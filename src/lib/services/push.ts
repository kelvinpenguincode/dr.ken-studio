import { createPrivateKey, createSign } from "crypto";
import { connect as http2Connect, type ClientHttp2Session } from "http2";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

type PushPayload = {
  title: string;
  body: string;
  requestId?: string;
};

export type ApnsSendResult = {
  ok: boolean;
  status?: number;
  reason?: string;
};

function isApnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      process.env.APNS_PRIVATE_KEY,
  );
}

/** TestFlight / App Store need production APNs. Debug builds use sandbox. */
function useProductionApns(): boolean {
  if (process.env.APNS_PRODUCTION === "true") return true;
  if (process.env.APNS_PRODUCTION === "false") return false;
  return process.env.VERCEL_ENV === "production";
}

let cachedJwt: { token: string; exp: number } | null = null;

/** Normalize a .p8 key pasted into Vercel (quoted, \\n, spaces, etc.). */
function normalizeApnsPrivateKey(raw: string): string {
  let key = raw.trim();

  // Strip wrapping quotes from env UIs
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Handle escaped newlines from dashboards
  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  // If someone pasted the key as one long line without breaks, rebuild PEM
  if (!key.includes("\n") && key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = key
      .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
      .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----");
    const match = key.match(
      /-----BEGIN PRIVATE KEY-----\n?([\s\S]*?)\n?-----END PRIVATE KEY-----/,
    );
    if (match) {
      const body = match[1].replace(/\s+/g, "");
      const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
      key = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
    }
  }

  if (
    !key.includes("-----BEGIN PRIVATE KEY-----") ||
    !key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "APNS_PRIVATE_KEY must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----",
    );
  }

  return key;
}

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) {
    return cachedJwt.token;
  }

  const keyId = process.env.APNS_KEY_ID!.trim();
  const teamId = process.env.APNS_TEAM_ID!.trim();
  const privateKeyPem = normalizeApnsPrivateKey(process.env.APNS_PRIVATE_KEY!);

  if (keyId.length !== 10) {
    console.warn("[push] APNS_KEY_ID should be 10 characters, got", keyId.length);
  }
  if (teamId.length !== 10) {
    console.warn("[push] APNS_TEAM_ID should be 10 characters, got", teamId.length);
  }

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString(
    "base64url",
  );
  const claims = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString(
    "base64url",
  );
  const unsigned = `${header}.${claims}`;

  const key = createPrivateKey(privateKeyPem);
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign({ key, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  const token = `${unsigned}.${signature}`;
  cachedJwt = { token, exp: now + 3500 };
  return token;
}

function apnsAuthority(): string {
  return useProductionApns()
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

/** APNs requires HTTP/2 — Node fetch/undici often fails with "fetch failed". */
function http2Request(
  authority: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let client: ClientHttp2Session | null = null;
    const timer = setTimeout(() => {
      client?.close();
      reject(new Error("APNs HTTP/2 request timed out"));
    }, 15000);

    try {
      client = http2Connect(authority);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }

    client.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    const req = client.request({
      ":method": "POST",
      ":path": path,
      ...headers,
    });

    let responseStatus = 0;
    let responseBody = "";

    req.on("response", (responseHeaders) => {
      responseStatus = Number(responseHeaders[":status"] ?? 0);
    });

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      responseBody += chunk;
    });

    req.on("end", () => {
      clearTimeout(timer);
      client?.close();
      resolve({ status: responseStatus, body: responseBody });
    });

    req.on("error", (error) => {
      clearTimeout(timer);
      client?.close();
      reject(error);
    });

    req.end(body);
  });
}

async function sendApns(
  deviceToken: string,
  payload: PushPayload,
): Promise<ApnsSendResult> {
  if (!isApnsConfigured()) {
    console.warn("[push] APNs env vars not configured — skipping send");
    return { ok: false, reason: "not_configured" };
  }

  const bundleId = process.env.APNS_BUNDLE_ID!;
  const authority = apnsAuthority();

  const body = JSON.stringify({
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      badge: 1,
    },
    requestId: payload.requestId,
  });

  try {
    const jwt = getApnsJwt();
    const response = await http2Request(
      authority,
      `/3/device/${deviceToken}`,
      {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body,
    );

    if (response.status === 410) {
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
      return { ok: false, status: 410, reason: "Gone" };
    }

    if (response.status < 200 || response.status >= 300) {
      console.error(
        "[push] APNs error",
        response.status,
        response.body,
        "topic=",
        bundleId,
        "host=",
        authority,
      );
      let reason = response.body || `HTTP ${response.status}`;
      try {
        reason =
          (JSON.parse(response.body) as { reason?: string }).reason ?? reason;
      } catch {
        /* keep text */
      }
      if (reason === "BadDeviceToken" || reason === "Unregistered") {
        await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
      }
      return { ok: false, status: response.status, reason };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    console.error("[push] APNs request failed", error);
    const message = error instanceof Error ? error.message : "request failed";
    return {
      ok: false,
      reason: message.includes("fetch failed")
        ? "APNs HTTP/2 connection failed"
        : message,
    };
  }
}

export async function registerPushToken(input: {
  token: string;
  platform?: string;
  userId?: string | null;
  /** undefined = leave unchanged on update; null = clear */
  watchRequestId?: string | null;
}) {
  const token = input.token.trim();
  if (!token) {
    throw new Error("Push token is required");
  }

  return prisma.devicePushToken.upsert({
    where: { token },
    update: {
      platform: input.platform ?? "ios",
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.watchRequestId !== undefined
        ? { watchRequestId: input.watchRequestId }
        : {}),
    },
    create: {
      token,
      platform: input.platform ?? "ios",
      userId: input.userId ?? null,
      watchRequestId: input.watchRequestId ?? null,
    },
  });
}

export async function unregisterPushToken(token: string) {
  await prisma.devicePushToken.deleteMany({
    where: { token: token.trim() },
  });
}

export async function notifyOrderStatusChange(
  requestId: string,
  status: OrderStatus,
  userId?: string | null,
) {
  const label = ORDER_STATUS_LABELS[status] ?? status;
  const payload: PushPayload = {
    title: "Order update",
    body: `${requestId} is now “${label}”.`,
    requestId,
  };

  const tokens = await prisma.devicePushToken.findMany({
    where: {
      OR: [
        ...(userId ? [{ userId }] : []),
        { watchRequestId: { equals: requestId, mode: "insensitive" } },
      ],
    },
  });

  if (tokens.length === 0) {
    console.info(
      "[push] no device tokens for",
      requestId,
      "userId=",
      userId ?? "none",
      "configured=",
      isApnsConfigured(),
    );
    return {
      sent: 0,
      attempted: 0,
      configured: isApnsConfigured(),
      results: [] as ApnsSendResult[],
    };
  }

  console.info(
    "[push] sending to",
    tokens.length,
    "device(s)",
    "production=",
    useProductionApns(),
    "bundle=",
    process.env.APNS_BUNDLE_ID,
    "requestId=",
    requestId,
  );

  const results: ApnsSendResult[] = [];
  let sent = 0;
  for (const row of tokens) {
    const result = await sendApns(row.token, payload);
    results.push(result);
    if (result.ok) sent += 1;
  }

  return { sent, attempted: tokens.length, configured: isApnsConfigured(), results };
}

export async function sendTestPushToAllDevices() {
  const tokens = await prisma.devicePushToken.findMany({ take: 20 });
  const payload: PushPayload = {
    title: "Test notification",
    body: "Dr. Ken Studio push is working.",
  };
  const results: Array<ApnsSendResult & { tokenPrefix: string }> = [];
  let sent = 0;
  for (const row of tokens) {
    const result = await sendApns(row.token, payload);
    results.push({ ...result, tokenPrefix: row.token.slice(0, 12) });
    if (result.ok) sent += 1;
  }
  return {
    sent,
    attempted: tokens.length,
    bundleId: process.env.APNS_BUNDLE_ID ?? null,
    production: useProductionApns(),
    results,
  };
}

export function getPushConfigStatus() {
  return {
    configured: isApnsConfigured(),
    production: useProductionApns(),
    bundleId: process.env.APNS_BUNDLE_ID ?? null,
    keyIdConfigured: Boolean(process.env.APNS_KEY_ID),
    teamIdConfigured: Boolean(process.env.APNS_TEAM_ID),
    privateKeyConfigured: Boolean(process.env.APNS_PRIVATE_KEY),
    expectedBundleNote:
      "APNS_BUNDLE_ID must exactly match the iOS app Bundle Identifier in Xcode (Signing & Capabilities).",
  };
}

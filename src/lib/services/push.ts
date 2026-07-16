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

function normalizeEnvString(raw: string | undefined | null): string {
  if (!raw) return "";
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function apnsBundleId(): string {
  return normalizeEnvString(process.env.APNS_BUNDLE_ID);
}

function isApnsConfigured(): boolean {
  return Boolean(
    normalizeEnvString(process.env.APNS_KEY_ID) &&
      normalizeEnvString(process.env.APNS_TEAM_ID) &&
      apnsBundleId() &&
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

  const keyId = normalizeEnvString(process.env.APNS_KEY_ID);
  const teamId = normalizeEnvString(process.env.APNS_TEAM_ID);
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

function apnsAuthority(production: boolean): string {
  return production
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

function parseApnsReason(body: string, status: number): string {
  if (!body) return `HTTP ${status}`;
  try {
    return (JSON.parse(body) as { reason?: string }).reason ?? body;
  } catch {
    return body;
  }
}

function shouldRetryOppositeApnsEnvironment(reason?: string): boolean {
  // Apple often returns BadDeviceToken (not only BadEnvironmentKeyInToken)
  // when a sandbox token is sent to production or the reverse.
  return (
    reason === "BadEnvironmentKeyInToken" ||
    reason === "BadDeviceToken"
  );
}

async function sendApnsOnce(
  deviceToken: string,
  payloadBody: string,
  production: boolean,
  topic: string,
  options?: { deleteOnHardFail?: boolean },
): Promise<ApnsSendResult> {
  const authority = apnsAuthority(production);
  const jwt = getApnsJwt();

  const response = await http2Request(
    authority,
    `/3/device/${deviceToken}`,
    {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    payloadBody,
  );

  if (response.status === 410) {
    if (options?.deleteOnHardFail !== false) {
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
    }
    return { ok: false, status: 410, reason: "Gone" };
  }

  if (response.status < 200 || response.status >= 300) {
    const reason = parseApnsReason(response.body, response.status);
    console.error(
      "[push] APNs error",
      response.status,
      reason,
      "topic=",
      topic,
      "host=",
      authority,
      "tokenLen=",
      deviceToken.length,
    );
    if (
      options?.deleteOnHardFail !== false &&
      (reason === "Unregistered" || reason === "Gone")
    ) {
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
    }
    return { ok: false, status: response.status, reason };
  }

  return { ok: true, status: response.status };
}

async function sendApns(
  deviceToken: string,
  payload: PushPayload,
  options?: { topic?: string | null; apsEnvironment?: string | null },
): Promise<ApnsSendResult> {
  if (!isApnsConfigured()) {
    console.warn("[push] APNs env vars not configured — skipping send");
    return { ok: false, reason: "not_configured" };
  }

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

  const topic =
    normalizeEnvString(options?.topic) ||
    apnsBundleId();

  // Prefer gateway from the phone’s signed aps-environment when known.
  let preferredProduction = useProductionApns();
  if (options?.apsEnvironment === "development") preferredProduction = false;
  if (options?.apsEnvironment === "production") preferredProduction = true;

  try {
    const first = await sendApnsOnce(deviceToken, body, preferredProduction, topic, {
      deleteOnHardFail: false,
    });
    if (first.ok || !shouldRetryOppositeApnsEnvironment(first.reason)) {
      if (
        !first.ok &&
        (first.reason === "BadDeviceToken" ||
          first.reason === "Unregistered" ||
          first.reason === "Gone")
      ) {
        await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
      }
      return first;
    }

    console.warn(
      "[push]",
      first.reason,
      "on",
      preferredProduction ? "production" : "sandbox",
      "topic=",
      topic,
      "— retrying opposite gateway",
    );
    const second = await sendApnsOnce(
      deviceToken,
      body,
      !preferredProduction,
      topic,
      { deleteOnHardFail: false },
    );
    if (!second.ok) {
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
      return {
        ...second,
        reason: `${first.reason}@${preferredProduction ? "prod" : "sandbox"} then ${second.reason}@${!preferredProduction ? "prod" : "sandbox"} (topic=${topic})`,
      };
    }
    return second;
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
  bundleId?: string | null;
  apsEnvironment?: string | null;
  /** undefined = leave unchanged on update; null = clear */
  watchRequestId?: string | null;
}) {
  // APNs tokens are hex; strip junk so we never save a mangled value
  const token = input.token.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (token.length < 64) {
    throw new Error("Push token looks invalid (too short)");
  }

  const bundleId = normalizeEnvString(input.bundleId) || null;
  const apsEnvironment = normalizeEnvString(input.apsEnvironment) || null;
  const expectedBundle = apnsBundleId();
  if (bundleId && expectedBundle && bundleId !== expectedBundle) {
    console.warn(
      "[push] device bundleId",
      bundleId,
      "does not match APNS_BUNDLE_ID",
      expectedBundle,
    );
  }

  return prisma.devicePushToken.upsert({
    where: { token },
    update: {
      platform: input.platform ?? "ios",
      ...(bundleId ? { bundleId } : {}),
      ...(apsEnvironment ? { apsEnvironment } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.watchRequestId !== undefined
        ? { watchRequestId: input.watchRequestId }
        : {}),
    },
    create: {
      token,
      platform: input.platform ?? "ios",
      bundleId,
      apsEnvironment,
      userId: input.userId ?? null,
      watchRequestId: input.watchRequestId ?? null,
    },
  });
}

export async function unregisterPushToken(token: string) {
  const normalized = token.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  await prisma.devicePushToken.deleteMany({
    where: {
      OR: [{ token: token.trim() }, ...(normalized ? [{ token: normalized }] : [])],
    },
  });
}

export async function clearAllDevicePushTokens() {
  const result = await prisma.devicePushToken.deleteMany();
  return { deleted: result.count };
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
    apnsBundleId(),
    "requestId=",
    requestId,
  );

  const results: ApnsSendResult[] = [];
  let sent = 0;
  for (const row of tokens) {
    const result = await sendApns(row.token, payload, {
      topic: row.bundleId ?? apnsBundleId(),
      apsEnvironment: row.apsEnvironment,
    });
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
  const results: Array<
    ApnsSendResult & {
      tokenPrefix: string;
      tokenLen: number;
      bundleId: string | null;
      apsEnvironment: string | null;
    }
  > = [];
  let sent = 0;
  for (const row of tokens) {
    const topic = row.bundleId || apnsBundleId();
    const result = await sendApns(row.token, payload, {
      topic,
      apsEnvironment: row.apsEnvironment,
    });
    results.push({
      ...result,
      tokenPrefix: row.token.slice(0, 12),
      tokenLen: row.token.length,
      bundleId: row.bundleId,
      apsEnvironment: row.apsEnvironment,
    });
    if (result.ok) sent += 1;
  }
  return {
    sent,
    attempted: tokens.length,
    bundleId: apnsBundleId() || null,
    production: useProductionApns(),
    results,
  };
}

export function getPushConfigStatus() {
  return {
    configured: isApnsConfigured(),
    production: useProductionApns(),
    bundleId: apnsBundleId() || null,
    keyIdConfigured: Boolean(normalizeEnvString(process.env.APNS_KEY_ID)),
    teamIdConfigured: Boolean(normalizeEnvString(process.env.APNS_TEAM_ID)),
    privateKeyConfigured: Boolean(process.env.APNS_PRIVATE_KEY),
    expectedBundleNote:
      "APNS_BUNDLE_ID must exactly match the iOS app Bundle Identifier in Xcode (Signing & Capabilities).",
  };
}

/**
 * APNs push — rewritten clean.
 *
 * Rules (from APNs HTTP/2 footguns):
 * - One brand-new HTTP/2 connection per notification
 * - Destroy the session before the next send (never reuse after errors)
 * - One gateway only — no “retry the other environment” on the same flow
 * - Topic = APNS_BUNDLE_ID (must match the app’s bundle id)
 */
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
  host?: string;
};

function trimEnv(raw: string | undefined | null): string {
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

function bundleId(): string {
  return trimEnv(process.env.APNS_BUNDLE_ID);
}

function isApnsConfigured(): boolean {
  return Boolean(
    trimEnv(process.env.APNS_KEY_ID) &&
      trimEnv(process.env.APNS_TEAM_ID) &&
      bundleId() &&
      process.env.APNS_PRIVATE_KEY,
  );
}

/** TestFlight / App Store → production. Xcode debug → set APNS_PRODUCTION=false. */
function useProductionApns(apsEnvironment?: string | null): boolean {
  if (apsEnvironment === "development") return false;
  if (apsEnvironment === "production") return true;
  if (process.env.APNS_PRODUCTION === "true") return true;
  if (process.env.APNS_PRODUCTION === "false") return false;
  return process.env.VERCEL_ENV === "production";
}

function normalizePrivateKey(raw: string): string {
  let key = trimEnv(raw);
  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

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

let cachedJwt: { token: string; exp: number } | null = null;

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) return cachedJwt.token;

  const keyId = trimEnv(process.env.APNS_KEY_ID);
  const teamId = trimEnv(process.env.APNS_TEAM_ID);
  const pem = normalizePrivateKey(process.env.APNS_PRIVATE_KEY!);

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString(
    "base64url",
  );
  const claims = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString(
    "base64url",
  );
  const unsigned = `${header}.${claims}`;

  const key = createPrivateKey(pem);
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

function hostFor(production: boolean): string {
  return production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

function destroySession(client: ClientHttp2Session | null): Promise<void> {
  if (!client) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    const timer = setTimeout(() => {
      try {
        client.destroy();
      } catch {
        /* ignore */
      }
      done();
    }, 500);
    try {
      client.close(() => {
        clearTimeout(timer);
        try {
          client.destroy();
        } catch {
          /* ignore */
        }
        done();
      });
    } catch {
      clearTimeout(timer);
      try {
        client.destroy();
      } catch {
        /* ignore */
      }
      done();
    }
  });
}

/** Fresh TCP/HTTP2 session → one POST → destroy. Never reuse the session. */
function postOnce(
  authority: string,
  deviceToken: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let client: ClientHttp2Session | null = null;
    let settled = false;

    const finish = async (
      err: Error | null,
      result?: { status: number; body: string },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await destroySession(client);
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      void finish(new Error("APNs HTTP/2 request timed out"));
    }, 15000);

    try {
      // No agent / no pooling — new connection every call.
      client = http2Connect(authority);
    } catch (error) {
      void finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    client.on("error", (error) => {
      void finish(error);
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      ...headers,
    });

    let status = 0;
    let responseBody = "";

    req.on("response", (responseHeaders) => {
      status = Number(responseHeaders[":status"] ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      void finish(null, { status, body: responseBody });
    });
    req.on("error", (error) => {
      void finish(error);
    });
    req.end(body);
  });
}

function parseReason(body: string, status: number): string {
  if (!body) return `HTTP ${status}`;
  try {
    return (JSON.parse(body) as { reason?: string }).reason ?? body;
  } catch {
    return body;
  }
}

async function sendApns(
  deviceToken: string,
  payload: PushPayload,
  options?: { topic?: string | null; apsEnvironment?: string | null },
): Promise<ApnsSendResult> {
  if (!isApnsConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const topic = trimEnv(options?.topic) || bundleId();
  const production = useProductionApns(options?.apsEnvironment);
  const authority = hostFor(production);
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      badge: 1,
    },
    requestId: payload.requestId,
  });

  try {
    const response = await postOnce(
      authority,
      deviceToken,
      {
        authorization: `bearer ${makeJwt()}`,
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body,
    );

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, host: authority };
    }

    const reason = parseReason(response.body, response.status);
    console.error(
      "[push] APNs",
      response.status,
      reason,
      "host=",
      authority,
      "topic=",
      topic,
      "tokenLen=",
      deviceToken.length,
    );

    if (
      response.status === 410 ||
      reason === "Unregistered" ||
      reason === "Gone"
    ) {
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
    }

    return { ok: false, status: response.status, reason, host: authority };
  } catch (error) {
    console.error("[push] APNs connection failed", error);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "request failed",
      host: authority,
    };
  }
}

export async function registerPushToken(input: {
  token: string;
  platform?: string;
  userId?: string | null;
  bundleId?: string | null;
  apsEnvironment?: string | null;
  watchRequestId?: string | null;
}) {
  const token = input.token.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (token.length < 64 || token.length % 2 !== 0 || token.length > 256) {
    throw new Error(
      `Push token length looks wrong (${token.length} chars). Expected even-length hex, 64–256.`,
    );
  }

  const deviceBundle = trimEnv(input.bundleId) || null;
  const apsEnvironment = trimEnv(input.apsEnvironment) || null;

  return prisma.devicePushToken.upsert({
    where: { token },
    update: {
      platform: input.platform ?? "ios",
      ...(deviceBundle ? { bundleId: deviceBundle } : {}),
      ...(apsEnvironment ? { apsEnvironment } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.watchRequestId !== undefined
        ? { watchRequestId: input.watchRequestId }
        : {}),
    },
    create: {
      token,
      platform: input.platform ?? "ios",
      bundleId: deviceBundle,
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
    return {
      sent: 0,
      attempted: 0,
      configured: isApnsConfigured(),
      results: [] as ApnsSendResult[],
    };
  }

  const results: ApnsSendResult[] = [];
  let sent = 0;
  for (const row of tokens) {
    // Sequential + fresh connection each time (never parallel on one session).
    const result = await sendApns(row.token, payload, {
      topic: row.bundleId || bundleId(),
      apsEnvironment: row.apsEnvironment,
    });
    results.push(result);
    if (result.ok) sent += 1;
  }

  return { sent, attempted: tokens.length, configured: isApnsConfigured(), results };
}

export async function sendTestPushToAllDevices() {
  const tokens = await prisma.devicePushToken.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
  });
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
    const result = await sendApns(row.token, payload, {
      topic: row.bundleId || bundleId(),
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
    bundleId: bundleId() || null,
    production: useProductionApns(),
    results,
  };
}

export function getPushConfigStatus() {
  return {
    configured: isApnsConfigured(),
    production: useProductionApns(),
    bundleId: bundleId() || null,
    keyIdConfigured: Boolean(trimEnv(process.env.APNS_KEY_ID)),
    teamIdConfigured: Boolean(trimEnv(process.env.APNS_TEAM_ID)),
    privateKeyConfigured: Boolean(process.env.APNS_PRIVATE_KEY),
    expectedBundleNote:
      "APNS_BUNDLE_ID must match the iOS app Bundle Identifier exactly.",
  };
}

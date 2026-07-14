import { createPrivateKey, createSign } from "crypto";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

type PushPayload = {
  title: string;
  body: string;
  requestId?: string;
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
  // Default: production on Vercel production deploys
  return process.env.VERCEL_ENV === "production";
}

let cachedJwt: { token: string; exp: number } | null = null;

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) {
    return cachedJwt.token;
  }

  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  const privateKeyPem = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n");

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

async function sendApns(deviceToken: string, payload: PushPayload): Promise<boolean> {
  if (!isApnsConfigured()) {
    console.warn("[push] APNs env vars not configured — skipping send");
    return false;
  }

  const bundleId = process.env.APNS_BUNDLE_ID!;
  const useSandbox = !useProductionApns();
  const host = useSandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";

  const body = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      badge: 1,
    },
    requestId: payload.requestId,
  };

  try {
    const response = await fetch(`${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${getApnsJwt()}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 410 || response.status === 400) {
      // Token invalid / expired — remove it
      await prisma.devicePushToken.deleteMany({ where: { token: deviceToken } });
      return false;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("[push] APNs error", response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[push] APNs request failed", error);
    return false;
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
    return { sent: 0, configured: isApnsConfigured() };
  }

  console.info(
    "[push] sending to",
    tokens.length,
    "device(s)",
    "production=",
    useProductionApns(),
    "requestId=",
    requestId,
  );

  let sent = 0;
  for (const row of tokens) {
    const ok = await sendApns(row.token, payload);
    if (ok) sent += 1;
  }

  return { sent, configured: isApnsConfigured() };
}

export function getPushConfigStatus() {
  return {
    configured: isApnsConfigured(),
    production: useProductionApns(),
    bundleId: process.env.APNS_BUNDLE_ID ?? null,
    keyIdConfigured: Boolean(process.env.APNS_KEY_ID),
    teamIdConfigured: Boolean(process.env.APNS_TEAM_ID),
    privateKeyConfigured: Boolean(process.env.APNS_PRIVATE_KEY),
  };
}

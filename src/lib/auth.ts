import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "fengjie_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export type AdminSession = {
  adminId: string;
  email: string;
  name: string | null;
  exp: number;
};

function getSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? null;
}

function sign(payload: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(session: Omit<AdminSession, "exp">): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp }),
    "utf8",
  ).toString("base64url");
  const signature = sign(payload);
  if (!signature) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return `${payload}.${signature}`;
}

export function parseAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (!expected) return null;
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;

    if (!session.exp || session.exp < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getAdminSessionCookieName(): string {
  return COOKIE_NAME;
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "fengjie_admin_session";
const USER_COOKIE = "drken_user_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type AdminSession = {
  adminId: string;
  email: string;
  name: string | null;
  exp: number;
};

export type UserSession = {
  userId: string;
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

function createToken(data: Record<string, unknown>, ttlMs: number): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ ...data, exp }), "utf8").toString("base64url");
  const signature = sign(payload);
  if (!signature) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return `${payload}.${signature}`;
}

function parseToken<T extends { exp: number }>(token: string | undefined): T | null {
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
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function createAdminSessionToken(session: Omit<AdminSession, "exp">): string {
  return createToken(session, SESSION_TTL_MS);
}

export function parseAdminSessionToken(token: string | undefined): AdminSession | null {
  return parseToken<AdminSession>(token);
}

export function getAdminSessionCookieName(): string {
  return ADMIN_COOKIE;
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

export function createUserSessionToken(session: Omit<UserSession, "exp">): string {
  return createToken(session, USER_SESSION_TTL_MS);
}

export function parseUserSessionToken(token: string | undefined): UserSession | null {
  return parseToken<UserSession>(token);
}

export function getUserSessionCookieName(): string {
  return USER_COOKIE;
}

/** Cookies for the iOS / web customer session */
export const userCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // lax works for Safari + native URLSession talking to your API host
  sameSite: "lax" as const,
  path: "/",
  maxAge: USER_SESSION_TTL_MS / 1000,
};

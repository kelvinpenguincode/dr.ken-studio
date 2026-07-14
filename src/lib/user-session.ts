import { getUserSessionCookieName, parseUserSessionToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function getUserSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getUserSessionCookieName())?.value;
  return parseUserSessionToken(token);
}

import { getAdminSessionCookieName, parseAdminSessionToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function getAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  return parseAdminSessionToken(token);
}

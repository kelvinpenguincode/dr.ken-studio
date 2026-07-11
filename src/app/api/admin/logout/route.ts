import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  const { cookies } = await import("next/headers");
  const { getAdminSessionCookieName } = await import("@/lib/auth");
  const cookieStore = await cookies();
  cookieStore.delete(getAdminSessionCookieName());
  return NextResponse.json({ success: true });
}

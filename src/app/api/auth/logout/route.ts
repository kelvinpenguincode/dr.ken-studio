import { getUserSessionCookieName } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(getUserSessionCookieName());
  return NextResponse.json({ success: true });
}

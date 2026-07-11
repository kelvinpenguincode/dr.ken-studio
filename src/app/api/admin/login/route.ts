import {
  adminCookieOptions,
  createAdminSessionToken,
  getAdminSessionCookieName,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/validations/order";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!admin) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createAdminSessionToken({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    });

    const cookieStore = await cookies();
    cookieStore.set(getAdminSessionCookieName(), token, adminCookieOptions);

    return NextResponse.json({
      email: admin.email,
      name: admin.name,
    });
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(getAdminSessionCookieName());
  return NextResponse.json({ success: true });
}

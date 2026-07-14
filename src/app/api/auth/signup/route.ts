import {
  createUserSessionToken,
  getUserSessionCookieName,
  userCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSignupSchema } from "@/lib/validations/order";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = userSignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.name?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        address: parsed.data.address?.trim() || null,
      },
    });

    const token = createUserSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const cookieStore = await cookies();
    cookieStore.set(getUserSessionCookieName(), token, userCookieOptions);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
    });
  } catch (error) {
    console.error("Signup failed", error);
    const message =
      error instanceof Error ? error.message : "Signup failed";
    if (message.includes("ADMIN_SESSION_SECRET")) {
      return NextResponse.json(
        { error: "Server misconfigured: ADMIN_SESSION_SECRET is missing on Vercel" },
        { status: 500 },
      );
    }
    if (
      message.includes("P2021") ||
      message.includes("does not exist") ||
      (message.toLowerCase().includes("relation") && message.toLowerCase().includes("users"))
    ) {
      return NextResponse.json(
        { error: "Database missing users table — run prisma db push" },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}

import {
  createUserSessionToken,
  getUserSessionCookieName,
  userCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userLoginSchema } from "@/lib/validations/order";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = userLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

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
    console.error("Login failed", error);
    const message =
      error instanceof Error ? error.message : "Login failed";
    if (message.includes("ADMIN_SESSION_SECRET")) {
      return NextResponse.json(
        { error: "Server misconfigured: ADMIN_SESSION_SECRET is missing on Vercel" },
        { status: 500 },
      );
    }
    if (
      message.includes("P2021") ||
      message.includes("does not exist") ||
      (message.toLowerCase().includes("relation") &&
        message.toLowerCase().includes("users"))
    ) {
      return NextResponse.json(
        { error: "Database missing users table — run prisma db push" },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

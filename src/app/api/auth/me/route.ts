import { prisma } from "@/lib/prisma";
import { getUserSessionFromCookies } from "@/lib/user-session";
import { userProfileSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getUserSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      address: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const session = await getUserSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = userProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone?.trim() || null,
        address: parsed.data.address?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile update failed", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

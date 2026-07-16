import { getUserSessionFromCookies } from "@/lib/user-session";
import { registerPushToken, unregisterPushToken } from "@/lib/services/push";
import { z } from "zod";
import { NextResponse } from "next/server";

const registerSchema = z.object({
  token: z.string().min(8, "Token is required"),
  platform: z.string().optional(),
  requestId: z.string().optional(),
  bundleId: z.string().optional(),
  apsEnvironment: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const hasRequestId = Object.prototype.hasOwnProperty.call(body, "requestId");
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid push token" }, { status: 400 });
    }

    const session = await getUserSessionFromCookies();
    const record = await registerPushToken({
      token: parsed.data.token,
      platform: parsed.data.platform ?? "ios",
      userId: session?.userId ?? null,
      bundleId: parsed.data.bundleId,
      apsEnvironment: parsed.data.apsEnvironment,
      watchRequestId: hasRequestId
        ? String(body.requestId ?? "").trim() || null
        : undefined,
    });

    return NextResponse.json({
      ok: true,
      id: record.id,
      linkedUser: Boolean(session?.userId),
      watchRequestId: record.watchRequestId,
      bundleId: record.bundleId,
      apsEnvironment: record.apsEnvironment,
    });
  } catch (error) {
    console.error("Push register failed", error);
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("P2021") ||
      message.includes("P2022") ||
      message.toLowerCase().includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error:
            "device_push_tokens table missing — run npx prisma db push (use DIRECT_URL)",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    await unregisterPushToken(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push unregister failed", error);
    return NextResponse.json({ error: "Failed to unregister" }, { status: 500 });
  }
}

import { requireAdminPermission } from "@/lib/admin-session";
import { getPushConfigStatus } from "@/lib/services/push";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdminPermission("admins.manage");
  if (error) return error;

  const config = getPushConfigStatus();

  try {
    const [tokenCount, linkedUsers, watchingOrders] = await Promise.all([
      prisma.devicePushToken.count(),
      prisma.devicePushToken.count({ where: { userId: { not: null } } }),
      prisma.devicePushToken.count({ where: { watchRequestId: { not: null } } }),
    ]);

    return NextResponse.json({
      ...config,
      tokenCount,
      linkedUsers,
      watchingOrders,
      hint: !config.configured
        ? "Add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_PRIVATE_KEY on Vercel, then redeploy."
        : config.production
          ? "Using production APNs (correct for TestFlight / App Store)."
          : "Using sandbox APNs — TestFlight builds will not receive pushes. Set APNS_PRODUCTION=true.",
    });
  } catch (err) {
    console.error("Push status failed", err);
    return NextResponse.json({
      ...config,
      tokenCount: 0,
      linkedUsers: 0,
      watchingOrders: 0,
      hint:
        "Could not read device_push_tokens — run npx prisma db push, then confirm APNs env vars on Vercel.",
    });
  }
}

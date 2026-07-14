import { requireAdminPermission } from "@/lib/admin-session";
import { getPushConfigStatus } from "@/lib/services/push";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdminPermission("admins.manage");
  if (error) return error;

  const [tokenCount, linkedUsers, watchingOrders] = await Promise.all([
    prisma.devicePushToken.count(),
    prisma.devicePushToken.count({ where: { userId: { not: null } } }),
    prisma.devicePushToken.count({ where: { watchRequestId: { not: null } } }),
  ]);

  return NextResponse.json({
    ...getPushConfigStatus(),
    tokenCount,
    linkedUsers,
    watchingOrders,
    hint: !getPushConfigStatus().configured
      ? "Add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_PRIVATE_KEY on Vercel, then redeploy."
      : getPushConfigStatus().production
        ? "Using production APNs (correct for TestFlight / App Store)."
        : "Using sandbox APNs — TestFlight builds will not receive pushes. Set APNS_PRODUCTION=true.",
  });
}

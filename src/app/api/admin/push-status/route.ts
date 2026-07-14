import { requireAdminPermission } from "@/lib/admin-session";
import {
  getPushConfigStatus,
  sendTestPushToAllDevices,
} from "@/lib/services/push";
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

    let hint = config.expectedBundleNote;
    if (!config.configured) {
      hint =
        "Add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_PRIVATE_KEY on Vercel, then redeploy.";
    } else if (!config.production) {
      hint =
        "Using sandbox APNs — TestFlight builds will not receive pushes. Set APNS_PRODUCTION=true.";
    } else if (tokenCount === 0) {
      hint =
        "APNs configured, but Devices is 0. On the phone: Enable order alerts / Notify me, then refresh this page.";
    } else {
      hint = `Production APNs ready · topic ${config.bundleId}. Use “Send test push” to verify.`;
    }

    return NextResponse.json({
      ...config,
      tokenCount,
      linkedUsers,
      watchingOrders,
      hint,
    });
  } catch (err) {
    console.error("Push status failed", err);
    return NextResponse.json({
      ...config,
      tokenCount: 0,
      linkedUsers: 0,
      watchingOrders: 0,
      hint:
        "Could not read device_push_tokens — run npx prisma db push (with DIRECT_URL), then confirm APNs env vars on Vercel.",
    });
  }
}

export async function POST() {
  const { error } = await requireAdminPermission("admins.manage");
  if (error) return error;

  try {
    const result = await sendTestPushToAllDevices();
    const firstFailure = result.results.find((row) => !row.ok);
    return NextResponse.json({
      ...result,
      hint: result.sent > 0
        ? `Sent ${result.sent}/${result.attempted} test notification(s).`
        : firstFailure?.reason === "TopicDisallowed" ||
            firstFailure?.reason === "DeviceTokenNotForTopic"
          ? `Bundle ID mismatch: APNS_BUNDLE_ID is “${result.bundleId}” but must match the app’s Bundle Identifier in Xcode exactly.`
          : firstFailure
            ? `APNs rejected the send: ${firstFailure.reason}`
            : "No device tokens registered yet.",
    });
  } catch (err) {
    console.error("Test push failed", err);
    return NextResponse.json({ error: "Test push failed" }, { status: 500 });
  }
}

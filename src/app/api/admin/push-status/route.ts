import { requireAdminPermission } from "@/lib/admin-session";
import {
  clearAllDevicePushTokens,
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
    const [tokenCount, linkedUsers, watchingOrders, devices] = await Promise.all([
      prisma.devicePushToken.count(),
      prisma.devicePushToken.count({ where: { userId: { not: null } } }),
      prisma.devicePushToken.count({ where: { watchRequestId: { not: null } } }),
      prisma.devicePushToken.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          token: true,
          bundleId: true,
          apsEnvironment: true,
          updatedAt: true,
        },
      }),
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
        "APNs configured, but Devices is 0. On the phone: Enable & sync order alerts until it says Registered with server, then refresh.";
    } else {
      hint = `Production APNs ready · topic ${config.bundleId}. Use “Send test push”. Copy a full device token below for Mac test-device-token.sh if push fails.`;
    }

    return NextResponse.json({
      ...config,
      tokenCount,
      linkedUsers,
      watchingOrders,
      devices: devices.map((row) => ({
        token: row.token,
        tokenLen: row.token.length,
        likelySimulator: row.token.length >= 150,
        bundleId: row.bundleId,
        apsEnvironment: row.apsEnvironment,
        updatedAt: row.updatedAt,
      })),
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
    const firstSuccess = result.results.find((row) => row.ok);
    const phoneEnv = firstFailure?.apsEnvironment ?? result.results[0]?.apsEnvironment;
    const phoneBundle = firstFailure?.bundleId ?? result.results[0]?.bundleId;
    const resultSummary = result.results
      .map(
        (row) =>
          `${row.ok ? "OK" : row.reason} · ${row.tokenLen}ch · ${row.tokenPrefix}…`,
      )
      .join(" | ");
    return NextResponse.json({
      ...result,
      hint: result.sent > 0
        ? `Sent ${result.sent}/${result.attempted}. Details: ${resultSummary}`
        : firstFailure?.reason === "TopicDisallowed" ||
            firstFailure?.reason === "DeviceTokenNotForTopic"
          ? `Bundle ID mismatch: APNS_BUNDLE_ID is “${result.bundleId}” but must match the app’s Bundle Identifier in Xcode exactly.`
          : firstFailure?.reason === "InvalidProviderToken"
            ? "InvalidProviderToken: APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY is wrong. Key ID + Team ID are each 10 characters; paste the full .p8 including BEGIN/END lines; Key ID must belong to that .p8 file."
            : firstFailure?.reason === "BadEnvironmentKeyInToken"
              ? "BadEnvironmentKeyInToken: phone token is sandbox but server used production (or reverse). For TestFlight set APNS_PRODUCTION=true, reinstall/enable alerts again, then retry."
              : firstFailure?.reason?.includes("BadEnvironmentKeyInToken") &&
                  firstFailure?.reason?.includes("BadDeviceToken")
                ? `Apple rejected this device token on both gateways (Mac test would too). This is not Vercel. Delete the TestFlight app, reboot the iPhone, reinstall ONLY from TestFlight, Clear tokens, sync — token must change. If Xcode/simulator still has the app, delete that too so only one install exists. Phone env="${phoneEnv ?? "unknown"}" bundle="${phoneBundle ?? result.bundleId}". Details: ${resultSummary}`
                : firstFailure?.reason?.includes("BadDeviceToken") ||
                    firstFailure?.reason === "Unregistered" ||
                    firstFailure?.reason === "Gone"
                  ? `BadDeviceToken after trying both APNs gateways. Check Vercel APNS_BUNDLE_ID is exactly the phone app’s Bundle ID (now “${result.bundleId}”), and that the APNs .p8 key belongs to the same Apple team as the app. Then Clear device tokens → phone Enable & sync → Send test push. Detail: ${firstFailure.reason}`
                  : firstFailure
                    ? `APNs rejected the send: ${firstFailure.reason}`
                    : "No device tokens registered yet.",
      firstSuccessTokenPrefix: firstSuccess?.tokenPrefix ?? null,
    });
  } catch (err) {
    console.error("Test push failed", err);
    return NextResponse.json({ error: "Test push failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const { error } = await requireAdminPermission("admins.manage");
  if (error) return error;

  try {
    const result = await clearAllDevicePushTokens();
    return NextResponse.json({
      ok: true,
      deleted: result.deleted,
      hint: `Cleared ${result.deleted} device token(s). On the phone: More → Enable & sync order alerts, then refresh this page.`,
    });
  } catch (err) {
    console.error("Clear push tokens failed", err);
    return NextResponse.json({ error: "Failed to clear tokens" }, { status: 500 });
  }
}

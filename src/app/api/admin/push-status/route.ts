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
        "Using sandbox APNs. For TestFlight set APNS_PRODUCTION=true and redeploy.";
    } else if (tokenCount === 0) {
      hint = "No device tokens yet. On the phone: Enable & sync, then refresh.";
    } else {
      hint = `Ready · topic ${config.bundleId} · production=${config.production}`;
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
      hint: "Could not read device_push_tokens — run npx prisma db push.",
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
    const summary = result.results
      .map(
        (row) =>
          `${row.ok ? "OK" : row.reason} @ ${row.host ?? "?"} · ${row.tokenLen}ch · ${row.tokenPrefix}…`,
      )
      .join(" | ");

    let hint: string;
    if (result.sent > 0) {
      hint = `Sent ${result.sent}/${result.attempted}. ${summary}`;
    } else if (!firstFailure) {
      hint = "No device tokens registered yet.";
    } else if (
      firstFailure.reason === "TopicDisallowed" ||
      firstFailure.reason === "DeviceTokenNotForTopic"
    ) {
      hint = `Topic mismatch. Vercel APNS_BUNDLE_ID="${result.bundleId}" must match the phone app bundle.`;
    } else if (firstFailure.reason === "InvalidProviderToken") {
      hint =
        "InvalidProviderToken: check APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY (.p8).";
    } else {
      hint = `APNs: ${firstFailure.reason} (host ${firstFailure.host ?? "?"}). Phone env=${firstFailure.apsEnvironment ?? "?"} bundle=${firstFailure.bundleId ?? result.bundleId}. ${summary}`;
    }

    return NextResponse.json({
      ...result,
      hint,
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
      hint: `Cleared ${result.deleted} token(s). Phone → Enable & sync, then retry.`,
    });
  } catch (err) {
    console.error("Clear push tokens failed", err);
    return NextResponse.json({ error: "Failed to clear tokens" }, { status: 500 });
  }
}

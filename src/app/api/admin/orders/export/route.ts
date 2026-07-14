import { requireAdminPermission } from "@/lib/admin-session";
import { exportOrdersToCsv } from "@/lib/services/orders";
import type { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { error } = await requireAdminPermission("orders.export");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as OrderStatus | null) ?? undefined;
    const productId = searchParams.get("productId") ?? undefined;

    const csv = await exportOrdersToCsv({ q, status, productId });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dr-ken-studio-orders-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("CSV export failed", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

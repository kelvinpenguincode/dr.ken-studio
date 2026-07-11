import { getAdminSessionFromCookies } from "@/lib/admin-session";
import { exportOrdersToCsv } from "@/lib/services/orders";
import type { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } catch (error) {
    console.error("CSV export failed", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

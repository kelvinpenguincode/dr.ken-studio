import { requireAdminPermission } from "@/lib/admin-session";
import { listOrdersForAdmin } from "@/lib/services/orders";
import type { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { error } = await requireAdminPermission("orders.view");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const status = (searchParams.get("status") as OrderStatus | null) ?? undefined;
    const productId = searchParams.get("productId") ?? undefined;

    const orders = await listOrdersForAdmin({ q, status, productId });
    return NextResponse.json(orders);
  } catch (err) {
    console.error("Failed to list admin orders", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

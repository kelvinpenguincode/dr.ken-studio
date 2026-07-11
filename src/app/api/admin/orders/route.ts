import { getAdminSessionFromCookies } from "@/lib/admin-session";
import { listOrdersForAdmin } from "@/lib/services/orders";
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

    const orders = await listOrdersForAdmin({ q, status, productId });
    return NextResponse.json(orders);
  } catch (error) {
    console.error("Failed to list admin orders", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

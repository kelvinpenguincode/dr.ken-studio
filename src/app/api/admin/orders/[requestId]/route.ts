import { requireAdminPermission } from "@/lib/admin-session";
import { getOrderByRequestId, updateOrderAsAdmin } from "@/lib/services/orders";
import { adminOrderUpdateSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { error } = await requireAdminPermission("orders.view");
  if (error) return error;

  try {
    const { requestId } = await context.params;
    const order = await getOrderByRequestId(requestId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("Failed to fetch admin order", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { actor, error } = await requireAdminPermission("orders.update");
  if (error || !actor) return error!;

  try {
    const { requestId } = await context.params;
    const body = await request.json();
    const parsed = adminOrderUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const order = await updateOrderAsAdmin(requestId, {
      ...parsed.data,
      adminEmail: actor.email,
      adminId: actor.id,
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error("Failed to update admin order", err);
    const message = err instanceof Error ? err.message : "Failed to update order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { getAdminSessionFromCookies } from "@/lib/admin-session";
import { getOrderByRequestId, updateOrderAsAdmin } from "@/lib/services/orders";
import { adminOrderUpdateSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { requestId } = await context.params;
    const order = await getOrderByRequestId(requestId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch admin order", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      adminEmail: session.email,
      adminId: session.adminId,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to update admin order", error);
    const message = error instanceof Error ? error.message : "Failed to update order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

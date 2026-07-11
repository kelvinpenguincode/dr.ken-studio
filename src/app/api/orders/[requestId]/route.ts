import {
  getOrderByRequestId,
  updateCustomerOrder,
} from "@/lib/services/orders";
import { isOrderEditable } from "@/lib/utils";
import { customerUpdateSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const order = await getOrderByRequestId(requestId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...order,
      editable: isOrderEditable(order.status),
    });
  } catch (error) {
    console.error("Failed to fetch order", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const existing = await getOrderByRequestId(requestId);

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!isOrderEditable(existing.status)) {
      return NextResponse.json(
        { error: "This order can no longer be edited because processing has started." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = customerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const order = await updateCustomerOrder(requestId, parsed.data);

    return NextResponse.json({
      ...order,
      editable: isOrderEditable(order.status),
    });
  } catch (error) {
    console.error("Failed to update order", error);
    const message = error instanceof Error ? error.message : "Failed to update order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

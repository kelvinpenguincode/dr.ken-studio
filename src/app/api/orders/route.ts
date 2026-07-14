import { createOrderRequest } from "@/lib/services/orders";
import { getUserSessionFromCookies } from "@/lib/user-session";
import { orderRequestSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await getUserSessionFromCookies();
    const order = await createOrderRequest(parsed.data, session?.userId);

    return NextResponse.json({
      requestId: order.requestId,
      lookupToken: order.lookupToken,
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Failed to create order", error);
    return NextResponse.json({ error: "Failed to submit order" }, { status: 500 });
  }
}

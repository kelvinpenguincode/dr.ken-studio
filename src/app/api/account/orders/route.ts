import { claimOrderForUser, listOrdersForUser } from "@/lib/services/orders";
import { getUserSessionFromCookies } from "@/lib/user-session";
import { claimOrderSchema } from "@/lib/validations/order";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getUserSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await listOrdersForUser(session.userId);
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const session = await getUserSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = claimOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a request ID or order number" }, { status: 400 });
    }

    const order = await claimOrderForUser(session.userId, parsed.data.orderNumber);
    return NextResponse.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to claim order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

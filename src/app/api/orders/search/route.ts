import { findOrderByLookup } from "@/lib/services/orders";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query?.trim()) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const order = await findOrderByLookup(query);

    if (!order) {
      return NextResponse.json({ error: "No matching order found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

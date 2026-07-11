import { getActiveProducts } from "@/lib/services/orders";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await getActiveProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to load products", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

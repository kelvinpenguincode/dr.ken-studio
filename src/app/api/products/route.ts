import { getActiveProducts } from "@/lib/services/orders";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await getActiveProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to load products", error);
    const message = error instanceof Error ? error.message : String(error);
    let hint =
      "Check DATABASE_URL on Vercel and run npx prisma db push + npm run db:seed";
    if (message.includes("P1001") || message.toLowerCase().includes("can't reach")) {
      hint =
        "Database unreachable — use Supabase Session pooler URI (port 5432) with ?sslmode=require";
    } else if (
      message.includes("P2021") ||
      message.includes("P2022") ||
      message.toLowerCase().includes("does not exist")
    ) {
      hint = "Schema missing columns/tables — run npx prisma db push then npm run db:seed";
    }

    return NextResponse.json(
      {
        error: "Failed to load products",
        hint,
        // Helps debug from the phone without opening Vercel logs
        detail: message.slice(0, 240),
      },
      { status: 500 },
    );
  }
}

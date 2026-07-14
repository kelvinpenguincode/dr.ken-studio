import { getAdminSessionFromCookies } from "@/lib/admin-session";
import { generateSalesReport } from "@/lib/services/orders";
import { formatCny, formatUsd } from "@/lib/pricing";
import type { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const status = (searchParams.get("status") as OrderStatus | null) ?? undefined;

    const report = await generateSalesReport({ from, to, status });

    if (format === "csv") {
      const headers = [
        "Product",
        "Quantity",
        "Unit Price USD",
        "Revenue USD",
        "Revenue CNY",
      ];
      const rows = report.products.map((product) => [
        product.name,
        String(product.quantity),
        product.unitPrice.toFixed(2),
        product.revenue.toFixed(2),
        (product.revenue * 6.8).toFixed(2),
      ]);
      rows.push([
        "TOTAL",
        "",
        "",
        report.totalUsd.toFixed(2),
        report.totalCny.toFixed(2),
      ]);

      const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="dr-ken-studio-report-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ...report,
      totalUsdFormatted: formatUsd(report.totalUsd),
      totalCnyFormatted: formatCny(report.totalCny),
    });
  } catch (error) {
    console.error("Report generation failed", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

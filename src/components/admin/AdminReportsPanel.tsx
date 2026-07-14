"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatCny, formatUsd } from "@/lib/pricing";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { useState } from "react";

type ReportData = {
  orderCount: number;
  totalUsd: number;
  totalCny: number;
  products: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    revenue: number;
  }>;
};

export function AdminReportsPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    return params;
  }

  async function generateReport() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports?${buildParams().toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to generate report");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    window.location.href = `/api/admin/reports?${buildParams().toString()}&format=csv`;
  }

  return (
    <Card title="Sales reports">
      <p className="mb-4 text-sm text-muted">
        Generate product revenue reports using catalog prices. CNY uses USD × 6.8.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="From date"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Input
          label="To date"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <Select
          label="Status"
          placeholder="All statuses"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <div className="flex items-end gap-2">
          <Button type="button" onClick={generateReport} disabled={loading} className="flex-1">
            {loading ? "Generating..." : "Generate"}
          </Button>
          <Button type="button" variant="secondary" onClick={downloadCsv}>
            CSV
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {report ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-cream/40 px-4 py-3">
              <p className="text-xs text-muted">Orders</p>
              <p className="text-xl font-semibold">{report.orderCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/40 px-4 py-3">
              <p className="text-xs text-muted">Total USD</p>
              <p className="text-xl font-semibold">{formatUsd(report.totalUsd)}</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/40 px-4 py-3">
              <p className="text-xs text-muted">Total CNY</p>
              <p className="text-xl font-semibold">{formatCny(report.totalCny)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-cream/50 text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Revenue USD</th>
                  <th className="px-3 py-2 font-medium">Revenue CNY</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((product) => (
                  <tr key={product.name} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2">{product.quantity}</td>
                    <td className="px-3 py-2">{formatUsd(product.unitPrice)}</td>
                    <td className="px-3 py-2">{formatUsd(product.revenue)}</td>
                    <td className="px-3 py-2">{formatCny(product.revenue * 6.8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

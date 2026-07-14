"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ORDER_STATUS_LABELS, groupProductsByCategory } from "@/lib/utils";
import type { ProductOption } from "@/types/order";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type AdminFiltersProps = {
  products: ProductOption[];
  canExport?: boolean;
};

export function AdminFilters({ products, canExport = true }: AdminFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [productId, setProductId] = useState(searchParams.get("productId") ?? "");

  function buildParams() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (productId) params.set("productId", productId);
    return params;
  }

  function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    router.push(`/admin?${buildParams().toString()}`);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setProductId("");
    router.push("/admin");
  }

  function exportCsv() {
    window.location.href = `/api/admin/orders/export?${buildParams().toString()}`;
  }

  const hasFilters = Boolean(q || status || productId);

  return (
    <form
      onSubmit={applyFilters}
      className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Search & filter</h2>
          <p className="text-xs text-muted">
            Find by request ID, order number, phone, recipient, or product
          </p>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-accent hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          placeholder="Request ID, phone, name..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
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
        <Select
          label="Product"
          placeholder="All products"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          groups={groupProductsByCategory(products)}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            Apply
          </Button>
          {canExport ? (
            <Button type="button" variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

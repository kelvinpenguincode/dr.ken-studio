"use client";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { calculateOrderTotals, formatCny, formatUsd } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";
import type { OrderDetail } from "@/types/order";
import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const CURRENT_STATUSES: OrderStatus[] = [
  "SUBMITTED",
  "REVIEWED",
  "ERROR_NEEDS_CORRECTION",
  "PROCESSING",
  "READY_FOR_DELIVERY",
];

const PAST_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

export function MyOrdersClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimValue, setClaimValue] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);

  async function loadOrders() {
    const response = await fetch("/api/account/orders");
    if (response.status === 401) {
      router.push("/login?next=/account/orders");
      return;
    }
    const data = await response.json();
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentOrders = useMemo(
    () => orders.filter((order) => CURRENT_STATUSES.includes(order.status)),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => PAST_STATUSES.includes(order.status)),
    [orders],
  );

  async function claimOrder(event: React.FormEvent) {
    event.preventDefault();
    setClaimMessage("");
    setClaimError("");
    setClaiming(true);
    try {
      const response = await fetch("/api/account/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: claimValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to claim order");
      }
      setClaimMessage(`Order ${data.requestId} linked to your account.`);
      setClaimValue("");
      await loadOrders();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Failed to claim order");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <PageShell className="pt-16">
        <p className="text-center text-sm text-muted">Loading orders...</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="pt-16">
      <PageTitle>My orders</PageTitle>
      <div className="flex justify-center gap-3 text-sm">
        <Link href="/account" className="text-accent hover:underline">
          Profile
        </Link>
        <span className="text-muted">·</span>
        <Link href="/" className="text-accent hover:underline">
          New order
        </Link>
      </div>

      <Card title="Claim a guest order">
        <p className="mb-3 text-sm text-muted">
          Submitted as a guest? Enter your request ID or incoming order number to add it
          to this account (only if it is not already linked).
        </p>
        <form onSubmit={claimOrder} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Request ID or order number"
              value={claimValue}
              onChange={(event) => setClaimValue(event.target.value)}
              placeholder="FJ-XXXXXXXX or tracking number"
            />
          </div>
          <Button type="submit" disabled={claiming}>
            {claiming ? "Linking..." : "Add to my account"}
          </Button>
        </form>
        {claimMessage ? <div className="mt-3"><Alert variant="success">{claimMessage}</Alert></div> : null}
        {claimError ? <div className="mt-3"><Alert variant="error">{claimError}</Alert></div> : null}
      </Card>

      <OrderGroup title="Current orders" orders={currentOrders} empty="No current orders." />
      <OrderGroup title="Past orders / history" orders={pastOrders} empty="No past orders yet." />
    </PageShell>
  );
}

function OrderGroup({
  title,
  orders,
  empty,
}: {
  title: string;
  orders: OrderDetail[];
  empty: string;
}) {
  return (
    <Card title={title}>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const totals = calculateOrderTotals(order);
            return (
              <Link
                key={order.id}
                href={`/search?q=${encodeURIComponent(order.requestId)}`}
                className="block cursor-pointer rounded-xl border border-border p-4 transition-colors hover:border-accent/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.requestId}</p>
                    <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-4">
                  <OrderStatusTracker status={order.status} compact />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatUsd(totals.usd)} · {formatCny(totals.cny)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

import { ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";
import Link from "next/link";

type AdminStatsProps = {
  total: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  activeStatus?: string;
};

const STAT_ORDER: OrderStatus[] = [
  "SUBMITTED",
  "REVIEWED",
  "ERROR_NEEDS_CORRECTION",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

export function AdminStats({ total, byStatus, activeStatus }: AdminStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <StatCard
        href="/admin"
        label="All orders"
        value={total}
        active={!activeStatus}
      />
      {STAT_ORDER.map((status) => (
        <StatCard
          key={status}
          href={`/admin?status=${status}`}
          label={ORDER_STATUS_LABELS[status]}
          value={byStatus[status] ?? 0}
          active={activeStatus === status}
        />
      ))}
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  active,
}: {
  href: string;
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border px-4 py-3 transition-colors ${
        active
          ? "border-accent bg-accent text-white shadow-sm"
          : "border-border bg-white text-foreground hover:border-accent/40 hover:bg-cream/40"
      }`}
    >
      <p className={`text-xs font-medium ${active ? "text-white/80" : "text-muted"}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

type StatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ORDER_STATUS_COLORS[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

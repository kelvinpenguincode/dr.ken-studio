import type { OrderStatus } from "@prisma/client";
import { cn, ORDER_STATUS_LABELS } from "@/lib/utils";

/** Happy-path steps shown on the tracker. */
export const ORDER_PROGRESS_STEPS: OrderStatus[] = [
  "SUBMITTED",
  "REVIEWED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "COMPLETED",
];

const MICRO_LABELS: Partial<Record<OrderStatus, string>> = {
  SUBMITTED: "Sent",
  REVIEWED: "Review",
  PROCESSING: "Work",
  READY_FOR_DELIVERY: "Ready",
  COMPLETED: "Done",
};

export function getOrderProgressIndex(status: OrderStatus): number {
  if (status === "ERROR_NEEDS_CORRECTION") {
    return 1;
  }
  if (status === "CANCELLED") {
    return -1;
  }
  return ORDER_PROGRESS_STEPS.indexOf(status);
}

export function OrderStatusTracker({
  status,
  className,
  compact = false,
}: {
  status: OrderStatus;
  className?: string;
  compact?: boolean;
}) {
  const currentIndex = getOrderProgressIndex(status);
  const isCancelled = status === "CANCELLED";
  const needsCorrection = status === "ERROR_NEEDS_CORRECTION";
  const stepCount = ORDER_PROGRESS_STEPS.length;
  const last = Math.max(stepCount - 1, 1);
  const activeIndex =
    status === "COMPLETED" ? stepCount - 1 : Math.max(0, currentIndex);
  const displayStep = Math.min(activeIndex + 1, stepCount);
  const progressFraction = status === "COMPLETED" ? 1 : activeIndex / last;

  if (isCancelled) {
    return (
      <div
        className={cn(
          "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
          className,
        )}
      >
        Order cancelled
      </div>
    );
  }

  return (
    <div
      className={cn("w-full", className)}
      role="group"
      aria-label={`Order status ${ORDER_STATUS_LABELS[status]}, step ${displayStep} of ${stepCount}`}
    >
      {needsCorrection ? (
        <p className="mb-3 text-sm font-medium text-amber-800">
          Needs correction — update the order, then we’ll continue processing.
        </p>
      ) : null}

      <div className={cn("flex items-baseline gap-2", compact ? "mb-2" : "mb-3")}>
        <p
          className={cn(
            "min-w-0 truncate font-semibold",
            compact ? "text-sm" : "text-base",
            needsCorrection ? "text-amber-800" : "text-foreground",
          )}
        >
          {ORDER_STATUS_LABELS[status]}
        </p>
        <span className="ml-auto shrink-0 rounded-full bg-cream-dark px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted">
          {displayStep}/{stepCount}
        </span>
      </div>

      <div className={cn("relative", compact ? "h-5" : "h-7")}>
        <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-accent/80 to-accent shadow-[0_0_8px_rgba(154,107,47,0.35)] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(progressFraction * 100, 2)}%` }}
        />

        {ORDER_PROGRESS_STEPS.map((step, index) => {
          const isDone =
            status === "COMPLETED" ||
            (!needsCorrection && activeIndex > index) ||
            (needsCorrection && index < 1);
          const isCurrent =
            (needsCorrection && index === 1) ||
            (!needsCorrection && activeIndex === index);
          const left = `${(index / last) * 100}%`;

          return (
            <span
              key={step}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left }}
            >
              {isCurrent ? (
                <span
                  className={cn(
                    "absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    needsCorrection ? "bg-amber-500/20" : "bg-accent/20",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative block rounded-full border-[1.5px] transition-all duration-300",
                  isCurrent ? "size-3.5 border-transparent" : "size-2.5",
                  isDone || isCurrent
                    ? needsCorrection && isCurrent
                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)]"
                      : "bg-accent shadow-[0_0_8px_rgba(154,107,47,0.45)]"
                    : "border-border bg-white",
                )}
              />
            </span>
          );
        })}
      </div>

      {!compact ? (
        <div className="mt-2 flex">
          {ORDER_PROGRESS_STEPS.map((step, index) => {
            const isDone =
              status === "COMPLETED" ||
              (!needsCorrection && activeIndex > index) ||
              (needsCorrection && index < 1);
            const isCurrent =
              (needsCorrection && index === 1) ||
              (!needsCorrection && activeIndex === index);

            return (
              <span
                key={step}
                className={cn(
                  "min-w-0 flex-1 truncate text-center text-[10px] leading-tight tracking-wide",
                  isDone || isCurrent
                    ? "font-semibold text-foreground"
                    : "font-medium text-muted/80",
                )}
              >
                {MICRO_LABELS[step] ?? ORDER_STATUS_LABELS[step]}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

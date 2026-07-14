import type { OrderStatus } from "@prisma/client";
import { cn, ORDER_STATUS_LABELS } from "@/lib/utils";

/** Happy-path steps shown on the tracker (Amazon-style). */
export const ORDER_PROGRESS_STEPS: OrderStatus[] = [
  "SUBMITTED",
  "REVIEWED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "COMPLETED",
];

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
  const completedThrough =
    status === "COMPLETED" ? ORDER_PROGRESS_STEPS.length - 1 : currentIndex;

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
    <div className={cn("w-full", className)}>
      {needsCorrection ? (
        <p className="mb-3 text-sm font-medium text-amber-800">
          Needs correction — update the order, then we’ll continue processing.
        </p>
      ) : null}

      <ol className="flex w-full items-start">
        {ORDER_PROGRESS_STEPS.map((step, index) => {
          const isDone =
            status === "COMPLETED" ||
            (!needsCorrection && completedThrough > index) ||
            (needsCorrection && index < 1);
          const isCurrent =
            (needsCorrection && index === 1) ||
            (!needsCorrection &&
              status !== "COMPLETED" &&
              completedThrough === index);
          const isLast = index === ORDER_PROGRESS_STEPS.length - 1;

          return (
            <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    index === 0
                      ? "bg-transparent"
                      : isDone || isCurrent
                        ? "bg-accent"
                        : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold sm:size-8 sm:text-xs",
                    isDone && "border-accent bg-accent text-white",
                    isCurrent &&
                      !isDone &&
                      (needsCorrection
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-accent bg-white text-accent shadow-[0_0_0_4px_rgba(184,149,90,0.2)]"),
                    !isDone && !isCurrent && "border-border bg-white text-muted",
                  )}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isLast ? "bg-transparent" : isDone ? "bg-accent" : "bg-border",
                  )}
                />
              </div>

              <span
                className={cn(
                  "mt-2 px-0.5 text-center text-[10px] leading-tight sm:text-xs",
                  compact && "sr-only sm:not-sr-only",
                  isDone || isCurrent
                    ? "font-semibold text-foreground"
                    : "text-muted",
                )}
              >
                {compact && step === "READY_FOR_DELIVERY"
                  ? "Ready"
                  : ORDER_STATUS_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-center text-sm text-muted">
        Current status:{" "}
        <span className="font-medium text-foreground">
          {ORDER_STATUS_LABELS[status]}
        </span>
      </p>
    </div>
  );
}

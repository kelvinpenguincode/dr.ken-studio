import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
  title?: string;
  action?: ReactNode;
};

export function Card({ children, className, highlighted, title, action }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm sm:p-6",
        highlighted ? "border-accent/60" : "border-border",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="text-base font-semibold text-accent sm:text-lg">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

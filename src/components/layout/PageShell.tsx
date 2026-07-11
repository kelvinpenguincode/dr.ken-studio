import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-cream px-4 py-8 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto w-full max-w-3xl space-y-6">{children}</div>
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-center font-serif text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
      {children}
    </h1>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-muted">{children}</p>;
}

export function Alert({
  children,
  variant = "warning",
}: {
  children: ReactNode;
  variant?: "warning" | "info" | "error" | "success";
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-green-200 bg-green-50 text-green-900",
  };

  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[variant])}>
      {children}
    </div>
  );
}

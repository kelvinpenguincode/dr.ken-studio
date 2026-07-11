"use client";

import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

type CollapsibleProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium text-foreground hover:bg-cream-dark/40 sm:px-6"
      >
        <span>{title}</span>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="border-t border-border px-4 py-4 sm:px-6">{children}</div> : null}
    </div>
  );
}

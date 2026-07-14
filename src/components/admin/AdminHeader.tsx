"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminHeader({
  email,
  title = "Orders",
  subtitle,
  canManageAdmins = false,
  canExport = false,
  showOrdersLink = false,
  exportQuery,
}: {
  email: string;
  title?: string;
  subtitle?: string;
  canManageAdmins?: boolean;
  canExport?: boolean;
  showOrdersLink?: boolean;
  exportQuery?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="rounded-2xl border border-border bg-white px-4 py-4 shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-accent uppercase">
            Dr. Ken Studio Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            {subtitle ?? `Signed in as ${email}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showOrdersLink ? (
            <Link
              href="/admin"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-cream/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-cream-dark"
            >
              Orders
            </Link>
          ) : null}
          {canManageAdmins ? (
            <Link
              href="/admin/team"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-cream/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-cream-dark"
            >
              Team
            </Link>
          ) : null}
          {canExport ? (
            <a
              href={`/api/admin/orders/export${exportQuery ? `?${exportQuery}` : ""}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-cream/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-cream-dark"
            >
              Export CSV
            </a>
          ) : null}
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-cream/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-cream-dark"
          >
            Public site
          </Link>
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}

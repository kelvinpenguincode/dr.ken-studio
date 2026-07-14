import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { AdminReportsPanel } from "@/components/admin/AdminReportsPanel";
import { AdminStats } from "@/components/admin/AdminStats";
import { hasPermission } from "@/lib/admin-permissions";
import { getAdminActor } from "@/lib/admin-session";
import {
  getActiveProducts,
  getAdminOrderStats,
  listOrdersForAdmin,
} from "@/lib/services/orders";
import type { OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: OrderStatus;
    productId?: string;
  }>;
};

export default async function AdminDashboardPage({ searchParams }: AdminPageProps) {
  const actor = await getAdminActor();
  if (!actor) {
    redirect("/admin/login");
  }
  if (!hasPermission(actor.permissions, "orders.view")) {
    redirect("/admin/login");
  }

  const filters = await searchParams;
  const [orders, products, stats] = await Promise.all([
    listOrdersForAdmin(filters),
    getActiveProducts(),
    getAdminOrderStats(),
  ]);

  const canManageAdmins = hasPermission(actor.permissions, "admins.manage");
  const canExport = hasPermission(actor.permissions, "orders.export");
  const canViewReports = hasPermission(actor.permissions, "reports.view");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e8_0%,#f4efe6_40%,#efe7db_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <AdminHeader
          email={actor.email}
          title="Order dashboard"
          subtitle={`${ROLE_SUBTITLE(actor.role)} · ${actor.email}`}
          canManageAdmins={canManageAdmins}
        />

        <AdminStats
          total={stats.total}
          byStatus={stats.byStatus}
          activeStatus={filters.status}
        />

        <Suspense fallback={<div className="text-sm text-muted">Loading filters...</div>}>
          <AdminFilters products={products} canExport={canExport} />
        </Suspense>

        {canViewReports ? <AdminReportsPanel /> : null}

        <AdminOrdersTable orders={orders} />
      </div>
    </div>
  );
}

function ROLE_SUBTITLE(role: string) {
  if (role === "OWNER") return "Owner access";
  if (role === "MANAGER") return "Manager access";
  return "Staff access";
}

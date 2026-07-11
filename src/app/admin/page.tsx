import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { AdminStats } from "@/components/admin/AdminStats";
import { getAdminSessionFromCookies } from "@/lib/admin-session";
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
  const session = await getAdminSessionFromCookies();
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await searchParams;
  const [orders, products, stats] = await Promise.all([
    listOrdersForAdmin(filters),
    getActiveProducts(),
    getAdminOrderStats(),
  ]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e8_0%,#f4efe6_40%,#efe7db_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <AdminHeader
          email={session.email}
          title="Order dashboard"
          subtitle={`Review submissions, update status, and export CSV · ${session.email}`}
        />

        <AdminStats
          total={stats.total}
          byStatus={stats.byStatus}
          activeStatus={filters.status}
        />

        <Suspense fallback={<div className="text-sm text-muted">Loading filters...</div>}>
          <AdminFilters products={products} />
        </Suspense>

        <AdminOrdersTable orders={orders} />
      </div>
    </div>
  );
}

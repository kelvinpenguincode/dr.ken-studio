import { AdminOrderDetail } from "@/components/admin/AdminOrderDetail";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { hasPermission } from "@/lib/admin-permissions";
import { getAdminActor } from "@/lib/admin-session";
import { getOrderByRequestId } from "@/lib/services/orders";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AdminOrderPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const actor = await getAdminActor();
  if (!actor) {
    redirect("/admin/login");
  }
  if (!hasPermission(actor.permissions, "orders.view")) {
    redirect("/admin");
  }

  const { requestId } = await params;
  const order = await getOrderByRequestId(requestId);

  if (!order) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e8_0%,#f4efe6_40%,#efe7db_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <Link
            href="/admin"
            className="inline-flex text-sm font-medium text-accent hover:underline"
          >
            ← Back to dashboard
          </Link>
          <AdminHeader
            email={actor.email}
            title="Order detail"
            subtitle={`Manage status, issues, and notes for ${order.requestId}`}
            canManageAdmins={hasPermission(actor.permissions, "admins.manage")}
            showOrdersLink
          />
        </div>
        <AdminOrderDetail order={order} />
      </div>
    </div>
  );
}

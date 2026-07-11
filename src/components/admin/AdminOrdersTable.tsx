import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";
import Link from "next/link";

type AdminOrderListItem = {
  id: string;
  requestId: string;
  formFillerName: string;
  status: OrderStatus;
  createdAt: string | Date;
  incomingOrders: Array<{
    orderNumber: string;
    pickupCode: string;
    products: Array<{ product: { name: string }; quantity: number }>;
  }>;
  recipients: Array<{ name: string; phone: string; address: string }>;
};

type AdminOrdersTableProps = {
  orders: AdminOrderListItem[];
};

export function AdminOrdersTable({ orders }: AdminOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">No orders found</p>
        <p className="mt-1 text-sm text-muted">
          Try clearing filters or wait for a new submission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted">
          Showing <span className="font-medium text-foreground">{orders.length}</span>{" "}
          {orders.length === 1 ? "order" : "orders"}
        </p>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/orders/${order.requestId}`}
            className="block rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{order.requestId}</p>
                <p className="mt-1 text-sm text-muted">{formatDateTime(order.createdAt)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="text-muted">Filler:</span> {order.formFillerName}
              </p>
              <p>
                <span className="text-muted">Recipients:</span>{" "}
                {order.recipients.map((r) => r.name).join(", ") || "—"}
              </p>
              <p>
                <span className="text-muted">Orders:</span>{" "}
                {order.incomingOrders.map((item) => item.orderNumber).join(", ") || "—"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-cream/60 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Request ID</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Form Filler</th>
                <th className="px-4 py-3 font-medium">Incoming #</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/70 transition-colors last:border-0 hover:bg-cream/30"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {order.requestId}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3">{order.formFillerName}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-[180px] truncate">
                      {order.incomingOrders.map((item) => item.orderNumber).join(", ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[180px]">
                      <p className="truncate">
                        {order.recipients.map((r) => r.name).join(", ") || "—"}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {order.recipients.map((r) => r.phone).join(", ")}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/orders/${order.requestId}`}
                      className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

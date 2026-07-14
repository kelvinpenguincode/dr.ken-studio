import type { OrderDetail } from "@/types/order";
import {
  ADMIN_ERROR_LABELS,
  ORDER_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils";
import {
  CNY_RATE,
  calculateOrderTotals,
  formatCny,
  formatUsd,
  getProductPriceUsd,
} from "@/lib/pricing";
import { Card } from "@/components/ui/Card";

type OrderSummaryProps = {
  order: OrderDetail;
};

export function OrderSummary({ order }: OrderSummaryProps) {
  const totals = calculateOrderTotals(order);

  return (
    <div className="space-y-4">
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SummaryItem label="Request ID" value={order.requestId} />
          <SummaryItem label="Status" value={ORDER_STATUS_LABELS[order.status]} />
          <SummaryItem label="Submitted" value={formatDateTime(order.createdAt)} />
          <SummaryItem label="Form Filler Name" value={order.formFillerName} />
          {order.user ? (
            <SummaryItem
              label="Linked account"
              value={order.user.name ? `${order.user.name} (${order.user.email})` : order.user.email}
              className="sm:col-span-2"
            />
          ) : (
            <SummaryItem label="Linked account" value="Guest (not linked)" className="sm:col-span-2" />
          )}
        </dl>
      </Card>

      <Card title="Incoming orders">
        <div className="space-y-4">
          {order.incomingOrders.map((incoming, index) => (
            <div key={incoming.id} className="rounded-xl border border-border p-4">
              <p className="mb-2 text-sm font-semibold">Item #{index + 1}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <SummaryItem label="Order number" value={incoming.orderNumber} />
                <SummaryItem label="Pickup code" value={incoming.pickupCode} />
              </dl>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {incoming.products.map((product) => (
                  <li key={product.id}>
                    {product.product.name} × {product.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recipient information">
        <div className="space-y-4">
          {order.recipients.map((recipient, index) => (
            <div key={recipient.id} className="rounded-xl border border-border p-4">
              <p className="mb-2 text-sm font-semibold">Recipient #{index + 1}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <SummaryItem label="Name" value={recipient.name} />
                <SummaryItem label="Phone" value={recipient.phone} />
                <SummaryItem label="Address" value={recipient.address} className="sm:col-span-2" />
                {recipient.notes ? (
                  <SummaryItem label="Notes" value={recipient.notes} className="sm:col-span-2" />
                ) : null}
              </dl>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {recipient.products.map((product) => {
                  const unit = getProductPriceUsd(
                    product.product.name,
                    Number(product.product.priceUsd),
                  );
                  return (
                    <li key={product.id}>
                      {product.product.name} × {product.quantity}{" "}
                      <span className="text-xs">
                        ({formatUsd(unit)} each)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Order total">
        <div className="space-y-1 text-sm">
          <p className="text-lg font-semibold text-foreground">
            {formatUsd(totals.usd)}
          </p>
          <p className="text-muted">
            ≈ {formatCny(totals.cny)}{" "}
            <span className="text-xs">(USD × {CNY_RATE})</span>
          </p>
          <p className="text-xs text-muted">
            Total is based on recipient delivery products.
          </p>
        </div>
      </Card>

      {order.adminErrors.length > 0 ? (
        <Card title="Review notes">
          <ul className="space-y-2 text-sm text-red-700">
            {order.adminErrors.map((error) => (
              <li key={error.id}>• {ADMIN_ERROR_LABELS[error.errorType]}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

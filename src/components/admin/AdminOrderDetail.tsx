"use client";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { OrderSummary } from "@/components/orders/OrderSummary";
import { Alert } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  ADMIN_ERROR_LABELS,
  ORDER_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils";
import type { OrderDetail } from "@/types/order";
import type { AdminErrorType, OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ERROR_OPTIONS = Object.entries(ADMIN_ERROR_LABELS).map(([value, label]) => ({
  value: value as AdminErrorType,
  label,
}));

type AdminOrderDetailProps = {
  order: OrderDetail;
};

export function AdminOrderDetail({ order: initialOrder }: AdminOrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [statusNote, setStatusNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [errors, setErrors] = useState<AdminErrorType[]>(
    order.adminErrors.map((item) => item.errorType),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function toggleError(errorType: AdminErrorType) {
    setErrors((current) =>
      current.includes(errorType)
        ? current.filter((item) => item !== errorType)
        : [...current, errorType],
    );
  }

  async function handleSave() {
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${order.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note: statusNote || undefined,
          adminNote: adminNote || undefined,
          errors,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update order");
      }

      setOrder(data);
      setStatus(data.status);
      setStatusNote("");
      setAdminNote("");
      setErrors(data.adminErrors.map((item: { errorType: AdminErrorType }) => item.errorType));
      setMessage("Order updated successfully.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update order");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Request
            </p>
            <h2 className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {order.requestId}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Submitted {formatDateTime(order.createdAt)} · Filler: {order.formFillerName}
            </p>
          </div>
          <StatusBadge status={order.status} className="self-start px-3 py-1 text-sm" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <OrderSummary order={order} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card title="Update status">
            <div className="space-y-4">
              <Select
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus)}
                options={Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <Textarea
                label="Status change note"
                placeholder="Optional note for status history"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
              />
            </div>
          </Card>

          <Card title="Mark issues">
            <div className="grid gap-2">
              {ERROR_OPTIONS.map((option) => {
                const checked = errors.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-red-200 bg-red-50 text-red-900"
                        : "border-border bg-white hover:bg-cream/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={checked}
                      onChange={() => toggleError(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </Card>

          <Card title="Internal admin note">
            <Textarea
              label="Add note"
              placeholder="Visible to admins only"
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
            />
            {order.adminNotes.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {order.adminNotes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-border bg-cream/40 px-3 py-2">
                    <p className="text-foreground">{note.content}</p>
                    <p className="mt-1 text-xs">
                      {note.admin?.name ?? note.admin?.email ?? "Admin"} ·{" "}
                      {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">No internal notes yet.</p>
            )}
          </Card>

          {order.statusHistory.length > 0 ? (
            <Card title="Status history">
              <ol className="space-y-3">
                {order.statusHistory.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={entry.status} />
                        <span className="text-xs text-muted">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted">
                        {entry.changedBy ?? "System"}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {message ? <Alert variant="success">{message}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}

          <Button onClick={handleSave} disabled={isSaving} fullWidth className="py-3">
            {isSaving ? "Saving..." : "Save admin updates"}
          </Button>
        </div>
      </div>
    </div>
  );
}

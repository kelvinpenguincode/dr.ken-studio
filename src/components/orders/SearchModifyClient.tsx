"use client";

import { OrderSummary } from "@/components/orders/OrderSummary";
import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  customerUpdateSchema,
  type CustomerUpdateFormValues,
} from "@/lib/validations/order";
import { groupProductsByCategory } from "@/lib/utils";
import type { OrderDetail, ProductOption } from "@/types/order";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

type SearchModifyClientProps = {
  initialQuery: string;
  initialOrder: OrderDetail | null;
  editable: boolean;
  products: ProductOption[];
};

export function SearchModifyClient({
  initialQuery,
  initialOrder,
  editable: initialEditable,
  products,
}: SearchModifyClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState(initialOrder);
  const [editable, setEditable] = useState(initialEditable);
  const [searchError, setSearchError] = useState(
    initialQuery && !initialOrder ? "No matching order found." : "",
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CustomerUpdateFormValues>({
    resolver: zodResolver(customerUpdateSchema),
    defaultValues: order
      ? {
          recipients: order.recipients.map((recipient) => ({
            id: recipient.id,
            name: recipient.name,
            phone: recipient.phone,
            address: recipient.address,
            notes: recipient.notes ?? "",
            products: recipient.products.map((product) => ({
              id: product.id,
              productId: product.productId,
              quantity: product.quantity,
            })),
          })),
        }
      : { recipients: [] },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "recipients",
  });

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError("Enter a request ID or order number.");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  async function handleSave(values: CustomerUpdateFormValues) {
    if (!order) return;
    setSaveError("");
    setSaveMessage("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/orders/${order.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save changes");
      }

      setOrder(data);
      setEditable(data.editable);
      setSaveMessage("Your changes have been saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <PageTitle>Find / modify submitted orders</PageTitle>

      <Card>
        <form onSubmit={handleSearch} className="space-y-3">
          <Input
            label="Order Number (any incoming tracking number is acceptable)"
            placeholder="Enter the order number to search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            error={searchError}
          />
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {order ? (
        <div className="space-y-4">
          {!editable ? (
            <Alert variant="info">
              Editing is locked because this order is now{" "}
              <strong>{order.status.replaceAll("_", " ").toLowerCase()}</strong>. Contact support
              if you need help.
            </Alert>
          ) : (
            <Alert variant="warning">
              You can edit recipient details, notes, and product quantities until the order moves
              to Processing.
            </Alert>
          )}

          <OrderSummary order={order} />

          {editable ? (
            <Card title="Edit recipient details">
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                {fields.map((field, index) => {
                  const recipientErrors = form.formState.errors.recipients?.[index];
                  return (
                    <div key={field.id} className="space-y-4 rounded-xl border border-border p-4">
                      <p className="text-sm font-semibold">Recipient #{index + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Name"
                          error={recipientErrors?.name?.message}
                          {...form.register(`recipients.${index}.name`)}
                        />
                        <Input
                          label="Phone"
                          error={recipientErrors?.phone?.message}
                          {...form.register(`recipients.${index}.phone`)}
                        />
                      </div>
                      <Input
                        label="Address"
                        error={recipientErrors?.address?.message}
                        {...form.register(`recipients.${index}.address`)}
                      />
                      <Textarea
                        label="Notes"
                        error={recipientErrors?.notes?.message}
                        {...form.register(`recipients.${index}.notes`)}
                      />

                      {order.recipients[index]?.products.map((product, productIndex) => (
                        <div
                          key={product.id}
                          className="grid gap-3 sm:grid-cols-[1fr_120px]"
                        >
                          <Select
                            label="Product"
                            groups={groupProductsByCategory(products)}
                            error={
                              recipientErrors?.products?.[productIndex]?.productId?.message
                            }
                            {...form.register(
                              `recipients.${index}.products.${productIndex}.productId`,
                            )}
                          />
                          <Input
                            label="Quantity"
                            type="number"
                            min={1}
                            error={
                              recipientErrors?.products?.[productIndex]?.quantity?.message
                            }
                            {...form.register(
                              `recipients.${index}.products.${productIndex}.quantity`,
                              { valueAsNumber: true },
                            )}
                          />
                          <input
                            type="hidden"
                            {...form.register(`recipients.${index}.products.${productIndex}.id`)}
                          />
                        </div>
                      ))}
                      <input type="hidden" {...form.register(`recipients.${index}.id`)} />
                    </div>
                  );
                })}

                {saveMessage ? <Alert variant="success">{saveMessage}</Alert> : null}
                {saveError ? <Alert variant="error">{saveError}</Alert> : null}

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Link
        href="/"
        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground"
      >
        Back to new order form
      </Link>
    </PageShell>
  );
}

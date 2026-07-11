"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { groupProductsByCategory } from "@/lib/utils";
import type { ProductOption } from "@/types/order";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { OrderRequestFormValues } from "@/lib/validations/order";

type ProductRowProps = {
  prefix: `incomingOrders.${number}.products` | `recipients.${number}.products`;
  index: number;
  products: ProductOption[];
  register: UseFormRegister<OrderRequestFormValues>;
  errors?: FieldErrors<OrderRequestFormValues>;
  onRemove: () => void;
  canRemove: boolean;
};

export function ProductRow({
  prefix,
  index,
  products,
  register,
  errors,
  onRemove,
  canRemove,
}: ProductRowProps) {
  const productError = getNestedError(errors, `${prefix}.${index}.productId`);
  const quantityError = getNestedError(errors, `${prefix}.${index}.quantity`);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-start">
      <Select
        label="Product"
        groups={groupProductsByCategory(products)}
        error={productError}
        {...register(`${prefix}.${index}.productId`)}
      />
      <Input
        label="Quantity"
        type="number"
        min={1}
        error={quantityError}
        {...register(`${prefix}.${index}.quantity`, { valueAsNumber: true })}
      />
      {canRemove ? (
        <div className="flex items-end pb-1">
          <Button type="button" variant="danger" onClick={onRemove} className="px-2 py-1 text-xs">
            ×
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function getNestedError(errors: FieldErrors<OrderRequestFormValues> | undefined, path: string) {
  if (!errors) return undefined;
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, errors);

  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: string }).message ?? "");
  }

  return undefined;
}

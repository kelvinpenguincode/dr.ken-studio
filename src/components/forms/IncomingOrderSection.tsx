"use client";

import { ProductRow } from "@/components/forms/ProductRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { OrderRequestFormValues } from "@/lib/validations/order";
import type { ProductOption } from "@/types/order";
import {
  type Control,
  type FieldErrors,
  useFieldArray,
  type UseFormRegister,
} from "react-hook-form";

type IncomingOrderSectionProps = {
  control: Control<OrderRequestFormValues>;
  register: UseFormRegister<OrderRequestFormValues>;
  errors: FieldErrors<OrderRequestFormValues>;
  products: ProductOption[];
};

export function IncomingOrderSection({
  control,
  register,
  errors,
  products,
}: IncomingOrderSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "incomingOrders",
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Receive some information</h3>

      {fields.map((field, index) => (
        <IncomingOrderCard
          key={field.id}
          index={index}
          control={control}
          register={register}
          errors={errors}
          products={products}
          onRemove={() => remove(index)}
          canRemove={fields.length > 1}
        />
      ))}

      <Button
        type="button"
        variant="dashed"
        fullWidth
        onClick={() =>
          append({
            orderNumber: "",
            pickupCode: "",
            products: [{ productId: "", quantity: 1 }],
          })
        }
      >
        + Add the incoming order form
      </Button>

      {errors.incomingOrders?.message ? (
        <p className="text-xs text-red-600">{errors.incomingOrders.message}</p>
      ) : null}
    </div>
  );
}

function IncomingOrderCard({
  index,
  control,
  register,
  errors,
  products,
  onRemove,
  canRemove,
}: {
  index: number;
  control: Control<OrderRequestFormValues>;
  register: UseFormRegister<OrderRequestFormValues>;
  errors: FieldErrors<OrderRequestFormValues>;
  products: ProductOption[];
  onRemove: () => void;
  canRemove: boolean;
}) {
  const productFields = useFieldArray({
    control,
    name: `incomingOrders.${index}.products`,
  });

  const orderErrors = errors.incomingOrders?.[index];

  return (
    <Card
      title={`Item #${index + 1}`}
      action={
        canRemove ? (
          <Button type="button" variant="danger" onClick={onRemove} className="px-2 py-1 text-xs">
            Delete
          </Button>
        ) : null
      }
      className="bg-cream/30"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Order number"
            placeholder="Enter the order number"
            error={orderErrors?.orderNumber?.message}
            {...register(`incomingOrders.${index}.orderNumber`)}
          />
          <Input
            label="Pickup code"
            placeholder="Enter the pickup code"
            error={orderErrors?.pickupCode?.message}
            {...register(`incomingOrders.${index}.pickupCode`)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Introducing a product</p>
          {productFields.fields.map((productField, productIndex) => (
            <ProductRow
              key={productField.id}
              prefix={`incomingOrders.${index}.products`}
              index={productIndex}
              products={products}
              register={register}
              errors={errors}
              canRemove={productFields.fields.length > 1}
              onRemove={() => productFields.remove(productIndex)}
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              productFields.append({
                productId: "",
                quantity: 1,
              })
            }
          >
            + Add products
          </Button>
          {orderErrors?.products?.message ? (
            <p className="text-xs text-red-600">{orderErrors.products.message}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

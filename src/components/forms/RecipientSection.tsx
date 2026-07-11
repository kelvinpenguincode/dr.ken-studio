"use client";

import { ProductRow } from "@/components/forms/ProductRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { OrderRequestFormValues } from "@/lib/validations/order";
import type { ProductOption } from "@/types/order";
import {
  type Control,
  type FieldErrors,
  useFieldArray,
  type UseFormRegister,
} from "react-hook-form";

type RecipientSectionProps = {
  control: Control<OrderRequestFormValues>;
  register: UseFormRegister<OrderRequestFormValues>;
  errors: FieldErrors<OrderRequestFormValues>;
  products: ProductOption[];
};

export function RecipientSection({
  control,
  register,
  errors,
  products,
}: RecipientSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "recipients",
  });

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Recipient information</h3>

      {fields.map((field, index) => (
        <RecipientCard
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
            name: "",
            phone: "",
            address: "",
            notes: "",
            products: [{ productId: "", quantity: 1 }],
          })
        }
      >
        + Add recipients
      </Button>

      {errors.recipients?.message ? (
        <p className="text-xs text-red-600">{errors.recipients.message}</p>
      ) : null}
    </div>
  );
}

function RecipientCard({
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
    name: `recipients.${index}.products`,
  });

  const recipientErrors = errors.recipients?.[index];

  return (
    <Card
      title={`Recipient #${index + 1}`}
      action={
        canRemove ? (
          <Button type="button" variant="danger" onClick={onRemove} className="px-2 py-1 text-xs">
            Delete
          </Button>
        ) : null
      }
      className="bg-cream/20"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="Recipient's name"
            error={recipientErrors?.name?.message}
            {...register(`recipients.${index}.name`)}
          />
          <Input
            label="Contact phone number"
            placeholder="Phone number"
            error={recipientErrors?.phone?.message}
            {...register(`recipients.${index}.phone`)}
          />
        </div>

        <Input
          label="Address"
          placeholder="Delivery address"
          error={recipientErrors?.address?.message}
          {...register(`recipients.${index}.address`)}
        />

        <div className="space-y-3">
          {productFields.fields.map((productField, productIndex) => (
            <ProductRow
              key={productField.id}
              prefix={`recipients.${index}.products`}
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
          {recipientErrors?.products?.message ? (
            <p className="text-xs text-red-600">{recipientErrors.products.message}</p>
          ) : null}
        </div>

        <Textarea
          label="Note"
          placeholder="Remarks (optional)"
          error={recipientErrors?.notes?.message}
          {...register(`recipients.${index}.notes`)}
        />
      </div>
    </Card>
  );
}

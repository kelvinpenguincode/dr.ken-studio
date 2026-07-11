"use client";

import { IncomingOrderSection } from "@/components/forms/IncomingOrderSection";
import { RecipientSection } from "@/components/forms/RecipientSection";
import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { Input } from "@/components/ui/Input";
import { SearchOrdersSection } from "@/components/forms/SearchOrdersSection";
import {
  defaultOrderValues,
  orderRequestSchema,
  type OrderRequestFormValues,
} from "@/lib/validations/order";
import type { ProductOption } from "@/types/order";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

type OrderRequestFormProps = {
  products: ProductOption[];
};

export function OrderRequestForm({ products }: OrderRequestFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderRequestFormValues>({
    resolver: zodResolver(orderRequestSchema),
    defaultValues: defaultOrderValues,
  });

  async function onSubmit(values: OrderRequestFormValues) {
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit order");
      }

      router.push(`/confirmation/${data.requestId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <PageTitle>Dr. Ken Studio</PageTitle>

      <Collapsible title="Find/modify submitted orders">
        <SearchOrdersSection />
      </Collapsible>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card highlighted title="Submit a new order">
          <div className="space-y-6">
            <Input
              label="Form Filler Name"
              placeholder="For example: Xiao Chen, Amin"
              error={errors.formFillerName?.message}
              {...register("formFillerName")}
            />

            <IncomingOrderSection
              control={control}
              register={register}
              errors={errors}
              products={products}
            />

            <RecipientSection
              control={control}
              register={register}
              errors={errors}
              products={products}
            />
          </div>
        </Card>

        {submitError ? <Alert variant="error">{submitError}</Alert> : null}

        <Button type="submit" fullWidth className="py-3 text-base" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit your order"}
        </Button>
      </form>

      <div className="pt-2 text-center">
        <Link
          href="/admin"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Admin
        </Link>
      </div>
    </PageShell>
  );
}

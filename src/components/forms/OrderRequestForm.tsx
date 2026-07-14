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
  clearOrderDraft,
  loadOrderDraft,
  saveOrderDraft,
} from "@/lib/order-draft";
import {
  defaultOrderValues,
  orderRequestSchema,
  type OrderRequestFormValues,
} from "@/lib/validations/order";
import type { ProductOption } from "@/types/order";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type OrderRequestFormProps = {
  products: ProductOption[];
};

export function OrderRequestForm({ products }: OrderRequestFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrderRequestFormValues>({
    resolver: zodResolver(orderRequestSchema),
    defaultValues: defaultOrderValues,
  });

  // Restore draft after signup / refresh, and autofill from profile when logged in
  useEffect(() => {
    const draft = loadOrderDraft<OrderRequestFormValues>();
    if (draft) {
      reset(draft);
      setRestoredDraft(true);
    }

    async function autofillProfile() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        const user = data.user;
        if (!user) return;

        const current = draft ?? defaultOrderValues;
        if (!current.formFillerName && user.name) {
          setValue("formFillerName", user.name);
        }
        if (user.name || user.phone || user.address) {
          const first = current.recipients?.[0];
          if (first && !first.name && user.name) {
            setValue("recipients.0.name", user.name);
          }
          if (first && !first.phone && user.phone) {
            setValue("recipients.0.phone", user.phone);
          }
          if (first && !first.address && user.address) {
            setValue("recipients.0.address", user.address);
          }
        }
      } catch {
        // ignore
      }
    }

    autofillProfile();
  }, [reset, setValue]);

  // Persist form draft so signup can restore it
  useEffect(() => {
    const subscription = watch((values) => {
      saveOrderDraft(values);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

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

      clearOrderDraft();
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

      {restoredDraft ? (
        <Alert variant="info">
          Your previous form entries were restored after signing up.
        </Alert>
      ) : null}

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

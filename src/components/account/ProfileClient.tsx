"use client";

import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { userProfileSchema } from "@/lib/validations/order";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type ProfileValues = z.infer<typeof userProfileSchema>;

export function ProfileClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: { name: "", phone: "", address: "" },
  });

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (!data.user) {
        router.push("/login?next=/account");
        return;
      }
      setEmail(data.user.email);
      reset({
        name: data.user.name ?? "",
        phone: data.user.phone ?? "",
        address: data.user.address ?? "",
      });
      setLoading(false);
    }
    load();
  }, [reset, router]);

  async function onSubmit(values: ProfileValues) {
    setMessage("");
    setError("");
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to save profile");
      return;
    }
    setMessage("Profile saved. These details can autofill new orders.");
  }

  if (loading) {
    return (
      <PageShell className="pt-16">
        <p className="text-center text-sm text-muted">Loading profile...</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="pt-16">
      <PageTitle>My profile</PageTitle>
      <div className="flex justify-center gap-3 text-sm">
        <Link href="/account/orders" className="text-accent hover:underline">
          My orders
        </Link>
        <span className="text-muted">·</span>
        <Link href="/" className="text-accent hover:underline">
          New order
        </Link>
      </div>

      <Card title="Personal details">
        <p className="mb-4 text-sm text-muted">Signed in as {email}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" error={errors.name?.message} {...register("name")} />
          <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
          <Input label="Address" error={errors.address?.message} {...register("address")} />
          {message ? <Alert variant="success">{message}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}

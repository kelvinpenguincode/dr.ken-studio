"use client";

import { Alert, PageShell, PageTitle } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { loadOrderDraft } from "@/lib/order-draft";
import { userLoginSchema, userSignupSchema } from "@/lib/validations/order";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type LoginValues = z.infer<typeof userLoginSchema>;
type SignupValues = z.infer<typeof userSignupSchema>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  if (mode === "signup") {
    return <SignupForm />;
  }
  return <LoginForm />;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(userLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    window.localStorage.removeItem("drken_skip_auth_prompt");
    router.push(next);
    router.refresh();
  }

  return (
    <PageShell className="flex items-center">
      <PageTitle>Log in</PageTitle>
      <Card className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Need an account?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/" className="text-muted hover:underline">
            Continue as guest
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [error, setError] = useState("");

  const draft = loadOrderDraft<{
    formFillerName?: string;
    recipients?: Array<{ phone?: string; address?: string }>;
  }>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(userSignupSchema),
    defaultValues: {
      email: "",
      password: "",
      name: draft?.formFillerName ?? "",
      phone: draft?.recipients?.[0]?.phone ?? "",
      address: draft?.recipients?.[0]?.address ?? "",
    },
  });

  async function onSubmit(values: SignupValues) {
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    window.localStorage.removeItem("drken_skip_auth_prompt");
    router.push(next);
    router.refresh();
  }

  return (
    <PageShell className="flex items-center">
      <PageTitle>Create account</PageTitle>
      <Card className="mx-auto w-full max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" placeholder="Your name" error={errors.name?.message} {...register("name")} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Input label="Phone (optional)" error={errors.phone?.message} {...register("phone")} />
          <Input label="Address (optional)" error={errors.address?.message} {...register("address")} />
          {draft ? (
            <Alert variant="info">
              Your in-progress order form will be restored after you sign up.
            </Alert>
          ) : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/" className="text-muted hover:underline">
            Continue as guest
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}

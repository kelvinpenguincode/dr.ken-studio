import { AuthForm } from "@/components/account/AuthForm";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading...</div>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}

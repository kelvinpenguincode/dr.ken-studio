"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UserInfo = {
  id: string;
  email: string;
  name: string | null;
};

const SKIP_KEY = "drken_skip_auth_prompt";

export function AccountBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (!cancelled) {
          setUser(data.user ?? null);
          const skipped =
            typeof window !== "undefined" &&
            window.localStorage.getItem(SKIP_KEY) === "1";
          setShowPrompt(!data.user && !skipped && !isAdminRoute && !isAuthRoute);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [pathname, isAdminRoute, isAuthRoute]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "DELETE" });
    setUser(null);
    setMenuOpen(false);
    router.refresh();
    if (pathname.startsWith("/account")) {
      router.push("/");
    }
  }

  function skipAuth() {
    window.localStorage.setItem(SKIP_KEY, "1");
    setShowPrompt(false);
  }

  if (isAdminRoute) return null;

  return (
    <>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 sm:top-4 sm:right-4">
        {!loaded ? null : user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-white/95 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur hover:border-accent"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] truncate sm:inline">
                {user.name || user.email}
              </span>
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                <Link
                  href="/account"
                  className="block cursor-pointer px-4 py-2.5 text-sm hover:bg-cream"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/account/orders"
                  className="block cursor-pointer px-4 py-2.5 text-sm hover:bg-cream"
                  onClick={() => setMenuOpen(false)}
                >
                  My orders
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-red-600 hover:bg-cream"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-white/95 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur hover:border-accent"
            >
              Log in
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(pathname)}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      {showPrompt && !user ? (
        <div className="fixed inset-x-3 top-16 z-40 mx-auto max-w-lg rounded-2xl border border-border bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:left-auto sm:w-full">
          <p className="text-sm font-semibold text-foreground">Save your progress?</p>
          <p className="mt-1 text-xs text-muted">
            Create an account to autofill details, track orders, and claim past guest
            submissions later. Or continue as a guest.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => router.push(`/signup?next=${encodeURIComponent(pathname)}`)}
            >
              Sign up
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}
            >
              Log in
            </Button>
            <Button type="button" variant="ghost" onClick={skipAuth}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

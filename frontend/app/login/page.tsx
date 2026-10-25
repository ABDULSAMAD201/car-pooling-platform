"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPortal, landingPathForRole } from "@/lib/portals";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);

      // Honour `next` only when it belongs to a portal this account can use,
      // so a driver cannot be pushed into the passenger portal (or vice versa).
      const requested = nextPath ? nextPath.split("?")[0] : null;
      const requestedPortal = requested?.startsWith("/driver") ? "driver" : "rider";
      const allowed =
        requested && canAccessPortal(user.role, requestedPortal) ? requested : null;

      router.push(allowed ?? landingPathForRole(user.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign you in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-sm">
          C
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to book and manage your rides.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
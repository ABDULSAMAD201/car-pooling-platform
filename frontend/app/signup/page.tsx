"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { landingPathForRole } from "@/lib/portals";
import type { UserRole } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "rider", label: "Rider", description: "I want to book rides" },
  { value: "driver", label: "Driver", description: "I want to offer rides" },
  { value: "both", label: "Both", description: "Ride and drive" },
];

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("rider");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return "Enter a valid email address.";
    }
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const user = await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
      });
      // Drivers land in the driver portal; passengers in the booking portal.
      router.push(landingPathForRole(user.role));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create your account."
      );
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Join Carpool to book rides or share your commute.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" htmlFor="full_name">
            <Input
              id="full_name"
              name="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>

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

          <Field label="Phone" htmlFor="phone" hint="Optional — used for ride notifications.">
            <Input
              id="phone"
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="+1 555 0100"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="password" hint="At least 8 characters.">
            <Input
              id="password"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <Field label="Confirm password" htmlFor="confirm_password">
            <Input
              id="confirm_password"
              type="password"
              name="confirm_password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>

          <Field
            label="I want to"
            htmlFor="role"
            hint="This decides which portal you get. You can change it later in your profile."
          >
            <Select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.description}
                </option>
              ))}
            </Select>
          </Field>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
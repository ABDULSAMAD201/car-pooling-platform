"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { UserRole } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { LatLng } from "@/lib/geo";
import { ClientOnlyMap } from "@/components/location-map";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";

export default function ProfilePage() {
  const { user, loading, updateProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("rider");
  const [homeLabel, setHomeLabel] = useState("");
  const [home, setHome] = useState<LatLng | null>(null);
  const [pickingHome, setPickingHome] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? "");
    setPhone(user.phone ?? "");
    setRole(user.role);
    setHomeLabel(user.home_label ?? "");
    setHome(
      user.home_lat != null && user.home_lng != null
        ? { lat: user.home_lat, lng: user.home_lng }
        : null
    );
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
        home_label: homeLabel.trim(),
        home_lat: home?.lat ?? null,
        home_lng: home?.lng ?? null,
      });
      setSuccess("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">Sign in to view your profile</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your profile stores the details used when you book or offer rides.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Profile"
        description="Keep your contact details and home address up to date."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Personal details" />
          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <Field label="Email address" htmlFor="email" hint="Your sign-in email cannot be changed.">
              <Input id="email" value={user.email} disabled readOnly />
            </Field>

            <Field label="Full name" htmlFor="full_name">
              <Input
                id="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ada Lovelace"
              />
            </Field>

            <Field label="Phone" htmlFor="phone" hint="Used for ride notifications.">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 0100"
              />
            </Field>

            <Field label="Account type" htmlFor="role">
              <Select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="rider">Rider — I book rides</option>
                <option value="driver">Driver — I offer rides</option>
                <option value="both">Both — I ride and drive</option>
              </Select>
            </Field>

            <div className="border-t border-slate-100 pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Home address</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Used as your default pickup point.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={pickingHome ? "primary" : "secondary"}
                  onClick={() => setPickingHome((value) => !value)}
                >
                  {pickingHome ? "Picking…" : home ? "Change" : "Set on map"}
                </Button>
              </div>

              {pickingHome && (
                <ClientOnlyMap
                  className="mb-3 h-[280px] w-full"
                  origin={home ? { ...home, label: "Home" } : null}
                  onPick={(_target, point) => setHome(point)}
                  activeTarget="origin"
                />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label" htmlFor="home_label">
                  <Input
                    id="home_label"
                    value={homeLabel}
                    onChange={(event) => setHomeLabel(event.target.value)}
                    placeholder="Home, Work, Campus…"
                  />
                </Field>
                <Field label="Coordinates" htmlFor="home_coords">
                  <Input
                    id="home_coords"
                    readOnly
                    value={home ? `${home.lat.toFixed(5)}, ${home.lng.toFixed(5)}` : ""}
                    placeholder="Not set"
                  />
                </Field>
              </div>

              {home && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setHome(null)}
                >
                  Clear home address
                </Button>
              )}
            </div>

            {error && <Alert>{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
              {(user.full_name || user.email).slice(0, 2).toUpperCase()}
            </div>
            <p className="mt-3 font-semibold text-slate-900">{user.full_name || "Your account"}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Member since</dt>
                <dd className="text-slate-900">
                  {new Date(user.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Seats offered</dt>
                <dd className="text-slate-900">{user.seats_offered}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
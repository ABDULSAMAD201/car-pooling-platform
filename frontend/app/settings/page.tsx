"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, CardHeader, Field, PageHeader, Select } from "@/components/ui";

type Theme = "light" | "dark" | "system";

interface Preferences {
  theme: Theme;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  notifyOnMatch: boolean;
  notifyOnStatusChange: boolean;
  notifyOnDriverArrival: boolean;
  shareLocationWithDriver: boolean;
  shareTripDetails: boolean;
  autoRefresh: boolean;
  defaultSeats: number;
}

const STORAGE_KEY = "carpool.preferences";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  notifyByEmail: true,
  notifyBySms: false,
  notifyOnMatch: true,
  notifyOnStatusChange: true,
  notifyOnDriverArrival: true,
  shareLocationWithDriver: true,
  shareTripDetails: true,
  autoRefresh: true,
  defaultSeats: 3,
};

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const prefersDark =
      prefs.theme === "dark" ||
      (prefs.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", prefersDark);
  }, [prefs.theme]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
  }

  function resetAll() {
    window.localStorage.removeItem(STORAGE_KEY);
    setPrefs(DEFAULT_PREFERENCES);
    document.documentElement.classList.remove("dark");
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Preferences are saved in this browser."
        action={
          <Button onClick={persist}>{saved ? "Saved" : "Save changes"}</Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Appearance" />
          <div className="space-y-4 p-5">
            <Field label="Theme" htmlFor="theme">
              <Select
                id="theme"
                value={prefs.theme}
                onChange={(event) => update("theme", event.target.value as Theme)}
              >
                <option value="system">Match my system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
            <p className="text-xs text-slate-500">
              Preferences live in local storage, so they apply on this device only.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            description="Choose what the app tells you about."
          />
          <div className="divide-y divide-slate-100 px-5 pb-2">
            <Toggle
              checked={prefs.notifyByEmail}
              onChange={(value) => update("notifyByEmail", value)}
              label="Email notifications"
              description="Ride confirmations and receipts."
            />
            <Toggle
              checked={prefs.notifyBySms}
              onChange={(value) => update("notifyBySms", value)}
              label="SMS notifications"
              description="Text messages for time-sensitive updates."
            />
            <Toggle
              checked={prefs.notifyOnMatch}
              onChange={(value) => update("notifyOnMatch", value)}
              label="When a driver is matched"
            />
            <Toggle
              checked={prefs.notifyOnStatusChange}
              onChange={(value) => update("notifyOnStatusChange", value)}
              label="When a ride status changes"
            />
            <Toggle
              checked={prefs.notifyOnDriverArrival}
              onChange={(value) => update("notifyOnDriverArrival", value)}
              label="When the driver arrives"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Privacy & sharing" />
          <div className="divide-y divide-slate-100 px-5 pb-2">
            <Toggle
              checked={prefs.shareLocationWithDriver}
              onChange={(value) => update("shareLocationWithDriver", value)}
              label="Share my pickup location with the driver"
              description="Needed for the driver to find you."
            />
            <Toggle
              checked={prefs.shareTripDetails}
              onChange={(value) => update("shareTripDetails", value)}
              label="Share my name and phone with matched drivers"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Ride defaults" />
          <div className="space-y-4 p-5">
            <Field
              label="Default seats to request"
              htmlFor="seats"
              hint="Used when booking a ride."
            >
              <Select
                id="seats"
                value={String(prefs.defaultSeats)}
                onChange={(event) => update("defaultSeats", Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "seat" : "seats"}
                  </option>
                ))}
              </Select>
            </Field>

            <Toggle
              checked={prefs.autoRefresh}
              onChange={(value) => update("autoRefresh", value)}
              label="Auto-refresh active rides"
              description="Keeps ride status up to date while a trip is open."
            />
          </div>
        </Card>

        {saved && <Alert variant="success">Your preferences have been saved.</Alert>}

        <Card>
          <CardHeader title="Reset" description="Clear locally stored preferences." />
          <div className="p-5">
            <Button variant="danger" onClick={resetAll}>
              Reset all settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
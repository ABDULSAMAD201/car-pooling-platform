"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  registerDriverAvailability,
  type DriverAvailability,
} from "@/lib/api";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function LatLngInputs({
  latLabel,
  lngLabel,
  lat,
  lng,
  onLatChange,
  onLngChange,
}: {
  latLabel: string;
  lngLabel: string;
  lat: string;
  lng: string;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={latLabel}>
        <input
          type="number"
          step="any"
          required
          placeholder="e.g. 24.8620"
          value={lat}
          onChange={(event) => onLatChange(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={lngLabel}>
        <input
          type="number"
          step="any"
          required
          placeholder="e.g. 67.0020"
          value={lng}
          onChange={(event) => onLngChange(event.target.value)}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden="true"
    />
  );
}

export default function DriverPage() {
  const [driverId, setDriverId] = useState("");
  const [currentLat, setCurrentLat] = useState("");
  const [currentLng, setCurrentLng] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<DriverAvailability | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRegistered(null);
    setSubmitting(true);
    try {
      const driver = await registerDriverAvailability({
        driver_id: driverId.trim(),
        current_lat: Number(currentLat),
        current_lng: Number(currentLng),
        destination_lat: Number(destLat),
        destination_lng: Number(destLng),
      });
      setRegistered(driver);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to register driver availability."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg self-start rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm">
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            ← Back to ride request
          </Link>
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Driver availability</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell the matching service where you are and where you&apos;re headed. Rides
          starting within 5 km and heading the same way can be matched to you.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Driver ID">
            <input
              type="text"
              required
              placeholder="e.g. driver-7"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              className={inputClass}
            />
          </Field>

          <LatLngInputs
            latLabel="Current latitude"
            lngLabel="Current longitude"
            lat={currentLat}
            lng={currentLng}
            onLatChange={setCurrentLat}
            onLngChange={setCurrentLng}
          />

          <LatLngInputs
            latLabel="Destination latitude"
            lngLabel="Destination longitude"
            lat={destLat}
            lng={destLng}
            onLatChange={setDestLat}
            onLngChange={setDestLng}
          />

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner />}
            {submitting ? "Registering…" : "Register availability"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        {registered && (
          <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium text-emerald-800">Driver registered</p>
            <p className="mt-1.5 break-all">
              <span className="text-emerald-700">Driver ID:</span>{" "}
              <span className="font-mono">{registered.driver_id}</span>
            </p>
            <p className="mt-1">
              <span className="text-emerald-700">Location:</span>{" "}
              <span className="font-mono">
                {registered.current_lat}, {registered.current_lng}
              </span>{" "}
              →{" "}
              <span className="font-mono">
                {registered.destination_lat}, {registered.destination_lng}
              </span>
            </p>
            <p className="mt-1">
              <span className="text-emerald-700">Status:</span>{" "}
              {registered.is_active ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  active
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  inactive
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
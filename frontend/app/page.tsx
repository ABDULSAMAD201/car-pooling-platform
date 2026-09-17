"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError,
  createRide,
  fetchMatchResult,
  fetchRide,
  type MatchResult,
  type Ride,
} from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-sky-100 text-sky-800",
  matched: "bg-violet-100 text-violet-800",
  confirmed: "bg-teal-100 text-teal-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

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
          placeholder="e.g. 24.8607"
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
          placeholder="e.g. 67.0011"
          value={lng}
          onChange={(event) => onLngChange(event.target.value)}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
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

function matchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "No match result recorded for this ride yet.";
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Match score unavailable — could not reach the matching service.";
}

function MatchInfo({ match }: { match: MatchResult }) {
  const hasMatch = match.driver_id != null && match.score != null;
  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <p className="flex items-center gap-2">
        <span className="text-slate-600">Driver:</span>
        <span className="font-mono">{match.driver_id ?? "—"}</span>
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span className="text-slate-600">Match score:</span>
        <span className="font-mono">
          {match.score != null ? match.score.toFixed(3) : "—"}
        </span>
      </p>
      {!hasMatch && (
        <p className="mt-2 text-xs text-slate-500">
          No driver was within 5 km of the pickup heading the same direction when this
          ride was created. Register a driver near the route on the{" "}
          <Link href="/driver" className="underline hover:text-slate-800">
            driver page
          </Link>
          , then submit a new ride.
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRide, setCreatedRide] = useState<Ride | null>(null);
  const [createdMatch, setCreatedMatch] = useState<MatchResult | null>(null);
  const [createdMatchError, setCreatedMatchError] = useState<string | null>(null);

  const [rideId, setRideId] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkedRide, setCheckedRide] = useState<Ride | null>(null);
  const [checkedMatch, setCheckedMatch] = useState<MatchResult | null>(null);
  const [checkedMatchError, setCheckedMatchError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setCreatedRide(null);
    setSubmitting(true);
    try {
      const ride = await createRide({
        user_id: userId.trim(),
        origin: { lat: Number(originLat), lng: Number(originLng) },
        destination: { lat: Number(destLat), lng: Number(destLng) },
        time: new Date(pickupTime).toISOString(),
      });
      setCreatedRide(ride);
      setRideId(ride.id);
      setCreatedMatch(null);
      setCreatedMatchError(null);
      try {
        setCreatedMatch(await fetchMatchResult(ride.id));
      } catch (error) {
        setCreatedMatchError(matchErrorMessage(error));
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit ride request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rideId.trim()) return;
    setCheckError(null);
    setCheckedRide(null);
    setChecking(true);
    try {
      const ride = await fetchRide(rideId.trim());
      setCheckedRide(ride);
      setCheckedMatch(null);
      setCheckedMatchError(null);
      try {
        setCheckedMatch(await fetchMatchResult(ride.id));
      } catch (error) {
        setCheckedMatchError(matchErrorMessage(error));
      }
    } catch (error) {
      setCheckError(
        error instanceof Error ? error.message : "Failed to check ride status."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg self-start rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Carpool Ride Request</h1>
        <p className="mt-1 text-sm text-slate-500">
          Request a ride through the booking service.
        </p>
        <p className="mt-1 text-sm">
          <Link href="/driver" className="text-slate-500 hover:text-slate-800">
            Are you a driver? Register your availability →
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="User ID">
            <input
              type="text"
              required
              placeholder="e.g. user-42"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={inputClass}
            />
          </Field>

          <LatLngInputs
            latLabel="Pickup latitude"
            lngLabel="Pickup longitude"
            lat={originLat}
            lng={originLng}
            onLatChange={setOriginLat}
            onLngChange={setOriginLng}
          />

          <LatLngInputs
            latLabel="Destination latitude"
            lngLabel="Destination longitude"
            lat={destLat}
            lng={destLng}
            onLatChange={setDestLat}
            onLngChange={setDestLng}
          />

          <Field label="Pickup time">
            <input
              type="datetime-local"
              required
              value={pickupTime}
              onChange={(event) => setPickupTime(event.target.value)}
              className={inputClass}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner />}
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>

        {submitError && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {submitError}
          </p>
        )}

        {createdRide && (
          <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium text-emerald-800">Ride requested</p>
            <p className="mt-1.5 break-all">
              <span className="text-emerald-700">Ride ID:</span>{" "}
              <span className="font-mono">{createdRide.id}</span>
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-emerald-700">Status:</span>
              <StatusBadge status={createdRide.status} />
            </p>
            {createdMatch && <MatchInfo match={createdMatch} />}
            {createdMatchError && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                {createdMatchError}
              </p>
            )}
          </div>
        )}

        <hr className="my-6 border-slate-200" />

        <h2 className="text-base font-semibold text-slate-900">Check status</h2>
        <p className="mt-1 text-sm text-slate-500">
          Look up a ride by its ID to see the current status.
        </p>

        <form onSubmit={handleCheckStatus} className="mt-4 flex gap-2">
          <input
            type="text"
            required
            placeholder="Ride ID"
            value={rideId}
            onChange={(event) => setRideId(event.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={checking}
            className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checking && <Spinner />}
            {checking ? "Checking…" : "Check"}
          </button>
        </form>

        {checkError && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {checkError}
          </p>
        )}

        {checkedRide && (
          <div className="mt-3 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200">
            <p className="break-all font-mono text-xs text-slate-500">{checkedRide.id}</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-slate-600">Status:</span>
              <StatusBadge status={checkedRide.status} />
            </p>
            {checkedMatch && <MatchInfo match={checkedMatch} />}
            {checkedMatchError && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                {checkedMatchError}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
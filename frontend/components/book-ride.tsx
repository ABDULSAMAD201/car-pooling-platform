"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  createRide,
  fetchMatchResult,
  type MatchResult,
  type Ride,
} from "@/lib/api";
import { useUserProfiles } from "@/lib/use-user-names";
import { useAuth } from "@/lib/auth-context";
import type { LatLng } from "@/lib/geo";
import { ClientOnlyMap, type PickTarget } from "@/components/location-map";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

function formatCoords(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function matchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "No match result recorded for this ride yet.";
  }
  if (error instanceof ApiError) return error.message;
  return "Match score unavailable — could not reach the matching service.";
}

/** `datetime-local` needs a local-time string, not the ISO/UTC form. */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function BookRide() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget>("origin");
  const [pickupTime, setPickupTime] = useState(() => toLocalInputValue(new Date()));
  const [notes, setNotes] = useState("");

  const [geolocating, setGeolocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRide, setCreatedRide] = useState<Ride | null>(null);
  const [createdMatch, setCreatedMatch] = useState<MatchResult | null>(null);
  const [createdMatchError, setCreatedMatchError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.home_lat != null && user.home_lng != null) {
      setOrigin((current) => current ?? { lat: user.home_lat!, lng: user.home_lng! });
    }
  }, [user]);

  const handlePick = useCallback(
    (target: PickTarget, point: LatLng) => {
      if (target === "origin") {
        setOrigin(point);
        setPickTarget("destination");
      } else if (target === "destination") {
        setDestination(point);
      }
    },
    []
  );

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }

    setGeolocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
        setPickTarget("destination");
        setGeolocating(false);
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Pick your pickup point on the map instead."
            : "Could not determine your location. Pick it on the map instead."
        );
        setGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setCreatedRide(null);
    setCreatedMatch(null);
    setCreatedMatchError(null);

    if (!origin || !destination) {
      setSubmitError("Choose both a pickup point and a destination on the map.");
      return;
    }
    if (!pickupTime) {
      setSubmitError("Choose a pickup time.");
      return;
    }
    if (!authLoading && !user) {
      setSubmitError("Please sign in to request a ride.");
      router.push("/login?next=/");
      return;
    }

    setSubmitting(true);
    try {
      const ride = await createRide({
        // The backend overrides this with the signed-in account when a token
        // is present, but the field is still required by the schema.
        user_id: user?.id ?? "anonymous",
        origin,
        destination,
        time: new Date(pickupTime).toISOString(),
      });
      setCreatedRide(ride);
      setNotes("");

      try {
        setCreatedMatch(await fetchMatchResult(ride.id));
      } catch (error) {
        setCreatedMatchError(matchErrorMessage(error));
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit the ride request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const readyToSubmit = origin != null && destination != null && pickupTime != null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Where are you heading?"
        description="Pick your pickup and destination on the map, and we'll find a driver heading your way."
        action={
          <Button variant="secondary" onClick={useMyLocation} loading={geolocating}>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.732 13.732 0 002.273 1.765 11.644 11.644 0 00.976.544l.062.029.018.008.006.003zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Use my location
          </Button>
        }
      />

      {geoError && (
        <div className="mb-4">
          <Alert variant="info">{geoError}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Map */}
        <Card className="overflow-hidden">
          <ClientOnlyMap
            className="h-[420px] w-full sm:h-[560px]"
            origin={origin ? { ...origin, label: "Pickup" } : null}
            destination={destination ? { ...destination, label: "Destination" } : null}
            onPick={handlePick}
            activeTarget={pickTarget}
          />

          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
            <Button
              size="sm"
              variant={pickTarget === "origin" ? "primary" : "secondary"}
              onClick={() => setPickTarget("origin")}
            >
              {origin ? "Change pickup" : "Set pickup"}
            </Button>
            <Button
              size="sm"
              variant={pickTarget === "destination" ? "primary" : "secondary"}
              onClick={() => setPickTarget("destination")}
            >
              {destination ? "Change destination" : "Set destination"}
            </Button>
            {origin && (
              <Button size="sm" variant="ghost" onClick={() => setOrigin(null)}>
                Clear pickup
              </Button>
            )}
            {destination && (
              <Button size="sm" variant="ghost" onClick={() => setDestination(null)}>
                Clear destination
              </Button>
            )}
          </div>
        </Card>

        {/* Booking form */}
        <div className="space-y-6">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="space-y-2">
                <div
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    pickTarget === "origin" ? "border-brand-300 bg-brand-50/50" : "border-slate-200"
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    A
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Pickup
                    </p>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {origin ? formatCoords(origin) : "Click the map to set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickTarget("origin")}
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                </div>

                <div className="ml-3 h-3 w-px bg-slate-300" />

                <div
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    pickTarget === "destination"
                      ? "border-brand-300 bg-brand-50/50"
                      : "border-slate-200"
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    B
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Destination
                    </p>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {destination ? formatCoords(destination) : "Click the map to set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickTarget("destination")}
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <Field label="Pickup time" htmlFor="pickup_time">
                <Input
                  id="pickup_time"
                  type="datetime-local"
                  required
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                />
              </Field>

              <Field label="Notes for the driver" htmlFor="notes" hint="Optional.">
                <Input
                  id="notes"
                  placeholder="Luggage, wheelchair space, extra stop…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>

              {!user && !authLoading && (
                <Alert variant="info">
                  <Link href="/login?next=/" className="font-semibold underline">
                    Sign in
                  </Link>{" "}
                  to request a ride and track it live.
                </Alert>
              )}

              {submitError && <Alert>{submitError}</Alert>}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                disabled={!readyToSubmit || !user}
                className="w-full"
              >
                {submitting ? "Requesting ride…" : "Request ride"}
              </Button>
            </form>
          </Card>

          {createdRide && (
            <Card className="animate-fade-in-up p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Ride requested</h2>
                <StatusBadge status={createdRide.status} />
              </div>

              <p className="mt-2 text-sm text-slate-500">Ride #{createdRide.id.slice(0, 8).toUpperCase()}</p>

              {createdMatch && <MatchInfo match={createdMatch} />}
              {createdMatchError && (
                <p className="mt-3 text-xs text-slate-500">{createdMatchError}</p>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                onClick={() => router.push(`/rides/${createdRide.id}`)}
              >
                Track this ride
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchInfo({ match }: { match: MatchResult }) {
  const { nameOf } = useUserProfiles([match.driver_id]);
  const hasMatch = match.driver_id != null && match.score != null;

  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-200">
      {hasMatch ? (
        <>
          <p className="text-sm font-medium text-emerald-700">Driver found</p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Driver</span>
            <span className="text-sm font-medium text-slate-900">{nameOf(match.driver_id)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-slate-600">Match score</span>
            <span className="font-mono text-xs">{match.score!.toFixed(3)}</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-amber-700">No driver matched yet</p>
          <p className="mt-1 text-xs text-slate-600">
            No driver was within 5 km of your pickup heading the same direction. Register
            availability on the{" "}
            <Link href="/driver" className="font-semibold text-brand-600 underline">
              driver page
            </Link>{" "}
            and request again.
          </p>
        </>
      )}
    </div>
  );
}
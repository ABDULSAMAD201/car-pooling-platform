"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDriverAvailability,
  fetchMyRides,
  type DriverAvailability,
  type Ride,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { bearing, bearingDifference, compassDirection, distanceKm } from "@/lib/geo";
import { ClientOnlyMap } from "@/components/location-map";
import { RequirePortal } from "@/components/portal-guard";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";

// These mirror the matching service's thresholds so the UI can explain *why*
// a rider was or was not eligible.
const MAX_PICKUP_RADIUS_KM = 5;
const MAX_BEARING_DIFF_DEGREES = 45;

const REFRESH_INTERVAL_MS = 10_000;

interface Candidate {
  ride: Ride;
  pickupKm: number;
  bearingDiff: number;
  eligible: boolean;
  reason: string;
}

/**
 * Evaluate a ride against the driver's registered route using the same rules
 * the matching service applies, so the dashboard can explain each decision.
 */
function evaluate(ride: Ride, availability: DriverAvailability | null): Candidate | null {
  if (!availability) return null;

  const driverBearing = bearing(
    { lat: availability.current_lat, lng: availability.current_lng },
    { lat: availability.destination_lat, lng: availability.destination_lng }
  );
  const riderBearing = bearing(ride.origin, ride.destination);
  const pickupKm = distanceKm(
    { lat: availability.current_lat, lng: availability.current_lng },
    ride.origin
  );
  const bearingDiff = bearingDifference(driverBearing, riderBearing);

  const withinRadius = pickupKm <= MAX_PICKUP_RADIUS_KM;
  const sameDirection = bearingDiff <= MAX_BEARING_DIFF_DEGREES;

  let reason = "Matched on distance and direction.";
  if (!withinRadius && !sameDirection) {
    reason = `Too far (${pickupKm.toFixed(1)} km) and heading ${compassDirection(riderBearing)} vs your ${compassDirection(driverBearing)}.`;
  } else if (!withinRadius) {
    reason = `Rider is ${pickupKm.toFixed(1)} km away — beyond the ${MAX_PICKUP_RADIUS_KM} km pickup radius.`;
  } else if (!sameDirection) {
    reason = `Rider is heading ${compassDirection(riderBearing)}, you're heading ${compassDirection(driverBearing)}.`;
  }

  return {
    ride,
    pickupKm,
    bearingDiff,
    eligible: withinRadius && sameDirection,
    reason,
  };
}

/** Driver-only page; passengers are redirected to their own portal. */
export default function DriverDashboardPage() {
  return (
    <RequirePortal portal="driver">
      <DriverDashboard />
    </RequirePortal>
  );
}

function DriverDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [availability, setAvailability] = useState<DriverAvailability | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [drivers, myRides] = await Promise.all([
        fetchDriverAvailability(true),
        fetchMyRides(),
      ]);
      const mine = drivers.find((item) => item.driver_id === user.id) ?? null;
      setAvailability(mine);
      setRides(myRides);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, load]);

  const openRides = useMemo(
    () => rides.filter((ride) => ["requested", "matched", "confirmed"].includes(ride.status)),
    [rides]
  );

  const online = availability?.is_active ?? false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Driver dashboard"
        description={
          online
            ? "You're online. Riders heading your way will appear here."
            : "You're currently offline. Go online to start receiving matches."
        }
        action={
          <Link href="/driver">
            <Button variant={online ? "secondary" : "primary"}>
              {online ? "Update route" : "Go online"}
            </Button>
          </Link>
        }
      />

      {authLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : !user ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-600">Please sign in to view your dashboard.</p>
          <Link href="/login?next=/driver/dashboard" className="mt-4 inline-block">
            <Button>Sign in</Button>
          </Link>
        </Card>
      ) : (
        <>
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`}
                />
                {online ? "Online" : "Offline"}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Vehicle
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {[user.vehicle_make, user.vehicle_model].filter(Boolean).join(" ") || "—"}
              </p>
              {user.vehicle_plate && (
                <p className="mt-1 font-mono text-xs text-slate-500">{user.vehicle_plate}</p>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Seats offered
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{user.seats_offered}</p>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Open requests
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{openRides.length}</p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Ride requests"
                  description="Eligibility mirrors the matching service's own rules."
                  action={
                    <Button size="sm" variant="ghost" onClick={() => void load()}>
                      Refresh
                    </Button>
                  }
                />

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Spinner className="h-6 w-6 text-indigo-600" />
                  </div>
                ) : openRides.length === 0 ? (
                  <EmptyState
                    title="No open requests"
                    description={
                      online
                        ? "When riders request trips heading your way, they'll show up here."
                        : "Go online from the driver page to start receiving requests."
                    }
                    action={
                      !online ? (
                        <Link href="/driver">
                          <Button>Go online</Button>
                        </Link>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {openRides.map((ride) => {
                      const candidate = evaluate(ride, availability);
                      return (
                        <li key={ride.id} className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={ride.status} />
                                {candidate && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      candidate.eligible
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {candidate.eligible ? "In range" : "Out of range"}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 break-all font-mono text-xs text-slate-500">
                                {ride.id}
                              </p>
                            </div>
                            <Link href={`/rides/${ride.id}`}>
                              <Button size="sm" variant="secondary">
                                View
                              </Button>
                            </Link>
                          </div>

                          {candidate && (
                            <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 text-xs ring-1 ring-slate-200 sm:grid-cols-3">
                              <div>
                                <p className="text-slate-500">Pickup distance</p>
                                <p className="mt-0.5 font-medium text-slate-900">
                                  {candidate.pickupKm.toFixed(2)} km{" "}
                                  <span className="font-normal text-slate-500">
                                    / {MAX_PICKUP_RADIUS_KM} km
                                  </span>
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500">Direction difference</p>
                                <p className="mt-0.5 font-medium text-slate-900">
                                  {candidate.bearingDiff.toFixed(0)}°{" "}
                                  <span className="font-normal text-slate-500">
                                    / {MAX_BEARING_DIFF_DEGREES}°
                                  </span>
                                </p>
                              </div>
                              <div className="sm:col-span-1">
                                <p className="text-slate-500">Result</p>
                                <p className="mt-0.5 text-slate-700">{candidate.reason}</p>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Recent trips" />
                {rides.length === 0 ? (
                  <EmptyState
                    title="No trips yet"
                    description="Trips you're matched to will be listed here."
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {rides.slice(0, 5).map((ride) => (
                      <li key={ride.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-slate-600">{ride.id}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {new Date(ride.requested_time).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={ride.status} />
                          <Link
                            href={`/rides/${ride.id}`}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            View
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Your current route</h2>
                </div>
                {availability ? (
                  <ClientOnlyMap
                    className="h-[360px] w-full"
                    driver={{
                      lat: availability.current_lat,
                      lng: availability.current_lng,
                      label: "You are here",
                    }}
                    destination={{
                      lat: availability.destination_lat,
                      lng: availability.destination_lng,
                      label: "Headed to",
                    }}
                  />
                ) : (
                  <div className="flex h-[360px] flex-col items-center justify-center gap-3 bg-slate-100 px-6 text-center">
                    <p className="text-sm text-slate-500">You&apos;re not online.</p>
                    <Link href="/driver">
                      <Button size="sm">Set your route</Button>
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
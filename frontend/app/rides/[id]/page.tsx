"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  cancelRide,
  fetchInterestedDrivers,
  fetchMatchResult,
  fetchRide,
  pickDriver,
  type DriverCandidate,
  type MatchResult,
  type Ride,
} from "@/lib/api";
import { useUserProfiles } from "@/lib/use-user-names";
import { useAuth } from "@/lib/auth-context";
import { ClientOnlyMap } from "@/components/location-map";
import { PersonRow } from "@/components/person";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";

const POLL_INTERVAL_MS = 5000;

const TIMELINE = [
  {
    key: "requested",
    label: "Ride requested",
    description: "The passenger posted this request.",
  },
  {
    key: "matched",
    label: "Driver matched",
    description: "A driver was assigned to this ride.",
  },
  {
    key: "confirmed",
    label: "Driver chosen",
    description: "The passenger picked a driver for the trip.",
  },
  {
    key: "in_progress",
    label: "On the way",
    description: "The driver is heading to the pickup point.",
  },
  { key: "completed", label: "Completed", description: "The passenger has arrived." },
];

type ViewerRole = "passenger" | "driver" | "visitor";

/** One plain-language sentence saying what is happening and what it means for the viewer. */
function summaryFor(
  status: string,
  viewer: ViewerRole,
  driver: string | null,
  passenger: string
): string {
  if (status === "cancelled") return "This ride was cancelled.";

  if (viewer === "passenger") {
    switch (status) {
      case "requested":
        return "Waiting for a driver. Drivers heading your way can volunteer, and you choose who picks you up.";
      case "in_progress":
        return `${driver ?? "Your driver"} is on the way to pick you up.`;
      case "completed":
        return `Your trip with ${driver ?? "your driver"} is complete.`;
      default:
        return `${driver ?? "Your driver"} will pick you up.`;
    }
  }

  if (viewer === "driver") {
    switch (status) {
      case "in_progress":
        return `You are on the way to pick up ${passenger}.`;
      case "completed":
        return `You completed this trip with ${passenger}.`;
      default:
        return `You are driving ${passenger}. Head to the pickup point at the requested time.`;
    }
  }

  return status === "requested"
    ? `${passenger} is looking for a ride. Volunteer from your dashboard and they may choose you.`
    : `${passenger} already has a driver for this ride.`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function timelineIndex(status: string): number {
  const index = TIMELINE.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

export default function RideDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rideId = params.id;
  const { user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DriverCandidate[]>([]);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [pickingDriverId, setPickingDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { nameOf, profile } = useUserProfiles([
    ride?.user_id,
    ride?.matched_driver_id,
    ...candidates.map((c) => c.driver_id),
  ]);

  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const current = await fetchRide(rideId);
      setRide(current);
      setError(null);

      try {
        setMatch(await fetchMatchResult(rideId));
        setMatchError(null);
      } catch (matchErr) {
        setMatch(null);
        setMatchError(
          matchErr instanceof ApiError && matchErr.status === 404
            ? "No match result recorded yet."
            : "Could not reach the matching service."
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load this ride."
      );
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the ride is still in a state that can still change.
  useEffect(() => {
    if (!ride) return;
    const settled = ["completed", "cancelled"].includes(ride.status);
    if (settled) return;

    const timer = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [ride, load]);

  /**
   * The interested-driver list is only readable by the rider who booked the
   * ride, so it is fetched separately and any refusal is silently ignored —
   * a driver opening someone else's ride simply sees no candidates.
   */
  const loadCandidates = useCallback(async () => {
    try {
      setCandidates(await fetchInterestedDrivers(rideId));
      setCandidatesError(null);
    } catch {
      setCandidates([]);
      setCandidatesError(null);
    }
  }, [rideId]);

  useEffect(() => {
    if (user) void loadCandidates();
  }, [user, loadCandidates]);

  async function handlePick(driverId: string) {
    setPickingDriverId(driverId);
    setCancelError(null);
    try {
      const updated = await pickDriver(rideId, driverId);
      setRide(updated);
      await loadCandidates();
    } catch (pickError) {
      setCancelError(
        pickError instanceof Error ? pickError.message : "Could not choose this driver."
      );
    } finally {
      setPickingDriverId(null);
    }
  }

  async function handleCancel() {
    if (!ride) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelRide(ride.id);
      setRide(updated);
      cancelledRef.current = true;
    } catch (cancelErr) {
      setCancelError(cancelErr instanceof Error ? cancelErr.message : "Could not cancel this ride.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">Ride unavailable</h1>
          <div className="mt-3">
            <Alert>{error ?? "This ride could not be found."}</Alert>
          </div>
          <Button variant="secondary" className="mt-4" onClick={() => router.push("/rides")}>
            Back to my rides
          </Button>
        </Card>
      </div>
    );
  }

  const stepIndex = timelineIndex(ride.status);
  const isPassenger = user?.id === ride.user_id;
  const isMatchedDriver = !!user && user.id === ride.matched_driver_id;
  const viewer: ViewerRole = isPassenger ? "passenger" : isMatchedDriver ? "driver" : "visitor";
  const canCancel = isPassenger && !["completed", "cancelled"].includes(ride.status);

  const passengerName = isPassenger ? (user?.full_name || "You") : nameOf(ride.user_id, undefined, "Passenger");
  const driverProfile = profile(ride.matched_driver_id);
  const driverName = ride.matched_driver_id ? nameOf(ride.matched_driver_id, user?.id) : null;
  const summary = summaryFor(
    ride.status,
    viewer,
    driverName === "You" ? null : driverName,
    passengerName
  );
  const viewerLabel =
    viewer === "passenger"
      ? "You are the passenger"
      : viewer === "driver"
        ? "You are the driver"
        : "You are viewing this ride";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/rides" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to my rides
      </Link>

      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ride details</h1>
          <p className="mt-1 text-sm text-slate-500">Ride #{ride.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div
        className={`mb-6 rounded-2xl p-5 ring-1 ${
          ride.status === "cancelled"
            ? "bg-rose-50 ring-rose-600/20"
            : viewer === "driver"
              ? "bg-brand-50 ring-brand-600/20"
              : viewer === "passenger"
                ? "bg-sky-50 ring-sky-600/20"
                : "bg-white ring-slate-200"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{viewerLabel}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <ClientOnlyMap
              className="h-[360px] w-full sm:h-[440px]"
              origin={{ ...ride.origin, label: "Pickup" }}
              destination={{ ...ride.destination, label: "Destination" }}
            />
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
              <div className="bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Pickup
                </p>
                <p className="mt-1 font-mono text-sm text-slate-900">
                  {ride.origin.lat.toFixed(5)}, {ride.origin.lng.toFixed(5)}
                </p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Destination
                </p>
                <p className="mt-1 font-mono text-sm text-slate-900">
                  {ride.destination.lat.toFixed(5)}, {ride.destination.lng.toFixed(5)}
                </p>
              </div>
            </div>
          </Card>

          {isPassenger && ride.status === "requested" && candidates.length > 0 && (
            <Card>
              <CardHeader
                title="Choose your driver"
                description="These drivers volunteered for your ride, best match first."
              />
              <ul className="divide-y divide-slate-100">
                {candidates.map((candidate, index) => (
                  <li key={candidate.driver_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {candidate.full_name || "Driver"}
                        </p>
                        {index === 0 && candidate.score != null && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Best match
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[candidate.vehicle_color, candidate.vehicle_make, candidate.vehicle_model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle not set"}
                        {candidate.vehicle_plate ? ` · ${candidate.vehicle_plate}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {candidate.seats_offered} seat
                        {candidate.seats_offered === 1 ? "" : "s"}
                        {candidate.pickup_km != null
                          ? ` · ${candidate.pickup_km.toFixed(1)} km away`
                          : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      loading={pickingDriverId === candidate.driver_id}
                      disabled={pickingDriverId !== null}
                      onClick={() => void handlePick(candidate.driver_id)}
                    >
                      Choose
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isPassenger && ride.status === "requested" && candidates.length === 0 && !candidatesError && (
            <Alert variant="info">
              No drivers have volunteered yet. You&apos;ll be notified as soon as
              one does — your ride is listed and visible to nearby drivers.
            </Alert>
          )}

          {canCancel && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">Need to cancel?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cancelling lets your driver know the trip is off. Completed rides can't be cancelled.
              </p>
              {cancelError && (
                <div className="mt-3">
                  <Alert>{cancelError}</Alert>
                </div>
              )}
              <Button
                variant="danger"
                className="mt-3"
                loading={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling…" : "Cancel this ride"}
              </Button>
            </Card>
          )}

          {ride.status === "cancelled" && cancelledRef.current && (
            <Alert variant="info">This ride was cancelled.</Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Progress" description="Updates automatically every few seconds." />
            <ol className="p-5">
              {TIMELINE.map((step, index) => {
                const done = index < stepIndex;
                const current = index === stepIndex && ride.status !== "cancelled";
                return (
                  <li key={step.key} className="flex gap-3 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          done
                            ? "bg-emerald-600 text-white"
                            : current
                              ? "bg-brand-600 text-white ring-4 ring-brand-100"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      {index < TIMELINE.length - 1 && (
                        <span
                          className={`w-0.5 flex-1 ${done ? "bg-emerald-300" : "bg-slate-200"}`}
                        />
                      )}
                    </div>
                    <div className="pb-5">
                      <p
                        className={`text-sm font-medium ${
                          done || current ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                  </li>
                );
              })}

              {ride.status === "cancelled" && (
                <li className="flex gap-3 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-600/20">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                    ✕
                  </span>
                  <div>
                    <p className="text-sm font-medium text-rose-800">Cancelled</p>
                    <p className="text-xs text-rose-700">This ride was cancelled.</p>
                  </div>
                </li>
              )}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Who's on this ride" />
            <div className="space-y-5 p-5">
              <PersonRow
                role="passenger"
                name={passengerName}
                isYou={isPassenger}
                detail="Waiting to be picked up"
              />
              <PersonRow
                role="driver"
                name={driverName ?? undefined}
                isYou={isMatchedDriver}
                empty={isPassenger ? "Not chosen yet" : "No driver chosen yet"}
                detail={
                  driverProfile
                    ? [driverProfile.vehicle, driverProfile.vehicle_plate]
                        .filter(Boolean)
                        .join(" · ") || "Vehicle details not set"
                    : undefined
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Best available score</span>
                <span className="font-mono text-xs">
                  {match?.score != null ? match.score.toFixed(3) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-600">Requested</span>
                <span className="text-xs text-slate-900">
                  {formatDateTime(ride.requested_time)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Last updated</span>
                <span className="text-xs text-slate-900">{formatDateTime(ride.updated_at)}</span>
              </div>
              {matchError && <p className="text-xs text-slate-500">{matchError}</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  cancelRide,
  fetchMatchResult,
  fetchRide,
  type MatchResult,
  type Ride,
} from "@/lib/api";
import { ClientOnlyMap } from "@/components/location-map";
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
  { key: "requested", label: "Ride requested", description: "We received your request." },
  { key: "matched", label: "Driver matched", description: "A driver was assigned to you." },
  { key: "confirmed", label: "Confirmed", description: "The driver accepted the trip." },
  { key: "in_progress", label: "On the way", description: "Your driver is heading to pickup." },
  { key: "completed", label: "Completed", description: "You have arrived." },
];

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

  const [ride, setRide] = useState<Ride | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
        <Spinner className="h-6 w-6 text-indigo-600" />
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
  const canCancel = !["completed", "cancelled"].includes(ride.status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/rides" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to my rides
      </Link>

      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ride details</h1>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{ride.id}</p>
        </div>
        <StatusBadge status={ride.status} />
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

          {canCancel && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">Need to cancel?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cancelling notifies your driver. Completed rides can't be cancelled.
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
                              ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
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
            <CardHeader title="Match" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Driver</span>
                <span className="font-mono text-xs">
                  {ride.matched_driver_id ?? match?.driver_id ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Match score</span>
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
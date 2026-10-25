"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyRides, type Ride } from "@/lib/api";
import { useUserProfiles } from "@/lib/use-user-names";
import { useAuth } from "@/lib/auth-context";
import { ClientOnlyMap } from "@/components/location-map";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";

type Filter = "all" | "active" | "past";

const ACTIVE_STATUSES = new Set(["requested", "matched", "confirmed", "in_progress"]);

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isActive(ride: Ride): boolean {
  return ACTIVE_STATUSES.has(ride.status);
}

function RideCard({ ride, driverName }: { ride: Ride; driverName: string }) {
  return (
    <Link
      href={`/rides/${ride.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
              A
            </span>
            <span className="truncate font-mono text-xs text-slate-600">
              {ride.origin.lat.toFixed(4)}, {ride.origin.lng.toFixed(4)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              B
            </span>
            <span className="truncate font-mono text-xs text-slate-600">
              {ride.destination.lat.toFixed(4)}, {ride.destination.lng.toFixed(4)}
            </span>
          </div>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Requested {formatDateTime(ride.requested_time)}</span>
        {ride.matched_driver_id && (
          <span className="font-medium text-slate-700">Driver: {driverName}</span>
        )}
      </div>
    </Link>
  );
}

export default function RidesPage() {
  const { user, loading: authLoading } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const { nameOf } = useUserProfiles(rides.map((ride) => ride.matched_driver_id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRides(await fetchMyRides());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your rides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  const visible = useMemo(() => {
    if (filter === "active") return rides.filter(isActive);
    if (filter === "past") return rides.filter((ride) => !isActive(ride));
    return rides;
  }, [rides, filter]);

  const previewRide = useMemo(() => {
    const active = rides.find(isActive);
    return active ?? rides[0] ?? null;
  }, [rides]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My rides"
        description="Every trip you've requested, newest first."
        action={
          <Link href="/">
            <Button>New ride</Button>
          </Link>
        }
      />

      {!user ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-600">Please sign in to see your rides.</p>
          <Link href="/login?next=/rides" className="mt-4 inline-block">
            <Button>Sign in</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["past", "Past"],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    filter === value
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4">
                <Alert>{error}</Alert>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-6 w-6 text-brand-600" />
              </div>
            ) : visible.length === 0 ? (
              <Card>
                <EmptyState
                  title={rides.length === 0 ? "No rides yet" : "Nothing in this filter"}
                  description={
                    rides.length === 0
                      ? "Request your first ride and it will show up here."
                      : "Try a different filter to see your other trips."
                  }
                  action={
                    rides.length === 0 ? (
                      <Link href="/">
                        <Button>Book a ride</Button>
                      </Link>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {visible.map((ride) => (
                  <RideCard key={ride.id} ride={ride} driverName={nameOf(ride.matched_driver_id)} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {previewRide ? "Trip overview" : "Trip overview"}
                </h2>
              </div>
              {previewRide ? (
                <ClientOnlyMap
                  className="h-[320px] w-full"
                  origin={{ ...previewRide.origin, label: "Pickup" }}
                  destination={{ ...previewRide.destination, label: "Destination" }}
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center bg-slate-100 text-sm text-slate-400">
                  No trips to display
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
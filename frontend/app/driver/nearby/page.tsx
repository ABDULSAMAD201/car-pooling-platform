"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchDriverAvailability, type DriverAvailability } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RequirePortal } from "@/components/portal-guard";
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";

/** Driver-only page. Kept separate from the availability form so neither screen is crowded. */
export default function DriversNearbyPage() {
  return (
    <RequirePortal portal="driver">
      <DriversNearby />
    </RequirePortal>
  );
}

function DriversNearby() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<DriverAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDrivers(await fetchDriverAvailability(true));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load active drivers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Drivers online"
        description="Every driver currently available on the platform, and where they are heading."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Link href="/driver">
              <Button>Go online</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <EmptyState
            title="No drivers are online"
            description="Be the first to go online and start earning."
            action={
              <Link href="/driver">
                <Button>Go online</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const isMe = driver.driver_id === user?.id;
            return (
              <Card key={driver.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-slate-500">
                    {isMe ? "You" : `${driver.driver_id.slice(0, 8)}…`}
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>
                    At {driver.current_lat.toFixed(4)}, {driver.current_lng.toFixed(4)}
                  </p>
                  <p>
                    To {driver.destination_lat.toFixed(4)}, {driver.destination_lng.toFixed(4)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
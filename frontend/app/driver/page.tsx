"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  registerDriverAvailability,
  type DriverAvailability,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { LatLng } from "@/lib/geo";
import { ClientOnlyMap, type PickTarget } from "@/components/location-map";
import { RequirePortal } from "@/components/portal-guard";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";

function formatCoords(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/** Driver-only entry point; passengers are redirected to their own portal. */
export default function DriverPage() {
  return (
    <RequirePortal portal="driver">
      <DriverAvailability />
    </RequirePortal>
  );
}

function DriverAvailability() {
  const router = useRouter();
  const { user, loading: authLoading, updateProfile } = useAuth();

  const [current, setCurrent] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget>("current");

  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [seats, setSeats] = useState("3");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<DriverAvailability | null>(null);

  // Hydrate the vehicle fields from the saved profile.
  useEffect(() => {
    if (!user) return;
    setVehicleMake(user.vehicle_make ?? "");
    setVehicleModel(user.vehicle_model ?? "");
    setVehicleColor(user.vehicle_color ?? "");
    setVehiclePlate(user.vehicle_plate ?? "");
    setSeats(String(user.seats_offered ?? 3));
    setCurrent((existing) =>
      existing ?? (user.home_lat != null && user.home_lng != null
        ? { lat: user.home_lat, lng: user.home_lng }
        : null)
    );
  }, [user]);

  const handlePick = useCallback((target: PickTarget, point: LatLng) => {
    if (target === "current") setCurrent(point);
    else if (target === "destination") setDestination(point);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!user) {
      router.push("/login?next=/driver");
      return;
    }
    if (!current || !destination) {
      setError("Set both your current position and your destination on the map.");
      return;
    }

    const seatsNumber = Number(seats);
    if (!Number.isInteger(seatsNumber) || seatsNumber < 1 || seatsNumber > 8) {
      setError("Seats offered must be between 1 and 8.");
      return;
    }

    setSubmitting(true);
    try {
      // Persist the vehicle details so the driver dashboard can show them.
      if (
        vehicleMake !== (user.vehicle_make ?? "") ||
        vehicleModel !== (user.vehicle_model ?? "") ||
        vehicleColor !== (user.vehicle_color ?? "") ||
        vehiclePlate !== (user.vehicle_plate ?? "") ||
        seatsNumber !== user.seats_offered
      ) {
        await updateProfile({
          vehicle_make: vehicleMake.trim(),
          vehicle_model: vehicleModel.trim(),
          vehicle_color: vehicleColor.trim(),
          vehicle_plate: vehiclePlate.trim(),
          seats_offered: seatsNumber,
          role: user.role === "rider" ? "both" : user.role,
        });
      }

      const result = await registerDriverAvailability({
        driver_id: user.id,
        current_lat: current.lat,
        current_lng: current.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      });
      setRegistered(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not register availability."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Driver availability"
        description="Tell us where you are and where you're headed. Rides starting within 5 km and heading the same way can be matched to you."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/driver/nearby">
              <Button variant="secondary">Drivers nearby</Button>
            </Link>
            <Link href="/driver/dashboard">
              <Button variant="secondary">Driver dashboard →</Button>
            </Link>
          </div>
        }
      />

      {!user && !authLoading && (
        <div className="mb-4">
          <Alert variant="info">
            <Link href="/login?next=/driver" className="font-semibold underline">
              Sign in
            </Link>{" "}
            to register availability and get matched with riders.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card className="overflow-hidden">
          <ClientOnlyMap
            className="h-[420px] w-full sm:h-[520px]"
            driver={current ? { ...current, label: "You are here" } : null}
            destination={destination ? { ...destination, label: "Headed to" } : null}
            onPick={handlePick}
            activeTarget={pickTarget}
          />
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
            <Button
              size="sm"
              variant={pickTarget === "current" ? "primary" : "secondary"}
              onClick={() => setPickTarget("current")}
            >
              {current ? "Change current position" : "Set current position"}
            </Button>
            <Button
              size="sm"
              variant={pickTarget === "destination" ? "primary" : "secondary"}
              onClick={() => setPickTarget("destination")}
            >
              {destination ? "Change destination" : "Set destination"}
            </Button>
            {current && (
              <Button size="sm" variant="ghost" onClick={() => setCurrent(null)}>
                Clear position
              </Button>
            )}
            {destination && (
              <Button size="sm" variant="ghost" onClick={() => setDestination(null)}>
                Clear destination
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your route" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                  C
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    Current position
                  </p>
                  <p className="truncate font-mono text-xs text-slate-900">
                    {current ? formatCoords(current) : "Click the map to set"}
                  </p>
                </div>
              </div>
              <div className="ml-3 h-3 w-px bg-slate-300" />
              <div className="flex items-start gap-3 rounded-lg border border-brand-300 bg-brand-50/60 p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  B
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                    Destination
                  </p>
                  <p className="truncate font-mono text-xs text-slate-900">
                    {destination ? formatCoords(destination) : "Click the map to set"}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Vehicle" description="Shown to riders when you're matched." />
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Make" htmlFor="make">
                  <Input
                    id="make"
                    placeholder="Toyota"
                    value={vehicleMake}
                    onChange={(event) => setVehicleMake(event.target.value)}
                  />
                </Field>
                <Field label="Model" htmlFor="model">
                  <Input
                    id="model"
                    placeholder="Corolla"
                    value={vehicleModel}
                    onChange={(event) => setVehicleModel(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Colour" htmlFor="color">
                  <Input
                    id="color"
                    placeholder="Silver"
                    value={vehicleColor}
                    onChange={(event) => setVehicleColor(event.target.value)}
                  />
                </Field>
                <Field label="Plate" htmlFor="plate">
                  <Input
                    id="plate"
                    placeholder="ABC-1234"
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Seats offered" htmlFor="seats" hint="1–8 passengers.">
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  max={8}
                  value={seats}
                  onChange={(event) => setSeats(event.target.value)}
                />
              </Field>

              {error && <Alert>{error}</Alert>}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                disabled={!user}
                className="w-full"
              >
                {submitting ? "Registering…" : "Go online"}
              </Button>
            </form>
          </Card>

          {registered && (
            <Card className="animate-fade-in-up border-emerald-200 p-5">
              <p className="text-sm font-semibold text-emerald-800">You're online</p>
              <p className="mt-1 text-sm text-emerald-700">
                Riders heading your way within 5 km can now be matched to you.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => router.push("/driver/dashboard")}
              >
                Open dashboard
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
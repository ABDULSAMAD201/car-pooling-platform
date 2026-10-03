"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PickTarget } from "@/components/location-map-impl";

// Leaflet reads `window` as soon as it is imported, so the real map is loaded
// dynamically with SSR disabled. Until it resolves we render a same-height
// placeholder so the page still prerenders without layout shift.
const LocationMap = dynamic(
  () => import("@/components/location-map-impl").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-slate-100 text-sm text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-r-transparent" />
          Loading map…
        </span>
      </div>
    ),
  }
);

export type { PickTarget };
export type { MapPoint } from "@/components/location-map-impl";

export function ClientOnlyMap(props: ComponentProps<typeof LocationMap>) {
  return <LocationMap {...props} />;
}
"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";
import { boundsFor, distanceKm } from "@/lib/geo";

export type PickTarget = "origin" | "destination" | "current" | null;

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

const DEFAULT_CENTER: [number, number] = [24.8607, 67.0011]; // Karachi
const DEFAULT_ZOOM = 12;

const PICK_TARGET_LABELS: Record<string, string> = {
  origin: "pickup",
  destination: "destination",
  current: "your position",
};

// Leaflet's default marker icons reference image files that are not bundled by
// the bundler, so we inline small SVG data URIs instead.
const MARKER_ICONS: Record<"origin" | "destination" | "driver", L.DivIcon> = {
  origin: createMarkerIcon("#0f766e", "A"),
  destination: createMarkerIcon("#4f46e5", "B"),
  driver: createMarkerIcon("#d97706", "C"),
};

function createMarkerIcon(color: string, letter: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
      <path d="M16 1C8.3 1 2 7.3 2 15c0 10.5 12.4 25.2 12.9 25.7a1.6 1.6 0 0 0 2.2 0C17.6 40.2 30 25.5 30 15 30 7.3 23.7 1 16 1z"
        fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="16" cy="15" r="6.5" fill="#ffffff"/>
      <text x="16" y="19" font-family="system-ui, sans-serif" font-size="9" font-weight="700"
        fill="${color}" text-anchor="middle">${letter}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
}

/** Keeps the viewport framed on whatever points are currently set. */
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const bounds = useMemo(() => boundsFor(points), [points]);

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [map, bounds]);

  return null;
}

/** Moves the map to a new centre when the caller changes it (e.g. geolocation). */
function Recentre({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [center, map]);
  return null;
}

export function LocationMap({
  origin,
  destination,
  driver,
  onPick,
  activeTarget = "origin",
  center,
  className = "",
}: {
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  driver?: MapPoint | null;
  onPick?: (target: PickTarget, point: LatLng) => void;
  activeTarget?: PickTarget;
  center?: LatLng | null;
  className?: string;
}) {
  const points = useMemo(() => {
    const list: LatLng[] = [];
    if (origin) list.push(origin);
    if (destination) list.push(destination);
    if (driver) list.push(driver);
    return list;
  }, [origin, destination, driver]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (center) return [center.lat, center.lng];
    if (origin) return [origin.lat, origin.lng];
    if (destination) return [destination.lat, destination.lng];
    return DEFAULT_CENTER;
  }, [center, origin, destination]);

  const route = useMemo(() => {
    if (!origin || !destination) return [];
    return [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ] as [number, number][];
  }, [origin, destination]);

  const tripDistance = origin && destination ? distanceKm(origin, destination) : null;

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />
        <Recentre center={center ?? null} />

        {onPick && (
          <MapClickHandler target={activeTarget} onPick={onPick} />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={MARKER_ICONS.origin}>
            <Tooltip permanent direction="top" offset={[0, -38]}>
              {origin.label ?? "Pickup"}
            </Tooltip>
          </Marker>
        )}

        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={MARKER_ICONS.destination}
          >
            <Tooltip permanent direction="top" offset={[0, -38]}>
              {destination.label ?? "Destination"}
            </Tooltip>
          </Marker>
        )}

        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={MARKER_ICONS.driver}>
            <Tooltip permanent direction="top" offset={[0, -38]}>
              {driver.label ?? "Driver"}
            </Tooltip>
          </Marker>
        )}

        {route.length === 2 && (
          <Polyline
            positions={route}
            pathOptions={{ color: "#4f46e5", weight: 4, opacity: 0.75, dashArray: "8 8" }}
          />
        )}
      </MapContainer>

      {tripDistance != null && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
          {tripDistance < 1
            ? `${Math.round(tripDistance * 1000)} m apart`
            : `${tripDistance.toFixed(1)} km apart`}
        </div>
      )}

      {onPick && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
          Click the map to set {PICK_TARGET_LABELS[activeTarget ?? "origin"]}
        </div>
      )}
    </div>
  );
}

/**
 * Leaflet's click handling lives on the container element, so it is attached via
 * a child that has access to the map instance.
 */
function MapClickHandler({
  target,
  onPick,
}: {
  target: PickTarget;
  onPick: (target: PickTarget, point: LatLng) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    const handleClick = (event: L.LeafletMouseEvent) => {
      onPick(target, { lat: event.latlng.lat, lng: event.latlng.lng });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, target, onPick]);

  return null;
}


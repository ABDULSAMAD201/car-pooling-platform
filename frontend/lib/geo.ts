export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres between two points. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `a` to `b`, in degrees (0-360). */
export function bearing(a: LatLng, b: LatLng): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

/** Smallest angle between two bearings, in degrees (0-180). */
export function bearingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff <= 180 ? diff : 360 - diff;
}

const COMPASS_POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

export function compassDirection(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[index];
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** A straight line between two points, used as the route preview on the map. */
export function routeLine(a: LatLng, b: LatLng): [LatLng, LatLng] {
  return [a, b];
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Build a bounds tuple that always has some span, so Leaflet can frame a
 * single marker without collapsing to zero zoom.
 */
export function boundsFor(points: LatLng[]): [[number, number], [number, number]] | null {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return null;

  const lats = valid.map((p) => p.lat);
  const lngs = valid.map((p) => p.lng);
  let [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  let [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

  const MIN_SPAN = 0.006;
  if (maxLat - minLat < MIN_SPAN) {
    const center = (minLat + maxLat) / 2;
    minLat = center - MIN_SPAN / 2;
    maxLat = center + MIN_SPAN / 2;
  }
  if (maxLng - minLng < MIN_SPAN) {
    const center = (minLng + maxLng) / 2;
    minLng = center - MIN_SPAN / 2;
    maxLng = center + MIN_SPAN / 2;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
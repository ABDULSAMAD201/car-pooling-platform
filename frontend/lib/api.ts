const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MATCHING_API_URL = process.env.NEXT_PUBLIC_MATCHING_API_URL;
const NOTIFY_API_URL = process.env.NEXT_PUBLIC_NOTIFY_API_URL;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CreateRideRequest {
  user_id: string;
  origin: LatLng;
  destination: LatLng;
  time: string;
}

export interface Ride {
  id: string;
  user_id: string;
  origin: LatLng;
  destination: LatLng;
  requested_time: string;
  status: string;
  matched_driver_id: string | null;
  matched_ride_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  id: string;
  ride_id: string;
  driver_id: string | null;
  score: number | null;
  created_at: string;
}

export interface DriverAvailabilityCreate {
  driver_id: string;
  current_lat: number;
  current_lng: number;
  destination_lat: number;
  destination_lng: number;
  available_from?: string | null;
  available_to?: string | null;
}

export interface DriverAvailability {
  id: string;
  driver_id: string;
  current_lat: number;
  current_lng: number;
  destination_lat: number;
  destination_lng: number;
  is_active: boolean;
  available_from: string | null;
  available_to: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = "rider" | "driver" | "both";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  home_lat: number | null;
  home_lng: number | null;
  home_label: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  seats_offered: number;
  created_at: string;
}

export interface OpenRequest extends Ride {
  /** Name of the rider who booked it. Phone is withheld until they pick a driver. */
  rider_name: string;
}

export interface RideInterest {
  ride_id: string;
  driver_id: string;
  score: number | null;
  pickup_km: number | null;
  bearing_diff: number | null;
}

/** An interested driver as shown to the rider deciding who to travel with. */
export interface DriverCandidate {
  driver_id: string;
  full_name: string;
  phone: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  seats_offered: number;
  score: number | null;
  pickup_km: number | null;
  bearing_diff: number | null;
  interested_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Notification {
  id: number;
  user_id: string;
  ride_id: string | null;
  message: string;
  created_at: string;
}

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function normalizeBaseUrl(value: string | undefined, name: string): string {
  if (!value) {
    throw new ApiError(
      `${name} is not set. Copy .env.local.example to .env.local and set the backend URL.`
    );
  }
  return value.replace(/\/+$/, "");
}

function bookingBaseUrl(): string {
  return normalizeBaseUrl(API_URL, "NEXT_PUBLIC_API_URL");
}

function matchingBaseUrl(): string {
  return normalizeBaseUrl(MATCHING_API_URL, "NEXT_PUBLIC_MATCHING_API_URL");
}

function notifyBaseUrl(): string {
  return normalizeBaseUrl(NOTIFY_API_URL, "NEXT_PUBLIC_NOTIFY_API_URL");
}

/** Token supplied by the auth context; read lazily so it is never stale. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  base: string = bookingBaseUrl(),
  options: { auth?: boolean } = {}
): Promise<T> {
  const useAuth = options.auth ?? false;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (useAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Could not reach the backend at ${base}. Is the service running?`);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body?.detail)) {
        // FastAPI validation errors arrive as a list of field errors.
        message = body.detail
          .map((item: { msg?: string; loc?: (string | number)[] }) => {
            const field = item.loc?.filter((part) => part !== "body").join(".");
            return field ? `${field}: ${item.msg}` : (item.msg ?? "Invalid value");
          })
          .join(" ");
      } else if (body?.detail != null) {
        message = JSON.stringify(body.detail);
      }
    } catch {
      // Error body was not JSON; keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function createRide(payload: CreateRideRequest): Promise<Ride> {
  return request<Ride>("/rides", { method: "POST", body: JSON.stringify(payload) }, undefined, {
    auth: true,
  });
}

export async function fetchRide(rideId: string): Promise<Ride> {
  return request<Ride>(`/rides/${encodeURIComponent(rideId)}`, undefined, undefined, {
    auth: true,
  });
}

export async function fetchMyRides(): Promise<Ride[]> {
  return request<Ride[]>("/rides/mine", undefined, undefined, { auth: true });
}

/** Unassigned rides the signed-in driver can volunteer for. */
export async function fetchOpenRequests(): Promise<OpenRequest[]> {
  return request<OpenRequest[]>("/rides/requests", undefined, undefined, { auth: true });
}

/** Rides this driver has put themselves forward for. */
export async function fetchMyInterests(): Promise<Ride[]> {
  return request<Ride[]>("/rides/mine/interested", undefined, undefined, { auth: true });
}

/** Put the signed-in driver forward for a ride. Idempotent. */
export async function expressInterest(rideId: string): Promise<RideInterest> {
  return request<RideInterest>(
    `/rides/${encodeURIComponent(rideId)}/interest`,
    { method: "POST" },
    undefined,
    { auth: true }
  );
}

/** Withdraw interest before the rider chooses somebody. */
export async function withdrawInterest(rideId: string): Promise<void> {
  await request<void>(
    `/rides/${encodeURIComponent(rideId)}/interest`,
    { method: "DELETE" },
    undefined,
    { auth: true }
  );
}

/** Drivers who volunteered for this ride. Only the rider who booked it can read this. */
export async function fetchInterestedDrivers(rideId: string): Promise<DriverCandidate[]> {
  return request<DriverCandidate[]>(
    `/rides/${encodeURIComponent(rideId)}/candidates`,
    undefined,
    undefined,
    { auth: true }
  );
}

/** The rider choosing which interested driver takes the ride. */
export async function pickDriver(rideId: string, driverId: string): Promise<Ride> {
  return request<Ride>(
    `/rides/${encodeURIComponent(rideId)}/pick`,
    { method: "POST", body: JSON.stringify({ driver_id: driverId }) },
    undefined,
    { auth: true }
  );
}

export async function cancelRide(rideId: string): Promise<Ride> {
  return request<Ride>(
    `/rides/${encodeURIComponent(rideId)}/cancel`,
    { method: "PATCH" },
    undefined,
    { auth: true }
  );
}

export async function fetchMatchResult(rideId: string): Promise<MatchResult> {
  return request<MatchResult>(
    `/matches/${encodeURIComponent(rideId)}`,
    undefined,
    matchingBaseUrl()
  );
}

export async function registerDriverAvailability(
  payload: DriverAvailabilityCreate
): Promise<DriverAvailability> {
  return request<DriverAvailability>(
    "/drivers/availability",
    { method: "POST", body: JSON.stringify(payload) },
    matchingBaseUrl()
  );
}

export async function fetchDriverAvailability(
  activeOnly = true
): Promise<DriverAvailability[]> {
  return request<DriverAvailability[]>(
    `/drivers/availability?active_only=${activeOnly}`,
    undefined,
    matchingBaseUrl()
  );
}

export async function register(payload: {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role?: UserRole;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(): Promise<User> {
  return request<User>("/auth/me", undefined, undefined, { auth: true });
}

export async function updateProfile(changes: Partial<User>): Promise<User> {
  return request<User>(
    "/auth/me",
    { method: "PATCH", body: JSON.stringify(changes) },
    undefined,
    { auth: true }
  );
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return request<Notification[]>(
    `/notifications/${encodeURIComponent(userId)}`,
    undefined,
    notifyBaseUrl()
  );
}
export interface PublicProfile {
  id: string;
  full_name: string;
  vehicle: string;
  vehicle_plate: string;
}

export async function lookupUsers(ids: string[]): Promise<PublicProfile[]> {
  if (ids.length === 0) return [];
  return request<PublicProfile[]>(
    `/auth/users/lookup?ids=${ids.map(encodeURIComponent).join(",")}`,
    undefined,
    undefined,
    { auth: true }
  );
}

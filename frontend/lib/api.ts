const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MATCHING_API_URL = process.env.NEXT_PUBLIC_MATCHING_API_URL;

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

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function bookingBaseUrl(): string {
  if (!API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not set. Copy .env.local.example to .env.local and set the backend URL."
    );
  }
  return API_URL.replace(/\/+$/, "");
}

function matchingBaseUrl(): string {
  if (!MATCHING_API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_MATCHING_API_URL is not set. Copy .env.local.example to .env.local and set the matching service URL."
    );
  }
  return MATCHING_API_URL.replace(/\/+$/, "");
}

async function request<T>(path: string, init?: RequestInit, base: string = bookingBaseUrl()): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Could not reach the backend at ${base}. Is the service running?`
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      } else if (body?.detail != null) {
        message = JSON.stringify(body.detail);
      }
    } catch {
      // Error body was not JSON; keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function createRide(payload: CreateRideRequest): Promise<Ride> {
  return request<Ride>("/rides", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchRide(rideId: string): Promise<Ride> {
  return request<Ride>(`/rides/${encodeURIComponent(rideId)}`);
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
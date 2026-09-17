# Carpool Ride Request — Frontend

A simple, single-page Next.js app (App Router, TypeScript, Tailwind CSS) for requesting
carpool rides. It is the frontend for a learning project about backend resilience
engineering — it only calls the backend API and contains no matching, notification,
or database logic.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local env file and set the API base URL:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` so `NEXT_PUBLIC_API_URL` points at the booking service, e.g.
   `http://localhost:8000` (the booking service from `docker-compose.yml`) or
   `http://carpool.local:8080`, and `NEXT_PUBLIC_MATCHING_API_URL` points at the
   matching service, e.g. `http://localhost:8001` (used to look up match results).

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Scripts

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `npm run dev`    | Start the dev server             |
| `npm run build`  | Production build                 |
| `npm run start`  | Serve the production build       |

## How it works

- `lib/api.ts` — all backend calls (`POST /rides`, `GET /rides/{id}`,
  `GET /matches/{id}`), kept separate from the UI. Base URLs are read from
  `NEXT_PUBLIC_API_URL` (booking) and `NEXT_PUBLIC_MATCHING_API_URL` (matching)
  and never hardcoded.
- `app/page.tsx` — the ride request page: a form (user ID, pickup/destination
  coordinates, pickup time) and a manual "check status" section. After a ride is
  submitted or checked, the matched driver and match score from the matching service
  are shown alongside the status.
- `app/driver/page.tsx` — the driver page: registers driver availability (driver ID,
  current location, destination) with the matching service so rides can be matched.

## API contract

Create a ride:

```
POST /rides
{
  "user_id": "string",
  "origin": { "lat": 24.8607, "lng": 67.0011 },
  "destination": { "lat": 24.9, "lng": 67.05 },
  "time": "2026-09-08T19:00:00Z"
}
```

Check a ride's status:

```
GET /rides/{ride_id}
```

## Trying a match end to end

The match score only appears when an active driver is registered near the ride's
pickup heading the same direction (within 5 km and 45° of bearing). To see a real
score:

1. Open http://localhost:3000/driver and register a driver near your planned route
   (e.g. current `24.8620, 67.0020` → destination `24.8720, 67.0120`).
2. Back on http://localhost:3000, submit a ride whose pickup is within a few
   hundredths of a degree of that driver (e.g. origin `24.86, 67.0` → destination
   `24.87, 67.01`). The ride must be created *after* the driver registers.
3. The ride response shows the matched driver and score (lower score = better
   match: distance in km plus a direction penalty).
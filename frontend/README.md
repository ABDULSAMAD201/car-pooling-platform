# Carpool frontend

Next.js (App Router), TypeScript and Tailwind CSS. It talks to the booking, matching and notify services; see the [root README](../README.md) for the whole platform.

## Run

```bash
cp .env.local.example .env.local   # backend URLs, default to localhost:8000/8001/8002
npm install
npm run dev                        # http://localhost:3000
```

Other commands: `npm run build` (production build) and `npm run start` (serve it).

## Structure

- `app/` — pages: landing, login/signup, book a ride, my rides, ride details, driver area, profile, settings, notifications
- `components/` — shared UI, header, map and role-aware pieces
- `lib/` — API client, auth context, portal rules (passenger vs driver) and geo helpers

Backend URLs come from `NEXT_PUBLIC_*` variables in `.env.local`; never hardcode them.

# Matching Service

A lightweight FastAPI service that stores driver availability and runs a placeholder ride matcher before reporting the result back to Booking.

## Features

- Register driver availability
- List currently active drivers
- Store match results per ride request
- Use a swappable `find_match` implementation behind a single service function
- Gracefully fail the Booking callback without breaking the `/match` response
- Expose a Kubernetes-friendly health endpoint

## Local development

1. Create and activate a virtual environment.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and update the values as needed.
4. Run the app:
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8001`

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/matching_service?sslmode=require`
- `BOOKING_SERVICE_URL`: Base URL for the Booking Service, default `http://localhost:8000`

## Testing

Run:

`pytest`

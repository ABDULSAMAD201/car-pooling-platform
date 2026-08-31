# Booking Service

A lightweight FastAPI service for the ride request lifecycle.

## Features

- Create ride requests and persist them in PostgreSQL
- Expose ride status and history APIs
- Call the Matching Service for ride matching without failing the request when that API is unavailable
- Notify the Notify Service on status changes or cancellations without failing the underlying update
- Include a DB health check for Kubernetes probes

## Local development

1. Create and activate a virtual environment.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and update the values as needed.
4. Run the app:
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string. Example: `postgresql://postgres:postgres@localhost:5432/booking_service?sslmode=require`
- `MATCHING_SERVICE_URL`: Base URL for the Matching Service, default `http://localhost:8001`
- `NOTIFY_SERVICE_URL`: Base URL for the Notify Service, default `http://localhost:8002`
- `CORS_ORIGINS`: Comma-separated list of allowed frontend origins; default `http://localhost:3000`

## Testing

Run:

`pytest`

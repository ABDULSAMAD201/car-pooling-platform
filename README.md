# Carpool

A carpooling platform: three small backend services and a Next.js web app. Passengers post a ride request, nearby drivers volunteer, and the passenger chooses who picks them up.

## How it works

1. A **passenger** signs up, picks a pickup and destination on the map, and requests a ride.
2. **Drivers** go online with their route, see open requests and volunteer.
3. The passenger sees everyone who volunteered, ranked by match score, and **chooses a driver**.
4. Both sides get notifications and can follow the ride's status until it is completed or cancelled.

## Architecture

| Part | Port | What it does |
|---|---|---|
| `frontend` | 3000 | Next.js web app with separate passenger and driver areas |
| `booking-service` | 8000 | Accounts, login, rides, driver interest and driver choice (FastAPI) |
| `matching-service` | 8001 | Driver availability and match scoring (FastAPI) |
| `notify-service` | 8002 | Stores and serves ride notifications (FastAPI) |

Each service has its own database and talks to the others over HTTP.

## Run it

You need Docker and Node.js 20+.

1. Create each backend's config from its template. Set `DATABASE_URL` to any PostgreSQL URL (a free Neon database works) and set `AUTH_SECRET_KEY` in `booking-service/.env` to a long random string.

   ```bash
   cp booking-service/.env.example booking-service/.env
   cp matching-service/.env.example matching-service/.env
   cp notify-service/.env.example notify-service/.env
   ```

2. Start the backends:

   ```bash
   docker compose up --build
   ```

3. Start the frontend:

   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm install
   npm run dev
   ```

Open http://localhost:3000 and create an account. Create one account as a driver and one as a passenger to try the full flow.

**Secrets:** `.env` files hold credentials and are git-ignored. Never commit them. If a service has no `DATABASE_URL`, it falls back to a local SQLite file.

## Test

```bash
cd booking-service && python -m pytest        # likewise matching-service and notify-service
scripts/dev-start.sh && scripts/e2e-test.sh   # end-to-end without Docker; then stop the servers
```

## Deploy

- `k8s/` has Kubernetes manifests (tested on minikube). Each service reads `DATABASE_URL` from a Kubernetes secret named `booking-secret`, `matching-secret` or `notify-secret`.
- `.github/workflows/backend-ci.yaml` runs each service's tests on every push and pull request, and builds and pushes the Docker images to Docker Hub from `main`. It needs the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.

API details are in [docs/api-contracts.md](docs/api-contracts.md).

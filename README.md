# Carpool

A carpooling platform built as three small services and a web app. Passengers request rides, drivers volunteer, and passengers choose who picks them up.

| Part | Port | What it does |
|---|---|---|
| `frontend` | 3000 | Next.js web app for passengers and drivers |
| `booking-service` | 8000 | Accounts, login, rides, driver interest and picks (FastAPI) |
| `matching-service` | 8001 | Driver availability and match scoring (FastAPI) |
| `notify-service` | 8002 | Stores and serves ride notifications (FastAPI) |

## Run it

You need Docker and Node.js 20+.

1. Create each backend's config from its template and set `DATABASE_URL` (any PostgreSQL URL, e.g. a free Neon database). Set `AUTH_SECRET_KEY` in `booking-service/.env` to a long random string.

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

Open http://localhost:3000, create an account, and you're in.

`.env` files hold secrets and are git-ignored. Never commit them.

## Test

```bash
cd booking-service && python -m pytest        # likewise matching-service, notify-service
scripts/dev-start.sh && scripts/e2e-test.sh   # end-to-end, no Docker; stop with scripts/dev-stop.sh
```

## More

- `k8s/` has Kubernetes manifests (minikube); each service reads `DATABASE_URL` from a secret.
- `.github/workflows/backend-ci.yaml` runs the tests and builds Docker images on every push.
- API details are in `docs/api-contracts.md`.

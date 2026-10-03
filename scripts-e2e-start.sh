#!/usr/bin/env bash
# Local dev helper: start the three backend services for end-to-end checks.
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/.tmp-logs"

start() {
  local name="$1" dir="$2" port="$3"
  # Each service gets its own SQLite file. Paths are Windows-style absolute
  # paths, which SQLAlchemy requires for sqlite:/// URLs.
  local db_path
  db_path="$(cd "$ROOT/.tmp-logs" && pwd -W 2>/dev/null || pwd)/$name.db"
  ( cd "$ROOT/$dir" && DATABASE_URL="sqlite:///$db_path" \
      MATCHING_SERVICE_URL="http://localhost:8001" \
      NOTIFY_SERVICE_URL="http://localhost:8002" \
      BOOKING_SERVICE_URL="http://localhost:8000" \
      CORS_ORIGINS="http://localhost:3000" \
      AUTH_SECRET_KEY="local-dev-secret" \
      nohup python -m uvicorn app.main:app --host 127.0.0.1 --port "$port" \
      > "$ROOT/.tmp-logs/$name.log" 2>&1 & echo $! > "$ROOT/.tmp-logs/$name.pid" )
}

start booking booking-service 8000
start matching matching-service 8001
start notify notify-service 8002

sleep 7
echo "started: $(cat "$ROOT"/.tmp-logs/*.pid | tr '\n' ' ')"
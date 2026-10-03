#!/usr/bin/env bash
# Stop the local backend services started by scripts-e2e-start.sh.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/.tmp-logs"

if [ -d "$LOGS" ]; then
  for pidfile in "$LOGS"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile")"
    if kill "$pid" 2>/dev/null; then
      echo "stopped $pid ($(basename "$pidfile" .pid))"
    fi
  done
fi
rm -rf "$LOGS"
echo "cleaned up $LOGS"
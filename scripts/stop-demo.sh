#!/usr/bin/env bash
# stop-demo.sh — kill anything holding the Grain demo ports.
# Useful when start-demo.sh was orphaned (laptop sleep, force quit, etc.).

set -euo pipefail

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "killing port $port: $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  else
    echo "port $port already free"
  fi
}

kill_port 3001
kill_port 5173
echo "done."

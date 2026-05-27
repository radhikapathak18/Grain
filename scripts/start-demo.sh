#!/usr/bin/env bash
# start-demo.sh — launch the Grain demo cleanly on Parth's laptop.
#
# Why this exists: the Grain backend shells out to the local `claude` CLI binary
# (corporate IT blocks Anthropic API keys), so there is no cloud deploy. This
# script is what Parth runs ~2 minutes before going on stage. It frees the
# demo ports, verifies the toolchain, boots api+web, health-checks them, and
# traps Ctrl+C so a single keystroke tears everything down again.

set -euo pipefail

# Make Homebrew-installed pnpm/node visible regardless of how the shell was launched.
eval "$(/opt/homebrew/bin/brew shellenv)"

# Resolve to the repo root (this script lives in <repo>/scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Grain demo launcher"
echo "    repo: $REPO_ROOT"

# ----- Free the ports -----------------------------------------------------------------
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "    freeing port $port (killing: $pids)"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  else
    echo "    port $port already free"
  fi
}

echo "==> Clearing demo ports"
free_port 3001
free_port 5173

# ----- Install only if node_modules is missing ---------------------------------------
if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "==> node_modules missing — running pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
else
  echo "==> node_modules present — skipping install"
fi

# ----- Typecheck (bail if it fails) ---------------------------------------------------
echo "==> Running pnpm typecheck"
if ! pnpm typecheck; then
  echo "ERROR: pnpm typecheck failed. Fix TS errors before demoing." >&2
  exit 1
fi

# ----- Boot api + web in the background -----------------------------------------------
API_LOG="/tmp/grain-api.log"
WEB_LOG="/tmp/grain-web.log"

echo "==> Starting @grain/api (logs: $API_LOG)"
: > "$API_LOG"
pnpm -F @grain/api dev >"$API_LOG" 2>&1 &
API_PID=$!

echo "==> Starting @grain/web (logs: $WEB_LOG)"
: > "$WEB_LOG"
pnpm -F @grain/web dev >"$WEB_LOG" 2>&1 &
WEB_PID=$!

echo "    api pid: $API_PID"
echo "    web pid: $WEB_PID"

# ----- Cleanup on Ctrl+C / TERM -------------------------------------------------------
cleanup() {
  echo ""
  echo "==> Shutting down (api $API_PID, web $WEB_PID)"
  kill "$API_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  # Give them a moment to exit gracefully, then force-kill anything still on the ports.
  sleep 1
  free_port 3001
  free_port 5173
  exit 0
}
trap cleanup SIGINT SIGTERM

# ----- Health probes ------------------------------------------------------------------
echo "==> Waiting 4s for servers to come up"
sleep 4

probe() {
  local url="$1"
  local label="$2"
  if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
    echo "    ok: $label ($url)"
    return 0
  else
    echo "    FAIL: $label ($url)"
    return 1
  fi
}

echo "==> Probing health endpoints"
HEALTH_OK=1
probe "http://localhost:3001/api/health" "api direct" || HEALTH_OK=0
probe "http://localhost:5173/api/health" "web proxy"  || HEALTH_OK=0

if [[ "$HEALTH_OK" -ne 1 ]]; then
  echo "" >&2
  echo "ERROR: one or both health checks failed. Tail logs to debug:" >&2
  echo "  tail -n 100 $API_LOG" >&2
  echo "  tail -n 100 $WEB_LOG" >&2
  kill "$API_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  sleep 1
  free_port 3001
  free_port 5173
  exit 1
fi

cat <<EOF

================================================================================
  Grain is ready. Open http://localhost:5173
  Logs: $API_LOG  +  $WEB_LOG
  Ctrl+C in this terminal stops both servers cleanly.
================================================================================

EOF

# Block on both child processes; the trap handles Ctrl+C cleanup.
wait "$API_PID" "$WEB_PID"

#!/usr/bin/env bash
# Launch the API and web dev servers for the Grain E2E suite.
#
# Differences from `pnpm dev`:
#   - Sets CLAUDE_BIN to the in-repo mock shim so the API never spawns the
#     real Claude CLI binary.
#   - Runs the API and web concurrently; if either child exits, this script
#     terminates so Playwright's webServer block notices the failure.
#
# The script is invoked from `tests/e2e/playwright.config.ts` (cwd =
# tests/e2e), but resolves paths via $REPO_ROOT so it works whether you
# run it from tests/e2e or from the repo root.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
MOCK_CLAUDE="$SCRIPT_DIR/mock-claude.mjs"

if [ ! -x "$MOCK_CLAUDE" ]; then
  chmod +x "$MOCK_CLAUDE" || true
fi

export CLAUDE_BIN="$MOCK_CLAUDE"
export GRAIN_MODEL="${GRAIN_MODEL:-mock}"
export PORT="${PORT:-3001}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:5173}"

cd "$REPO_ROOT"

echo "[start-e2e] CLAUDE_BIN=$CLAUDE_BIN" >&2
echo "[start-e2e] PORT=$PORT WEB_ORIGIN=$WEB_ORIGIN" >&2

# Track child PIDs so we can clean them up.
pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# API first so the Vite proxy can immediately reach it.
pnpm --filter @grain/api dev &
pids+=($!)

pnpm --filter @grain/web dev -- --port 5173 --strictPort &
pids+=($!)

# Wait on any child. `wait -n` is bash 4+; on macOS default bash (3.2)
# we fall back to a polling loop that checks each PID. Exit when any
# child has died.
if wait -n "${pids[@]}" 2>/dev/null; then
  exit_code=$?
else
  exit_code=0
  while :; do
    for pid in "${pids[@]}"; do
      if ! kill -0 "$pid" 2>/dev/null; then
        wait "$pid" 2>/dev/null
        exit_code=$?
        break 2
      fi
    done
    sleep 1
  done
fi
echo "[start-e2e] a child exited with code $exit_code, tearing down" >&2
cleanup
exit "$exit_code"

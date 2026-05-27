# Chaos scenario: subprocess traps SIGTERM

## Goal

Verify `killWithEscalation()` in `apps/api/src/lib/process.ts`
correctly escalates SIGTERM → SIGKILL after 2 s when the child traps
SIGTERM.

## Shim

`tests/chaos/shims/trap-term.mjs` — installs a SIGTERM handler that
logs and ignores the signal. Stays alive forever otherwise.

## Setup

There are two ways to drive this:

### A. End-to-end via the abort path (preferred — covers `finally` cleanup)

1. Point the API at the trap shim and start it:

   ```bash
   chmod +x tests/chaos/shims/trap-term.mjs
   export CLAUDE_BIN="$(pwd)/tests/chaos/shims/trap-term.mjs"
   export GRAIN_MODEL=mock
   pnpm --filter @grain/api dev
   ```

2. Open an SSE request and abort it client-side BEFORE the idle timer
   fires (within 60 s):

   ```bash
   curl -N -X POST http://localhost:3001/api/chat/stream \
     -H 'content-type: application/json' \
     -H 'x-forwarded-for: 127.0.0.101' \
     -d '{
       "question": "What patterns appear in workspace setup feedback?",
       "role": "pm",
       "shape": "explore",
       "products": ["helix-core"]
     }' &
   CURL_PID=$!
   sleep 2
   kill -INT $CURL_PID   # client disconnect → generator finally → killWithEscalation
   ```

3. Observe in a third terminal:

   ```bash
   while true; do
     ps -ef | grep -v grep | grep trap-term.mjs && date '+%H:%M:%S.%N'
     sleep 0.2
   done
   ```

   - Immediately after the client abort, the child should receive
     SIGTERM (you will see one
     `chaos: trapped SIGTERM (#1), ignoring` line on the API's stderr
     output if you are tailing it).
   - ≈ 2 s later, the child must vanish from `ps`. That is SIGKILL
     winning.

### B. Isolated unit-style verification (no Hono server, fastest)

Useful if you just want to test the `process.ts` helper in isolation
under chaos conditions.

```bash
cat <<'TS' > /tmp/chaos-trap.ts
import { spawn } from 'node:child_process';
import { killWithEscalation } from './apps/api/src/lib/process.ts';

const proc = spawn(process.cwd() + '/tests/chaos/shims/trap-term.mjs');
proc.stderr.pipe(process.stderr);
proc.stdin.end();

setTimeout(() => {
  console.log('chaos: calling killWithEscalation at', new Date().toISOString());
  killWithEscalation(proc);
}, 500);

proc.on('close', (code, signal) => {
  console.log('chaos: child closed code=', code, 'signal=', signal);
});
TS

pnpm tsx /tmp/chaos-trap.ts
```

## Expected resilience behaviour

| t (ms)         | What happens                                                       |
|----------------|--------------------------------------------------------------------|
| 0              | `killWithEscalation(proc)` called.                                 |
| 0              | `proc.kill('SIGTERM')` fires.                                      |
| 0              | Shim's SIGTERM handler runs, ignores signal.                       |
| 2000 (± ~50)   | Escalation timer fires. `proc.kill('SIGKILL')`.                    |
| 2000           | Kernel kills child. `close` fires with `signal === 'SIGKILL'`.     |

## Pass criteria

1. The `close` event's `signal` argument is `'SIGKILL'`
   (or, when wrapped through the SSE route, the audit line shows
   `outcome:'error'` and the child is gone).
2. Time from `killWithEscalation()` call to `close` event is
   ≥ 1.9 s and ≤ 2.5 s.
3. No `trap-term.mjs` process remains 1 s after the test ends.
4. The API process is unaffected — `GET /api/health` still 200.

## Fail signals

- Child still alive after 5 s → escalation never ran. Likely
  regression in `process.ts` setTimeout or guard.
- Escalation fires before 1.9 s → KILL_ESCALATION_MS regressed.
- API stops serving health checks → wrapper's `finally` block crashed
  the request handler.

## Notes

- Both variants are useful: Variant A covers the route's `finally`
  contract; Variant B isolates the helper.
- `process.signalCode` should be `'SIGKILL'` on the child for ~10 ms
  before close fires.

# Chaos scenario: subprocess floods stderr

## Goal

Verify the `STDERR_MAX_BYTES = 16 * 1024` ring buffer in
`apps/api/src/lib/claude.ts` actually caps memory. A misbehaving CLI
that writes a megabyte of warnings must not be able to grow the API's
heap without bound, and on non-zero exit only the LAST ≤500 chars of
stderr appear in the operator log.

## Shim

`tests/chaos/shims/noisy.mjs` — emits two valid stdout deltas, then
floods stderr with ~1 MB of repeated 64-byte warning lines, then exits
with code 2. The very last stderr line is the distinctive marker
`CHAOS-TAIL-MARKER-END-OF-STREAM` so reviewers can confirm the wrapper
logged the TAIL, not the HEAD.

## Setup

```bash
chmod +x tests/chaos/shims/noisy.mjs
export CLAUDE_BIN="$(pwd)/tests/chaos/shims/noisy.mjs"
export GRAIN_MODEL=mock

# Capture API logs + RSS samples for the run.
pnpm --filter @grain/api dev 2>&1 | tee /tmp/grain-api-noisy.log &
API_PID=$!
sleep 2  # wait for server up

# Sample RSS in KB every 200 ms while we drive the request.
( while kill -0 $API_PID 2>/dev/null; do
    ps -o rss= -p $API_PID
    sleep 0.2
  done ) > /tmp/grain-api-rss.tsv &
RSS_PID=$!

# Drive 5 back-to-back requests through the noisy shim.
for i in 1 2 3 4 5; do
  curl -sN -X POST http://localhost:3001/api/chat/stream \
    -H 'content-type: application/json' \
    -H "x-forwarded-for: 127.0.0.20$i" \
    -d '{
      "question": "Where does workspace setup friction show up?",
      "role": "pm",
      "shape": "explore",
      "products": ["helix-core"]
    }' > /dev/null
done

kill $RSS_PID 2>/dev/null
echo "RSS samples (KB):"
sort -n /tmp/grain-api-rss.tsv | uniq -c | tail -20
```

## Expected resilience behaviour

| What                                              | Expected                                  |
|---------------------------------------------------|--------------------------------------------|
| Per request, stderr written by shim               | ~1 MB                                      |
| Per request, stderr retained in `stderrBuf`       | ≤ 16 KB (STDERR_MAX_BYTES)                 |
| Per request, stderr written to API log on exit    | ≤ 500 chars (the `slice(-500)` tail)       |
| API RSS growth across 5 requests                  | Effectively flat (few MB of jitter)        |
| Tail content                                       | Ends with `CHAOS-TAIL-MARKER-END-OF-STREAM` |
| Client-visible SSE error message                  | `synthesis subprocess exited unexpectedly` |
| Client-visible error includes any stderr text     | NO — that would be a leak                  |

## Pass criteria

1. Operator log line for each request looks like:
   `[claude] requestId=… synthesis subprocess exited unexpectedly | exit=2 stderr-tail=…CHAOS-TAIL-MARKER-END-OF-STREAM`
2. The `stderr-tail=` portion is ≤ ~520 chars (500 chars + small
   framing).
3. RSS growth over the 5-request run is < 20 MB (i.e. no per-request
   leak proportional to the ~1 MB shim output).
4. Each client SSE feed sees one or two `delta` events (the deltas the
   shim emitted before the flood) and then the generic `error` event.
5. `ps -ef | grep noisy.mjs` returns no rows after the runs complete.

## Fail signals

- API RSS climbs by ~5 MB per request → ring buffer not trimming.
- Operator log line contains ≥1 KB of stderr → `slice(-500)` broke.
- Operator log tail starts with `WARN: chaos: noisy shim diagnostic` and
  NOT with `CHAOS-TAIL-MARKER-END-OF-STREAM` → the wrapper kept the
  HEAD instead of the TAIL.
- Client error event contains `chaos:` or `WARN:` strings → diagnostic
  leak.

## Notes

- The 16 KB cap is small enough that you can confirm the head-trim
  visually by inserting a `console.log(stderrBuf.length)` call in
  `claude.ts` locally — DO NOT commit that.
- Five requests is enough to make a leak obvious. For a harder test,
  run 100 requests in a loop and confirm RSS asymptotes.

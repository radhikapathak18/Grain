// Minimal structured audit logger. Writes one JSON object per line to
// stdout so downstream log shippers (logfwd / journald / Splunk fwd) can
// pick events up without parsing rules.
//
// Event names should be dot-namespaced (e.g. "chat.stream.start"). Fields
// should be primitive-only so the line stays single-line JSON.
export function audit(event: string, fields: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  console.log(JSON.stringify(entry));
}

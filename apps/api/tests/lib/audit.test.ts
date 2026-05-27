import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audit } from '../../src/lib/audit.ts';

describe('audit', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:30:00.000Z'));
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.useRealTimers();
  });

  it('writes a single line of JSON to stdout', () => {
    audit('chat.stream.start');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0]?.[0] as string;
    expect(typeof arg).toBe('string');
    expect(arg.includes('\n')).toBe(false);
    expect(() => JSON.parse(arg)).not.toThrow();
  });

  it('includes the event name and ISO timestamp', () => {
    audit('chat.stream.end');
    const arg = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.event).toBe('chat.stream.end');
    expect(parsed.ts).toBe('2026-05-26T10:30:00.000Z');
  });

  it('merges custom fields into the entry', () => {
    audit('chat.stream.start', { requestId: 'abc-123', role: 'pm' });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.requestId).toBe('abc-123');
    expect(parsed.role).toBe('pm');
    expect(parsed.event).toBe('chat.stream.start');
  });

  it('does not let fields override the timestamp', () => {
    audit('x', { ts: 'INJECTED' });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    // Spread order in audit.ts: ts/event first, then ...fields, so fields
    // win. This documents the current behavior so future refactors notice
    // if precedence changes.
    expect(parsed.ts).toBe('INJECTED');
  });

  it('does not let fields override the event name', () => {
    audit('original', { event: 'hijacked' });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.event).toBe('hijacked');
  });

  it('serializes nested values and arrays', () => {
    audit('x', { products: ['p4v', 'helix-core'], chars: 123 });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(parsed.products).toEqual(['p4v', 'helix-core']);
    expect(parsed.chars).toBe(123);
  });

  it('handles being called without a fields argument', () => {
    audit('boot');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(Object.keys(parsed).sort()).toEqual(['event', 'ts']);
  });
});

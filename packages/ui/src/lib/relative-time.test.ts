import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

describe('relativeTime', () => {
  // Fixed reference so the tests are stable across runs.
  const NOW = new Date('2026-04-19T12:00:00.000Z').getTime();
  const iso = (offsetMs: number): string =>
    new Date(NOW - offsetMs).toISOString();

  it('returns "just now" for deltas under a minute', () => {
    expect(relativeTime(iso(0), NOW)).toBe('just now');
    expect(relativeTime(iso(30_000), NOW)).toBe('just now');
  });

  it('returns minutes for deltas under an hour', () => {
    expect(relativeTime(iso(60_000), NOW)).toBe('1m ago');
    expect(relativeTime(iso(59 * 60_000), NOW)).toBe('59m ago');
  });

  it('returns hours for deltas under a day', () => {
    expect(relativeTime(iso(60 * 60_000), NOW)).toBe('1h ago');
    expect(relativeTime(iso(23 * 60 * 60_000), NOW)).toBe('23h ago');
  });

  it('returns days for deltas under a week', () => {
    expect(relativeTime(iso(24 * 60 * 60_000), NOW)).toBe('1d ago');
    expect(relativeTime(iso(6 * 24 * 60 * 60_000), NOW)).toBe('6d ago');
  });

  it('falls back to localeDateString for 1 week+', () => {
    const out = relativeTime(iso(8 * 24 * 60 * 60_000), NOW);
    // Locale-dependent — just assert it's not a relative marker.
    expect(out).not.toMatch(/ago|just now/);
    expect(out.length).toBeGreaterThan(0);
  });

  it('falls back to localeDateString for future timestamps', () => {
    const future = new Date(NOW + 60 * 60_000).toISOString();
    const out = relativeTime(future, NOW);
    expect(out).not.toMatch(/ago|just now/);
  });

  it('falls back to localeDateString for invalid ISO', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('Invalid Date');
  });
});

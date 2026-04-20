/**
 * Phase 49 — shared helper. "3m ago" / "2h ago" / "4d ago", fall
 * back to toLocaleDateString for anything older than a week so
 * month-old rows don't become visually indistinguishable from
 * fresh ones.
 *
 * Pure function, zero deps, safe to import in both RSC and client
 * components. Takes an explicit `now` argument for deterministic
 * unit testing; defaults to Date.now() at call time otherwise.
 */
export function relativeTime(iso: string, now?: number): string {
  const ts = new Date(iso).getTime();
  const nowMs = now ?? Date.now();
  const deltaMs = nowMs - ts;
  if (Number.isNaN(deltaMs) || deltaMs < 0) {
    return new Date(iso).toLocaleDateString();
  }
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (deltaMs < MIN) return 'just now';
  if (deltaMs < HOUR) return `${Math.floor(deltaMs / MIN)}m ago`;
  if (deltaMs < DAY) return `${Math.floor(deltaMs / HOUR)}h ago`;
  if (deltaMs < 7 * DAY) return `${Math.floor(deltaMs / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}

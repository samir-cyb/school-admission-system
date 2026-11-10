/**
 * Server clock offset, learned from the HTTP `Date` header (exposed by the API's CORS policy).
 * The countdown uses server time, so a guardian whose phone clock is wrong still sees the
 * real time left on the hold.
 */
let offsetMs = 0;
let samples = 0;

export function recordServerDate(dateHeader: string | null, requestStartedAt: number, responseAt: number): void {
  if (!dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;

  // The header has 1-second resolution and marks some moment during the request; use the midpoint
  // plus half a second as the best estimate of "now" on the server.
  const localMid = (requestStartedAt + responseAt) / 2;
  const sample = server + 500 - localMid;

  // Ignore sub-second jitter; follow real drift.
  if (samples === 0 || Math.abs(sample - offsetMs) > 1500) offsetMs = sample;
  samples += 1;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Test hook. */
export function resetClock(offset = 0): void {
  offsetMs = offset;
  samples = offset === 0 ? 0 : 1;
}

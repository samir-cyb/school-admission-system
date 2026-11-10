import { useEffect, useState } from "react";
import { serverNow } from "../lib/clock";

/**
 * Milliseconds left until `expiresAt`, measured on the server's clock.
 * Ticks 4× per second while running and stops at 0, so the UI flips to EXPIRED
 * the moment time is up — without waiting for the next poll or a page reload.
 */
export function useCountdown(expiresAt: string | undefined, active: boolean): number {
  const target = expiresAt ? Date.parse(expiresAt) : NaN;
  const compute = () => (Number.isNaN(target) ? 0 : Math.max(0, target - serverNow()));
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    if (!active || Number.isNaN(target)) return;

    const id = window.setInterval(() => {
      const next = compute();
      setRemaining(next);
      if (next <= 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active]);

  return remaining;
}

export function splitDuration(ms: number): { minutes: number; seconds: number; totalSeconds: number } {
  const totalSeconds = Math.ceil(ms / 1000);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60, totalSeconds };
}

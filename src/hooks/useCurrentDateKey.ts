import { useEffect, useState } from 'react';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';

const MINUTE_MS = 60_000;
const BOUNDARY_BUFFER_MS = 50;

/**
 * Returns the current YYYY-MM-DD key for the requested timezone and updates
 * automatically just after each minute boundary. This guarantees midnight
 * rollover without requiring a page refresh or unrelated state update.
 */
export function useCurrentDateKey(
  timeZone = CONFIGURED_TIMEZONE
): string {
  const [dateKey, setDateKey] = useState(() =>
    getIsoDateKeyInTimezone(0, timeZone)
  );

  useEffect(() => {
    let intervalId: number | undefined;

    const syncDateKey = () => {
      const nextDateKey = getIsoDateKeyInTimezone(0, timeZone);
      setDateKey((current) =>
        current === nextDateKey ? current : nextDateKey
      );
    };

    const startAlignedInterval = () => {
      syncDateKey();
      intervalId = window.setInterval(syncDateKey, MINUTE_MS);
    };

    const delayToNextMinute =
      MINUTE_MS - (Date.now() % MINUTE_MS) + BOUNDARY_BUFFER_MS;

    const timeoutId = window.setTimeout(
      startAlignedInterval,
      delayToNextMinute
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncDateKey();
      }
    };

    window.addEventListener('focus', syncDateKey);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', syncDateKey);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [timeZone]);

  return dateKey;
}

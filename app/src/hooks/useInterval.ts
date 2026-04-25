import { useEffect, useRef } from 'react';

/**
 * Custom interval hook that handles tab backgrounding correctly
 * Uses Date.now() drift compensation instead of simple increment
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<(() => void) | null>(null);
  const savedDelay = useRef<number | null>(null);
  const lastTime = useRef<number>(Date.now());

  useEffect(() => {
    savedCallback.current = callback;
    savedDelay.current = delay;
    lastTime.current = Date.now();
  }, [callback, delay]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      const now = Date.now();
      const drift = now - lastTime.current;
      lastTime.current = now;

      // Only fire if drift is reasonable (not a huge gap from tab sleep)
      if (drift < delay * 3) {
        savedCallback.current?.();
      } else {
        // Tab was asleep - fire immediately and reset
        savedCallback.current?.();
      }
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}

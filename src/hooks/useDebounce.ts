import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// useDebounce - debounce a value
// ---------------------------------------------------------------------------

/**
 * Returns a debounced version of the provided value. The returned value will
 * only update after `delay` milliseconds have elapsed since the last change
 * to the input value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ---------------------------------------------------------------------------
// useDebouncedCallback - debounce a callback
// ---------------------------------------------------------------------------

/**
 * Returns a stable, debounced version of the provided callback. Calls to the
 * returned function will be delayed until `delay` milliseconds have passed
 * since the last invocation. The pending timer is cleared on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep the ref pointing at the latest callback so the debounced
  // wrapper never closes over a stale reference.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clean up any pending timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const debouncedFn = useCallback(
    (...args: Args) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );

  return debouncedFn;
}

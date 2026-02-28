import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('does not update the value until the delay has passed', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 500 } },
    );

    rerender({ value: 'world', delay: 500 });
    expect(result.current).toBe('hello'); // Still old value

    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current).toBe('hello'); // Still waiting

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('world'); // Now updated
  });

  it('resets the timer when value changes again before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    );

    rerender({ value: 'b', delay: 300 });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');

    rerender({ value: 'c', delay: 300 });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a'); // Timer was reset

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c'); // Final value after full delay
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces the callback', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => { result.current('a'); });
    act(() => { result.current('b'); });
    act(() => { result.current('c'); });

    expect(fn).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(500); });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c'); // Only last call
  });

  it('returns a stable function reference', () => {
    const fn = vi.fn();
    const { result, rerender } = renderHook(() => useDebouncedCallback(fn, 500));
    const ref1 = result.current;
    rerender();
    expect(result.current).toBe(ref1);
  });

  it('uses the latest callback reference', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ cb }) => useDebouncedCallback(cb, 500),
      { initialProps: { cb: fn1 } },
    );

    act(() => { result.current('test'); });
    rerender({ cb: fn2 }); // Update callback

    act(() => { vi.advanceTimersByTime(500); });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith('test');
  });

  it('cleans up timer on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => { result.current('test'); });
    unmount();

    act(() => { vi.advanceTimersByTime(500); });
    expect(fn).not.toHaveBeenCalled(); // Timer was cleaned up
  });
});

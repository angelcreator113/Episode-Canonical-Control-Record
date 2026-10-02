/**
 * S9 (b) (Evoni, 2026-10-02; §8(hh)): "Large sticky episode header —
 * Collapse to a small episode title and navigation bar while scrolling."
 */
import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useScrolledPast from './useScrolledPast';

describe('useScrolledPast (S9 b)', () => {
  test('true once the page is scrolled past the threshold, false back at the top', () => {
    window.scrollY = 0;
    const { result } = renderHook(() => useScrolledPast(120));
    expect(result.current).toBe(false);
    act(() => { window.scrollY = 300; window.dispatchEvent(new Event('scroll')); });
    expect(result.current).toBe(true);
    act(() => { window.scrollY = 10; window.dispatchEvent(new Event('scroll')); });
    expect(result.current).toBe(false);
  });
});

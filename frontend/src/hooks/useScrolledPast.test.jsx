/**
 * S9 (b) (Evoni, 2026-10-02; §8(hh)): "Large sticky episode header —
 * Collapse to a small episode title and navigation bar while scrolling."
 */
import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useScrolledPast, { pageScrollTop } from './useScrolledPast';

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

  // Evoni, 2026-10-05: on a phone <body> scrolls and on a desktop
  // .app-content does; window.scrollY stays 0, so the header never collapsed.
  test('a scrolled <body> (phone) counts', () => {
    window.scrollY = 0;
    const { result } = renderHook(() => useScrolledPast(120));
    act(() => { document.body.scrollTop = 400; document.body.dispatchEvent(new Event('scroll')); });
    expect(result.current).toBe(true);
    act(() => { document.body.scrollTop = 0; document.body.dispatchEvent(new Event('scroll')); });
    expect(result.current).toBe(false);
  });

  test('a scrolled .app-content (desktop) counts', () => {
    window.scrollY = 0;
    const content = document.createElement('div');
    content.className = 'app-content';
    document.body.appendChild(content);
    const { result } = renderHook(() => useScrolledPast(120));
    act(() => { content.scrollTop = 500; content.dispatchEvent(new Event('scroll')); });
    expect(result.current).toBe(true);
    content.remove();
  });

  test('pageScrollTop reads the largest of the scrollers', () => {
    window.scrollY = 0;
    document.body.scrollTop = 250;
    expect(pageScrollTop()).toBe(250);
    document.body.scrollTop = 0;
  });

  // Evoni, 2026-10-06: the banner flickered between full and compact.
  test('with a release line it stays past until scrolled back above it', () => {
    window.scrollY = 0;
    const { result } = renderHook(() => useScrolledPast(120, 60));
    const at = (y) => act(() => { window.scrollY = y; window.dispatchEvent(new Event('scroll')); });
    at(121);
    expect(result.current).toBe(true);
    at(90); // between the lines: no flip back
    expect(result.current).toBe(true);
    at(119);
    expect(result.current).toBe(true);
    at(59);
    expect(result.current).toBe(false);
    at(100); // between the lines on the way down: no flip either
    expect(result.current).toBe(false);
    at(121);
    expect(result.current).toBe(true);
    window.scrollY = 0;
  });
});

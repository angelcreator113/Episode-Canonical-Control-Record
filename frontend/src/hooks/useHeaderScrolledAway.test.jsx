/**
 * Evoni, 2026-10-23 (Android): the episode header "jumps" while scrolling on
 * a phone. The full header now scrolls away and the compact one takes over
 * when only its own height of the full header is still showing.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import useHeaderScrolledAway, { nextCompact } from './useHeaderScrolledAway';

describe('nextCompact', () => {
  test('turns compact once no more than the compact height of the full header shows', () => {
    expect(nextCompact(false, 200, 118)).toBe(false);
    expect(nextCompact(false, 119, 118)).toBe(false);
    expect(nextCompact(false, 118, 118)).toBe(true);
    expect(nextCompact(false, -40, 118)).toBe(true);
  });

  test('stays compact until the full header shows its compact height plus the margin', () => {
    expect(nextCompact(true, 118, 118)).toBe(true);
    expect(nextCompact(true, 149, 118)).toBe(true);
    expect(nextCompact(true, 150, 118)).toBe(false);
    expect(nextCompact(true, 160, 118, 48)).toBe(true);
  });
});

describe('useHeaderScrolledAway', () => {
  let top;
  let sentinel;
  beforeEach(() => {
    top = 0;
    sentinel = { getBoundingClientRect: () => ({ top }) };
    // Runs the frame at once; 0 so the next scroll schedules again.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 0; });
  });
  afterEach(() => vi.restoreAllMocks());

  const render = (enabled = true) => renderHook(({ on }) => useHeaderScrolledAway({
    enabled: on,
    sentinelRef: { current: sentinel },
    fullHeight: () => 356,
    compactHeight: () => 118,
    stickTop: () => 0,
  }), { initialProps: { on: enabled } });

  const scrollTo = (y) => act(() => { top = -y; document.body.dispatchEvent(new Event('scroll')); });

  test('follows the full header scrolling up and back down, with no flip in between', () => {
    const { result } = render();
    expect(result.current).toBe(false);
    scrollTo(120);
    expect(result.current).toBe(false); // the old 120px rule no longer applies
    scrollTo(237);
    expect(result.current).toBe(false); // 119px of the full header still shows
    scrollTo(238);
    expect(result.current).toBe(true); // 118px left: the compact header takes its place
    scrollTo(210);
    expect(result.current).toBe(true); // inside the margin
    scrollTo(206);
    expect(result.current).toBe(false); // 150px shows again
  });

  test('off (desktop): never compact from this hook', () => {
    const { result } = render(false);
    scrollTo(600);
    expect(result.current).toBe(false);
  });
});

describe('episode page wiring', () => {
  const page = readFileSync(resolve(__dirname, '../pages/EpisodeDetail.jsx'), 'utf8');
  const css = readFileSync(resolve(__dirname, '../pages/EpisodeDetail.css'), 'utf8');

  test('a phone uses the scrolled-away header; a desktop keeps the 120/60 rule', () => {
    expect(page).toMatch(/const headerCompact = isPhone \? scrolledAway : scrolledPast;/);
    expect(page).toMatch(/useScrolledPast\(120, 60\)/);
    expect(page).toMatch(/className="ed-header-sentinel"/);
  });

  test('on a phone the full header scrolls with the page and the tabs stick under the compact one', () => {
    const phone = css.slice(css.indexOf('The full header scrolls away with the page'));
    expect(phone).toMatch(/\.ed-header-new:not\(\.is-compact\) \{ position: relative; top: auto; \}/);
    expect(phone).toMatch(/backdrop-filter: none;/);
    expect(phone).toMatch(/top: calc\(var\(--app-header-h, 0px\) \+ var\(--ed-head-compact-h, var\(--ed-head-h, 0px\)\)\);/);
  });
});

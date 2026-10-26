/**
 * The stats panel's boxes (Task 3164): new boxes inside the design, moved
 * and sized without leaving the art; icons by their overlay key.
 */
import { test, expect } from 'vitest';
import { newSpot, moveSpot, resizeSpot, iconUrlsOf, PANEL_STATS, PANEL_SIZES, PANEL_ASPECT } from './statsPanel';

test('new boxes take the next stat and sit left to right inside the 1600 × 180 design', () => {
  const boxes = [0, 1, 2, 3].map((n) => newSpot(n));
  expect(boxes.map((b) => b.stat)).toEqual(PANEL_STATS.slice(0, 4).map((s) => s.key));
  expect(boxes.map((b) => b.x)).toEqual([10, 30, 50, 70]);
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(1600 / 1920 * 0 + 160 / 1920 * 100 - 0.1);
    expect(b.x + b.w).toBeLessThanOrEqual(100 - (160 / 1920) * 100 + 0.1);
    expect([b.y, b.h, b.icon, b.color]).toEqual([25, 50, null, null]);
  }
  expect(new Set(boxes.map((b) => b.id)).size).toBe(4);
});

test('a box moves and resizes in percent, and never leaves the art', () => {
  const b = { id: 'b', stat: 'coins', x: 10, y: 25, w: 18, h: 50 };
  expect(moveSpot(b, 5.04, -5)).toMatchObject({ x: 15, y: 20 });
  expect(moveSpot(b, 200, 200)).toMatchObject({ x: 82, y: 50 });
  expect(moveSpot(b, -50, -50)).toMatchObject({ x: 0, y: 0 });
  expect(resizeSpot(b, 2, 10)).toMatchObject({ w: 20, h: 60 });
  expect(resizeSpot(b, -100, -100)).toMatchObject({ w: 2, h: 2 });
  expect(resizeSpot(b, 500, 500)).toMatchObject({ w: 90, h: 75 });
});

test('icons by overlay key; the sizes and the master shape', () => {
  expect(iconUrlsOf([{ id: 'coin_icon', url: 'https://x/c.png' }, { id: 'none', url: null }])).toEqual({ coin_icon: 'https://x/c.png' });
  expect(PANEL_SIZES.map((s) => [s.key, s.dims])).toEqual([['1080p', '1920 × 220'], ['4k', '3840 × 440']]);
  expect(PANEL_ASPECT).toBeCloseTo(1920 / 220);
});

test('stress is a panel stat, the one where lower is better', () => {
  expect(PANEL_STATS.find((s) => s.key === 'stress')).toEqual({ key: 'stress', label: 'Stress', lowerIsBetter: true });
  expect(PANEL_STATS.filter((s) => s.lowerIsBetter).map((s) => s.key)).toEqual(['stress']);
  expect(newSpot(4).stat).toBe('stress');
});

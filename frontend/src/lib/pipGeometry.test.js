/** Moving and resizing Prime in the preview (Timeline Editor redesign P3). */
import { describe, test, expect } from 'vitest';
import { dragLayout, sameLayout } from './pipGeometry';

const start = { x: 1300, y: 700, w: 480, h: 270 };

describe('dragLayout', () => {
  test('a move keeps the size', () => {
    expect(dragLayout(start, 'move', -300, -200)).toEqual({ x: 1000, y: 500, w: 480, h: 270 });
  });
  test('a move snaps an edge to the safe margin or the frame edge within 12 px', () => {
    expect(dragLayout(start, 'move', 100, 0)).toEqual({ x: 1392, y: 700, w: 480, h: 270 }); // right edge 1872 = 1920 − 48
    expect(dragLayout(start, 'move', 0, 60)).toMatchObject({ y: 762 }); // bottom edge 1030 snaps to 1032 = 1080 − 48
    expect(dragLayout(start, 'move', 0, 105)).toMatchObject({ y: 810 }); // bottom edge 1075 snaps to the frame's edge
    expect(dragLayout(start, 'move', 0, 105, { snap: 0 })).toMatchObject({ y: 805 });
  });
  test('a corner keeps the proportions from the opposite corner; Shift frees them', () => {
    const se = dragLayout(start, 'se', 96, 0, { snap: 0 });
    expect(se).toEqual({ x: 1300, y: 700, w: 576, h: 324 });
    const nw = dragLayout(start, 'nw', -96, 0, { snap: 0 });
    expect(nw).toEqual({ x: 1204, y: 646, w: 576, h: 324 });
    expect(dragLayout(start, 'se', 96, 0, { free: true, snap: 0 })).toEqual({ x: 1300, y: 700, w: 576, h: 270 });
  });
  test('an edge handle changes one side; the box never gets smaller than 64 px', () => {
    expect(dragLayout(start, 'e', -50, 0, { snap: 0 })).toEqual({ x: 1300, y: 700, w: 430, h: 270 });
    expect(dragLayout(start, 'n', 0, 40, { snap: 0 })).toEqual({ x: 1300, y: 740, w: 480, h: 230 });
    expect(dragLayout(start, 'w', 1000, 0, { snap: 0 })).toMatchObject({ w: 64, x: 1716 });
  });
  test('sameLayout', () => {
    expect(sameLayout(start, { ...start })).toBe(true);
    expect(sameLayout(start, { ...start, x: 1301 })).toBe(false);
  });
});

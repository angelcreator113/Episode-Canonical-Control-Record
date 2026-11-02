/**
 * Moving and resizing Prime's PIP in the preview (Timeline Editor redesign
 * P3; plan §3.5). Pure: a layout { x, y, w, h } in 1920×1080 pixels, a
 * handle, and how far the pointer moved (in frame pixels) give the new
 * layout. Corner handles keep the aspect ratio unless `free`; edge handles
 * change one side. Edges snap to the frame's edges, its centre lines and a
 * 48 px safe margin when within `snap` pixels.
 */
import { FRAME_W, FRAME_H } from './editTimeline';

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const SAFE_MARGIN = 48;
const MIN_SIZE = 64;

const xGuides = [0, SAFE_MARGIN, FRAME_W / 2, FRAME_W - SAFE_MARGIN, FRAME_W];
const yGuides = [0, SAFE_MARGIN, FRAME_H / 2, FRAME_H - SAFE_MARGIN, FRAME_H];

/** The nearest guide within `snap` of v, else v. */
const near = (v, guides, snap) => {
  let best = v;
  let d = snap + 1;
  for (const g of guides) if (Math.abs(g - v) <= snap && Math.abs(g - v) < d) { best = g; d = Math.abs(g - v); }
  return best;
};

/** A move: the box keeps its size; its left/right (and top/bottom, and centre) snap. */
function moved(l, dx, dy, snap) {
  let x = l.x + dx;
  let y = l.y + dy;
  if (snap > 0) {
    const sx = [near(x, xGuides, snap) - x, near(x + l.w, xGuides, snap) - (x + l.w), near(x + l.w / 2, xGuides, snap) - (x + l.w / 2)].find((d) => d !== 0) || 0;
    const sy = [near(y, yGuides, snap) - y, near(y + l.h, yGuides, snap) - (y + l.h), near(y + l.h / 2, yGuides, snap) - (y + l.h / 2)].find((d) => d !== 0) || 0;
    x += sx;
    y += sy;
  }
  return { x, y, w: l.w, h: l.h };
}

/**
 * The layout after dragging `handle` ('move' or one of HANDLES) by (dx, dy)
 * frame pixels from `start`. Whole pixels; never smaller than 64 px.
 */
export function dragLayout(start, handle, dx, dy, { free = false, snap = 12 } = {}) {
  const l = { x: Number(start.x), y: Number(start.y), w: Number(start.w), h: Number(start.h) };
  if (handle === 'move') {
    const m = moved(l, dx, dy, snap);
    return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.w), h: Math.round(m.h) };
  }
  let left = l.x;
  let top = l.y;
  let right = l.x + l.w;
  let bottom = l.y + l.h;
  if (handle.includes('w')) left = near(left + dx, xGuides, snap);
  if (handle.includes('e')) right = near(right + dx, xGuides, snap);
  if (handle.includes('n')) top = near(top + dy, yGuides, snap);
  if (handle.includes('s')) bottom = near(bottom + dy, yGuides, snap);
  let w = Math.max(MIN_SIZE, right - left);
  let h = Math.max(MIN_SIZE, bottom - top);
  if (handle.includes('w')) left = right - w;
  if (handle.includes('n')) top = bottom - h;

  const corner = handle.length === 2;
  if (corner && !free && l.w > 0 && l.h > 0) {
    const ratio = l.w / l.h;
    // The larger relative change leads; the other side follows the ratio, from the fixed corner.
    if (Math.abs(w / l.w - 1) >= Math.abs(h / l.h - 1)) h = Math.max(MIN_SIZE, w / ratio);
    else w = Math.max(MIN_SIZE, h * ratio);
    if (handle.includes('w')) left = right - w;
    if (handle.includes('n')) top = bottom - h;
  }
  return { x: Math.round(left), y: Math.round(top), w: Math.round(w), h: Math.round(h) };
}

/** Whether two layouts differ (a drag that did not move saves nothing). */
export const sameLayout = (a, b) => Boolean(a && b) && ['x', 'y', 'w', 'h'].every((k) => Math.round(a[k]) === Math.round(b[k]));

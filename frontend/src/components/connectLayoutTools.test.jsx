/**
 * Connect's layout tools line up zones of different sizes by their centres
 * (Task #2030, doctrine rule 18).
 *
 * A zone's icon is drawn centred in the zone, so zones of different sizes
 * only look aligned when their centres are. Make Row / Make Column put the
 * centres on one line, one home-grid step apart; Align C aligns centres and
 * Align L / R edges; Dist H / V space centres evenly; Equal Size keeps each
 * zone's centre; Snap to Grid and Auto Layout put each centre on a
 * home-grid slot's centre. Every zone stays inside 0–100.
 *
 * The zones are a dock's worth: a 12×6 camera, a 16×8 phone and a 22×11 map
 * pin, off any line. frontend/e2e/layoutTools/run.cjs measures the same
 * tools in real Chromium, including the centre of each icon as drawn.
 */

import React, { createRef } from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone-editor/AIProposalReview', () => ({ default: () => null }));

import ScreenLinkEditor from './ScreenLinkEditor';
import { HOME_GRID, snapZoneToGrid, lineUpCentres } from './phone/homeGrid';

const SCREEN = { id: 'home', name: 'Homepage', url: 'https://x/home.png' };
const zone = (id, x, y, w, h) => ({ id, x, y, w, h, target: 'calls', label: id, icon_url: null, icon_urls: [] });
const dock = () => [zone('camera', 10, 70, 12, 6), zone('phone', 33, 74, 16, 8), zone('pin', 57, 65, 22, 11)];

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  try { localStorage.clear(); } catch (err) { console.warn(err); }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Applies one tool with nothing selected (so it acts on every zone) and
// returns the saved zones, by id.
function apply(kind, links = dock()) {
  const ref = createRef();
  const onSave = vi.fn();
  render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={links} iconOverlays={[]} onSave={onSave} embedded />);
  act(() => { ref.current.transformZones(kind); });
  act(() => { ref.current.save(); });
  const saved = onSave.mock.calls.at(-1)[0];
  return Object.fromEntries(saved.map(z => [z.id, z]));
}

const cx = (z) => z.x + (z.w / 2);
const cy = (z) => z.y + (z.h / 2);
const close = (a, b) => expect(a).toBeCloseTo(b, 2); // within 0.005 (tolerance 0.01)
const inside = (zs) => Object.values(zs).forEach((z) => {
  expect(z.x).toBeGreaterThanOrEqual(0);
  expect(z.y).toBeGreaterThanOrEqual(0);
  expect(z.x + z.w).toBeLessThanOrEqual(100 + 1e-9);
  expect(z.y + z.h).toBeLessThanOrEqual(100 + 1e-9);
});
const sizesKept = (zs) => {
  const start = Object.fromEntries(dock().map(z => [z.id, z]));
  Object.values(zs).forEach((z) => { expect(z.w).toBe(start[z.id].w); expect(z.h).toBe(start[z.id].h); });
};

describe('layout tools on mixed-size zones (Task #2030)', () => {
  test('Make Row: centres on one row, one home-grid step apart', () => {
    const z = apply('make_row');
    close(cy(z.camera), cy(z.phone)); close(cy(z.phone), cy(z.pin));
    close(cy(z.camera), (73 + 78 + 70.5) / 3); // the zones' mean centre line
    close(cx(z.phone) - cx(z.camera), HOME_GRID.stepX);
    close(cx(z.pin) - cx(z.phone), HOME_GRID.stepX);
    close(cx(z.camera), 16); // starts at the leftmost centre
    sizesKept(z); inside(z);
  });

  test('Make Column: centres in one column, one home-grid step apart', () => {
    const z = apply('make_column');
    close(cx(z.camera), cx(z.phone)); close(cx(z.phone), cx(z.pin));
    // Top to bottom by centre: pin, camera, phone.
    close(cy(z.camera) - cy(z.pin), HOME_GRID.stepY);
    close(cy(z.phone) - cy(z.camera), HOME_GRID.stepY);
    sizesKept(z); inside(z);
  });

  test('Align L: left edges equal', () => {
    const z = apply('align_left');
    [z.camera, z.phone, z.pin].forEach(v => close(v.x, 10));
    sizesKept(z); inside(z);
  });

  test('Align C: centres on one vertical line', () => {
    const z = apply('align_center');
    close(cx(z.camera), (16 + 41 + 68) / 3); close(cx(z.phone), cx(z.camera)); close(cx(z.pin), cx(z.camera));
    sizesKept(z); inside(z);
  });

  test('Align R: right edges equal', () => {
    const z = apply('align_right');
    [z.camera, z.phone, z.pin].forEach(v => close(v.x + v.w, 79));
    sizesKept(z); inside(z);
  });

  test('Dist H: centres evenly spaced, the outer two kept', () => {
    const z = apply('distribute_horizontal');
    close(cx(z.camera), 16); close(cx(z.pin), 68);
    close(cx(z.phone), 42);
    sizesKept(z); inside(z);
  });

  test('Dist V: centres evenly spaced, the outer two kept', () => {
    const z = apply('distribute_vertical');
    close(cy(z.pin), 70.5); close(cy(z.phone), 78);
    close(cy(z.camera), 74.25);
    sizesKept(z); inside(z);
  });

  test('Equal Size: one size, each zone keeping its centre', () => {
    const z = apply('equal_size');
    Object.values(z).forEach(v => { expect(v.w).toBe(12); expect(v.h).toBe(6); });
    close(cx(z.phone), 41); close(cy(z.phone), 78);
    close(cx(z.pin), 68); close(cy(z.pin), 70.5);
    inside(z);
  });

  test('Snap to Grid: each centre on its nearest home-grid slot\'s centre', () => {
    const z = apply('snap_grid');
    const slotCx = (col) => HOME_GRID.originX + (HOME_GRID.width / 2) + (col * HOME_GRID.stepX);
    const slotCy = (row) => HOME_GRID.originY + (HOME_GRID.height / 2) + (row * HOME_GRID.stepY);
    close(cx(z.camera), slotCx(0)); close(cx(z.phone), slotCx(1)); close(cx(z.pin), slotCx(3));
    [z.camera, z.phone, z.pin].forEach(v => close(cy(v), slotCy(4)));
    sizesKept(z); inside(z);
  });

  test('Auto Layout: icon-sized, each in the next slot, centred', () => {
    const z = apply('auto_layout');
    [z.camera, z.phone, z.pin].forEach((v, i) => {
      expect([v.w, v.h]).toEqual([HOME_GRID.width, HOME_GRID.height]);
      close(cx(v), HOME_GRID.originX + (HOME_GRID.width / 2) + (i * HOME_GRID.stepX));
      close(cy(v), HOME_GRID.originY + (HOME_GRID.height / 2));
    });
    inside(z);
  });
});

describe('the line stays inside the screen (Task #2030)', () => {
  test('Make Row near the right edge moves the row in rather than stacking zones', () => {
    // Left to right by centre: a (76), c (87), b (88).
    const z = apply('make_row', [zone('a', 70, 40, 12, 6), zone('b', 80, 42, 16, 8), zone('c', 76, 50, 22, 11)]);
    close(cx(z.c) - cx(z.a), HOME_GRID.stepX); close(cx(z.b) - cx(z.c), HOME_GRID.stepX);
    close(cy(z.a), cy(z.b)); close(cy(z.b), cy(z.c));
    close(z.b.x + z.b.w, 100); // moved in just far enough
    inside(z);
  });

  test('Make Row with too many zones for the step shrinks the step to fit', () => {
    const many = Array.from({ length: 6 }, (_, i) => zone(`z${i}`, i * 10, 30, 16, 8));
    const z = apply('make_row', many);
    const centres = Object.values(z).map(cx).sort((a, b) => a - b);
    const gaps = centres.slice(1).map((c, i) => c - centres[i]);
    gaps.forEach(g => close(g, gaps[0]));
    expect(gaps[0]).toBeLessThan(HOME_GRID.stepX);
    inside(z);
  });

  test('Align C with a zone that would cross the edge keeps every centre on one line', () => {
    const z = apply('align_center', [zone('a', 0, 10, 12, 6), zone('b', 2, 30, 40, 8)]);
    close(cx(z.a), cx(z.b));
    inside(z);
  });
});

describe('home grid helpers (Task #2030)', () => {
  test('snapZoneToGrid: an icon-sized zone lands on the slot\'s top-left, as before', () => {
    expect(snapZoneToGrid(zone('a', 30, 27, 12, 9))).toMatchObject({ x: 29, y: 28 });
  });

  test('snapZoneToGrid: a larger zone is centred in its slot', () => {
    const z = snapZoneToGrid(zone('a', 25, 25, 20, 13));
    close(cx(z), 35); close(cy(z), 32.5);
  });

  test('lineUpCentres: a step apart from the start when it fits, else fitted', () => {
    expect(lineUpCentres([12, 16, 22], 16, 21)).toEqual([16, 37, 58]);
    const fitted = lineUpCentres([20, 20, 20, 20, 20, 20], 10, 21);
    close(fitted[0], 10); close(fitted[5], 90);
  });
});

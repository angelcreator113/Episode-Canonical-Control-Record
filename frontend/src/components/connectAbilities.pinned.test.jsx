/**
 * Connect editor abilities, pinned on main before the TAP and ICON editors
 * become one (Task #2020, part 1 of 2; doctrine rule 18).
 *
 * TAP (ScreenLinkEditor): drawing a zone; a mouse drag moves a zone and
 * selects it; undo / redo; align, distribute and equal size; copy a zone to
 * other screens.
 * ICON (IconPlacementMode): Make Row, Make Column, Snap Selected, Auto
 * Layout, and a drag that snaps to the home grid when Snap is on.
 *
 * Task #2021 (part 2) deleted IconPlacementMode. Its five cases here now run
 * against the one editor, ScreenLinkEditor, through the same actions
 * (Multi Select, transformZones, iconGridSnap); every expected value is
 * unchanged.
 *
 * Abilities already pinned elsewhere, and required to keep passing: save
 * shape and per-zone upload and tap-to-place (zonesWorkspace.pinned), click /
 * drag / Multi Select in ICON (IconPlacementMode.drag), Move inside, the
 * picker beside the phone and "● Unsaved" (UIOverlaysTab.connect), saving on
 * Done and screen switch (UIOverlaysTab.homeAndIconSave), and
 * frontend/e2e/iconDrag/run.cjs. Saving on the jump to Content is pinned in
 * pages/UIOverlaysTab.connectAbilities.pinned.test.jsx.
 */

import React, { createRef } from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone-editor/AIProposalReview', () => ({ default: () => null }));

import ScreenLinkEditor from './ScreenLinkEditor';

// jsdom has no PointerEvent; a MouseEvent-based stand-in keeps coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SCREEN = { id: 'home', name: 'Homepage', url: 'https://x/home.png' };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call.png' };
const zone = (id, x, y, over = {}) => ({ id, x, y, w: 12, h: 9, target: 'calls', label: id, icon_url: null, icon_urls: [], ...over });

beforeEach(() => {
  // A 100×100 phone, so clientX/clientY are percentages of the screen.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  try { localStorage.clear(); } catch (err) { console.warn(err); }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const near = (v, want) => expect(v).toBeCloseTo(want, 0);

describe('TAP editor — pinned (Task #2020)', () => {
  function tap(links, props = {}) {
    const ref = createRef();
    const onZonesChange = vi.fn();
    const onSave = vi.fn();
    const utils = render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={links} iconOverlays={[CALL]} onSave={onSave} onZonesChange={onZonesChange} embedded {...props} />);
    const canvas = utils.container.querySelector('[style*="crosshair"]');
    const last = () => onZonesChange.mock.calls.at(-1);
    return { ...utils, ref, onSave, canvas, last };
  }

  test('drawing on the phone makes a tap zone', () => {
    const { canvas, last } = tap([]);
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 45, clientY: 50 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 45, clientY: 50 });
    const [zones, dirty, selected] = last();
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 20, y: 30, w: 25, h: 20, target: '', icon_url: null });
    expect(dirty).toBe(true);
    expect(selected).toBe(zones[0].id);
  });

  test('a mouse drag moves a zone and selects it', () => {
    const { container, canvas, last } = tap([zone('a', 10, 10), zone('b', 50, 10)]);
    fireEvent.pointerDown(container.querySelector('[data-zone-id="b"]'), { pointerId: 1, clientX: 55, clientY: 14 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 60, clientY: 30 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 60, clientY: 30 });
    const [zones, dirty, selected] = last();
    near(zones[1].x, 55); near(zones[1].y, 26);
    expect(zones[0]).toMatchObject({ x: 10, y: 10 });
    expect(dirty).toBe(true);
    expect(selected).toBe('b');
  });

  test('undo and redo step through edits', () => {
    const { ref, last } = tap([zone('a', 10, 10)]);
    act(() => { ref.current.updateZone('a', { label: 'Phone' }); });
    expect(last()[0][0].label).toBe('Phone');
    act(() => { ref.current.undo(); });
    expect(last()[0][0].label).toBe('a');
    act(() => { ref.current.redo(); });
    expect(last()[0][0].label).toBe('Phone');
  });

  test('align, distribute and equal size act on the zones', () => {
    const { ref, last } = tap([zone('a', 10, 10, { w: 20 }), zone('b', 30, 40), zone('c', 70, 70)]);
    act(() => { ref.current.transformZones('align_left'); });
    expect(last()[0].map(z => z.x)).toEqual([10, 10, 10]);
    act(() => { ref.current.transformZones('distribute_vertical'); });
    expect(last()[0].map(z => z.y)).toEqual([10, 40, 70]);
    // With no zone selected, Equal Size matches the first zone.
    act(() => { ref.current.transformZones('equal_size'); });
    expect(last()[0].map(z => z.w)).toEqual([20, 20, 20]);
  });

  test('a zone can be copied to other screens', async () => {
    const onBulkPlace = vi.fn().mockResolvedValue(undefined);
    render(<ScreenLinkEditor screen={SCREEN} links={[zone('a', 10, 10, { label: 'Phone' })]} iconOverlays={[CALL]} onSave={vi.fn()} onBulkPlace={onBulkPlace} allScreens={[{ id: 'home', name: 'Homepage' }, { id: 'calls', name: 'calls list' }]} />);
    fireEvent.click(screen.getAllByText('Phone')[0]);
    fireEvent.click(screen.getByText('📋 Also place on other screens'));
    fireEvent.click(screen.getByLabelText(/calls list/));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Place on 1 screen' })); });
    expect(onBulkPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', label: 'Phone' }), ['calls']);
  });
});

describe('ICON abilities — pinned (Task #2020; one editor since Task #2021)', () => {
  function icon(links, { snap = false } = {}) {
    const ref = createRef();
    const onSave = vi.fn();
    const utils = render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={links} iconOverlays={[CALL]} onSave={onSave} embedded multiSelect iconGridSnap={snap} />);
    const canvas = utils.container.querySelector('[style*="crosshair"]');
    const save = () => { act(() => { ref.current.save(); }); return onSave.mock.calls.at(-1)[0]; };
    const press = async (id, x, y, to = null) => {
      fireEvent.pointerDown(utils.container.querySelector(`[data-zone-id="${id}"]`), { pointerId: 1, clientX: x, clientY: y });
      if (to) fireEvent.pointerMove(canvas, { pointerId: 1, clientX: to[0], clientY: to[1] });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: (to || [x])[0], clientY: (to || [x, y])[1] });
      fireEvent.click(canvas);
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    };
    const act2 = (kind) => act(() => { ref.current.transformZones(kind); });
    return { ...utils, canvas, save, press, transform: act2 };
  }
  const three = () => [zone('a', 10, 12), zone('b', 40, 20), zone('c', 70, 30)];

  async function selectAll(press) {
    // Multi Select is on (the multiSelect prop, the workspace's toggle).
    await press('a', 15, 16); await press('b', 45, 24); await press('c', 75, 34);
  }

  test('Make Row lines the selected icons up on the home grid\'s row step', async () => {
    const { press, save, transform } = icon(three());
    await selectAll(press);
    transform('make_row');
    const z = save();
    expect(z.map(v => v.x)).toEqual([10, 31, 52]);
    near(z[0].y, 20.67); near(z[1].y, 20.67); near(z[2].y, 20.67);
  });

  test('Make Column stacks the selected icons on the home grid\'s column step', async () => {
    const { press, save, transform } = icon(three());
    await selectAll(press);
    transform('make_column');
    const z = save();
    expect(z.map(v => v.y)).toEqual([12, 26, 40]);
    near(z[0].x, 40); near(z[2].x, 40);
  });

  test('Snap Selected moves the selected icons onto home-grid slots', async () => {
    const { press, save, transform } = icon(three());
    await selectAll(press);
    transform('snap_grid');
    expect(save().map(v => [v.x, v.y])).toEqual([[8, 14], [50, 14], [71, 28]]);
  });

  test('Auto Layout puts every icon in the next home-grid slot, icon-sized', () => {
    const { save, transform } = icon([zone('a', 60, 60, { w: 20, h: 20 }), zone('b', 5, 80)]);
    transform('auto_layout');
    expect(save().map(v => [v.x, v.y, v.w, v.h])).toEqual([[8, 14, 12, 9], [29, 14, 12, 9]]);
  });

  test('with Snap on, a dragged icon lands on the nearest home-grid slot', async () => {
    const { press, save } = icon([zone('a', 8, 14)], { snap: true });
    await press('a', 14, 18, [37, 33]);
    expect(save()[0]).toMatchObject({ x: 29, y: 28 });
  });
});

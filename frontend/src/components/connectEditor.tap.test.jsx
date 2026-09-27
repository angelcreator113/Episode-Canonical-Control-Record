/**
 * TAP editor — ICON mode's abilities (Task #2020, one Connect editor, part 1).
 *
 * Tap an empty spot to place a library icon or a blank tap zone from a picker
 * (beside the phone when given a side panel); snap to the home icon grid;
 * Multi Select with group drag; Make Row / Column, Snap to Grid, Auto Layout;
 * a click on a zone moves nothing; Equal Size uses the selected zone.
 */

import React, { createRef } from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone-editor/AIProposalReview', () => ({ default: () => null }));

import ScreenLinkEditor from './ScreenLinkEditor';

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SCREEN = { id: 'home', name: 'Homepage', url: 'https://x/home.png' };
const CALL = { id: 'call_icon', name: 'Call Icon', category: 'phone_icon', url: 'https://x/call.png', opens_screen: 'calls' };
const TYPES = [{ key: 'calls', label: 'calls list' }, { key: 'dms', label: 'DMs' }];
const zone = (id, x, y, over = {}) => ({ id, x, y, w: 12, h: 9, target: 'calls', label: id, icon_url: null, icon_urls: [], ...over });
const PICKER = 'PICK AN ICON + WHERE IT OPENS';

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

function tap(links, props = {}) {
  const ref = createRef();
  const onZonesChange = vi.fn();
  const utils = render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={links} iconOverlays={[CALL]} screenTypes={TYPES} onSave={vi.fn()} onZonesChange={onZonesChange} embedded {...props} />);
  const canvas = utils.container.querySelector('[style*="crosshair"]');
  const last = () => onZonesChange.mock.calls.at(-1);
  const tapAt = (x, y) => {
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: x, clientY: y });
  };
  const pressZone = async (id, at, to = null, modifiers = {}) => {
    fireEvent.pointerDown(utils.container.querySelector(`[data-zone-id="${id}"]`), { pointerId: 1, clientX: at[0], clientY: at[1], ...modifiers });
    if (to) fireEvent.pointerMove(canvas, { pointerId: 1, clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: (to || at)[0], clientY: (to || at)[1] });
    fireEvent.click(canvas);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  };
  return { ...utils, ref, canvas, last, tapAt, pressZone };
}

describe('TAP editor — tap to place (Task #2020)', () => {
  test('a tap on an empty spot opens the picker; picking a library icon places it there, by key', () => {
    const { tapAt, last } = tap([]);
    tapAt(50, 40);
    expect(screen.getByText(PICKER)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Call Icon'));
    expect(screen.queryByText(PICKER)).toBeNull();
    const [zones, dirty, selected] = last();
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 44, y: 35.5, w: 12, h: 9, icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url], label: 'Call', target: 'calls' });
    expect(dirty).toBe(true);
    expect(selected).toBe(zones[0].id);
  });

  test('"Blank tap zone" places an icon-sized zone with no icon, opening the chosen screen', () => {
    const { tapAt, last } = tap([]);
    tapAt(50, 40);
    fireEvent.change(screen.getByLabelText(/Opens screen/), { target: { value: 'dms' } });
    fireEvent.click(screen.getByTitle('Blank tap zone'));
    expect(last()[0][0]).toMatchObject({ w: 12, h: 9, target: 'dms', icon_url: null, icon_urls: [], label: '' });
    expect(last()[0][0].icon_overlay_id).toBeUndefined();
  });

  test('with a side panel, the picker opens there, not under the phone', () => {
    const side = document.createElement('div');
    document.body.appendChild(side);
    const { container, tapAt } = tap([], { sidePanel: side });
    tapAt(50, 40);
    expect(within(side).getByText(PICKER)).toBeTruthy();
    expect(within(container).queryByText(PICKER)).toBeNull();
  });

  test('a tap near the edge places the zone inside; with Snap on it lands on the home grid', () => {
    const edge = tap([]);
    edge.tapAt(99, 99);
    fireEvent.click(screen.getByTitle('Blank tap zone'));
    expect(edge.last()[0][0]).toMatchObject({ x: 88, y: 91 });
    cleanup();
    const snapped = tap([], { iconGridSnap: true });
    snapped.tapAt(33, 30);
    fireEvent.click(screen.getByTitle('Blank tap zone'));
    expect(snapped.last()[0][0]).toMatchObject({ x: 29, y: 28 });
  });

  test('a short press that is neither a tap nor a drawing does nothing', () => {
    const { canvas, last } = tap([]);
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 53, clientY: 43 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 53, clientY: 43 });
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(last()[0]).toEqual([]);
  });

  test('drawing still makes a tap zone, and pressing a zone closes the picker', async () => {
    const { canvas, tapAt, pressZone, last } = tap([zone('a', 10, 10)]);
    tapAt(60, 60);
    expect(screen.getByText(PICKER)).toBeTruthy();
    await pressZone('a', [15, 14]);
    expect(screen.queryByText(PICKER)).toBeNull();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 40, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 70, clientY: 70 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 70, clientY: 70 });
    expect(last()[0]).toHaveLength(2);
    expect(screen.queryByText(PICKER)).toBeNull();
  });
});

describe('TAP editor — selection and layout (Task #2020)', () => {
  test('a click on a zone selects it and changes nothing', async () => {
    const { pressZone, last, ref } = tap([zone('a', 10, 10)]);
    await pressZone('a', [15, 14]);
    const [zones, dirty, selected] = last();
    expect(zones[0]).toMatchObject({ x: 10, y: 10 });
    expect(dirty).toBe(false);
    expect(selected).toBe('a');
    // No undo step was recorded for the click.
    act(() => { ref.current.undo(); });
    expect(last()[1]).toBe(false);
  });

  test('Multi Select adds zones to the selection, and a drag moves them together', async () => {
    const { pressZone, last } = tap([zone('a', 10, 10), zone('b', 40, 10), zone('c', 70, 10)], { multiSelect: true });
    await pressZone('a', [15, 14]);
    await pressZone('b', [45, 14]);
    expect(last()[3]).toEqual(['a', 'b']);
    await pressZone('b', [45, 14], [45, 34]);
    const [zones] = last();
    expect(zones.map(z => [z.id, z.y])).toEqual([['a', 30], ['b', 30], ['c', 10]]);
  });

  test('without Multi Select, a Ctrl-click adds a zone and a second Ctrl-click removes it', async () => {
    const { pressZone, last } = tap([zone('a', 10, 10), zone('b', 40, 10)]);
    await pressZone('a', [15, 14]);
    await pressZone('b', [45, 14], null, { ctrlKey: true });
    expect(last()[3]).toEqual(['a', 'b']);
    await pressZone('b', [45, 14], null, { ctrlKey: true });
    expect(last()[3]).toEqual(['a']);
  });

  test('Make Row and Make Column act on the selection', async () => {
    const { pressZone, ref, last } = tap([zone('a', 10, 12), zone('b', 40, 20), zone('c', 70, 30)], { multiSelect: true });
    await pressZone('a', [15, 16]);
    await pressZone('b', [45, 24]);
    act(() => { ref.current.transformZones('make_row'); });
    let z = last()[0];
    expect([z[0].x, z[1].x, z[2].x]).toEqual([10, 31, 70]);
    expect(z[0].y).toBe(16); expect(z[1].y).toBe(16); expect(z[2].y).toBe(30);
    act(() => { ref.current.transformZones('make_column'); });
    z = last()[0];
    expect([z[0].y, z[1].y]).toEqual([16, 30]);
  });

  test('Snap to Grid and Auto Layout use the home icon grid; with no selection they act on every zone', () => {
    const { ref, last } = tap([zone('a', 10, 12), zone('b', 40, 20, { w: 20, h: 20 })]);
    act(() => { ref.current.transformZones('snap_grid'); });
    expect(last()[0].map(z => [z.x, z.y])).toEqual([[8, 14], [50, 14]]);
    act(() => { ref.current.transformZones('auto_layout'); });
    expect(last()[0].map(z => [z.x, z.y, z.w, z.h])).toEqual([[8, 14, 12, 9], [29, 14, 12, 9]]);
  });

  test('Equal Size matches the selected zone, not the first (a stale handle before)', () => {
    const { ref, last } = tap([zone('a', 10, 10), zone('b', 30, 40, { w: 20, h: 15 }), zone('c', 60, 70)]);
    act(() => { ref.current.setSelectedZone('b'); });
    act(() => { ref.current.transformZones('equal_size'); });
    expect(last()[0].map(z => [z.w, z.h])).toEqual([[20, 15], [20, 15], [20, 15]]);
  });
});

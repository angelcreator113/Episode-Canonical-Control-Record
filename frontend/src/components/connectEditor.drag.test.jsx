/**
 * The Connect editor — pressing, clicking and dragging a zone (Task #2018;
 * moved from IconPlacementMode.drag.test.jsx by Task #2021, one editor).
 *
 * Pressing a zone captures the pointer on the phone, so in a browser the
 * release and the click that follows land on the phone, not the zone (seen in
 * real Chromium; frontend/e2e/iconDrag/run.cjs). These tests send the events
 * the same way: pointerdown on the zone, pointerup and click on the phone.
 * The click after a zone press must not open the picker; a press without
 * movement selects the zone; a drag moves it; a later tap on an empty spot
 * still opens the picker. (ICON mode's "grabbing" cursor has no counterpart:
 * the one editor's zones show the move cursor.)
 */

import React, { createRef } from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

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

const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call.png' };
const zone = (id, x, over = {}) => ({ id, x, y: 28, w: 12, h: 9, target: '', label: id, icon_url: CALL.url, icon_overlay_id: 'call_icon', ...over });
const PICKER = 'PICK AN ICON + WHERE IT OPENS';

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup(links = [zone('a', 29)], props = {}) {
  const ref = createRef();
  const onSave = vi.fn();
  const onZonesChange = vi.fn();
  const utils = render(<ScreenLinkEditor ref={ref} screen={{ id: 'home', url: 'https://x/home.png' }} links={links} iconOverlays={[CALL]} onSave={onSave} onZonesChange={onZonesChange} embedded {...props} />);
  const phone = utils.container.querySelector('[style*="crosshair"]');
  const el = (id) => utils.container.querySelector(`[data-zone-id="${id}"]`);
  const last = () => onZonesChange.mock.calls.at(-1);
  return { ...utils, ref, onSave, phone, el, last };
}

// A press on a zone as the browser delivers it once the phone holds the pointer.
async function press(el, phone, { from = [35, 32], to = null } = {}) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: from[0], clientY: from[1] });
  if (to) {
    for (let i = 1; i <= 4; i += 1) {
      fireEvent.pointerMove(phone, { pointerId: 1, clientX: from[0] + ((to[0] - from[0]) * i) / 4, clientY: from[1] + ((to[1] - from[1]) * i) / 4 });
    }
  }
  fireEvent.pointerUp(phone, { pointerId: 1, clientX: (to || from)[0], clientY: (to || from)[1] });
  fireEvent.click(phone, { clientX: (to || from)[0], clientY: (to || from)[1] });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

describe('Connect editor — zone press, click and drag (Task #2018, one editor since #2021)', () => {
  test('a click on a zone selects it and does not open the picker', async () => {
    const { phone, el, last } = setup();
    await press(el('a'), phone);
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(last()[2]).toBe('a');
    expect(el('a').style.left).toBe('29%');
  });

  test('a drag moves the zone and does not open the picker; Save carries the new x/y', async () => {
    const { phone, el, ref, onSave } = setup();
    await press(el('a'), phone, { from: [35, 32], to: [55, 48] });
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(parseFloat(el('a').style.left)).toBeCloseTo(49);
    expect(parseFloat(el('a').style.top)).toBeCloseTo(44);
    act(() => { ref.current.save(); });
    const saved = onSave.mock.calls[0][0][0];
    expect(saved.id).toBe('a');
    expect(saved.x).toBeCloseTo(49);
    expect(saved.y).toBeCloseTo(44);
  });

  test('a movement under the drag threshold is a click: nothing moves or is marked unsaved', async () => {
    const { phone, el, last } = setup();
    await press(el('a'), phone, { from: [35, 32], to: [35.2, 32.2] });
    expect(el('a').style.left).toBe('29%');
    expect(last()[1]).toBe(false);
    expect(last()[2]).toBe('a');
  });

  test('after a zone press, a tap on an empty spot still opens the picker', async () => {
    const { phone, el } = setup();
    await press(el('a'), phone);
    fireEvent.pointerDown(phone, { pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerUp(phone, { pointerId: 1, clientX: 80, clientY: 80 });
    expect(screen.getByText(PICKER)).toBeTruthy();
  });

  test('with Multi Select, clicking two zones selects both', async () => {
    const { phone, el, last } = setup([zone('a', 29), zone('b', 50)], { multiSelect: true });
    await press(el('a'), phone, { from: [35, 32] });
    await press(el('b'), phone, { from: [56, 32] });
    expect(last()[3]).toEqual(['a', 'b']);
    expect(screen.queryByText(PICKER)).toBeNull();
  });
});

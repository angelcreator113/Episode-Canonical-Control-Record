/**
 * IconPlacementMode — pressing, clicking and dragging an icon (Task #2018).
 *
 * Pressing an icon captures the pointer on the phone, so in a browser the
 * release and the click that follows land on the phone, not the icon (seen in
 * real Chromium; frontend/e2e/iconDrag/run.cjs). These tests send the events
 * the same way: pointerdown on the icon, pointerup and click on the phone.
 * The click after an icon press must not open the new-icon picker; a press
 * without movement selects the icon; a drag moves it; a later tap on an empty
 * spot still opens the picker.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));

import IconPlacementMode from './IconPlacementMode';

const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call.png' };
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'phone_icon', url: 'https://x/mail.png' };
const zone = (id, x, over = {}) => ({ id, x, y: 28, w: 12, h: 9, target: '', label: id, icon_url: CALL.url, icon_overlay_id: 'call_icon', ...over });
const PICKER = 'PICK AN ICON + WHERE IT OPENS';

// jsdom has no PointerEvent, so fireEvent.pointer* would carry no
// coordinates. A MouseEvent-based stand-in keeps clientX/clientY and pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  window.PointerEvent = PointerEventPolyfill;
}

beforeEach(() => {
  // A 100×100 phone, so clientX/clientY are percentages of the screen.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  try { localStorage.setItem('phone_hub_icon_grid_snap', '0'); } catch (err) { console.warn(err); }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); try { localStorage.clear(); } catch (err) { console.warn(err); } });

function setup(links = [zone('a', 29)], props = {}) {
  const onSave = vi.fn();
  const utils = render(<IconPlacementMode links={links} iconOverlays={[CALL, MAIL]} onSave={onSave} screenUrl="https://x/home.png" screenTypes={[]} {...props} />);
  const phone = utils.container.querySelector('[style*="crosshair"]');
  const icon = (id) => utils.container.querySelector(`[data-icon-id="${id}"]`);
  return { ...utils, onSave, phone, icon };
}

// A press on an icon as the browser delivers it once the phone holds the pointer.
async function press(icon, phone, { from = [35, 32], to = null, modifiers = {} } = {}) {
  fireEvent.pointerDown(icon, { pointerId: 1, clientX: from[0], clientY: from[1], ...modifiers });
  if (to) {
    for (let i = 1; i <= 4; i += 1) {
      fireEvent.pointerMove(phone, { pointerId: 1, clientX: from[0] + ((to[0] - from[0]) * i) / 4, clientY: from[1] + ((to[1] - from[1]) * i) / 4 });
    }
  }
  fireEvent.pointerUp(phone, { pointerId: 1, clientX: (to || from)[0], clientY: (to || from)[1] });
  fireEvent.click(phone, { clientX: (to || from)[0], clientY: (to || from)[1] });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

describe('IconPlacementMode — icon press, click and drag (Task #2018)', () => {
  test('a click on an icon selects it and does not open the picker', async () => {
    const { phone, icon } = setup();
    await press(icon('a'), phone);
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(screen.getByPlaceholderText('Label').value).toBe('a');
    expect(icon('a').style.left).toBe('29%');
  });

  test('a drag moves the icon, shows the grabbing cursor, and does not open the picker', async () => {
    const { phone, icon, onSave } = setup();
    fireEvent.pointerDown(icon('a'), { pointerId: 1, clientX: 35, clientY: 32 });
    fireEvent.pointerMove(phone, { pointerId: 1, clientX: 45, clientY: 40 });
    expect(icon('a').style.cursor).toBe('grabbing');
    fireEvent.pointerMove(phone, { pointerId: 1, clientX: 55, clientY: 48 });
    fireEvent.pointerUp(phone, { pointerId: 1, clientX: 55, clientY: 48 });
    fireEvent.click(phone, { clientX: 55, clientY: 48 });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(parseFloat(icon('a').style.left)).toBeCloseTo(49);
    expect(parseFloat(icon('a').style.top)).toBeCloseTo(44);
    expect(icon('a').style.cursor).toBe('grab');
    fireEvent.click(screen.getByText(/Save Icon Placement/));
    const saved = onSave.mock.calls[0][0][0];
    expect(saved.id).toBe('a');
    expect(saved.x).toBeCloseTo(49);
    expect(saved.y).toBeCloseTo(44);
  });

  test('a movement under the drag threshold is a click: nothing moves or is marked unsaved', async () => {
    const onDirtyChange = vi.fn();
    const { phone, icon } = setup([zone('a', 29)], { onDirtyChange });
    await press(icon('a'), phone, { from: [35, 32], to: [35.2, 32.2] });
    expect(icon('a').style.left).toBe('29%');
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    expect(screen.getByPlaceholderText('Label').value).toBe('a');
  });

  test('after an icon press, a tap on an empty spot still opens the picker', async () => {
    const { phone, icon } = setup();
    await press(icon('a'), phone);
    fireEvent.click(phone, { clientX: 80, clientY: 80 });
    expect(screen.getByText(PICKER)).toBeTruthy();
  });

  test('with Multi Select, clicking two icons selects both', async () => {
    const { phone, icon } = setup([zone('a', 29), zone('b', 50)]);
    fireEvent.click(screen.getByText(/Multi Select/));
    await press(icon('a'), phone, { from: [35, 32] });
    await press(icon('b'), phone, { from: [56, 32] });
    expect(screen.getByText('2 ICONS SELECTED')).toBeTruthy();
    expect(screen.queryByText(PICKER)).toBeNull();
  });
});

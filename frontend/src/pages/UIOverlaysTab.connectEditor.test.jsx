/**
 * UIOverlaysTab — the TAP editor with ICON mode's abilities, in the Connect
 * workspace (Task #2020, one Connect editor, part 1).
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SHOW = 's-1';
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };
const zone = (id, x, y, over = {}) => ({ id, x, y, w: 12, h: 9, target: 'calls', label: id, icon_url: null, icon_urls: [], ...over });
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };
const homeWith = (zones) => ({ id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: zones });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  try { localStorage.clear(); } catch (err) { console.warn(err); }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openConnect(zones) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [homeWith(zones), CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.zones-tab__canvas [style*="crosshair"]')).toBeTruthy());
  return document.querySelector('.zones-tab__canvas [style*="crosshair"]');
}
const saved = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalled());
  return vi.mocked(api.put).mock.calls.at(-1)[1].screen_links;
};

describe('UIOverlaysTab — Connect TAP editor with ICON abilities (Task #2020)', () => {
  test('in TAP, a tap on an empty spot opens the picker beside the phone and places the icon', async () => {
    const canvas = await openConnect([]);
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 50, clientY: 40 });
    const side = document.querySelector('.zones-tab__icon-panel');
    expect(within(side).getByText('PICK AN ICON + WHERE IT OPENS')).toBeTruthy();
    fireEvent.click(within(side).getByTitle('Call'));
    expect(await screen.findByText('● Unsaved')).toBeTruthy();
    const links = await saved();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ icon_overlay_id: 'call_icon', w: 12, h: 9, x: 44, y: 35.5, label: 'Call' });
  });

  test('the tools row has Multi Select, Snap, Make Row, Make Column, Snap to Grid and Auto Layout', async () => {
    await openConnect([zone('a', 10, 12), zone('b', 40, 20)]);
    const tools = document.querySelector('.zones-tap-tools');
    for (const name of ['Multi Select', 'Snap Off', 'Make Row', 'Make Column', 'Snap to Grid', 'Auto Layout', 'Align L', 'Equal Size']) {
      expect(within(tools).getByRole('button', { name })).toBeTruthy();
    }
    fireEvent.click(within(tools).getByRole('button', { name: 'Snap Off' }));
    expect(within(tools).getByRole('button', { name: 'Snap On' }).getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('screenLinkEditor.iconGridSnap')).toBe('1');
  });

  test('Multi Select, then Make Row, lines up the selected zones and saves', async () => {
    const canvas = await openConnect([zone('a', 10, 12), zone('b', 40, 20), zone('c', 70, 60)]);
    const tools = document.querySelector('.zones-tap-tools');
    fireEvent.click(within(tools).getByRole('button', { name: 'Multi Select' }));
    for (const [id, at] of [['a', [15, 16]], ['b', [45, 24]]]) {
      fireEvent.pointerDown(document.querySelector(`[data-zone-id="${id}"]`), { pointerId: 1, clientX: at[0], clientY: at[1] });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: at[0], clientY: at[1] });
      fireEvent.click(canvas);
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    }
    expect(rowActive('a') && rowActive('b') && !rowActive('c')).toBe(true);
    fireEvent.click(within(tools).getByRole('button', { name: 'Make Row' }));
    const links = await saved();
    expect(links.map(z => [z.id, z.x, z.y])).toEqual([['a', 10, 16], ['b', 31, 16], ['c', 70, 60]]);
  });

  test('a row\'s size control keeps the zone inside the screen', async () => {
    await openConnect([zone('a', 80, 12)]);
    const row = screen.getByDisplayValue('a').closest('.zones-tap-row');
    fireEvent.click(within(row).getByRole('button', { name: 'Show advanced' }));
    fireEvent.change(within(row).getByLabelText('Width of a'), { target: { value: '40' } });
    const links = await saved();
    expect(links[0]).toMatchObject({ w: 40, x: 60 });
  });
});

function rowActive(label) {
  return screen.getByDisplayValue(label).closest('.zones-tap-row').classList.contains('active');
}

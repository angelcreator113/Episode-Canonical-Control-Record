/**
 * UIOverlaysTab — the Connect zones workspace, repaired (Task #2014, doctrine
 * rules 17 and 18).
 *
 * Tap Zones rows say what each zone draws and can give it a library icon,
 * saved by key; "Unsaved" shows until the zones are saved, and Done still
 * saves; screen health names an out-of-bounds zone and "Move inside" fixes it
 * in one click; in ICON mode the picker opens beside the phone.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

// jsdom has no PointerEvent; a MouseEvent-based stand-in keeps coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SHOW = 's-1';
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };

function homeWith(zones) {
  return { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: zones };
}
const keyed = { id: 'z-call', x: 8, y: 14, w: 12, h: 9, target: 'calls', label: 'Call', icon_url: CALL.url, icon_urls: [CALL.url], icon_overlay_id: 'call_icon' };
const custom = { id: 'z-cust', x: 30, y: 14, w: 12, h: 9, target: 'calls', label: 'Star', icon_url: 'https://x/upload.png', icon_urls: ['https://x/upload.png'] };
const bare = { id: 'z-bare', x: 52, y: 14, w: 12, h: 9, target: 'calls', label: 'Phone', icon_url: null, icon_urls: [] };

function mockApi(zones) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [homeWith(zones), CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openConnect(zones) {
  mockApi(zones);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.zones-tap-panel__list')).toBeTruthy());
}
const rowOf = (label) => screen.getByDisplayValue(label).closest('.zones-tap-row');
const linkWrites = () => vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));

describe('UIOverlaysTab — Connect zones workspace (Task #2014)', () => {
  test('every Tap Zones row says what the zone draws', async () => {
    await openConnect([keyed, custom, bare]);
    expect(within(rowOf('Call')).getByText('Icon: Call')).toBeTruthy();
    expect(within(rowOf('Star')).getByText('Custom image')).toBeTruthy();
    expect(within(rowOf('Phone')).getByText('No icon')).toBeTruthy();
  });

  test('a TAP zone given a library icon is saved with its key and draws it', async () => {
    await openConnect([bare]);
    fireEvent.click(within(rowOf('Phone')).getByRole('button', { name: /Choose icon for Phone/ }));
    fireEvent.click(within(rowOf('Phone')).getByTitle('Call'));
    expect(within(rowOf('Phone')).getByText('Icon: Call')).toBeTruthy();
    expect(document.querySelector('[data-zone-id="z-bare"] img').getAttribute('src')).toBe(CALL.url);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expect(linkWrites()[0][1].screen_links[0]).toEqual({ ...bare, icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url] });
  });

  test('"Unsaved" shows while there are unsaved changes, and Done still saves them', async () => {
    await openConnect([bare]);
    expect(screen.queryByText('● Unsaved')).toBeNull();
    fireEvent.change(screen.getByDisplayValue('Phone'), { target: { value: 'Phone app' } });
    expect(await screen.findByText('● Unsaved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expect(linkWrites()[0][1].screen_links[0].label).toBe('Phone app');
  });

  test('screen health names an out-of-bounds zone and "Move inside" fixes it in one click', async () => {
    const outside = { ...bare, x: 95, y: 96, w: 12, h: 9 };
    await openConnect([keyed, outside]);
    const health = document.querySelector('.zones-health');
    expect(within(health).getByText('"Phone" is out of bounds')).toBeTruthy();
    fireEvent.click(within(health).getByRole('button', { name: 'Move inside' }));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    const [savedKeyed, moved] = linkWrites()[0][1].screen_links;
    expect(savedKeyed).toEqual(keyed);
    expect(moved).toEqual({ ...outside, x: 88, y: 91 });
    await waitFor(() => expect(within(document.querySelector('.zones-health')).queryByText(/out of bounds/)).toBeNull());
  });

  // Task #2021: there is no Icon tab any more; the one editor opens the same
  // picker on a tap on an empty spot.
  test('tapping the phone opens the picker beside it, not under it', async () => {
    await openConnect([keyed]);
    const canvas = document.querySelector('.zones-tab__canvas');
    await waitFor(() => expect(canvas.querySelector('[style*="crosshair"]')).toBeTruthy());
    const surface = canvas.querySelector('[style*="crosshair"]');
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    const side = document.querySelector('.zones-tab__icon-panel');
    expect(await within(side).findByText('PICK AN ICON + WHERE IT OPENS')).toBeTruthy();
    expect(within(canvas).queryByText('PICK AN ICON + WHERE IT OPENS')).toBeNull();
    fireEvent.click(within(side).getByTitle('Call'));
    expect(await screen.findByText('● Unsaved')).toBeTruthy();
  });
});

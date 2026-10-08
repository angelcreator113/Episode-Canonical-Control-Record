/**
 * UIOverlaysTab — the first zone can be added on a screen that has none
 * (Task #2044).
 *
 * A screen that has never had zones comes from the API with no
 * screen_links (null or absent), unlike one whose zones were all deleted
 * (screen_links: []). On such a screen, tapping the phone and picking an
 * icon, drawing a rectangle, and the Zones panel's Add each create a zone,
 * as they do on a screen that already has zones.
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
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, custom: true, ...over });
const HOME = screenOf({
  id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home',
  screen_links: [{ id: 'z-call', x: 29, y: 28, w: 12, h: 9, target: 'wallet', label: 'Wallet', icon_overlay_id: 'call_icon' }],
});
// Never had zones: screen_links null, or no screen_links at all.
const WALLET = screenOf({ id: 'wallet', name: 'wallet', url: 'https://x/wallet.png', asset_id: 'a-wallet', screen_links: null });
const CLOSET = screenOf({ id: 'closet', name: 'closet', url: 'https://x/closet.png', asset_id: 'a-closet' });
// Every zone deleted: an empty array, which already worked.
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls', screen_links: [] });

function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, WALLET, CLOSET, CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Open Connect on Homepage, then switch to the named screen.
async function openConnectOn(name) {
  mockApi();
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.zones-tab__canvas [style*="crosshair"]')).toBeTruthy());
  if (name !== 'Homepage') {
    const list = document.querySelector('.connect-screens');
    fireEvent.click(within(list).getByText(name).closest('.connect-screens__item'));
    await waitFor(() => expect(document.querySelector('.zones-tab__sidebar-screen').textContent).toBe(name));
  }
  return document.querySelector('.zones-tab__canvas [style*="crosshair"]');
}
const zonesOnPhone = () => document.querySelectorAll('.zones-tab__canvas [data-zone-id]').length;
const panelTitle = () => document.querySelector('.zones-tap-panel__title').textContent;

async function tapAndPickCall(surface) {
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 70, clientY: 60 });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 70, clientY: 60 });
  fireEvent.click(await within(document.querySelector('.zones-tab__icon-panel')).findByTitle('Call'));
}
function drawRect(surface) {
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 20, clientY: 50 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 40, clientY: 60 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 50, clientY: 62 });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 50, clientY: 62 });
}
const pressAdd = () => fireEvent.click(within(document.querySelector('.zones-tap-panel__header')).getByRole('button', { name: 'Add' }));

describe.each([
  ['wallet', 'screen_links: null'],
  ['closet', 'no screen_links'],
])('UIOverlaysTab — the first zone on %s (%s) (Task #2044)', (name) => {
  test('(a) a tap on the phone and a picked icon place a zone', async () => {
    const surface = await openConnectOn(name);
    expect(zonesOnPhone()).toBe(0);
    await tapAndPickCall(surface);
    await waitFor(() => expect(zonesOnPhone()).toBe(1));
    expect(panelTitle()).toBe('Zones (1)');
    expect(await screen.findByText('● Unsaved')).toBeTruthy();
  });

  test('(b) drawing a rectangle makes a tap zone', async () => {
    const surface = await openConnectOn(name);
    drawRect(surface);
    await waitFor(() => expect(zonesOnPhone()).toBe(1));
    expect(panelTitle()).toBe('Zones (1)');
  });

  test('(c) the Zones panel\'s Add adds a zone', async () => {
    await openConnectOn(name);
    pressAdd();
    await waitFor(() => expect(zonesOnPhone()).toBe(1));
    expect(panelTitle()).toBe('Zones (1)');
  });

  test('the new zone is saved on Done', async () => {
    const surface = await openConnectOn(name);
    drawRect(surface);
    await waitFor(() => expect(zonesOnPhone()).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    await waitFor(() => expect(vi.mocked(api.put).mock.calls.some(([url]) => String(url).endsWith(`/screen-links/a-${name}`))).toBe(true));
    const [, body] = vi.mocked(api.put).mock.calls.find(([url]) => String(url).endsWith(`/screen-links/a-${name}`));
    expect(body.screen_links).toHaveLength(1);
  });
});

describe('UIOverlaysTab — screens that already worked still do (Task #2044)', () => {
  test.each([['Homepage', 1], ['calls list', 0]])('%s: tap, draw and Add each add one zone', async (name, start) => {
    let surface = await openConnectOn(name);
    expect(zonesOnPhone()).toBe(start);
    await tapAndPickCall(surface);
    await waitFor(() => expect(zonesOnPhone()).toBe(start + 1));
    surface = document.querySelector('.zones-tab__canvas [style*="crosshair"]');
    drawRect(surface);
    await waitFor(() => expect(zonesOnPhone()).toBe(start + 2));
    pressAdd();
    await waitFor(() => expect(zonesOnPhone()).toBe(start + 3));
  });
});

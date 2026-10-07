/**
 * UIOverlaysTab — home is never "Unreached", ICON placements are saved like
 * TAP zones, no AI panel, and no header Preview or Generate All (Task #2016,
 * doctrine rules 17 and 18).
 *
 * Task #2021 (one Connect editor) removed ICON mode: the placement cases now
 * place Call by a tap in the one editor. "Switching to Tap saves them" has no
 * toggle left to switch; it is replaced by the jump to Content, the other way
 * the workspace is left mid-edit.
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
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const HOME = screenOf({ id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home', custom_id: 't-home' });
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls', custom_id: 't-calls' });

function mockApi(screens) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [...screens, CALL] } };
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

async function renderPage(screens = [HOME, CALLS]) {
  mockApi(screens);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}
const grid = () => within(document.querySelector('.phone-hub-screen-grid'));
const cardOf = (name) => grid().getByText(name).closest('.screen-card');
const linkWrites = () => vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));

async function placeCallInIconMode() {
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  const canvas = document.querySelector('.zones-tab__canvas') || await waitFor(() => {
    const c = document.querySelector('.zones-tab__canvas'); if (!c) throw new Error('no canvas'); return c;
  });
  await waitFor(() => expect(canvas.querySelector('[style*="crosshair"]')).toBeTruthy());
  const surface = canvas.querySelector('[style*="crosshair"]');
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 50 });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 50, clientY: 50 });
  fireEvent.click(await within(document.querySelector('.zones-tab__icon-panel')).findByTitle('Call'));
  expect(await screen.findByText('● Unsaved')).toBeTruthy();
  expect(linkWrites()).toHaveLength(0);
}
function expectCallSavedOnHome() {
  expect(linkWrites()).toHaveLength(1);
  const [url, body] = linkWrites()[0];
  expect(url).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-home`);
  expect(body.screen_links).toHaveLength(1);
  expect(body.screen_links[0]).toMatchObject({ icon_overlay_id: 'call_icon', icon_url: CALL.url, label: 'Call' });
}

describe('UIOverlaysTab — home is never "Unreached" (Task #2016)', () => {
  // Task #2042 (doctrine rule 18) renamed a screen card's "⚠ Unreached" to
  // "⚠ Nothing links here"; the home card still never carries it.
  test('the home card reads HOME; another screen no zone reaches reads Nothing links here', async () => {
    await renderPage();
    expect(within(cardOf('Homepage')).getByText('★ HOME')).toBeTruthy();
    expect(within(cardOf('Homepage')).queryByText(/Unreached|Nothing links here/)).toBeNull();
    expect(within(cardOf('calls list')).getByText('⚠ Nothing links here')).toBeTruthy();
  });

  test('with no screen marked home, the first generated screen is home', async () => {
    await renderPage([{ ...HOME, is_home: false }, CALLS]);
    expect(within(cardOf('Homepage')).getByText('★ HOME')).toBeTruthy();
    expect(within(cardOf('calls list')).queryByText('★ HOME')).toBeNull();
  });

  test('a home screen with zones leading to it still reads HOME', async () => {
    await renderPage([HOME, { ...CALLS, screen_links: [{ id: 'b', x: 0, y: 0, w: 10, h: 10, target: 'home', label: 'Back' }] }]);
    expect(within(cardOf('Homepage')).getByText('★ HOME')).toBeTruthy();
  });
});

describe('UIOverlaysTab — ICON placements are saved like TAP zones (Task #2016)', () => {
  test('Done saves them, and "Unsaved" clears', async () => {
    await renderPage();
    await placeCallInIconMode();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expectCallSavedOnHome();
    expect(screen.queryByText('● Unsaved')).toBeNull();
  });

  test('switching screens saves them', async () => {
    await renderPage();
    await placeCallInIconMode();
    fireEvent.click(within(document.querySelector('.zones-thumbnail-strip')).getByText('calls list'));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expectCallSavedOnHome();
  });

  test('the jump to Content saves them', async () => {
    await renderPage([{ ...HOME, content_zones: [{ id: 'cz1', x: 0, y: 50, w: 100, h: 40 }] }, CALLS]);
    await placeCallInIconMode();
    fireEvent.click(within(document.querySelector('.zones-health')).getByText('1 content zone unassigned'));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expectCallSavedOnHome();
  });
});

describe('UIOverlaysTab — no AI Assistant panel (Task #2016)', () => {
  test('the zones workspace has no AI Assistant, and opening it calls no AI route', async () => {
    await renderPage();
    fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(document.querySelector('.zones-tap-panel__list, .zones-tap-panel__empty')).toBeTruthy());
    expect(screen.queryByText('AI Assistant')).toBeNull();
    expect(screen.queryByText(/Propose tap zones/)).toBeNull();
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => String(url).includes('/ai/'))).toEqual([]);
  });
});

describe('UIOverlaysTab — "Set as Home Screen" hint (Task #2016)', () => {
  async function openEditor(name) {
    fireEvent.click(within(cardOf(name)).getByRole('button', { name: 'Screen options' }));
    fireEvent.click(within(cardOf(name)).getByText('Edit'));
    // The Home screen switch (Evoni's mock, 2026-10-07; it was a "Set as Home Screen" button).
    return screen.findByRole('switch', { name: /Home screen/ });
  }

  test('with no home marked, it names the screen the phone opens on', async () => {
    await renderPage([{ ...HOME, is_home: false }, CALLS]);
    await openEditor('Homepage');
    expect(screen.getByText('No home screen set — the phone opens on this screen')).toBeTruthy();
    cleanup();
    await renderPage([{ ...HOME, is_home: false }, CALLS]);
    await openEditor('calls list');
    expect(screen.getByText('No home screen set — the phone opens on Homepage')).toBeTruthy();
  });

  test('with a home marked, there is no hint', async () => {
    await renderPage();
    await openEditor('calls list');
    expect(screen.queryByText(/No home screen set/)).toBeNull();
  });
});

describe('UIOverlaysTab — no header Preview, no Generate All (Task #2016)', () => {
  test('neither button renders; the Preview stage and per-screen Generate remain', async () => {
    await renderPage([HOME, { ...CALLS, generated: false, url: null }]);
    expect(screen.queryByTitle('Preview mode')).toBeNull();
    expect(screen.queryByText('Generate All')).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate All/ })).toBeNull();
    // The Preview stage is the page's preview now.
    expect(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Preview' })).toBeTruthy();
    // A screen still generates on its own, from its editor.
    fireEvent.click(within(cardOf('calls list')).getByRole('button', { name: 'Screen options' }));
    fireEvent.click(within(cardOf('calls list')).getByText('Edit'));
    expect(await screen.findByRole('button', { name: /^\s*Generate\s*$/ })).toBeTruthy();
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => String(url).includes('generate-all'))).toEqual([]);
  });
});

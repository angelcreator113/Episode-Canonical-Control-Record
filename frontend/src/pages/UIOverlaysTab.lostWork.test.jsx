/**
 * Lala's Phone audit, batch 2 — lost work (Evoni, 2026-10-07). Leaving
 * Connect saves first and stays put when the save fails; a save that ends
 * after you moved on lands on its own screen.
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

const stage = (name) => within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name });

describe('Lala\'s Phone audit: leaving Connect keeps your work', () => {
  test('a failed save keeps you in Connect with your change still unsaved', async () => {
    await openConnect([bare]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: 'Network down' } } });
    fireEvent.change(screen.getByDisplayValue('Phone'), { target: { value: 'Phone app' } });
    expect(await screen.findByText('● Unsaved')).toBeTruthy();
    fireEvent.click(stage('Build'));
    expect(await screen.findByText(/Not saved, so you are still on this screen/)).toBeTruthy();
    expect(document.querySelector('.zones-tap-panel__list')).toBeTruthy();
    expect(screen.getByText('● Unsaved')).toBeTruthy();
    expect(screen.getByDisplayValue('Phone app')).toBeTruthy();
  });

  test('a stage change waits for the save, which goes to the screen being edited', async () => {
    await openConnect([bare]);
    let finish;
    vi.mocked(api.put).mockImplementation(() => new Promise((r) => { finish = () => r({ data: { success: true } }); }));
    fireEvent.change(screen.getByDisplayValue('Phone'), { target: { value: 'Phone app' } });
    await screen.findByText('● Unsaved');
    fireEvent.click(stage('Build'));
    await waitFor(() => expect(linkWrites()).toHaveLength(1));
    expect(linkWrites()[0][0]).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-home`);
    // Still in Connect until the save is done.
    expect(document.querySelector('.zones-tap-panel__list')).toBeTruthy();
    finish();
    await waitFor(() => expect(document.querySelector('.zones-tap-panel__list')).toBeNull());
  });
});

/**
 * UIOverlaysTab — under the phone (Evoni's mock, 2026-10-07): the shown
 * screen's name, its tap zones and icons, Edit screen and Play through.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

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

const SHOW = 's-1';
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const HOME = screenOf({
  id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home',
  screen_links: [
    { id: 'z-call', x: 10, y: 20, w: 12, h: 9, target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' },
    { id: 'z-none', x: 40, y: 20, w: 12, h: 9, label: 'Nowhere' },
  ],
});
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls' });
const MAIL = screenOf({ id: 'mail', name: 'mail inbox', url: 'https://x/mail.png', asset_id: 'a-mail' });
const DMS = screenOf({ id: 'dms', name: 'dm thread', generated: false, url: null });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, MAIL, DMS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage() {
  const utils = render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  return utils;
}

const caption = () => document.querySelector('[data-testid="phone-device-caption"]');
const stage = (name) => within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name });

describe('UIOverlaysTab — the caption under the phone', () => {
  test('opens on the home screen: its name and what it holds', async () => {
    await renderPage();
    await waitFor(() => expect(caption()).toBeTruthy());
    expect(caption().querySelector('.ph-device-name').textContent).toBe('Homepage');
    expect(caption().querySelector('.ph-device-meta').textContent).toBe('1 tap zone · 1 icon');
  });

  test('Play through opens Preview, and the caption steps aside there', async () => {
    await renderPage();
    await waitFor(() => expect(caption()).toBeTruthy());
    fireEvent.click(within(caption()).getByRole('button', { name: 'Play through' }));
    expect(stage('Preview').getAttribute('aria-current')).toBe('page');
    expect(caption()).toBeNull();
  });

  test('Edit screen opens the screen editor for the shown screen', async () => {
    await renderPage();
    await waitFor(() => expect(caption()).toBeTruthy());
    fireEvent.click(within(caption()).getByRole('button', { name: 'Edit screen' }));
    await waitFor(() => expect(document.querySelector('.editor-modal')).toBeTruthy());
  });
});

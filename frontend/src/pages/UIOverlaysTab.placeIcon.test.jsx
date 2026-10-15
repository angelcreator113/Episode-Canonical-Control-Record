/**
 * UIOverlaysTab — an icon's panel places it as the Icons stage's "Place it"
 * does (phone audit, 2026-10-15): the first free spot of the grid, with the
 * icon's own destination. It used a fixed spot, on top of whatever was
 * there, with no destination.
 */

import React from 'react';
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
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

const SHOW = 's-1';
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'phone_icon', generated: true, url: 'https://x/mail.png', asset_id: 'a-mail' };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call', opens_screen: 'calls' };
// The home screen's first grid spot (8, 14) is taken by Mail.
const HOME = screenOf({
  id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home',
  screen_links: [{ id: 'z-mail', x: 8, y: 14, w: 12, h: 9, target: 'calls', icon_overlay_id: 'mail_icon' }],
});
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls' });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, MAIL, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('placing from the icon\'s panel takes the first free grid spot and the icon\'s destination', async () => {
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(screen.getByRole('group', { name: 'Build' })).getByRole('button', { name: /^Icons/ }));
  await waitFor(() => expect(document.querySelector('.phone-hub-icon-grid')).toBeTruthy());
  const card = within(document.querySelector('.phone-hub-icon-grid')).getByText('Call').closest('.screen-card');
  fireEvent.click(within(card).getByRole('button', { name: 'Screen options' }));
  fireEvent.click(within(card).getByText('Edit'));
  fireEvent.click(await screen.findByRole('button', { name: 'Placements' }));
  fireEvent.change(await screen.findByDisplayValue('— Pick a screen —'), { target: { value: 'home' } });
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  const [url, body] = vi.mocked(api.put).mock.calls[0];
  expect(url).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-home`);
  const placed = body.screen_links.find(z => z.icon_overlay_id === 'call_icon');
  expect([placed.x, placed.y]).toEqual([29, 14]);
  expect(placed.target).toBe('calls');
  expect(body.screen_links.find(z => z.id === 'z-mail')).toBeTruthy();
});

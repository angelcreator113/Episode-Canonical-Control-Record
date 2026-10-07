/**
 * Lala's Phone step 1 (Evoni, 2026-10-07): Connect never opens on an icon.
 * With an icon selected it used to edit tap zones on the icon's image; it
 * now moves to the home screen.
 */
import React from 'react';
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => ({ ...(await importOriginal()), default: () => null }));
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class extends MouseEvent { constructor(t, i = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; } };
}

const SHOW = 's-1';
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  vi.mocked(api.get).mockImplementation(async (url) => (url === `/api/v1/ui-overlays/${SHOW}`
    ? { data: { success: true, data: [HOME, CALL] } }
    : { data: { success: true, data: [], missions: [] } }));
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('with an icon selected, Connect opens on the home screen, not the icon', async () => {
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /^Icons ·/ }));
  await waitFor(() => expect(document.querySelector('.phone-hub-icon-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-icon-grid')).getAllByText('Call')[0]);
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.zones-tab__canvas')).toBeTruthy());
  const images = [...document.querySelectorAll('.zones-tab__canvas img')].map((img) => img.getAttribute('src'));
  expect(images).toContain(HOME.url);
  expect(images).not.toContain(CALL.url);
});

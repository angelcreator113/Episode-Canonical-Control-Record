/**
 * UIOverlaysTab — Back after navigating with an icon selected (Task #2008,
 * doctrine rule 17).
 *
 * Selecting an icon keeps the phone's screen. Tapping a zone then records that
 * screen, not the icon, in the back history, so Back returns to the screen the
 * phone was showing. Real PhoneHub; the panels not under test are stubbed.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

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
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => null }));
vi.mock('../components/IconPlacementMode', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW,
  screen_links: [{ id: 'z-call', x: 8, y: 14, w: 12, h: 9, target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' }],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call', opens_screen: 'calls' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
});
afterEach(() => cleanup());

function device() {
  return within(document.querySelector('.phone-hub-device'));
}

describe('UIOverlaysTab — Back after navigating with an icon selected (Task #2008)', () => {
  test('Back returns to the screen the phone showed, not to the icon', async () => {
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(device().getByAltText('Homepage')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /^Icons/ }));
    const grid = within(document.querySelector('.phone-hub-grid-section'));
    fireEvent.click(await grid.findByText('Call'));
    expect(device().getByAltText('Homepage')).toBeTruthy();
    expect(device().getByTitle('Call').getAttribute('data-highlighted')).toBe('true');

    fireEvent.click(device().getByTitle('Call'));
    await waitFor(() => expect(device().getByAltText('calls list')).toBeTruthy());

    fireEvent.click(device().getByText('← Back'));
    await waitFor(() => expect(device().getByAltText('Homepage')).toBeTruthy());
    expect(device().getByTitle('Call').hasAttribute('data-highlighted')).toBe(false);
  });
});

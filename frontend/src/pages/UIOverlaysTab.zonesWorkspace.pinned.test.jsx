/**
 * UIOverlaysTab — the zones workspace saves zones in the same shape (Task
 * #2014), pinned on main before the Connect repair.
 *
 * In Connect, editing a zone's label in the Tap Zones panel and saving sends
 * one screen-links PUT whose zones keep every field: target, label,
 * conditions, actions, icon addresses and pin.
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

const SHOW = 's-1';
const ZONES = [
  {
    id: 'z1', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call',
    icon_url: 'https://x/custom.png', icon_urls: ['https://x/custom.png'],
    conditions: [{ key: 'met_lala', op: 'eq', value: true }],
    actions: [{ type: 'set_state', key: 'called', value: true }],
    persistent: true,
  },
  { id: 'z2', x: 40, y: 20, w: 15, h: 10, target: 'calls', label: 'Messages', icon_url: null, icon_urls: [] },
];
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: ZONES };
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});
afterEach(() => cleanup());

describe('UIOverlaysTab — zones workspace saves the same shape, pinned (Task #2014)', () => {
  test('editing a label in the Tap Zones panel and saving keeps every field', async () => {
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
    fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
    const labelInput = await screen.findByDisplayValue('Messages');
    fireEvent.change(labelInput, { target: { value: 'Texts' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const writes = vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));
    expect(writes).toHaveLength(1);
    const [url, body] = writes[0];
    expect(url).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-home`);
    expect(body).toEqual({ screen_links: [ZONES[0], { ...ZONES[1], label: 'Texts' }] });
  });
});

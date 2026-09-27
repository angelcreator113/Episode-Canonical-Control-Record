/**
 * UIOverlaysTab — the zones workspace saves before jumping to Content,
 * pinned on main (Task #2020, part 1 of 2; doctrine rule 18).
 *
 * A screen-health item about a content zone opens the Content stage. Unsaved
 * zone edits are saved first, as they are on Done and on a screen switch.
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
vi.mock('../components/ContentZoneEditor', () => ({ default: () => <div data-testid="view-content" /> }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const ZONE = { id: 'z1', x: 10, y: 20, w: 12, h: 9, target: 'calls', label: 'Phone', icon_url: null, icon_urls: [] };
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW,
  screen_links: [ZONE],
  content_zones: [{ id: 'cz1', x: 0, y: 50, w: 100, h: 40 }],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});
afterEach(() => cleanup());

describe('UIOverlaysTab — saves on the jump to Content, pinned (Task #2020)', () => {
  test('an unsaved zone edit is saved when a content health item opens Content', async () => {
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
    fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
    fireEvent.change(await screen.findByDisplayValue('Phone'), { target: { value: 'Phone app' } });
    fireEvent.click(within(document.querySelector('.zones-health')).getByText('1 content zone unassigned'));
    await waitFor(() => expect(screen.getByTestId('view-content')).toBeTruthy());
    const writes = vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));
    expect(writes).toHaveLength(1);
    expect(writes[0][1].screen_links).toEqual([{ ...ZONE, label: 'Phone app' }]);
  });
});

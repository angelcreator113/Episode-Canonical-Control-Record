/**
 * S8 (Evoni, 2026-10-02; EVENT_EPISODE_FLOW.md §8(dd)): "All scene image
 * work ... happens in one place: the scene set's panel in Scene Sets. Other
 * pages (... World Admin's event editor) show status only, with one entry
 * point: 'Open in Scene Sets →' ..." and answer 3: "Generate Venue Images"
 * with no set becomes "Create the scene set" (no images). In the event
 * editor (?tab=events&event=<id>):
 *   - with no set: "Create the scene set" makes the venue's set and links it;
 *     nothing is generated;
 *   - with a linked set: "Open in Scene Sets →"; no generate or video here;
 *   - Mark Ready opens no brief and generates nothing.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const BASE_EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', status: 'draft', prestige: 5, cost_coins: 10,
  host: 'Mira', venue_name: 'The Glasshouse', event_date: '2026-11-02', dress_code: 'Black tie', description: 'A launch.',
  canon_consequences: { automation: {} }, updated_at: '2026-10-01T00:00:00Z',
};
const SET_NO_IMAGE = { id: 'set-9', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', base_still_url: null, show_id: 'show-1' };

let events;
function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/world?tab=events&event=ev-1']}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}
const posted = (suffix) => vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith(suffix));

describe('WorldAdmin event editor: no scene image work here (S8)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    events = [{ ...BASE_EVENT, venue_location_id: 'loc-1' }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [SET_NO_IMAGE] } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-new', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', base_still_url: null, show_id: 'show-1' } } };
      if (url.endsWith('/generate-social-checklist')) return { data: { success: true, data: { tasks: [], assetUrl: null } } };
      return { data: { success: true, data: {} } };
    });
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, event: { ...events[0], ...body, updated_at: '2026-10-01T00:00:01Z' } } }));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  test('with no set: "Create the scene set" makes the venue\'s set and links it; nothing is generated', async () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: 'Generate Venue Images' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Create the scene set' }));
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.some(([u]) => u === '/api/v1/scene-sets')).toBe(true));
    const [, created] = vi.mocked(api.post).mock.calls.find(([u]) => u === '/api/v1/scene-sets');
    expect(created).toEqual({ name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', world_location_id: 'loc-1', show_id: 'show-1' });
    await waitFor(() => expect(vi.mocked(api.put).mock.calls.some(([, b]) => b?.scene_set_id === 'set-new')).toBe(true));
    expect(posted('/generate-venue')).toHaveLength(0);
    expect(posted('/venue-brief')).toHaveLength(0);
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
  });

  test('with a linked set: "Open in Scene Sets →" on it; no Generate Venue Images and no Video here', async () => {
    events = [{ ...BASE_EVENT, scene_set_id: 'set-9' }];
    renderEditor();
    const link = await screen.findByTestId('event-editor-open-scene-sets');
    expect(link.getAttribute('href')).toBe(`/shows/show-1/world?tab=scene-sets&set=set-9&from=${encodeURIComponent('/shows/show-1/world?tab=events&event=ev-1')}&fromLabel=the%20event`);
    expect(screen.queryByRole('button', { name: 'Generate Venue Images' })).toBeNull();
    expect(screen.queryByText('🎬 Video')).toBeNull();
  });

  test('Mark Ready with no venue opens no brief and generates nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    events = [{ ...BASE_EVENT }];
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Ready' }));
    await waitFor(() => expect(posted('/generate-social-checklist')).toHaveLength(1));
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
    expect(posted('/venue-brief')).toHaveLength(0);
    expect(posted('/generate-venue')).toHaveLength(0);
  });
});

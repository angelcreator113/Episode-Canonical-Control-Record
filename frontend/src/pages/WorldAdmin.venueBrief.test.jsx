/**
 * Venue generation from an event shows its Scene Brief first (rulings S2
 * and S5, Evoni 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)). In the event
 * editor (?tab=events&event=<id>):
 *   - "Generate Venue Images" asks for the venue's brief and generates only
 *     on confirm, with the overrides set there;
 *   - for a linked scene set with no image, it opens the set's base brief
 *     with this event chosen (S3) and generates its base, not a new venue;
 *   - Mark Ready no longer starts a paid venue generation by itself: it
 *     opens the venue's brief.
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
const BRIEF = {
  version: 1, scene_set_id: null, world_location_id: 'loc-1', event_id: 'ev-1', angle: 'WIDE',
  lines: [{ layer: 'place', key: 'identity', label: 'Place', text: 'The Glasshouse.', source: 'venue', essential: true }],
  rules: ['An empty space with no people.'], missing: [], overrides: {},
};

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

describe('WorldAdmin: venue generation shows its brief first (S2, S5)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    events = [{ ...BASE_EVENT }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [SET_NO_IMAGE] } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/venue-brief')) return { data: { success: true, data: { target: { kind: 'venue' }, brief: BRIEF, estimate: { usd: 0.1, priced: true, images: 2 } } } };
      if (url.endsWith('/scene-sets/set-9/brief')) return { data: { success: true, data: { target: { kind: 'base' }, brief: { ...BRIEF, scene_set_id: 'set-9' }, estimate: { usd: 0.03, priced: true } } } };
      if (url.endsWith('/generate-venue')) return { data: { success: true, data: { scene_set_id: 'set-new' } } };
      if (url.endsWith('/generate-social-checklist')) return { data: { success: true, data: { tasks: [], assetUrl: null } } };
      return { data: { success: true, data: {} } };
    });
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { success: true, event: { ...events[0], ...body, updated_at: '2026-10-01T00:00:01Z' } } }));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  test('"Generate Venue Images" shows the venue\'s brief; nothing is generated until confirmed', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Venue Images' }));
    expect(await screen.findByTestId('scene-brief-confirm')).toBeTruthy();
    await waitFor(() => expect(posted('/events/ev-1/venue-brief')).toHaveLength(1));
    expect(screen.getByTestId('sbc-event-fixed')).toBeTruthy();
    expect(screen.queryByTestId('sbc-event')).toBeNull();
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.10');
    expect(posted('/generate-venue')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posted('/generate-venue')).toHaveLength(1));
    expect(posted('/generate-venue')[0][1]).toEqual({ overrides: {} });
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
  });

  test('a linked scene set with no image: its base brief, for this event; the base is generated, not a new venue', async () => {
    events = [{ ...BASE_EVENT, scene_set_id: 'set-9' }];
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Venue Images' }));
    await screen.findByTestId('scene-brief-confirm');
    await waitFor(() => expect(posted('/scene-sets/set-9/brief')).toHaveLength(1));
    expect(posted('/scene-sets/set-9/brief')[0][1]).toEqual({ event_id: 'ev-1' });

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posted('/scene-sets/set-9/generate-base')).toHaveLength(1));
    expect(posted('/scene-sets/set-9/generate-base')[0][1]).toEqual({ overrides: {}, event_id: 'ev-1' });
    expect(posted('/generate-venue')).toHaveLength(0);
  });

  // F1 (Evoni, 2026-10-01): an event whose scene set is attached but not in
  // the page's list. The old call was skipped by the backend and the toast
  // said the venue was kept, with no image made.
  describe('an attached scene set not in the list (F1)', () => {
    const toast = (text) => screen.findByText(text, { exact: false });
    beforeEach(() => { events = [{ ...BASE_EVENT, scene_set_id: 'set-x' }]; });

    test('with no image: its base brief is shown with its note; the generated image is reported', async () => {
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/world/show-1/events') return { data: { events } };
        if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [SET_NO_IMAGE] } };
        if (url === '/api/v1/scene-sets/set-x') return { data: { success: true, data: { id: 'set-x', name: 'Old Glasshouse', base_still_url: null } } };
        return { data: {} };
      });
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url.endsWith('/venue-brief')) return { data: { success: true, data: { target: { kind: 'base', scene_set_id: 'set-x', scene_set_name: 'Old Glasshouse' }, brief: BRIEF, estimate: { usd: 0.04, priced: true, images: 1 } } } };
        if (url.endsWith('/generate-venue')) return { data: { success: true, outcome: 'generated', data: { kind: 'base', scene_set_id: 'set-x', venue_name: 'Old Glasshouse' } } };
        return { data: { success: true, data: {} } };
      });
      renderEditor();
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Venue Images' }));

      expect((await screen.findByTestId('sbc-note')).textContent).toMatch(/“Old Glasshouse” has no image yet/);
      expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.04');
      fireEvent.click(screen.getByTestId('sbc-confirm'));

      expect(await toast('Venue image generated for “Old Glasshouse”.')).toBeTruthy();
    });

    test('with its image: already available; no brief, nothing generated', async () => {
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/world/show-1/events') return { data: { events } };
        if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [SET_NO_IMAGE] } };
        if (url === '/api/v1/scene-sets/set-x') return { data: { success: true, data: { id: 'set-x', name: 'Old Glasshouse', base_still_url: 'https://cdn/x.jpg' } } };
        return { data: {} };
      });
      renderEditor();
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Venue Images' }));

      expect(await toast('Venue images already available: “Old Glasshouse” has its image. Nothing generated.')).toBeTruthy();
      expect(screen.getByTestId('wa-toast').textContent).not.toMatch(/injected/);
      expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
      expect(posted('/venue-brief')).toHaveLength(0);
      expect(posted('/generate-venue')).toHaveLength(0);
    });

    test('a generation that made nothing, or failed, is never reported as generated', async () => {
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/world/show-1/events') return { data: { events } };
        if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [SET_NO_IMAGE] } };
        if (url === '/api/v1/scene-sets/set-x') throw Object.assign(new Error('gone'), { response: { status: 404 } });
        return { data: {} };
      });
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url.endsWith('/venue-brief')) return { data: { success: true, data: { target: { kind: 'venue' }, brief: BRIEF, estimate: { usd: 0.1, priced: true, images: 2 } } } };
        if (url.endsWith('/generate-venue')) throw Object.assign(new Error('500'), { response: { status: 500, data: { success: false, outcome: 'failed', error: 'provider down' } } });
        return { data: { success: true, data: {} } };
      });
      renderEditor();
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Venue Images' }));
      fireEvent.click(await screen.findByTestId('sbc-confirm'));

      expect(await toast('Venue generation failed: provider down')).toBeTruthy();
      // Reported as a failure: in red, never as an injected success.
      const box = screen.getByTestId('wa-toast');
      expect(box.dataset.tone).toBe('failed');
      expect(box.textContent).not.toMatch(/injected|✅/);
    });
  });

  test('Mark Ready with no venue opens the venue\'s brief instead of generating', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Ready' }));
    expect(await screen.findByTestId('scene-brief-confirm')).toBeTruthy();
    await waitFor(() => expect(posted('/events/ev-1/venue-brief')).toHaveLength(1));
    expect(posted('/generate-social-checklist')).toHaveLength(1);
    expect(posted('/generate-venue')).toHaveLength(0);
  });
});

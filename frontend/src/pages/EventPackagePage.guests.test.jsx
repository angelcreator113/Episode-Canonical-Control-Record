/**
 * Recommended featured attendees (Evoni, 2026-10-03, episode creation
 * step 5): the People section proposes the few people the story should
 * use, each with a role and why, from the invited guests and the Feed's
 * most relevant creators. Feature saves through the page's guest save.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';
const FEED_URL = '/api/v1/social-profiles?feed_layer=lalaverse&sort=score&limit=40';

// Every gate set; warnings (scene set, outfit, time, dress code, featured,
// stakes, money) open unless a test fills them.
const GATED_EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  category: 'arts_entertainment',
  format: 'gala',
  event_date: '2026-11-09',
  host_brand: 'Velour',
  venue_location_id: 'loc-1',
  invitation_asset_id: 'asset-inv-1',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {} },
};

const COMPLETE_EVENT = {
  ...GATED_EVENT,
  scene_set_id: 'set-1',
  outfit_set_id: 'outfit-1',
  event_time: '19:00',
  dress_code: 'Black tie',
  narrative_stakes: 'Her first red carpet',
  cost_coins: 250,
  canon_consequences: { automation: { guest_profiles: [{ id: 'g1', featured: true }] } },
};

let stored;
let preview;
let feed;
let extraProfiles;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  preview = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: stored, sourceProfile: null, startedFromProfile: null,
        sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
      } };
    }
    if (url === PREVIEW_URL) return { data: { success: true, data: preview } };
    if (url === FEED_URL) return { data: { profiles: feed } };
    if (url.startsWith('/api/v1/social-profiles/')) {
      const id = url.split('/').pop();
      return { data: { profile: extraProfiles[id] || null } };
    }
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    stored = { ...stored, ...body, updated_at: '2026-09-25T10:05:00.000Z' };
    return { data: { success: true, event: stored } };
  });
});

const guestsOf = (body) => body.canon_consequences.automation.guest_profiles;

describe('recommended featured attendees in People', () => {
  beforeEach(() => {
    feed = [
      { id: 3, handle: 'dana', display_name: 'Dana', lala_relationship: 'direct', lala_relevance_score: 50 },
      { id: 4, handle: 'jaw', display_name: 'JustAWoman', is_justawoman_record: true, lala_relationship: 'direct' },
    ];
    extraProfiles = { 1: { id: 1, handle: 'maya', display_name: 'Maya Chen', lala_relationship: 'competitive' } };
  });

  test('recommends with a role and why, reading an invited guest the Feed page did not include', async () => {
    stored = { ...GATED_EVENT, canon_consequences: { automation: { host_brand: 'Velour', guest_profiles: [
      { profile_id: 1, handle: 'maya', display_name: 'Maya', relationship: 'collab' },
    ] } } };
    renderPage();
    const recs = await screen.findByTestId('guest-recs');
    expect(api.get).toHaveBeenCalledWith('/api/v1/social-profiles/1');
    const maya = within(recs).getByTestId('guest-rec-1');
    expect(within(maya).getByTestId('guest-rec-role').textContent).toBe('Tension');
    expect(within(maya).getByTestId('guest-rec-why').textContent).toBe('Competes with Lala');
    const dana = within(recs).getByTestId('guest-rec-3');
    expect(within(dana).getByTestId('guest-rec-why').textContent).toBe('Knows Lala · not invited yet');
    expect(within(recs).queryByTestId('guest-rec-4')).toBeNull();
  });

  test('Feature on an invited guest features them with the role, keeping the rest of automation', async () => {
    stored = { ...GATED_EVENT, canon_consequences: { automation: { host_brand: 'Velour', guest_profiles: [
      { profile_id: 1, handle: 'maya', display_name: 'Maya', relationship: 'collab' },
    ] } } };
    renderPage();
    const maya = await screen.findByTestId('guest-rec-1');
    fireEvent.click(within(maya).getByTestId('guest-rec-feature'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = vi.mocked(api.put).mock.calls[0][1];
    expect(body.canon_consequences.automation.host_brand).toBe('Velour');
    expect(guestsOf(body)).toEqual([{ profile_id: 1, handle: 'maya', display_name: 'Maya', relationship: 'collab', featured: true, story_role: 'tension' }]);
  });

  test('Feature on someone not invited adds them to the guest list featured', async () => {
    stored = { ...GATED_EVENT };
    renderPage();
    const dana = await screen.findByTestId('guest-rec-3');
    fireEvent.click(within(dana).getByTestId('guest-rec-feature'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(guestsOf(vi.mocked(api.put).mock.calls[0][1])).toEqual([
      { profile_id: 3, handle: 'dana', display_name: 'Dana', featured: true, story_role: 'friend' },
    ]);
  });

  test('no recommendations with five featured, and none on a used event', async () => {
    const five = [1, 2, 5, 6, 7].map((id) => ({ profile_id: id, display_name: `G${id}`, featured: true }));
    stored = { ...GATED_EVENT, canon_consequences: { automation: { guest_profiles: five } } };
    const { unmount } = renderPage();
    await screen.findByText('Featured Attendees (5/5)');
    expect(screen.queryByTestId('guest-recs')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith(FEED_URL);
    unmount();

    stored = { ...COMPLETE_EVENT, used_in_episode_id: 'ep-1' };
    renderPage();
    await screen.findByTestId('terms-locked-banner');
    expect(screen.queryByTestId('guest-recs')).toBeNull();
  });
});

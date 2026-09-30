/**
 * Event Package — read-only once Start Episode has locked the terms
 * (Task #2356).
 *
 * The page follows the server's own terms lock (termsLockedBy, found the way
 * findTermsLockEpisode finds it: the brief that names the event, §8(w) P2,
 * else the used_in_episode_id stamp). While it is set, the page shows a
 * "Locked at Start Episode" note with a link to the episode, and no edit
 * controls: no Edit details, no Start Episode, no Terms edits.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';

const EVENT = {
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
  deal_type: 'paid_appearance',
  appearance_fee: 250,
  requirements: { reputation_min: 3 },
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {} },
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="landed">{loc.pathname}{loc.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
        <Route path="/episodes/:episodeId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockPackage({ event, usedInEpisode = null, termsLockedBy = null }) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event, sourceProfile: null, startedFromProfile: null,
        sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode, termsLockedBy,
      } };
    }
    return { data: { success: true, deliverables: [], locked: true } };
  });
}

describe('EventPackagePage — locked at Start Episode', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('a used event: the lock note, a link to its episode, and no edit controls', async () => {
    const lockEp = { id: 'ep-7', episode_number: 7, title: 'Velour' };
    mockPackage({ event: { ...EVENT, used_in_episode_id: 'ep-7', status: 'used' }, usedInEpisode: lockEp, termsLockedBy: lockEp });
    renderPage();

    const banner = await screen.findByTestId('terms-locked-banner');
    expect(banner.textContent).toContain('Locked at Start Episode.');
    expect(banner.textContent).toContain('Used by Episode 7: Velour.');
    expect(banner.textContent).toContain('This package is read-only');

    // Locked terms render read-only.
    const terms = screen.getByTestId('terms-section');
    expect(within(terms).getByTestId('terms-locked').textContent).toContain('Locked at Start Episode');
    expect(within(terms).queryByTestId('terms-access-edit')).toBeNull();
    expect(within(terms).queryByTestId('terms-deal-type-edit')).toBeNull();
    expect(within(terms).queryByTestId('terms-component-edit-appearance_fee')).toBeNull();
    expect(within(terms).queryByTestId('terms-deliverable-add')).toBeNull();
    expect(within(terms).queryByTestId('terms-propose-open')).toBeNull();

    // The page's own edit controls are gone.
    expect(screen.queryByTestId('start-episode')).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit details/ })).toBeNull();
    expect(screen.queryByTestId('change-organizer')).toBeNull();
    expect(screen.queryByTestId('stakes-edit')).toBeNull();

    fireEvent.click(screen.getByTestId('terms-locked-open-episode'));
    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-7?tab=overview'));
  });

  test('locked by the brief alone (the stamp cleared): still read-only, as the server lock is (§8(w) P2)', async () => {
    mockPackage({
      event: { ...EVENT, used_in_episode_id: null },
      usedInEpisode: null,
      termsLockedBy: { id: 'ep-8', episode_number: 8, title: 'After Party' },
    });
    renderPage();

    const banner = await screen.findByTestId('terms-locked-banner');
    expect(banner.textContent).toContain('Used by Episode 8: After Party.');
    expect(screen.getByTestId('terms-locked')).toBeTruthy();
    expect(screen.queryByTestId('start-episode')).toBeNull();
    expect(screen.queryByTestId('terms-access-edit')).toBeNull();
  });

  test('not locked: no lock note, and the edit controls are there', async () => {
    mockPackage({ event: { ...EVENT, used_in_episode_id: null } });
    renderPage();

    expect(await screen.findByTestId('start-episode')).toBeTruthy();
    expect(screen.queryByTestId('terms-locked-banner')).toBeNull();
    expect(screen.queryByTestId('terms-locked')).toBeNull();
    expect(screen.getByTestId('terms-access-edit')).toBeTruthy();
  });
});

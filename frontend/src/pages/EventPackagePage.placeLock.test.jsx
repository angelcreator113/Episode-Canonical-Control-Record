/**
 * Ruling L13 (Evoni, 2026-10-02, §8(hh)): "an event's Place section (scene
 * set choice, venue look, Generate this look) stays editable while its
 * episode is a draft, even after Start Episode; only the terms lock at
 * Start Episode. It locks when the episode is accepted."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Sable shoot', event_type: 'invite', prestige: 5, venue_location_id: 'loc-1',
  venue_name: 'Studio by Sable', scene_set_id: 'set-1', used_in_episode_id: 'ep-1', updated_at: '2026-10-02T10:00:00.000Z',
  canon_consequences: { automation: {} },
};
const SET = { id: 'set-1', name: 'Studio', scene_type: 'EVENT_LOCATION', show_id: 'show-1' };

function mockPackage({ placeLocked, evaluation }) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: SET, venueLocation: null,
        invitationAsset: null, usedInEpisode: { id: 'ep-1', episode_number: 3, title: 'Sable ep', evaluation_status: evaluation },
        termsLockedBy: { id: 'ep-1', episode_number: 3, title: 'Sable ep' }, termsReopen: null, placeLocked,
      } };
    }
    return { data: { success: true, deliverables: [], locked: true } };
  });
}
const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>
);

describe('EventPackagePage: the Place after Start Episode (L13)', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset?.()); });

  test('the episode a draft: the terms are locked, the scene set can still be changed', async () => {
    mockPackage({ placeLocked: false, evaluation: 'pending' });
    renderPage();
    expect(await screen.findByTestId('terms-locked-banner')).toBeTruthy();
    expect(screen.getByTestId('place-choose-scene-set').textContent).toBe('Change scene set');
  });

  test('the episode accepted: the scene set choice is gone', async () => {
    mockPackage({ placeLocked: true, evaluation: 'accepted' });
    renderPage();
    expect(await screen.findByTestId('place-scene-set')).toBeTruthy();
    expect(screen.queryByTestId('place-choose-scene-set')).toBeNull();
  });
});

/**
 * Event Package — the drafted event name (Task #2135, step 5).
 *
 * A name the creation draft wrote reads "Auto-drafted · AI draft" in Basics
 * while it equals its saved copy (automation.drafted_values.name), and
 * "Edited" once it differs, e.g. after picking a suggested name. A name never
 * drafted keeps the plain row with no label (doctrine rule 14).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const DRAFTED_NAME = 'Golden Hour Sculpt Social';

const draftedEvent = () => ({
  id: 'ev-1', show_id: 'show-1', name: DRAFTED_NAME, event_type: 'invite', prestige: 6,
  event_date: '2026-11-12', event_time: '18:30',
  description: 'A golden-hour sculpt session to close out summer.',
  category: 'fitness', format: 'workout_class',
  updated_at: '2026-09-28T10:00:00.000Z',
  canon_consequences: { automation: {
    started_from_profile_id: 42, event_date_auto: '2026-11-12',
    concept: 'A sunset sculpt workout that ends in a recovery social.',
    auto_drafted: { description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft', name: 'ai_draft' },
    drafted_values: { description: 'A golden-hour sculpt session to close out summer.', name: DRAFTED_NAME },
  } },
});

let stored;

function payload() {
  return {
    success: true, event: stored, sourceProfile: null, startedFromProfile: null,
    sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage — drafted name (Task #2135)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = draftedEvent();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) return { data: payload() };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${EVENT_URL}/suggest-names`) return { data: { success: true, names: ['Sunset Sculpt Club', 'Rooftop Reset', 'Golden Stretch'] } };
      return { data: { success: true } };
    });
    // The PUT stores what it is sent (minus the version key), as the route does.
    vi.mocked(api.put).mockImplementation(async (url, body) => {
      if (url !== EVENT_URL) return { data: { success: true } };
      const { expected_updated_at: _v, ...fields } = body;
      stored = { ...stored, ...fields, updated_at: '2026-09-28T10:05:00.000Z' };
      return { data: { success: true, event: stored } };
    });
  });

  test('a drafted name reads Auto-drafted · AI draft', async () => {
    renderPage();
    const row = await screen.findByTestId('basics-name');
    expect(row.getAttribute('data-state')).toBe('auto_drafted');
    expect(row.textContent).toContain(DRAFTED_NAME);
    expect(screen.getByTestId('basics-name-state').textContent).toContain('Auto-drafted · AI draft');
  });

  test('picking a suggested name turns it Edited', async () => {
    renderPage();
    await screen.findByTestId('basics-name');
    fireEvent.click(screen.getByRole('button', { name: /Suggest names/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rooftop Reset' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ name: 'Rooftop Reset' });
    await waitFor(() => expect(screen.getByTestId('basics-name').getAttribute('data-state')).toBe('edited'));
    expect(screen.getByTestId('basics-name-state').textContent).toContain('Edited');
    expect(screen.getByTestId('basics-name').textContent).toContain('Rooftop Reset');
  });

  test('a name never drafted keeps the plain row, with no label', async () => {
    const ev = draftedEvent();
    ev.name = 'Event with Maya Moves';
    delete ev.canon_consequences.automation.auto_drafted.name;
    delete ev.canon_consequences.automation.drafted_values.name;
    stored = ev;
    renderPage();
    const row = await screen.findByTestId('basics-name');
    expect(row.hasAttribute('data-state')).toBe(false);
    expect(row.textContent).toContain('Event with Maya Moves');
    expect(screen.queryByTestId('basics-name-state')).toBeNull();
  });
});

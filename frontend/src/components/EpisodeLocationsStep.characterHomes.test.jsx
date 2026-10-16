/**
 * Character homes in the Episode Locations step (2026-10-15, step 3 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md): Home and Closet name the
 * show's lead; the other characters' homes are one click each, as extras.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import EpisodeLocationsStep from './EpisodeLocationsStep';

const PLACES = {
  lead_character_id: 'c-lala',
  characters: [
    { id: 'c-jade', name: 'Jade', is_lead: false, places: [{ role: 'home', scene_set_id: 'set-jade', scene_set_name: 'Jade flat' }] },
    { id: 'c-lala', name: 'Lala', is_lead: true, places: [{ role: 'home', scene_set_id: 'set-loft', scene_set_name: 'Loft' }] },
    { id: 'c-mo', name: 'Mo', is_lead: false, places: [{ role: 'other', scene_set_id: 'set-studio', scene_set_name: 'Studio', label: 'Studio' }] },
  ],
};

const renderIt = (props = {}) => {
  const onConfirm = vi.fn();
  render(
    <MemoryRouter>
      <EpisodeLocationsStep showId="show-1" initial={[{ role: 'home', scene_set_id: 'set-loft', scene_set: { id: 'set-loft', name: 'Loft' } }]}
        onConfirm={onConfirm} onCancel={() => {}} {...props} />
    </MemoryRouter>,
  );
  return { onConfirm };
};

describe('EpisodeLocationsStep: character homes', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/shows/show-1/character-places'
      ? { data: { success: true, data: PLACES } }
      : { data: { data: [] } }));
  });

  test('Home and Closet name the lead; another character\'s home is added as a named extra', async () => {
    const { onConfirm } = renderIt();
    expect(await screen.findByText("Home (Lala's)")).toBeTruthy();
    expect(screen.getByText("Closet (Lala's)")).toBeTruthy();
    // Only homes are offered, and never the lead's (that is the Home row).
    expect(screen.getByTestId('els-character-homes').textContent).toBe("Add a character's home+ Jade's home");

    fireEvent.click(screen.getByTestId('els-character-home-c-jade'));
    expect(screen.getByDisplayValue("Jade's home")).toBeTruthy();
    expect(screen.getByTestId('els-character-home-c-jade').disabled).toBe(true);

    fireEvent.click(screen.getByTestId('els-confirm'));
    expect(onConfirm).toHaveBeenCalledWith([
      { role: 'home', scene_set_id: 'set-loft', name: null },
      { role: 'extra', scene_set_id: 'set-jade', name: "Jade's home" },
    ]);
  });

  test('with no lead and no other homes, the step reads as before', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/shows/show-1/character-places'
      ? { data: { success: true, data: { lead_character_id: null, characters: [] } } }
      : { data: { data: [] } }));
    renderIt();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places'));
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByTestId('els-character-homes')).toBeNull();
  });

  test("a default home whose set was deleted says so; a closet with no default reads as before (fourth audit)", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { lead_character_id: null, characters: [] } } });
    renderIt({ initial: [], missing: ['home', 'closet'], removed: ['home'] });
    expect((await screen.findByTestId('els-missing-home')).textContent).toBe("The show's default home was removed from Scene Sets: choose another.");
    expect(screen.getByTestId('els-missing-closet').textContent).toBe('No saved default: choose one.');
  });
});

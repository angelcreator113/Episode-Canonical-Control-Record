/**
 * EpisodeScenesTab — Edit locations (Evoni's ruling L6 and her answers Q15
 * and Q16, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): the episode's
 * locations, with their roles, are changed in the same step as Start
 * Episode while the episode is a draft; an accepted episode's are fixed.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';

const LOCATIONS_URL = '/api/v1/episodes/ep-1/locations';
const HOME = { id: 'set-home', name: "Lala's Apartment", scene_type: 'HOME_BASE', show_id: 'show-1', base_still_url: null };
const VENUE = { id: 'set-venue', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', show_id: 'show-1', base_still_url: null };
const CAFE = { id: 'set-cafe', name: 'Corner Café', scene_type: 'OTHER', show_id: 'show-1', base_still_url: null };

let locationsBody;

const renderTab = (onToast = vi.fn()) => {
  render(
    <MemoryRouter>
      <EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={onToast} />
    </MemoryRouter>
  );
  return onToast;
};

describe('EpisodeScenesTab — Edit locations (L6)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    locationsBody = {
      editable: true,
      locations: [
        { role: 'event', scene_set_id: VENUE.id, name: null, scene_set: VENUE },
        { role: 'home', scene_set_id: HOME.id, name: null, scene_set: HOME },
      ],
    };
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === LOCATIONS_URL) return { data: { success: true, data: locationsBody } };
      if (url === '/api/v1/scene-sets?show_id=show-1') return { data: { success: true, data: [HOME, VENUE, CAFE] } };
      return { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.put).mockImplementation(async (url, body) => ({ data: { success: true, data: { locations: body.locations } } }));
  });

  test("opens with the episode's locations; an added extra is saved with its name", async () => {
    const onToast = renderTab();
    fireEvent.click(await screen.findByTestId('est-edit-locations'));
    await screen.findByTestId('episode-locations-step');
    expect(screen.getByTestId('els-row-event').textContent).toContain('The Glasshouse');
    expect(screen.getByTestId('els-row-home').textContent).toContain("Lala's Apartment");

    fireEvent.click(screen.getByTestId('els-add-extra'));
    fireEvent.click(await screen.findByTestId('els-option-set-cafe'));
    fireEvent.change(screen.getByLabelText('Extra location 1 name'), { target: { value: 'Café' } });
    fireEvent.click(screen.getByTestId('els-confirm'));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(LOCATIONS_URL, {
      locations: [
        { role: 'event', scene_set_id: VENUE.id, name: null },
        { role: 'home', scene_set_id: HOME.id, name: null },
        { role: 'extra', scene_set_id: CAFE.id, name: 'Café' },
      ],
    }));
    await waitFor(() => expect(screen.queryByTestId('episode-locations-step')).toBeNull());
    expect(onToast).toHaveBeenCalledWith('Locations saved', 'success');
  });

  test('an accepted episode does not open the step', async () => {
    locationsBody = { ...locationsBody, editable: false };
    const onToast = renderTab();
    fireEvent.click(await screen.findByTestId('est-edit-locations'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('This episode is accepted; its locations are fixed.', 'error'));
    expect(screen.queryByTestId('episode-locations-step')).toBeNull();
  });

  test('a refused save keeps the step open and shows the reason', async () => {
    vi.mocked(apiClient.put).mockImplementation(async () => {
      const err = new Error('Request failed');
      err.response = { status: 409, data: { success: false, code: 'EPISODE_ACCEPTED', error: 'This episode is accepted' } };
      throw err;
    });
    const onToast = renderTab();
    fireEvent.click(await screen.findByTestId('est-edit-locations'));
    fireEvent.click(await screen.findByTestId('els-confirm'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('This episode is accepted', 'error'));
    expect(screen.getByTestId('episode-locations-step')).toBeTruthy();
  });
});

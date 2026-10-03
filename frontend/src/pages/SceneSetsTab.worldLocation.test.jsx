/**
 * Linking a set to a World Location from Scene Sets (Details & Usage):
 * approving a set's base needs one (S6); an approved base keeps its
 * location until it is un-approved.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab, { SetWorldLocationSelect } from './SceneSetsTab';

const LOCATIONS = [
  { id: 'loc-b', name: 'The Glasshouse', city: 'Los Angeles' },
  { id: 'loc-a', name: 'Atelier Row', city: null },
];
const SET = { id: 'set-1', name: 'Side Street', scene_type: 'OTHER', world_location_id: null, base_approved: false };

describe('SetWorldLocationSelect', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockResolvedValue({ data: { locations: LOCATIONS } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
  });

  test('lists the locations by name and links the one chosen', async () => {
    const onSaved = vi.fn();
    render(<SetWorldLocationSelect set={SET} onSaved={onSaved} />);
    const select = screen.getByLabelText('World Location');
    await waitFor(() => expect(within(select).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['No World Location', 'Atelier Row', 'The Glasshouse · Los Angeles']));
    fireEvent.change(select, { target: { value: 'loc-b' } });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { world_location_id: 'loc-b' }));
    expect(onSaved).toHaveBeenCalledWith('loc-b');
  });

  test('New location makes one named after the set, then links it', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { location: { id: 'loc-new', name: 'Side Street' } } });
    render(<SetWorldLocationSelect set={SET} />);
    await waitFor(() => expect(screen.getByLabelText('World Location').disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /New location/ }));
    expect(screen.getByLabelText('New World Location name').value).toBe('Side Street');
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { world_location_id: 'loc-new' }));
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations', { name: 'Side Street', location_type: 'interior' });
  });

  test('a refusal puts the choice back and says why', async () => {
    const onError = vi.fn();
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'No such location' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SetWorldLocationSelect set={SET} onError={onError} />);
    const select = screen.getByLabelText('World Location');
    await waitFor(() => expect(select.disabled).toBe(false));
    fireEvent.change(select, { target: { value: 'loc-a' } });
    await waitFor(() => expect(onError).toHaveBeenCalledWith('No such location'));
    expect(select.value).toBe('');
  });

  test('an approved base keeps its location: no choice is offered', async () => {
    render(<SetWorldLocationSelect set={{ ...SET, world_location_id: 'loc-b', base_approved: true }} />);
    await waitFor(() => expect(screen.getByTestId('set-location-set-1').textContent).toContain('The Glasshouse'));
    expect(screen.queryByLabelText('World Location')).toBeNull();
    expect(screen.getByTestId('set-location-set-1').textContent).toMatch(/Un-approve it to change the location/);
  });
});

describe('SceneSetsTab: from the approval note to the location', () => {
  test('a set with a base and no location links to Details & Usage, where the location is chosen', async () => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.endsWith('/world/locations')) return { data: { locations: LOCATIONS } };
      return url.includes('/scene-sets')
        ? { data: { success: true, data: [{ ...SET, generation_status: 'complete', base_still_url: 'https://x/s.jpg', angles: [] }] } }
        : { data: { success: true, data: [] } };
    });
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('scene-set-open-set-1'));
    fireEvent.click(screen.getByTestId('link-location-set-1'));
    expect(await screen.findByLabelText('World Location')).toBeTruthy();
  });
});

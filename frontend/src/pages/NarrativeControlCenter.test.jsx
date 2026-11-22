/**
 * NarrativeControlCenter — Track 6 CP8 behavioral tests (file 2 of 10).
 *
 * 1 fetch site migrated via getTierPipelineApi. The file's existing Track 4
 * fetchJSON wrapper covers other endpoints; this CP8 helper closes the one
 * remaining bare-fetch site at the PipelineTab useEffect.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import { getTierPipelineApi, RelTimelineTab, LocationsTab } from './NarrativeControlCenter';

describe('NarrativeControlCenter — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getTierPipelineApi GET on /tier/pipeline', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pipelines: [], stats: null } });
    await getTierPipelineApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tier/pipeline');
  });

  test('getTierPipelineApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getTierPipelineApi()).rejects.toThrow('not authorized');
  });
});

describe('NarrativeControlCenter — the Relationship Timeline tab never stays on Loading', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('refused (403): it says the tab is for admins, and the loader is gone', async () => {
    vi.mocked(apiClient.request).mockRejectedValue({ response: { status: 403, data: { error: 'Forbidden' } } });
    render(<RelTimelineTab />);
    expect(screen.getByText('Loading...')).toBeTruthy();
    const note = await screen.findByTestId('rel-timeline-error');
    expect(note.textContent).toBe('Relationships are for admins. Your account is not in the admin group.');
    expect(screen.queryByText('Loading...')).toBeNull();
    expect(note.textContent).not.toMatch(/Forbidden/);
  });

  test('any other failure: a plain message, and the loader is gone', async () => {
    vi.mocked(apiClient.request).mockRejectedValue(new Error('Network Error'));
    render(<RelTimelineTab />);
    const note = await screen.findByTestId('rel-timeline-error');
    expect(note.textContent).toBe('Relationships could not be loaded just now. Try again in a moment.');
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  test('read: the relationships are listed, with no error', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: { relationships: [{ id: 'r1', char_a_name: 'Ari', char_b_name: 'Bex' }] } });
    render(<RelTimelineTab />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.queryByTestId('rel-timeline-error')).toBeNull();
    expect(screen.getByText('Relationships')).toBeTruthy();
  });
});

// Evoni, 2026-11-22: deleting a location is an admin's and asks first; a
// location anything still uses is refused with what uses it.
describe('NarrativeControlCenter — the Locations tab deletes with a confirmation and says why it could not', () => {
  const atelier = { id: 'loc-1', name: 'The Atelier', location_type: 'interior' };
  const refusal = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
  const deletes = () => vi.mocked(apiClient.request).mock.calls.filter(([req]) => req.method === 'delete');
  // GET answers the list; DELETE answers with whatever the test sets.
  const open = async (onDelete) => {
    vi.mocked(apiClient.request).mockImplementation(async (req) => {
      if (req.method === 'delete') return onDelete(req);
      return { data: { locations: [atelier] } };
    });
    render(<LocationsTab />);
    await screen.findByText(/The Atelier/);
  };

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.confirm = vi.fn(() => true);
  });

  test('it asks for confirmation, naming the location', async () => {
    await open(async () => ({ data: { success: true } }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete the location "The Atelier"? This cannot be undone.');
    await waitFor(() => expect(deletes()).toHaveLength(1));
    expect(deletes()[0][0].url).toBe('/api/v1/tier/world-locations/loc-1');
  });

  test('declined: the server is not called, and nothing is shown', async () => {
    window.confirm.mockReturnValue(false);
    await open(async () => ({ data: { success: true } }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(deletes()).toHaveLength(0);
    expect(screen.queryByTestId('locations-error')).toBeNull();
    expect(screen.getByText(/The Atelier/)).toBeTruthy();
  });

  test('refused for someone who is not an admin (403): the admin-only sentence', async () => {
    await open(async () => { throw refusal(403, { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }); });
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    const note = await screen.findByTestId('locations-error');
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toBe('Only an admin can add, change or delete a location.');
    expect(screen.getByText(/The Atelier/)).toBeTruthy();
  });

  test('refused because it is in use (409): the server\'s sentence, and the location stays listed', async () => {
    await open(async () => { throw refusal(409, { success: false, code: 'LOCATION_IN_USE', uses: { scene_sets: 1 }, error: 'The Atelier is used by 1 scene set. Nothing was deleted.' }); });
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    expect((await screen.findByTestId('locations-error')).textContent).toBe('The Atelier is used by 1 scene set. Nothing was deleted.');
    expect(screen.getByRole('button', { name: 'Delete The Atelier' })).toBeTruthy();
  });

  test('refused because its Place is locked (409) with no sentence: the locked events are named', async () => {
    await open(async () => { throw refusal(409, { code: 'PLACE_LOCKED', locked_events: [{ id: 'e1', name: 'Neon Gala' }] }); });
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    expect((await screen.findByTestId('locations-error')).textContent).toBe('Its Place is locked by Neon Gala. Nothing was deleted.');
  });

  test('any other failure: a plain message, never an unhandled rejection', async () => {
    await open(async () => { throw new Error('Network Error'); });
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Atelier' }));
    expect((await screen.findByTestId('locations-error')).textContent).toBe('The location could not be deleted.');
  });

  test('adding a location refused for someone who is not an admin shows the admin-only sentence and keeps the form', async () => {
    vi.mocked(apiClient.request).mockImplementation(async (req) => {
      if (req.method === 'post') throw refusal(403, { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' });
      return { data: { locations: [] } };
    });
    render(<LocationsTab />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Add Location' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'New place' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Location' }));
    expect((await screen.findByTestId('locations-error')).textContent).toBe('Only an admin can add, change or delete a location.');
    expect(screen.getByRole('button', { name: 'Save Location' })).toBeTruthy();
  });
});

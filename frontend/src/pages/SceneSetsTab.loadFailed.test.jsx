/**
 * A failed read of the scene sets is a failed read (audit TRUTH-02,
 * 2026-10-03): the reason and Retry, never the "no scene sets yet" empty
 * state; a degraded read says what it left out; an empty collection is
 * still the empty state.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const SETS = [{ id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/a.jpg', angles: [] }];
const isList = (url) => url.includes('/scene-sets') && !url.includes('/events/');
const renderAt = () => render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const failure = () => Object.assign(new Error('Request failed with status code 500'), {
  response: { status: 500, data: { success: false, error: 'Scene sets could not be read', code: 'SCENE_SETS_UNAVAILABLE' } },
});

describe('SceneSetsTab: a failed read', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the first read failing shows the reason and Retry, not the empty state; Retry loads', async () => {
    let listFails = true;
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (isList(url)) { if (listFails) throw failure(); return { data: { success: true, data: SETS } }; }
      return { data: { success: true, data: [] } };
    });
    renderAt();
    const panel = await screen.findByTestId('scene-sets-load-failed');
    expect(panel.textContent).toContain('Could not load the scene sets. Scene sets could not be read.');
    expect(screen.queryByText(/No scene sets/)).toBeNull();
    expect(card('set-1')).toBeNull();

    listFails = false;
    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    expect(screen.queryByTestId('scene-sets-load-failed')).toBeNull();
  });

  test('a degraded read shows the sets and says what was left out', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => (isList(url)
      ? { data: { success: true, data: SETS, degraded: { omitted: ['angles', 'show', 'episodes'], text: 'Views, show names and episode links could not be read for this list' } } }
      : { data: { success: true, data: [] } }));
    renderAt();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    const note = screen.getByTestId('scene-sets-degraded');
    expect(note.textContent).toContain('Partial data: Views, show names and episode links could not be read for this list.');
    expect(within(note).getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByTestId('scene-sets-load-failed')).toBeNull();
  });

  test('an empty collection that answered is still the empty state, with no failure panel', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    renderAt();
    expect(await screen.findByText(/No scene sets/)).toBeTruthy();
    expect(screen.queryByTestId('scene-sets-load-failed')).toBeNull();
    expect(screen.queryByTestId('scene-sets-degraded')).toBeNull();
  });
});

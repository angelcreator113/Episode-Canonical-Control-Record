/**
 * Scene Sets audit (2026-10-15): a rename showed the old name on the card
 * until the page was reloaded. The card now reloads the sets after it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

let sets;
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const setsLoads = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => /\/scene-sets(\?|$)/.test(url)).length;

describe('SceneSetsTab: the card shows a change once it is saved', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    sets = [{ id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [], generation_status: 'complete', base_still_url: 'https://x/a.jpg', base_approved: false }];
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: sets } } : { data: { success: true, data: [] } }
    ));
    vi.mocked(apiClient.put).mockImplementation(async (url, body) => {
      sets = sets.map((s) => (s.id === 'set-1' ? { ...s, ...body } : s));
      return { data: { success: true, data: sets[0] } };
    });
  });

  test('a rename reloads the sets, and the new name shows', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    const before = setsLoads();
    fireEvent.click(screen.getByTitle('Click to rename'));
    const input = document.querySelector('.scene-sets-modal-title-input');
    fireEvent.change(input, { target: { value: 'The Atelier' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { name: 'The Atelier' }));
    await waitFor(() => expect(setsLoads()).toBeGreaterThan(before));
    await waitFor(() => expect(screen.getAllByText('The Atelier').length).toBeGreaterThan(0));
  });
});

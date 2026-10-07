/**
 * A snapshot saved on the State tab carries the active show, so the route
 * files it under that show's universe and the script writers read it
 * (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list
 * item 17).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import WorldDashboard from './WorldDashboard';

const SHOW = { id: '11111111-2222-4333-8444-555555555555', name: 'Styling Adventures' };

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/universe?tab=state&sub=state');
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/shows'
    ? { data: { success: true, data: [SHOW] } }
    : { data: { snapshots: [], events: [], pairs: [], status: 'ok' } }));
  vi.mocked(api.post).mockResolvedValue({ data: { snapshot: { id: 's1' } } });
});

describe('State tab: Save Snapshot', () => {
  test('sends the active show with the snapshot', async () => {
    render(<MemoryRouter initialEntries={['/universe?tab=state&sub=state']}><Routes><Route path="/universe" element={<WorldDashboard embedded />} /></Routes></MemoryRouter>);
    fireEvent.change(await screen.findByPlaceholderText('e.g. Before the Dazzle Season'), { target: { value: 'Before the Gala' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/shows'));
    // The active show is known once the shows list lands.
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByRole('button', { name: 'Save Snapshot' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/state/snapshots', {
      snapshot_label: 'Before the Gala', show_id: SHOW.id, world_facts: [], active_threads: [],
    }));
  });
});

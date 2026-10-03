/**
 * Producer Mode's Overview counts what is true: Events Ready and Used by the
 * Events queue's definition (computeEventState), episodes and wardrobe by
 * their lists' totals (the lists stop at 100 / 200), Locations by this
 * show's sets (the list answers every show's). A section that fails to load
 * says so, with Retry, instead of looking empty.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const READY = {
  name: 'Velvet Hour', category: 'social', format: 'gala', event_date: '2026-11-07', event_time: '20:00',
  dress_code: 'black tie', source_profile_id: 7, venue_location_id: 'loc-1', venue_name: 'Club Noir',
  invitation_asset_id: 'inv-1', prestige: 5, strictness: 5, cost_coins: 300, deadline_type: 'medium', career_tier: 1,
};
const EVENTS = [
  { ...READY, id: 'e1', status: 'draft' },                                   // Ready by the queue, "draft" by status
  { ...READY, id: 'e2', status: 'ready', invitation_asset_id: null },        // "ready" by status, a gate missing
  { ...READY, id: 'e3', status: 'ready', used_in_episode_id: 'ep-9' },       // used by an episode
];
let failing;
const renderIt = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=overview']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);

describe('WorldAdmin Overview: counts that are true', () => {
  beforeEach(() => {
    failing = new Set();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if ([...failing].some((f) => url.startsWith(f))) throw Object.assign(new Error('boom'), { response: { status: 500 } });
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Styling Adventures' } } };
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { data: [{ id: 'ep-1', title: 'One', status: 'draft' }], pagination: { total: 137 } } };
      }
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: [{ id: 'w1' }], pagination: { total: 412 } } };
      if (url.startsWith('/api/v1/scene-sets')) {
        return { data: { data: [{ id: 's1', show_id: 'show-1' }, { id: 's2', show_id: 'show-1' }, { id: 's3', show_id: 'other' }, { id: 's4', show_id: null }] } };
      }
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('Ready and Used by the queue; episodes and wardrobe by their totals; Locations by this show', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByTestId('wa-stat-episodes').textContent).toBe('137'));
    expect(screen.getByTestId('wa-stat-events-ready').textContent).toBe('1');
    expect(screen.getByTestId('wa-stat-events-used').textContent).toBe('1');
    expect(screen.getByTestId('wa-stat-wardrobe').textContent).toBe('412');
    expect(screen.getByTestId('wa-stat-locations').textContent).toBe('2');
    expect(screen.queryByTestId('wa-load-failed')).toBeNull();
  });

  test('a failed load says what could not load, and Retry loads again', async () => {
    failing = new Set(['/api/v1/world/show-1/events', '/api/v1/wardrobe']);
    renderIt();
    const banner = await screen.findByTestId('wa-load-failed');
    expect(banner.textContent).toContain("Couldn't load events, wardrobe");
    failing = new Set();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('wa-load-failed')).toBeNull());
    expect(screen.getByTestId('wa-stat-events-ready').textContent).toBe('1');
  });
});

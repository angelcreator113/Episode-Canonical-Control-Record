/**
 * Producer Mode's Overview answers four questions (ShowOverview): what is in
 * production, what needs attention, what comes next, what changed. Ready is
 * the Events queue's definition (computeEventState). Production counts the
 * show's episodes by the list's total; every page of a list is read, and one
 * that loads short of its total says so ("Showing X of Y"). A section
 * that fails to load says so, with Retry, instead of looking empty.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

describe('WorldAdmin Overview: four questions, true counts', () => {
  beforeEach(() => {
    failing = new Set();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if ([...failing].some((f) => url.startsWith(f))) throw Object.assign(new Error('boom'), { response: { status: 500 } });
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Styling Adventures' } } };
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { data: [{ id: 'ep-1', episode_number: 1, title: 'One', status: 'draft' }], pagination: { total: 137 } } };
      }
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: [{ id: 'w1' }], pagination: { total: 412 } } };
      if (url.startsWith('/api/v1/scene-sets')) {
        return { data: { data: [{ id: 's1', show_id: 'show-1' }, { id: 's2', show_id: 'show-1' }, { id: 's3', show_id: 'other' }, { id: 's4', show_id: null }] } };
      }
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the four questions, from the queue\'s definition of Ready', async () => {
    renderIt();
    const producing = await screen.findByTestId('sov-producing');
    await waitFor(() => expect(producing.textContent).toContain('One'));
    expect(within(producing).getByRole('link', { name: 'Continue episode' }).getAttribute('href')).toBe('/episodes/ep-1');
    // e2 says "ready" but lacks its invitation: it needs attention, with what is missing.
    const attention = screen.getByTestId('sov-attention');
    expect(attention.textContent).toMatch(/Missing: .*invitation/i);
    expect(attention.querySelector('a').getAttribute('href')).toBe('/shows/show-1/events/e2');
    // e1 says "draft" but meets every gate: it is the next ready event. e3 is used.
    const nextEvent = screen.getByTestId('sov-next-event');
    expect(nextEvent.querySelector('a').getAttribute('href')).toBe('/shows/show-1/events/e1');
    expect(screen.queryByTestId('wa-load-failed')).toBeNull();
  });

  test('Production counts the show\'s episodes by the list\'s total', async () => {
    render(
      <MemoryRouter initialEntries={['/shows/show-1/world?tab=episodes']}>
        <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('seb-count').textContent).toContain('137 episodes'));
    expect(screen.getByTestId('seb-count').textContent).toContain('showing the first 1');
  });

  test('a list that loads short of its total says so, instead of passing a partial list off as whole', async () => {
    renderIt();
    const note = await screen.findByTestId('wa-load-partial');
    expect(note.textContent).toContain('episodes: Showing 1 of 137');
    expect(note.textContent).toContain('wardrobe: Showing 1 of 412');
    expect(note.textContent).not.toContain('scene sets'); // no total and a short page: complete
    // Every page was asked for: the episodes from page 1 at 100 a page, the closet at 200.
    const urls = vi.mocked(api.get).mock.calls.map((c) => c[0]);
    expect(urls).toContain('/api/v1/episodes?show_id=show-1&limit=100&page=1');
    expect(urls).toContain('/api/v1/wardrobe?show_id=show-1&limit=200&page=1');
    expect(urls).toContain('/api/v1/scene-sets?show_id=show-1&limit=200&offset=0');
  });

  test('a failed load says what could not load, and Retry loads again', async () => {
    failing = new Set(['/api/v1/world/show-1/events', '/api/v1/wardrobe']);
    renderIt();
    const banner = await screen.findByTestId('wa-load-failed');
    expect(banner.textContent).toContain("Couldn't load events, wardrobe");
    failing = new Set();
    fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('wa-load-failed')).toBeNull());
    expect(screen.getByTestId('sov-next-event').querySelector('a').getAttribute('href')).toBe('/shows/show-1/events/e1');
  });

  test('nothing answering is a connection failure, not an empty show (audit TRUTH-01)', async () => {
    failing = new Set(['/api/v1/']);
    renderIt();
    const banner = await screen.findByTestId('wa-load-failed');
    expect(banner.textContent).toContain("Couldn't reach the server: nothing loaded");
    expect(banner.textContent).not.toMatch(/Couldn't load events/);
    expect(within(banner).getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  test('a failed refresh keeps what loaded before and says so (audit TRUTH-01)', async () => {
    failing = new Set(['/api/v1/wardrobe']);
    renderIt();
    const first = await screen.findByTestId('wa-load-failed');
    expect(first.textContent).toContain("Couldn't load wardrobe");
    expect(screen.getByTestId('sov-next-event').querySelector('a').getAttribute('href')).toBe('/shows/show-1/events/e1');
    failing = new Set(['/api/v1/world/show-1/events']);
    fireEvent.click(within(first).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('wa-load-failed').textContent).toContain("Couldn't refresh events; showing what loaded before."));
    // The events read before the failed refresh are still on the page.
    expect(screen.getByTestId('sov-next-event').querySelector('a').getAttribute('href')).toBe('/shows/show-1/events/e1');
  });
});

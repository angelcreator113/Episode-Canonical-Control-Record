/**
 * The world's setup progress lives on the LalaVerse Overview (2026-10-04,
 * out of World Dashboard's Setup Progress tab): seven steps, each a link
 * to the hub tab that does the work, a count and a bar of how many are
 * done; the events check reads the active show it is given, never the
 * first show the API returns (audit CTX-01). The checks read the routes'
 * real shapes (page-content answers the content object itself; the
 * social-profiles list answers pagination.total), measure usable records,
 * and tell "could not check" apart from "not done".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import WorldSetupProgress, { SETUP_STEPS, checkSetup, nextStep } from './WorldSetupProgress';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
// The section is rendered at /overview so a step's /universe target lands on Where.
const renderIt = (showId) => render(
  <MemoryRouter initialEntries={['/overview']}>
    <Routes>
      <Route path="/overview" element={<WorldSetupProgress showId={showId} />} />
      <Route path="/universe" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => u);

// The routes' real shapes.
const REAL = (url) => {
  if (url.includes('page-content/world_infrastructure')) return { data: { DREAM_CITIES: [{ name: 'Dazzle' }, { name: 'Radiance' }], UNIVERSITIES: [], CORPORATIONS: [{ name: 'Lumen' }] } };
  if (url.includes('page-content/influencer_systems')) return { data: {} };
  if (url.includes('page-content/cultural_memory')) return { data: { LEGENDS: [] } };
  if (url.includes('calendar/events')) return { data: { events: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
  if (url.includes('world/locations')) return { data: { locations: [{ id: 1 }] } };
  if (url.includes('social-profiles')) return { data: { profiles: [{ id: 'p1' }], pagination: { page: 1, limit: 1, total: 42, totalPages: 42 }, statusCounts: { total: 40 } } };
  if (url.includes('/world/show-b/events')) return { data: { success: true, events: [{ id: 'e1' }] } };
  // Nothing synced into the Brain yet.
  if (url.includes('franchise-brain/sync/status')) return { data: { success: true, data: {
    world_foundation: { cards: 0, legacy: 0 }, social_systems: { cards: 0, legacy: 0 }, cultural_memory: { cards: 0, legacy: 0 },
  } } };
  return { data: {} };
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => REAL(url));
});

describe('WorldSetupProgress', () => {
  test('reads the real shapes and measures usable records: 5 of 7 done, with counts on each step', async () => {
    renderIt('show-b');
    expect(SETUP_STEPS).toHaveLength(7);
    expect(SETUP_STEPS.every((s) => s.route)).toBe(true);
    await screen.findByRole('button', { name: 'Step 1: World Foundation (done)' });
    expect(screen.getByTestId('world-setup-count').textContent).toBe('5/7');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('5');
    // The page-content object is the content itself: 2 usable sections of 3 keys (the empty array is not configuration).
    expect(screen.getByTestId('world-setup-count-infrastructure').textContent).toBe('Saved · 2 sections');
    expect(screen.getByRole('button', { name: 'Step 2: Social Systems' })).toBeTruthy();
    expect(screen.getByTestId('world-setup-count-influencer').textContent).toBe('Starter content only, not in the Brain yet');
    expect(screen.getByRole('button', { name: 'Step 4: Cultural Memory' })).toBeTruthy();
    expect(screen.getByTestId('world-setup-count-calendar').textContent).toBe('3 cultural calendar events');
    expect(screen.getByTestId('world-setup-count-locations').textContent).toBe('1 locations');
    // The feed count is pagination.total, not a top-level count.
    expect(screen.getByRole('button', { name: 'Step 6: Generate Feed (done)' })).toBeTruthy();
    expect(screen.getByTestId('world-setup-count-feed').textContent).toBe('42 profiles');
    expect(screen.getByTestId('world-setup-count-events').textContent).toBe('1 draft events');
    // Done steps are checked circles (the mock, 2026-10-06); open ones show their number.
    expect(screen.getAllByRole('button', { name: /\(done\)$/ })).toHaveLength(5);
    expect(screen.getAllByText('✓')).toHaveLength(5);
    expect(screen.queryByTestId('world-setup-unreachable')).toBeNull();
    // The banner names the first step still to do.
    expect(screen.getByTestId('world-setup-next').textContent).toContain('Next: Social Systems');
  });

  test('"Start step N" opens the first open step; with every step done it says so', async () => {
    renderIt('show-b');
    fireEvent.click(await screen.findByRole('button', { name: 'Start step 2' }));
    expect(screen.getByTestId('where').textContent).toBe('/universe?tab=society');
    expect(nextStep({ done: Object.fromEntries(SETUP_STEPS.map((s) => [s.key, true])), unreachable: [] })).toBeNull();
    expect(nextStep({ done: { infrastructure: false }, unreachable: ['infrastructure'] })?.key).toBe('influencer');
    expect(nextStep(null)).toBeNull();
  });

  test('a step opens its hub tab', async () => {
    renderIt('show-b');
    fireEvent.click(await screen.findByRole('button', { name: 'Step 5: Locations & Venues (done)' }));
    expect(screen.getByTestId('where').textContent).toBe('/universe?tab=world&sub=locations');
  });

  test('an endpoint that could not be reached is "could not check", not "not done"', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => { if (url.includes('world/locations')) throw Object.assign(new Error('boom'), { response: { status: 500 } }); return REAL(url); });
    renderIt('show-b');
    await screen.findByRole('button', { name: 'Step 5: Locations & Venues (could not check)' });
    expect(screen.getByTestId('world-setup-unreachable').textContent).toContain('One step could not be checked');
    expect(screen.getByText('Could not check')).toBeTruthy();
    expect(screen.queryByTestId('world-setup-count-locations')).toBeNull();
    expect(screen.getByTestId('world-setup-count').textContent).toBe('4/7');
    spy.mockRestore();
  });

  test('checkSetup: the events check reads the active show only, and is 0 without one', async () => {
    const withShow = await checkSetup('show-b');
    expect(withShow.done.events).toBe(true);
    expect(withShow.counts).toEqual({ infrastructure: 2, influencer: 0, calendar: 3, memory: 0, locations: 1, feed: 42, events: 1 });
    expect(withShow.unreachable).toEqual([]);
    expect(calls().some((u) => u.includes('/world/show-b/events?status=draft'))).toBe(true);
    expect(calls().some((u) => u.endsWith('/shows'))).toBe(false);
    vi.mocked(api.get).mockClear();
    const without = await checkSetup(undefined);
    expect(without.done.events).toBe(false);
    expect(without.counts.events).toBe(0);
    expect(calls().some((u) => u.includes('/events?status=draft'))).toBe(false);
  });

  test('a page synced into the Brain is done though nothing was saved on it, and says so', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('franchise-brain/sync/status')) return { data: { success: true, data: {
        world_foundation: { cards: 0, legacy: 0 }, social_systems: { cards: 14, legacy: 0 }, cultural_memory: { cards: 0, legacy: 1 },
      } } };
      return REAL(url);
    });
    renderIt('show-b');
    await screen.findByRole('button', { name: 'Step 2: Social Systems (done)' });
    expect(screen.getByTestId('world-setup-count-influencer').textContent).toBe('In the Brain · 14 cards');
    expect(screen.getByRole('button', { name: 'Step 4: Cultural Memory (done)' })).toBeTruthy();
    expect(screen.getByTestId('world-setup-count-memory').textContent).toBe('In the Brain · 1 card');
    expect(screen.getByTestId('world-setup-count').textContent).toBe('7/7');
  });

  test('when the Brain cannot be read, a page with no saved edits is "could not check"', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('franchise-brain/sync/status')) throw Object.assign(new Error('boom'), { response: { status: 500 } });
      return REAL(url);
    });
    renderIt('show-b');
    await screen.findByRole('button', { name: 'Step 2: Social Systems (could not check)' });
    expect(screen.getByRole('button', { name: 'Step 1: World Foundation (done)' })).toBeTruthy();
    expect(screen.getByTestId('world-setup-count-infrastructure').textContent).toBe('Saved · 2 sections');
    expect(screen.getByTestId('world-setup-unreachable').textContent).toContain('2 steps could not be checked');
    spy.mockRestore();
  });
});

/**
 * The world's setup progress lives on the LalaVerse Overview (2026-10-04,
 * out of World Dashboard's Setup Progress tab): seven steps, each a link
 * to the hub tab that does the work, a count and a bar of how many are
 * done; the events check reads the active show it is given, never the
 * first show the API returns (audit CTX-01).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import WorldSetupProgress, { SETUP_STEPS, checkSetup } from './WorldSetupProgress';

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

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('page-content/world_infrastructure')) return { data: { data: { cities: ['Dazzle'] } } };
    if (url.includes('world/locations')) return { data: { locations: [{ id: 1 }] } };
    if (url.includes('/world/show-b/events')) return { data: { events: [{ id: 'e1' }] } };
    return { data: { data: {}, events: [], count: 0 } };
  });
});

describe('WorldSetupProgress', () => {
  test('seven steps, each linking into the hub; the done ones are marked and counted', async () => {
    renderIt('show-b');
    expect(SETUP_STEPS).toHaveLength(7);
    expect(SETUP_STEPS.every((s) => s.route)).toBe(true);
    expect((await screen.findByTestId('world-setup-count')).textContent).toBe('3/7');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByRole('button', { name: 'Step 1: World Foundation (done)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Step 5: Locations & Venues (done)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Step 7: Create World Events (done)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Step 2: Social Systems' })).toBeTruthy();
    expect(screen.getAllByText('DONE')).toHaveLength(3);
  });

  test('a step opens its hub tab', async () => {
    renderIt('show-b');
    await screen.findByTestId('world-setup-count');
    fireEvent.click(screen.getByRole('button', { name: 'Step 5: Locations & Venues (done)' }));
    expect(screen.getByTestId('where').textContent).toBe('/universe?tab=world&sub=locations');
  });

  test('the events check reads the active show only, and is false without one', async () => {
    const withShow = await checkSetup('show-b');
    expect(withShow.events).toBe(true);
    expect(calls().some((u) => u.includes('/world/show-b/events?status=draft'))).toBe(true);
    expect(calls().some((u) => u.endsWith('/shows'))).toBe(false);
    vi.mocked(api.get).mockClear();
    const without = await checkSetup(undefined);
    expect(without.events).toBe(false);
    expect(calls().some((u) => u.includes('/events?status=draft'))).toBe(false);
  });
});

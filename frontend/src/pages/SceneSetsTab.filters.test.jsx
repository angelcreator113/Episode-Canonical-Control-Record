/**
 * Finding scene sets: This show / All shows, a status filter, sorting, and
 * Load more, all over the sets the page already loads.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab, { filterSceneSets, setProgress, SCENE_SETS_PAGE_SIZE } from './SceneSetsTab';

const base = 'https://x/b.jpg';
const S = {
  bare: { id: 's-bare', name: 'Bare Room', scene_type: 'OTHER', show_id: 'show-1', created_at: '2026-10-01', updated_at: '2026-10-01', angles: [] },
  failed: { id: 's-failed', name: 'atelier', scene_type: 'HOME_BASE', show_id: 'show-1', base_still_url: base, created_at: '2026-09-01', updated_at: '2026-10-03',
    angles: [{ id: 'a1', generation_status: 'failed' }, { id: 'a2', generation_status: 'pending' }] },
  pending: { id: 's-pending', name: 'Closet', scene_type: 'CLOSET', show_id: 'show-2', base_still_url: base, created_at: '2026-09-15', updated_at: '2026-09-15',
    angles: [{ id: 'a3', generation_status: 'pending' }] },
  ready: { id: 's-ready', name: 'Glasshouse', scene_type: 'EVENT_LOCATION', show_id: null, base_runway_seed: 'seed', created_at: '2026-08-01', updated_at: '2026-08-01',
    angles: [{ id: 'a4', generation_status: 'complete' }] },
};
const ALL = Object.values(S);
const ids = (list) => list.map((s) => s.id);

describe('setProgress and filterSceneSets', () => {
  test('one progress state per set: background first, then failures, then views to generate', () => {
    expect(ALL.map(setProgress)).toEqual(['no_background', 'failed', 'to_generate', 'ready']);
  });

  test('scope, type, status and search narrow; sort orders', () => {
    expect(ids(filterSceneSets(ALL))).toEqual(['s-bare', 's-pending', 's-failed', 's-ready']);
    expect(ids(filterSceneSets(ALL, { scope: 'show', showId: 'show-1' }))).toEqual(['s-bare', 's-failed']);
    expect(ids(filterSceneSets(ALL, { scope: 'show', showId: null }))).toHaveLength(4);
    expect(ids(filterSceneSets(ALL, { type: 'CLOSET' }))).toEqual(['s-pending']);
    expect(ids(filterSceneSets(ALL, { status: 'ready' }))).toEqual(['s-ready']);
    expect(ids(filterSceneSets(ALL, { query: 'GLASS' }))).toEqual(['s-ready']);
    expect(ids(filterSceneSets(ALL, { sort: 'name' }))).toEqual(['s-failed', 's-bare', 's-pending', 's-ready']);
    expect(ids(filterSceneSets(ALL, { sort: 'updated' }))).toEqual(['s-failed', 's-bare', 's-pending', 's-ready']);
  });
});

const many = (n) => Array.from({ length: n }, (_, i) => ({
  id: `m-${String(i).padStart(2, '0')}`, name: `Set ${String(i).padStart(2, '0')}`, scene_type: 'OTHER', show_id: 'show-1',
  created_at: `2026-09-${String(30 - (i % 30)).padStart(2, '0')}T00:00:${String(i).padStart(2, '0')}Z`, angles: [],
}));
const serve = (sets) => vi.mocked(apiClient.get).mockImplementation(async (url) => (
  url.includes('/scene-sets') ? { data: { success: true, data: sets } } : { data: { success: true, data: [] } }
));
const cards = () => [...document.querySelectorAll('[data-scene-set-id]')].map((el) => el.getAttribute('data-scene-set-id'));

describe('SceneSetsTab: finding sets', () => {
  beforeEach(() => { Object.values(apiClient).forEach((fn) => fn.mockReset()); });

  test('in a show it opens on This show; All shows widens it', async () => {
    serve(ALL);
    render(<MemoryRouter><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(cards().sort()).toEqual(['s-bare', 's-failed']));
    expect(screen.getByRole('button', { name: /This show/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /All shows/ }));
    expect(cards()).toHaveLength(4);
  });

  test('outside a show there is no This show / All shows choice', async () => {
    serve(ALL);
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(cards()).toHaveLength(4));
    expect(screen.queryByRole('button', { name: /This show/ })).toBeNull();
  });

  test('status and sort', async () => {
    serve(ALL);
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(cards()).toHaveLength(4));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(cards()).toEqual(['s-failed']);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(cards()).toEqual(['s-failed', 's-bare', 's-pending', 's-ready']);
  });

  test('a show with no sets says so and offers all shows', async () => {
    serve([S.pending, S.ready]);
    render(<MemoryRouter><SceneSetsTab showId="show-1" /></MemoryRouter>);
    expect(await screen.findByTestId('scene-sets-show-empty')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See all shows' }));
    expect(cards()).toHaveLength(2);
  });

  test(`${SCENE_SETS_PAGE_SIZE} at a time, with Load more; a filter starts again from the first page`, async () => {
    serve(many(30));
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(cards()).toHaveLength(SCENE_SETS_PAGE_SIZE));
    expect(screen.getByTestId('scene-sets-pager').textContent).toContain(`Showing ${SCENE_SETS_PAGE_SIZE} of 30`);
    fireEvent.click(screen.getByRole('button', { name: 'Load 6 more' }));
    expect(cards()).toHaveLength(30);
    expect(screen.queryByRole('button', { name: /Load .* more/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(cards()).toHaveLength(SCENE_SETS_PAGE_SIZE);
  });

  test('a set a link focuses on is shown even past the first page', async () => {
    const sets = many(30);
    serve(sets);
    const last = filterSceneSets(sets).at(-1).id;
    render(<MemoryRouter initialEntries={[`/shows/show-1/world?tab=scene-sets&set=${last}`]}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(cards()).toContain(last));
    expect(cards()).toHaveLength(SCENE_SETS_PAGE_SIZE + 1);
    expect(screen.queryByTestId('scene-sets-focus-missing')).toBeNull();
  });
});

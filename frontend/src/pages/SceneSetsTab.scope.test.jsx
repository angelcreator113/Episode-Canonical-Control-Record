/**
 * The Scene Sets list is scoped on the server (audit CTX-03, 2026-10-03):
 * in a show, This show and Shared read this show's sets plus the shared
 * ones; All shows reads every set, deliberately. The scope counts come with
 * the read, and the credits total covers the sets in view, not every
 * show's.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab, { filterSceneSets } from './SceneSetsTab';

const MINE = { id: 's-mine', name: 'My home', scene_type: 'HOME_BASE', show_id: 'show-1', generation_cost: '2.5', angles: [] };
const SHARED = { id: 's-shared', name: 'Shared venue', scene_type: 'EVENT_LOCATION', show_id: null, generation_cost: '1.0', angles: [] };
const FRANCHISE = { id: 's-franchise', name: 'Franchise venue', scene_type: 'EVENT_LOCATION', show_id: 'show-2', is_franchise_asset: true, generation_cost: '0.5', angles: [] };
const OTHER = { id: 's-other', name: 'Other show home', scene_type: 'HOME_BASE', show_id: 'show-2', generation_cost: '10', angles: [] };
const listCalls = () => vi.mocked(apiClient.get).mock.calls.map(([u]) => u).filter((u) => u.startsWith('/api/v1/scene-sets') && !u.includes('/scene-sets/'));
const cards = () => [...document.querySelectorAll('[data-scene-set-id]')].map((el) => el.getAttribute('data-scene-set-id')).sort();

describe('SceneSetsTab: the list is scoped on the server', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) {
        return { data: { success: true, data: [MINE, SHARED, FRANCHISE], scope: 'show+shared', show_id: 'show-1', counts: { show: 1, shared: 2, all: 9 } } };
      }
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: [MINE, SHARED, FRANCHISE, OTHER], scope: 'all' } };
      return { data: { success: true, data: [] } };
    });
  });

  test('in a show it asks for this show plus the shared ones; the counts are the server\'s; the credits are the sets in view', async () => {
    render(<MemoryRouter><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(cards()).toEqual(['s-mine']));
    expect(listCalls()).toEqual(['/api/v1/scene-sets?show_id=show-1']);
    expect(screen.getByRole('button', { name: /This show/ }).textContent).toContain('1');
    expect(screen.getByRole('button', { name: /Shared/ }).textContent).toContain('2');
    // Nine across all shows, though only three were read.
    expect(screen.getByRole('button', { name: /All shows/ }).textContent).toContain('9');
    expect(document.querySelector('.ss-tile-credits').textContent).toBe('2.5credits used');

    fireEvent.click(screen.getByRole('button', { name: /Shared/ }));
    expect(cards()).toEqual(['s-franchise', 's-shared']);
    expect(document.querySelector('.ss-tile-credits').textContent).toBe('1.5credits used');
    // Shared needs no second read: it is in the same scoped read.
    expect(listCalls()).toEqual(['/api/v1/scene-sets?show_id=show-1']);
  });

  test('All shows reads every set, deliberately, and the other show\'s set appears only then', async () => {
    render(<MemoryRouter><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(cards()).toEqual(['s-mine']));
    fireEvent.click(screen.getByRole('button', { name: /All shows/ }));
    await waitFor(() => expect(cards()).toEqual(['s-franchise', 's-mine', 's-other', 's-shared']));
    expect(listCalls()).toEqual(['/api/v1/scene-sets?show_id=show-1', '/api/v1/scene-sets']);
    expect(document.querySelector('.ss-tile-credits').textContent).toBe('14.0credits used');
  });

  test('outside a show the read is unscoped', async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(cards()).toHaveLength(4));
    expect(listCalls()).toEqual(['/api/v1/scene-sets']);
  });

  test('filterSceneSets counts a franchise asset as shared, as the server does', () => {
    expect(filterSceneSets([MINE, SHARED, FRANCHISE, OTHER], { scope: 'shared' }).map((s) => s.id).sort()).toEqual(['s-franchise', 's-shared']);
  });
});

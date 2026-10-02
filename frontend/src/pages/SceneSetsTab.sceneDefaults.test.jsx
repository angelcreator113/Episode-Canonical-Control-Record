/**
 * Scene Sets — "Make default" for a show's home and closet (Evoni's ruling
 * L3 and her answer to Q12, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 * The Episode Locations step proposes these defaults at Start Episode.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const base = { angles: [], generation_status: 'pending', base_still_url: null };
const HOME = { ...base, id: 'set-home', name: "Lala's Apartment", scene_type: 'HOME_BASE', show_id: 'show-1' };
const LOFT = { ...base, id: 'set-loft', name: 'Downtown Loft', scene_type: 'HOME_BASE', show_id: 'show-1' };
const CLOSET = { ...base, id: 'set-closet', name: 'Walk-in Closet', scene_type: 'CLOSET', show_id: 'show-1' };
const NO_SHOW = { ...base, id: 'set-free', name: 'Spare Room', scene_type: 'HOME_BASE', show_id: null };
const VENUE = { ...base, id: 'set-venue', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', show_id: 'show-1' };

let defaults;

function card(id) {
  return document.querySelector(`[data-scene-set-id="${id}"]`);
}

function openMenu(id) {
  fireEvent.click(within(card(id)).getByTitle('More options'));
}

describe('SceneSetsTab — Make default (L3, Q12)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    defaults = { home_set_id: 'set-home', closet_set_id: null };
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows/show-1/scene-defaults') return { data: { success: true, scene_defaults: defaults } };
      if (url.startsWith('/api/v1/scene-sets')) return { data: { success: true, data: [HOME, LOFT, CLOSET, NO_SHOW, VENUE] } };
      return { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.put).mockImplementation(async (url, body) => {
      if (url === '/api/v1/shows/show-1/scene-defaults') {
        defaults = { ...defaults, ...body };
        return { data: { success: true, scene_defaults: defaults } };
      }
      return { data: { success: true } };
    });
  });

  test('the saved default is badged and offers no "Make default"', async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    expect((await screen.findByTestId('scene-set-default-set-home')).textContent).toBe('DEFAULT HOME');
    openMenu('set-home');
    expect(screen.queryByTestId('make-default-set-home')).toBeNull();
  });

  test('a Home Base set is made the default home', async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await screen.findByTestId('scene-set-default-set-home');
    openMenu('set-loft');
    fireEvent.click(screen.getByTestId('make-default-set-loft'));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/shows/show-1/scene-defaults', { home_set_id: 'set-loft' }));
    expect((await screen.findByTestId('scene-set-default-set-loft')).textContent).toBe('DEFAULT HOME');
    expect(screen.queryByTestId('scene-set-default-set-home')).toBeNull();
  });

  test('a Closet set is made the default closet', async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await screen.findByTestId('scene-set-default-set-home');
    openMenu('set-closet');
    fireEvent.click(screen.getByTestId('make-default-set-closet'));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/shows/show-1/scene-defaults', { closet_set_id: 'set-closet' }));
    expect((await screen.findByTestId('scene-set-default-set-closet')).textContent).toBe('DEFAULT CLOSET');
  });

  test('a venue set, or a set with no show, offers no "Make default"', async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    await screen.findByTestId('scene-set-default-set-home');
    openMenu('set-venue');
    expect(screen.queryByTestId('make-default-set-venue')).toBeNull();
    fireEvent.click(document.querySelector('.scene-sets-kebab-backdrop'));
    openMenu('set-free');
    expect(screen.queryByTestId('make-default-set-free')).toBeNull();
  });
});

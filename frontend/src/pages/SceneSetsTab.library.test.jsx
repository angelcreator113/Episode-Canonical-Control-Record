/**
 * The Scene Sets page as a library: each card is a preview, a name, its type,
 * one status line and Open Set; editing happens in the set's workspace
 * (Backgrounds, Event Looks, Details & Usage, Advanced).
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

const SETS = [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/a.jpg', angles: [
    { id: 'a1', angle_label: 'WIDE', angle_name: 'Wide', generation_status: 'complete', still_image_url: 'https://x/a1.jpg', sort_order: 0 },
    { id: 'a2', angle_label: 'CLOSE', angle_name: 'Close', generation_status: 'pending', still_image_url: null, sort_order: 1 },
  ] },
  { id: 'set-2', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', generation_status: 'complete', base_still_url: 'https://x/g.jpg',
    base_approved: true, world_location_id: 'loc-1', angles: [
      { id: 'g1', angle_label: 'A', angle_name: 'Entrance', generation_status: 'pending', sort_order: 0 },
      { id: 'g2', angle_label: 'B', angle_name: 'Main room', generation_status: 'pending', sort_order: 1 },
      { id: 'g3', angle_label: 'C', angle_name: 'Stage', generation_status: 'pending', sort_order: 2 },
      { id: 'g4', angle_label: 'D', angle_name: 'Terrace', generation_status: 'pending', sort_order: 3 },
    ],
    visual_language: { scene_spec: { objects: [{ id: 'o1' }], camera_contracts: [{}, {}, {}, {}] } },
    events: [{ id: 'ev-1', name: 'Velour Gala', show_id: 'show-1' }, { id: 'ev-2', name: 'Night Market', show_id: 'show-1' }] },
  { id: 'set-3', name: 'Rooftop Stairwell', scene_type: 'OTHER', generation_status: 'pending', angles: [] },
];

const renderAt = (search = '?tab=scene-sets') => render(<MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);

describe('SceneSetsTab: the library', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') && !url.includes('/events/') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } }
    ));
  });

  test('the page is called Scene Sets, with New Scene Set', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Scene Sets' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /New Scene Set/ })).toBeTruthy();
  });

  test('a card shows counts and one status line, not the editing controls', async () => {
    renderAt();
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    const venue = card('set-2');
    expect(within(venue).getByTestId('scene-set-event-looks-count-set-2').textContent).toContain('2 event looks');
    expect(within(venue).getByTestId('scene-set-views-set-2').textContent).toContain('0/4 views');
    expect(within(venue).getByTestId('scene-set-status-set-2').textContent).toContain('4 views to generate');
    expect(within(venue).getByTestId('scene-set-open-set-2')).toBeTruthy();
    // The event-look work and approval are in the workspace, not on the card.
    expect(within(venue).queryByTestId('scene-set-looks-set-2')).toBeNull();
    expect(within(venue).queryByTestId('approved-base-set-2')).toBeNull();
    expect(within(card('set-3')).getByTestId('scene-set-status-set-3').textContent).toContain('Needs a main background');
  });

  test('Open Set opens the workspace on Backgrounds; Event Looks holds each event', async () => {
    renderAt();
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-2'));
    expect(screen.getByTestId('scene-set-main-bg-set-2')).toBeTruthy();
    fireEvent.click(screen.getByTestId('scene-set-tab-looks-set-2'));
    const tab = screen.getByTestId('scene-set-looks-tab-set-2');
    expect(within(tab).getByTestId('approved-base-set-2')).toBeTruthy();
    expect(within(tab).getByTestId('scene-set-event-ev-1')).toBeTruthy();
    expect(within(tab).getByTestId('scene-set-event-ev-2')).toBeTruthy();
  });

  test('a venue with four views gets no "events only need 1-2 angles" advice and no rebuild that deletes them', async () => {
    renderAt();
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-2'));
    expect(screen.queryByText(/only need 1-2/)).toBeNull();
    expect(screen.queryByText(/Rebuild for 1-2 angles/)).toBeNull();
    expect(screen.getByText(/Generate All Angles \(4\)/)).toBeTruthy();
  });

  test('a look zone opens the set on Event Looks', async () => {
    renderAt('?tab=scene-sets&set=set-2&zone=look:ev-2');
    expect(await screen.findByTestId('scene-set-looks-tab-set-2')).toBeTruthy();
    expect(screen.getByTestId('scene-set-event-ev-2').classList.contains('is-zone-focus')).toBe(true);
  });

  test('Other is a filter; a search with no match says so and clears', async () => {
    renderAt();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    expect(card('set-3')).toBeTruthy();
    expect(card('set-1')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search scene sets...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No scene sets match your search')).toBeTruthy();
    expect(screen.queryByText('No scene sets yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(card('set-1')).toBeTruthy();
    expect(card('set-3')).toBeTruthy();
  });
});

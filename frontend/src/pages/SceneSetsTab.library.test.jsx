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
    expect(within(venue).getByTestId('scene-set-views-set-2').textContent).toContain('0 of 4 angles');
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
    fireEvent.click(screen.getByRole('button', { name: /^Other · \d+$/ }));
    expect(card('set-3')).toBeTruthy();
    expect(card('set-1')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search scene sets...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No scene sets match your search')).toBeTruthy();
    expect(screen.queryByText('No scene sets yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(card('set-1')).toBeTruthy();
    expect(card('set-3')).toBeTruthy();
  });

  test('no Compare base models in the header', async () => {
    renderAt();
    await screen.findByRole('heading', { name: 'Scene Sets' });
    expect(screen.queryByRole('button', { name: /Compare base models/ })).toBeNull();
  });

  test('approving the base is on the main background, beside the image', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    const SET = { id: 'set-9', name: 'Velour Hall', scene_type: 'EVENT_LOCATION', generation_status: 'complete', base_still_url: 'https://x/v.jpg', world_location_id: 'loc-9', angles: [] };
    const LOOSE = { id: 'set-8', name: 'Side Street', scene_type: 'OTHER', generation_status: 'complete', base_still_url: 'https://x/s.jpg', angles: [] };
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: [SET, LOOSE] } } : { data: { success: true, data: [] } }
    ));
    renderAt();
    fireEvent.click(await screen.findByTestId('scene-set-open-set-9'));
    const main = screen.getByTestId('scene-set-main-bg-set-9');
    fireEvent.click(within(main).getByRole('button', { name: /Approve as the location's base/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-9/approve-base', {}));
    fireEvent.click(document.querySelector('.scene-sets-modal-close'));
    fireEvent.click(screen.getByTestId('scene-set-open-set-8'));
    expect(screen.getByTestId('approve-needs-location-set-8')).toBeTruthy();
  });
});

describe('SceneSetsTab: back to the show', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.endsWith('/shows')) return { data: { success: true, data: [{ id: 'show-1', name: 'Styling Adventures' }] } };
      return url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } };
    });
  });
  const renderInShow = (search = '?tab=scene-sets') => render(
    <MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}><SceneSetsTab showId="show-1" /></MemoryRouter>,
  );

  // Inside Producer Mode the shell's own header leads back to the show, so
  // the page no longer repeats it (Evoni's mock, 2026-10-07).
  test('in a show, the page adds no second Back to show', async () => {
    renderInShow();
    await screen.findByRole('heading', { name: 'Scene Sets' });
    expect(screen.queryByTestId('scene-sets-back-to-show')).toBeNull();
  });

  test('opened from another page, the way back is to that page instead', async () => {
    renderInShow('?tab=scene-sets&from=%2Fepisodes%2Fep-1%2Fplan&fromLabel=Beat%20Plan');
    expect((await screen.findByTestId('scene-sets-back')).getAttribute('href')).toBe('/episodes/ep-1/plan');
    expect(screen.queryByTestId('scene-sets-back-to-show')).toBeNull();
  });

  test('outside a show there is no Back to show', async () => {
    renderAt();
    await screen.findByRole('heading', { name: 'Scene Sets' });
    expect(screen.queryByTestId('scene-sets-back-to-show')).toBeNull();
  });
});

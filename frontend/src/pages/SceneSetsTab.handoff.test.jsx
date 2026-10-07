/**
 * Arriving in Scene Sets from an episode: one line naming the page, the set
 * and what it needs, and the way back; once the image exists it says so and
 * Back to Episode N becomes the main action.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab, { handoffReady } from './SceneSetsTab';
import { sceneSetPath } from '../utils/sceneSets';

const SET = (entranceDone) => ({
  id: 'set-1', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', generation_status: 'complete', base_still_url: 'https://x/b.jpg',
  angles: [
    { id: 'a-front', angle_label: 'ESTABLISHING', angle_name: 'Entrance', angle_kind: 'front', sort_order: 0,
      generation_status: entranceDone ? 'complete' : 'pending', still_image_url: entranceDone ? 'https://x/f.jpg' : null },
  ],
  looks: [{ id: 'l1', event_id: 'ev-1', event_name: 'Velour Gala', status: 'generating', image_url: null }],
});

describe('handoffReady', () => {
  test('by angle id, zone kind or look; null without a zone or a set', () => {
    expect(handoffReady(SET(false), 'a-front')).toEqual({ ready: false, what: 'Entrance' });
    expect(handoffReady(SET(true), 'front')).toEqual({ ready: true, what: 'Entrance' });
    expect(handoffReady(SET(true), 'back')).toEqual({ ready: false, what: 'Back' });
    expect(handoffReady(SET(true), 'look:ev-1')).toEqual({ ready: false, what: "Velour Gala's look" });
    const done = { ...SET(true), looks: [{ event_id: 'ev-1', event_name: 'Velour Gala', status: 'complete', image_url: 'https://x/l.jpg' }] };
    expect(handoffReady(done, 'look:ev-1').ready).toBe(true);
    expect(handoffReady(SET(true), null)).toBeNull();
    expect(handoffReady(null, 'front')).toBeNull();
  });

  test('sceneSetPath carries what is needed', () => {
    expect(sceneSetPath('show-1', 'set-1', { zone: 'front', from: '/episodes/ep-1', fromLabel: 'Episode 10', need: 'Entrance angle missing' }))
      .toBe('/shows/show-1/world?tab=scene-sets&set=set-1&zone=front&from=%2Fepisodes%2Fep-1&fromLabel=Episode%2010&need=Entrance%20angle%20missing');
  });
});

describe('SceneSetsTab: the handoff line', () => {
  let current;
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: [current] } } : { data: { success: true, data: [] } }
    ));
  });
  // The page's own line (the workspace of the linked set shows the same one).
  const pageLine = () => document.querySelector('.scene-sets-container > [data-testid="scene-sets-handoff"]');
  const at = (zone) => `/shows/show-1/world?tab=scene-sets&set=set-1&zone=${zone}&from=%2Fepisodes%2Fep-1%2Fscenes&fromLabel=Episode%2010&need=Entrance%20angle%20missing`;

  test('names the episode, the set and what it needs, with the way back', async () => {
    current = SET(false);
    render(<MemoryRouter initialEntries={[at('front')]}><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(pageLine()?.textContent).toContain('The Glasshouse'));
    const line = within(pageLine());
    expect(pageLine().textContent).toContain('Working on Episode 10');
    expect(line.getByTestId('scene-sets-handoff-need').textContent).toBe('Entrance angle missing');
    expect(line.queryByTestId('scene-sets-handoff-ready')).toBeNull();
    expect(line.getByTestId('scene-sets-back').textContent).toBe('← Back to Episode 10');
    expect(line.getByTestId('scene-sets-back').getAttribute('href')).toBe('/episodes/ep-1/scenes');
    // The handoff replaces Back to show.
    expect(screen.queryByTestId('scene-sets-back-to-show')).toBeNull();
  });

  test('once the image exists, says so; Back to Episode 10 is the main action', async () => {
    current = SET(true);
    render(<MemoryRouter initialEntries={[at('front')]}><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(pageLine()?.querySelector('[data-testid="scene-sets-handoff-ready"]')).toBeTruthy());
    expect(within(pageLine()).getByTestId('scene-sets-handoff-ready').textContent).toContain('Entrance has its image now.');
    const back = within(pageLine()).getByTestId('scene-sets-back');
    expect(back.textContent).toBe('Back to Episode 10');
    expect(back.className).toContain('scene-sets-handoff-back');
  });

  test('a link from outside the app shows no handoff', async () => {
    current = SET(true);
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets&set=set-1&from=https%3A%2F%2Fevil.example']}><SceneSetsTab showId="show-1" /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Scene Sets' });
    expect(screen.queryByTestId('scene-sets-handoff')).toBeNull();
  });

  test('the set opened for the zone shows the handoff in its workspace too, so the way back stays in view', async () => {
    current = SET(true);
    render(<MemoryRouter initialEntries={[at('front')]}><SceneSetsTab showId="show-1" /></MemoryRouter>);
    const modal = await waitFor(() => {
      const el = document.querySelector('.scene-sets-modal');
      if (!el) throw new Error('workspace not open yet');
      return el;
    });
    await waitFor(() => expect(modal.querySelector('[data-testid="scene-sets-handoff-ready"]')).toBeTruthy());
    expect(modal.querySelector('[data-testid="scene-sets-back"]').textContent).toBe('Back to Episode 10');
  });
});

/**
 * S9 (b) (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): the
 * compact layout. "A compact location strip ... Expand a location to see its
 * views, event look, and Scene Set link. Keep Open Event Package with the
 * event venue." Beats in story order, each row: "Beat number and name; one
 * short line of story action; location and selected view; the actual
 * production background preview; Change Background, plus a specific repair
 * action when needed. Everything else goes inside Details. Keep Group by
 * location as an optional view. A missing background should appear as
 * missing. If you show a reference image, label it clearly."
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';

const HOME = { id: 'set-home', name: "Lala's Apartment", scene_type: 'HOME_BASE', base_still_url: 'https://x/home.jpg' };
const VENUE = { id: 'set-venue', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', base_still_url: 'https://x/venue.jpg' };
const beat = (n, set, extra = {}) => ({
  id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, scene_set_id: set?.id || null, locked: false, chosen_by_user: false,
  scene_context: null, shot_type: null, emotional_intent: null,
  sceneSet: set, location: { role: 'home', kinds: [], angle: null, missing: null }, scene_id: null, ...extra,
});
const LOCATIONS = {
  show_id: 'show-1', editable: true,
  locations: [
    { role: 'home', scene_set_id: HOME.id, name: null, scene_set: HOME, angle_count: 3 },
    { role: 'event', scene_set_id: VENUE.id, name: null, scene_set: VENUE, angle_count: 0 },
  ],
};
let PLAN;

function renderTab(props = {}) {
  render(
    <MemoryRouter initialEntries={['/episodes/ep-1?tab=scenes']}>
      <EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('EpisodeScenesTab, the compact layout (S9 b)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    PLAN = [
      beat(10, VENUE, {
        scene_context: 'Lala arrives at the gala. The doors open.',
        location: { role: 'event', kinds: ['front'], angle: null,
          missing: { reason: 'no_angle', kind: 'front', kinds: ['front'], label: 'ESTABLISHING', angle_id: null, name: 'Front', text: 'Front zone missing' },
          image: { url: 'https://x/venue.jpg', source: 'base', label: 'The Glasshouse · Inside' } },
      }),
      beat(1, HOME, {
        chosen_by_user: true, shot_type: 'WIDE', emotional_intent: 'Quiet before the storm',
        scene_context: 'Lala wakes up to a message.',
        location: { role: 'home', kinds: [], angle: null, missing: null, image: { url: 'https://x/home.jpg', source: 'base', label: "Lala's Apartment · Inside" } },
      }),
      beat(11, VENUE, { locked: true, location: { role: 'event', kinds: ['inside'], angle: null, missing: null, image: { url: 'https://x/venue.jpg', source: 'base', label: 'The Glasshouse · Inside' } } }),
      beat(12, VENUE, {
        location: { role: 'event', kinds: ['area'], angle: null,
          missing: { reason: 'no_angle', kind: 'area', kinds: ['area'], label: 'OTHER', angle_id: null, name: 'Bar', text: 'Bar area missing' }, image: null },
        sceneSet: { ...VENUE, base_still_url: null },
      }),
    ];
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: { ready: 2, total: 4, not_ready: [] } } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: LOCATIONS } };
      if (url === '/api/v1/episodes/ep-1/scenes') return { data: { success: true, data: [] } };
      return { data: { data: [] } };
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: {} } });
  });

  test('the locations are a compact strip; a location expands to its views, its Scene Sets link and, for the event venue, its Event Package', async () => {
    renderTab({ sourceEvent: { id: 'ev-1', name: 'Velour Gala', show_id: 'show-1' } });
    const strip = await screen.findByTestId('est-location-strip');
    expect(within(strip).getByTestId('est-location-chip-set-home').textContent).toBe("Home · Lala's Apartment");
    expect(within(strip).getByTestId('est-location-chip-set-venue').textContent).toBe('Event · The Glasshouse');
    expect(screen.queryByText('3 views')).toBeNull();

    fireEvent.click(within(strip).getByTestId('est-location-chip-set-home'));
    const home = screen.getByTestId('est-location-detail-set-home');
    expect(home.textContent).toContain('3 more views');
    expect(within(home).getByRole('link', { name: 'Open in Scene Sets' }).getAttribute('href')).toBe('/shows/show-1/world?tab=scene-sets&set=set-home');
    expect(within(home).queryByRole('link', { name: 'Open Event Package' })).toBeNull();

    fireEvent.click(within(strip).getByTestId('est-location-chip-set-venue'));
    const venue = screen.getByTestId('est-location-detail-set-venue');
    expect(venue.textContent).toContain('Base image only');
    expect(within(venue).getByRole('link', { name: 'Open Event Package' }).getAttribute('href')).toBe('/shows/show-1/events/ev-1');
  });

  test('the beats are in story order; Group by location is an option', async () => {
    renderTab();
    await screen.findByTestId('est-beat-1');
    const order = () => [...document.querySelectorAll('[data-testid^="est-beat-"]')].map((b) => b.dataset.testid.replace('est-beat-', ''));
    expect(order()).toEqual(['1', '10', '11', '12']);
    expect(document.querySelector('.est-beat-group')).toBeNull();
    fireEvent.click(screen.getByLabelText('Group by location'));
    expect(document.querySelectorAll('.est-beat-group').length).toBeGreaterThan(0);
  });

  test('a row: number and name, one line of story, location and view, the background, Change background; the rest in Details', async () => {
    renderTab();
    const one = await screen.findByTestId('est-beat-1');
    expect(one.textContent).toContain('Beat 1');
    expect(screen.getByTestId('est-story-1').textContent).toBe('Lala wakes up to a message.');
    expect(screen.getByTestId('est-where-1').textContent).toBe("Lala's Apartment · Inside");
    expect(one.querySelector('img').getAttribute('src')).toBe('https://x/home.jpg');
    expect(screen.getByRole('button', { name: 'Change background for beat 1' })).toBeTruthy();
    // Not on the collapsed row.
    expect(screen.queryByTestId('beat-chosen-1')).toBeNull();
    expect(screen.queryByText('Quiet before the storm')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details for beat 1' }));
    const details = screen.getByTestId('est-details-1');
    expect(details.textContent).toContain('Shot: Wide');
    expect(details.textContent).toContain('Emotional intent: Quiet before the storm');
    expect(within(details).getByTestId('beat-chosen-1').textContent).toBe('Chosen by you');
    expect(within(details).getByRole('button', { name: 'Lock' })).toBeTruthy();
  });

  test('Change background opens the editor; a locked beat is unlocked from its Details', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Change background for beat 1' }));
    expect(await screen.findByTestId('est-beat-sheet')).toBeTruthy();

    const locked = screen.getByRole('button', { name: 'Change background for beat 11' });
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe('Locked: unlock it in Details to change it');
    fireEvent.click(screen.getByRole('button', { name: 'Details for beat 11' }));
    fireEvent.click(within(screen.getByTestId('est-details-11')).getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/11/lock'));
  });

  test('a missing background shows as missing; a stand-in picture is labelled as a reference, not the background', async () => {
    renderTab();
    const missing = await screen.findByTestId('est-beat-12');
    expect(missing.querySelector('img')).toBeNull();
    expect(within(missing).getByTestId('est-thumb-missing-12').textContent).toBe('Missing');

    const ten = screen.getByTestId('est-beat-10');
    expect(within(ten).getByTestId('est-reference-10').textContent).toBe('Reference');
    expect(screen.getByTestId('est-where-10').textContent).toBe('The Glasshouse · Front missing (reference: Inside)');
    // Its repair action stays on the row.
    expect(screen.getByTestId('beat-missing-10').textContent).toContain('Front zone missing');
  });

  // The walkthrough (2026-10-02): a beat at a removed set looked ready on its
  // row. Each beat that needs attention says so on its own row.
  test('a beat that needs attention is marked on its row; a removed set points to Move my beats', async () => {
    PLAN.push(beat(5, { id: 'set-gone', name: "Lala's Room", base_still_url: 'https://x/old.jpg', removed: true }, {
      location: { role: 'home', kinds: [], angle: null, missing: null, image: { url: 'https://x/old.jpg', source: 'base', label: "Lala's Room · Inside (removed from Scene Sets)" } },
    }));
    const notReady = [
      { beat_number: 5, beat_name: 'Beat 5', text: "Lala's Room was removed", fix: { kind: 'removed_set', scene_set_id: 'set-gone' } },
      { beat_number: 10, beat_name: 'Beat 10', text: 'Front zone missing', fix: { kind: 'scene_set', scene_set_id: 'set-venue', zone: 'front' } },
    ];
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: { ready: 3, total: 5, not_ready: notReady } } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: LOCATIONS } };
      return { data: { data: [] } };
    });
    renderTab();
    expect((await screen.findByTestId('est-attention-5')).textContent).toBe('Needs attention: Lala\'s Room was removed. Choose its replacement in Move my beats, above.');
    // A missing zone already has its repair box on the row: marked, not repeated.
    expect(screen.queryByTestId('est-attention-10')).toBeNull();
    expect(screen.getByTestId('est-beat-10').closest('li').className).toContain('is-attention');
    expect(screen.queryByTestId('est-attention-1')).toBeNull();
    expect(screen.getByTestId('est-beat-5').closest('li').className).toContain('is-attention');
  });
});

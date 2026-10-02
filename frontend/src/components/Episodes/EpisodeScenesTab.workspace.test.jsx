/**
 * The episode's Scenes tab, the one scene workspace (Evoni's ruling L12 and
 * answer L12a, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): a status
 * bar, the Locations, the beats grouped by location with their badges and
 * missing-image actions, editing in place, "Open in Studio" on each beat,
 * older scenes until removed; no "Use in Episode" and no Episode Scenes list.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab, { groupBeats, nextStep } from './EpisodeScenesTab';

const HOME = { id: 'set-home', name: "Lala's Apartment", scene_type: 'HOME_BASE', base_still_url: 'https://x/home.jpg' };
const VENUE = { id: 'set-venue', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', base_still_url: null };
const CAFE = { id: 'set-cafe', name: 'Corner Café', scene_type: 'OTHER', base_still_url: 'https://x/cafe.jpg' };
const beat = (n, setId, extra = {}) => ({
  id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, scene_set_id: setId, locked: false, chosen_by_user: false,
  sceneSet: { [HOME.id]: HOME, [VENUE.id]: VENUE, [CAFE.id]: CAFE }[setId] || null,
  location: { role: 'home', kinds: [], angle: null, missing: null }, scene_id: setId ? `scene-${n}` : null, ...extra,
});
let PLAN;
let READINESS;
let SCENES;
const LOCATIONS = {
  show_id: 'show-1', editable: true,
  locations: [
    { role: 'home', scene_set_id: HOME.id, name: null, scene_set: HOME, angle_count: 3 },
    { role: 'event', scene_set_id: VENUE.id, name: null, scene_set: VENUE, angle_count: 1 },
  ],
};

function renderTab() {
  const onToast = vi.fn();
  render(
    <MemoryRouter>
      <EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={onToast} />
    </MemoryRouter>
  );
  return onToast;
}

describe('EpisodeScenesTab: the one scene workspace (L12, L12a)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    PLAN = [
      beat(1, HOME.id, { chosen_by_user: true }),
      beat(2, HOME.id, { location: { role: 'home', kinds: [], angle: { id: 'a-van', label: 'VANITY', name: 'Vanity', still_image_url: 'https://x/vanity.jpg' }, missing: null } }),
      beat(4, CAFE.id),
      beat(10, VENUE.id, { location: { role: 'event', kinds: ['entrance'], angle: null,
        missing: { reason: 'no_angle', kind: 'entrance', kinds: ['entrance'], label: 'DOORWAY', angle_id: null, name: 'Entrance', text: 'Entrance angle missing' } } }),
      beat(11, VENUE.id, { locked: true }),
      beat(14, null),
    ];
    READINESS = { ready: 4, total: 6, not_ready: [{ beat_number: 10 }, { beat_number: 14 }] };
    SCENES = [{ id: 'scene-2', scene_plan_id: 'p2', title: 'Beat 2' }, { id: 'old-1', scene_plan_id: null, title: 'Old arrival', scene_number: 1 }];
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: READINESS } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: LOCATIONS } };
      if (url === '/api/v1/episodes/ep-1/scenes') return { data: { success: true, data: SCENES } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [{ ...HOME, show_id: 'show-1', angles: [] }, { ...CAFE, show_id: 'show-1', angles: [] }] } };
      return { data: {} };
    });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: {} } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
  });

  // S9 (a) (§8(hh)): the background summary counts what needs attention.
  test('the status bar counts ready backgrounds and locked beats, and names the next step', async () => {
    renderTab();
    expect((await screen.findByTestId('est-status-images')).textContent).toBe('Backgrounds: 4 ready · 2 need attention');
    await waitFor(() => expect(screen.getByTestId('est-status-locked').textContent).toBe('1/6 locked'));
    expect(screen.getByTestId('est-status-next').textContent).toBe('Next: Add the missing images: beats 10 and 14');
    expect(screen.getByTestId('est-open-beat-plan').getAttribute('href')).toBe('/episodes/ep-1/plan');
  });

  test('the next step after the images is locking the beats, then writing the script', () => {
    const ready = { ready: 2, total: 2, not_ready: [] };
    expect(nextStep([], null)).toEqual({ kind: 'plan', text: 'Make the beat plan' });
    expect(nextStep([{ locked: true }, { locked: false }], ready)).toEqual({ kind: 'lock', text: 'Lock the beats' });
    expect(nextStep([{ locked: true }, { locked: true }], ready)).toEqual({ kind: 'script', text: 'Write the script' });
  });

  test('Lock the beats locks them all', async () => {
    READINESS = { ready: 6, total: 6, not_ready: [] };
    renderTab();
    fireEvent.click(await screen.findByTestId('est-lock-all'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/lock-all'));
  });

  test('the Locations show role, thumbnail, angle count and a link to Scene Sets', async () => {
    renderTab();
    const home = await screen.findByTestId('est-location-set-home');
    expect(home.textContent).toContain('Home');
    expect(home.textContent).toContain("Lala's Apartment");
    expect(home.textContent).toContain('3 angles');
    expect(home.querySelector('img').getAttribute('src')).toBe('https://x/home.jpg');
    expect(within(home).getByRole('link', { name: 'Scene Sets' }).getAttribute('href')).toBe('/shows/show-1/world?tab=scene-sets&set=set-home');
    expect(screen.getByTestId('est-location-set-venue').textContent).toContain('1 angle');
    expect(screen.getByTestId('est-edit-locations')).toBeTruthy();
  });

  test('the beats are grouped by location, in the locations\' order, then other sets, then no location', async () => {
    renderTab();
    await screen.findByTestId('est-beat-1');
    const groups = [...document.querySelectorAll('.est-beat-group')].map((g) => [
      g.querySelector('.est-beat-group-title').textContent,
      [...g.querySelectorAll('[data-testid^="est-beat-"]')].map((b) => b.dataset.testid.replace('est-beat-', '')),
    ]);
    expect(groups).toEqual([
      ["Home: Lala's Apartment", ['1', '2']],
      ['Event: The Glasshouse', ['10', '11']],
      ['Corner Café', ['4']],
      ['No location', ['14']],
    ]);
    expect(groupBeats([], LOCATIONS.locations)).toEqual([]);
  });

  test('each row shows its angle image, name, set and angle, badges, the missing-image actions and Open in Studio', async () => {
    renderTab();
    const two = await screen.findByTestId('est-beat-2');
    expect(two.querySelector('img').getAttribute('src')).toBe('https://x/vanity.jpg');
    expect(two.textContent).toContain('Beat 2');
    expect(two.textContent).toContain("Lala's Apartment · Vanity");
    expect(screen.getByTestId('beat-chosen-1').textContent).toBe('Chosen by you');
    expect(screen.getByTestId('est-locked-11').textContent).toBe('Locked');
    expect(screen.getByTestId('beat-missing-10').textContent).toContain('Entrance angle missing');
    expect(screen.getByTestId('est-studio-2').getAttribute('href')).toBe('/studio/scene/scene-2');
    expect(screen.queryByTestId('est-studio-14')).toBeNull();
    expect(screen.queryByText(/Use in Episode/)).toBeNull();
    expect(screen.queryByText('Episode Scenes')).toBeNull();
  });

  test('tapping a row edits it in place; saving a set from the library marks it chosen; a locked row does not open', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('est-beat-11'));
    expect(screen.queryByTestId('beat-editor')).toBeNull();

    fireEvent.click(screen.getByTestId('est-beat-2'));
    const sheet = await screen.findByTestId('est-beat-sheet');
    expect(screen.getByTestId('est-beat-2').closest('li').contains(sheet)).toBe(true);
    const editor = within(sheet).getByTestId('beat-editor');
    fireEvent.click(await within(editor).findByTestId('beat-set-option-set-cafe'));
    fireEvent.click(within(editor).getByText('Save'));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2',
      expect.objectContaining({ scene_set_id: 'set-cafe', chosen: true })));
    await waitFor(() => expect(screen.queryByTestId('est-beat-sheet')).toBeNull());
  });

  test('older scenes (not tied to a beat) are listed until removed', async () => {
    const onToast = renderTab();
    const older = await screen.findByTestId('est-older-scenes');
    expect(within(older).queryByTestId('est-older-scene-2')).toBeNull();
    expect(within(older).getByTestId('est-older-old-1').textContent).toContain('Old arrival');
    fireEvent.click(within(older).getByTestId('est-older-remove-old-1'));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scenes/old-1'));
    await waitFor(() => expect(screen.queryByTestId('est-older-scenes')).toBeNull());
    expect(onToast).toHaveBeenCalledWith('Scene removed', 'info');
  });
});

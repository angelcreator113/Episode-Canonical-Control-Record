/**
 * L9 (Evoni, 2026-10-02, §8(hh)): "On the Scene Sets page, a venue's set
 * shows a Looks row: its approved base, then one card per event's dressed
 * version, each naming its event. ... Scene Sets links each look back to
 * its event."
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import api from '../services/api';
import { LooksRow } from './SceneSetsTab';

const renderRow = (set, props = {}) => render(<MemoryRouter><LooksRow set={set} {...props} /></MemoryRouter>);

describe('SceneSetsTab Looks row (L9)', () => {
  test('the approved base first, then one card per event, each linking to its event', () => {
    renderRow({
      id: 'set-1', base_approved: true, base_still_url: 'https://x/base.jpg',
      looks: [
        { id: 'l1', event_id: 'ev-1', event_show_id: 'show-1', event_name: 'Velour Gala', status: 'complete', image_url: 'https://x/l1.jpg' },
        { id: 'l2', event_id: 'ev-2', event_show_id: 'show-1', event_name: 'Garden Brunch', status: 'generating', image_url: null },
      ],
    });
    const row = screen.getByTestId('scene-set-looks-set-1');
    const figures = within(row).getAllByRole('figure');
    expect(figures.map((f) => f.textContent)).toEqual(['Everyday look', 'Velour Gala', 'Generating…Garden Brunch']);
    expect(within(row).getByText('Velour Gala').getAttribute('href')).toBe('/shows/show-1/events/ev-1');
    expect(screen.getByTestId('scene-set-look-l1').querySelector('img').getAttribute('src')).toBe('https://x/l1.jpg');
  });

  test('looks without an approved base on this set show without the base card', () => {
    renderRow({ id: 'set-2', base_approved: false, looks: [{ id: 'l3', event_id: 'ev-3', event_show_id: 'show-1', event_name: 'Mixer', status: 'failed' }] });
    expect(screen.queryByTestId('scene-set-look-base-set-2')).toBeNull();
    expect(screen.getByTestId('scene-set-look-l3').textContent).toBe('FailedMixer');
  });

  test('a look made from an old everyday look says the episode does not use it', () => {
    renderRow({ id: 'set-5', base_approved: false, looks: [{ id: 'l5', event_id: 'ev-5', event_show_id: 'show-1', event_name: 'Gala', status: 'complete', image_url: 'https://x/l5.jpg', stale: true }] });
    expect(screen.getByTestId('scene-set-look-stale-l5').textContent).toBe(' · old everyday look');
  });

  test('a set with no approved base and no looks shows no row', () => {
    const { container } = renderRow({ id: 'set-3', base_approved: false, looks: [] });
    expect(container.innerHTML).toBe('');
  });

  // S8 (Evoni, 2026-10-02; §8(dd)), answers 1-2: the look and its dressed
  // angles are made here, per event using the set.
  test('S8: each event using the set has its look work here: Generate this look, and its dressed angles once it has an episode', async () => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events/ev-1/look') return { data: { success: true, data: { scene_set: { id: 'set-4', name: 'Hall' }, approved_base: null, look: null, editable: true } } };
      if (url === '/api/v1/episode-brief/ep-1/dressed-angles?scene_set_id=set-4') return { data: { data: { look: null, angles: [] } } };
      return { data: {} };
    });
    renderRow({
      id: 'set-4', base_approved: false, looks: [],
      events: [{ id: 'ev-1', name: 'Velour Gala', show_id: 'show-1', used_in_episode_id: 'ep-1', episode_id: 'ep-1', is_episode_event: true, look: null }],
    }, { focusZone: 'look:ev-1' });
    const block = await screen.findByTestId('scene-set-event-ev-1');
    expect(block.classList.contains('is-zone-focus')).toBe(true);
    expect(within(block).getByText('Velour Gala')).toBeTruthy();
    expect(await within(block).findByTestId('generate-this-look')).toBeTruthy();
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toContain('/api/v1/episode-brief/ep-1/dressed-angles?scene_set_id=set-4'));
  });
  test("an event whose episode is another event's does not show that event's dressed angles (fourth audit)", async () => {
    vi.mocked(api.get).mockClear();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/look')) return { data: { success: true, data: { scene_set: { id: 'set-5', name: 'Hall' }, approved_base: null, look: null, editable: true } } };
      return { data: {} };
    });
    renderRow({
      id: 'set-5', base_approved: false, looks: [],
      events: [{
        id: 'ev-2', name: 'After party', show_id: 'show-1', used_in_episode_id: 'ep-1', episode_id: 'ep-1', is_episode_event: false,
        episode_event: { id: 'ev-1', name: 'Velour Gala', show_id: 'show-1' }, other_events: [], look: null,
      }],
    });
    // Evoni, 2026-10-16: the note names the episode's event, with a link.
    const note = await screen.findByTestId('scene-set-event-not-episode-ev-2');
    expect(within(note).getByRole('link', { name: 'Velour Gala' }).getAttribute('href')).toBe('/shows/show-1/events/ev-1');
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(api.get).mock.calls.map(([u]) => u).some((u) => u.includes('dressed-angles'))).toBe(false);
  });

  // Evoni, 2026-10-16: an episode made from several events dresses its own
  // event's look, and names the others, each a link to its event.
  test('the episode\'s event dresses its look and names the episode\'s other events', async () => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/look')) return { data: { success: true, data: { scene_set: { id: 'set-7', name: 'Hall' }, approved_base: null, look: null, editable: true } } };
      if (url === '/api/v1/episode-brief/ep-9/dressed-angles?scene_set_id=set-7') return { data: { data: { look: null, angles: [] } } };
      return { data: {} };
    });
    renderRow({
      id: 'set-7', base_approved: false, looks: [],
      // Named by the episode's brief, not stamped with it.
      events: [{
        id: 'ev-9', name: 'Gala', show_id: 'show-1', used_in_episode_id: null, episode_id: 'ep-9', is_episode_event: true, episode_event: null,
        other_events: [{ id: 'ev-10', name: 'After party', show_id: 'show-1' }, { id: 'ev-11', name: 'Brunch', show_id: 'show-1' }], look: null,
      }],
    });
    const others = await screen.findByTestId('scene-set-event-others-ev-9');
    expect(others.textContent).toBe('Also in this episode: After party, Brunch');
    expect(within(others).getByRole('link', { name: 'Brunch' }).getAttribute('href')).toBe('/shows/show-1/events/ev-11');
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toContain('/api/v1/episode-brief/ep-9/dressed-angles?scene_set_id=set-7'));
  });

  test('a look being made again, or whose last try failed, keeps its picture and says so (fourth audit)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    renderRow({
      id: 'set-6', base_approved: false, events: [],
      looks: [
        { id: 'lk-1', status: 'generating', image_url: 'https://x/old.jpg', event_id: 'e1', event_name: 'Gala', event_show_id: 'show-1' },
        { id: 'lk-2', status: 'complete', image_url: 'https://x/kept.jpg', error: 'Provider timeout', event_id: 'e2', event_name: 'Brunch', event_show_id: 'show-1' },
      ],
    });
    const regenerating = await screen.findByTestId('scene-set-look-lk-1');
    expect(regenerating.querySelector('img').getAttribute('src')).toBe('https://x/old.jpg');
    expect(screen.getByTestId('scene-set-look-regenerating-lk-1')).toBeTruthy();
    expect(screen.getByTestId('scene-set-look-error-lk-2').textContent).toMatch(/last try failed: Provider timeout/);
  });
});

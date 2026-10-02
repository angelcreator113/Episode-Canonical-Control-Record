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
    expect(figures.map((f) => f.textContent)).toEqual(['Approved base', 'Velour Gala', 'Generating…Garden Brunch']);
    expect(within(row).getByText('Velour Gala').getAttribute('href')).toBe('/shows/show-1/events/ev-1');
    expect(screen.getByTestId('scene-set-look-l1').querySelector('img').getAttribute('src')).toBe('https://x/l1.jpg');
  });

  test('looks without an approved base on this set show without the base card', () => {
    renderRow({ id: 'set-2', base_approved: false, looks: [{ id: 'l3', event_id: 'ev-3', event_show_id: 'show-1', event_name: 'Mixer', status: 'failed' }] });
    expect(screen.queryByTestId('scene-set-look-base-set-2')).toBeNull();
    expect(screen.getByTestId('scene-set-look-l3').textContent).toBe('FailedMixer');
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
      events: [{ id: 'ev-1', name: 'Velour Gala', show_id: 'show-1', used_in_episode_id: 'ep-1', look: null }],
    }, { focusZone: 'look:ev-1' });
    const block = await screen.findByTestId('scene-set-event-ev-1');
    expect(block.classList.contains('is-zone-focus')).toBe(true);
    expect(within(block).getByText('Velour Gala')).toBeTruthy();
    expect(await within(block).findByTestId('generate-this-look')).toBeTruthy();
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toContain('/api/v1/episode-brief/ep-1/dressed-angles?scene_set_id=set-4'));
  });
});

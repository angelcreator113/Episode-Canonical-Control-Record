/**
 * Production readiness (Evoni's ruling L5 and her answer Q21, 2026-10-02,
 * §8(hh)): "every planned beat has an angle with an image. Flag it on the
 * production checklist and the planner header; never block."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => null) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';

let readiness;
const renderChecklist = () => render(
  <MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" /></MemoryRouter>,
);
const item = () => screen.findByText(/^Scene images for every beat/);

describe('EpisodeProductionChecklist: "Scene images for every beat" (L5, Q21)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: [{ beat_number: 1 }], readiness } };
      return { data: {} };
    });
  });

  test('beats without their image are flagged, by number, and the item is optional', async () => {
    readiness = { ready: 12, total: 14, not_ready: [{ beat_number: 10 }, { beat_number: 11 }] };
    renderChecklist();
    const note = await screen.findByTestId('check-note-scene_images');
    expect(note.textContent).toBe('12 of 14 beats have an image; missing: beats 10, 11');
    const label = await item();
    expect(label.style.textDecoration).toBe('none');
    expect(label.textContent).not.toMatch(/required/i);
    expect(screen.getByRole('button', { name: 'Open planner' })).toBeTruthy();
  });

  test('ticked when every beat has its image', async () => {
    readiness = { ready: 14, total: 14, not_ready: [] };
    renderChecklist();
    await waitFor(async () => expect((await item()).style.textDecoration).toBe('line-through'));
    expect(screen.queryByTestId('check-note-scene_images')).toBeNull();
  });
});

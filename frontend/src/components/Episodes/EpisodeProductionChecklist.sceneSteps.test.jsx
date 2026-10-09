/**
 * S9 (c) (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): "Plan →
 * Images → Locks → Write Script guidance — Remove from this tab; put
 * stage-aware guidance on the episode Overview or Checklist."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => null) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';
import { nextStep } from '../../utils/sceneSteps';

let plan;
let readiness;
const renderChecklist = () => render(
  <MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" /></MemoryRouter>,
);

describe('nextStep (L12, moved by S9 c)', () => {
  test('plan, then images, then locks, then the script', () => {
    const ready = { ready: 2, total: 2, not_ready: [] };
    expect(nextStep([], null)).toEqual({ kind: 'plan', text: 'Make the beat plan' });
    expect(nextStep([{ locked: false }, { locked: false }], { ready: 1, total: 2, not_ready: [{ beat_number: 10 }] }))
      .toEqual({ kind: 'images', text: 'Add the missing images: beat 10' });
    expect(nextStep([{ locked: true }, { locked: false }], ready)).toEqual({ kind: 'lock', text: 'Lock the beats' });
    expect(nextStep([{ locked: true }, { locked: true }], ready)).toEqual({ kind: 'script', text: 'Write the script' });
  });

  test('a plan short of the 14 beats is still at the plan step (audit GATE-01)', () => {
    const ready = { ready: 1, total: 1, not_ready: [] };
    const coverage = { complete: false, text: '1 of 14 beats · missing beats 2, 3 and 4' };
    expect(nextStep([{ locked: true }], ready, coverage)).toEqual({ kind: 'plan', text: 'Complete the beat plan: 1 of 14 beats · missing beats 2, 3 and 4' });
    expect(nextStep([{ locked: true }], ready, { complete: true, text: '14 of 14 beats' })).toEqual({ kind: 'script', text: 'Write the script' });
  });
});

describe('EpisodeProductionChecklist: the scenes\' next step (S9 c)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan, readiness } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  });

  test('missing images: the next step names the beats; the images row opens the Scenes tab', async () => {
    plan = [{ beat_number: 1, locked: false }, { beat_number: 10, locked: false }, { beat_number: 11, locked: false }];
    readiness = { ready: 1, total: 3, not_ready: [{ beat_number: 10 }, { beat_number: 11 }] };
    renderChecklist();
    const next = await screen.findByTestId('checklist-scene-next');
    expect(next.textContent).toContain('Next: Add the missing images: beats 10 and 11');
    // Said once: the images row's own Open Scenes is the action.
    expect(screen.queryByTestId('checklist-scene-next-action')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Open Scenes' })).toHaveLength(1);
    expect((await screen.findByTestId('check-note-scene_images')).textContent).toBe('1 ready · 2 need attention: beats 10, 11');
  });

  test('every image ready, beats unlocked: the checklist skips locking and goes to the script (Evoni, 2026-10-09)', async () => {
    plan = [{ beat_number: 1, locked: false }, { beat_number: 2, locked: true }];
    readiness = { ready: 2, total: 2, not_ready: [] };
    renderChecklist();
    expect((await screen.findByTestId('checklist-scene-next')).textContent).toContain('Next: Write the script');
    expect(screen.queryByRole('button', { name: 'Lock all beats' })).toBeNull();
    expect(screen.queryByText(/^Scene plan locked/)).toBeNull();
    expect(screen.queryByText(/Production coverage/)).toBeNull();
  });

  test('no plan yet: make the beat plan; all locked: write the script', async () => {
    plan = [];
    readiness = { ready: 0, total: 0, not_ready: [] };
    const { unmount } = renderChecklist();
    expect((await screen.findByTestId('checklist-scene-next')).textContent).toContain('Next: Make the beat plan');
    // The walkthrough: the footer's Scene Plan and Write Script buttons are
    // these actions, so the Next line adds none.
    expect(screen.queryByTestId('checklist-scene-next-action')).toBeNull();
    unmount();
    plan = [{ beat_number: 1, locked: true }];
    readiness = { ready: 1, total: 1, not_ready: [] };
    renderChecklist();
    expect((await screen.findByTestId('checklist-scene-next')).textContent).toContain('Next: Write the script');
    expect(screen.queryByTestId('checklist-scene-next-action')).toBeNull();
  });
});

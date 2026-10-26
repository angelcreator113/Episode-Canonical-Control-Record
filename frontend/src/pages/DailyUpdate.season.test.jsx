/**
 * The daily update's "The season" (Evoni, 2026-10-26, Season page round 3):
 * each show's season in progress (the update's `seasons`) with the Season
 * page's own Needs attention list, the same items in the same words
 * (lib/seasonAttention attentionItems over the same reads), each row a link
 * to its fix; the "Focus for today" spot empty for a later AI step.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import DailyUpdate from './DailyUpdate';
import { attentionItems } from '../lib/seasonAttention';

const PHASES = [{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 3 }];
const arc = { id: 'arc-2', title: 'Glow', season_number: 2, status: 'active', current_phase: 1, phases: PHASES };
const roadmap = {
  arc: { id: 'arc-2', current_phase: 1 }, season_number: 2, slot_count: 3, counts: {},
  phases: [{ ...PHASES[0], slots: [
    { id: 's1', slot_number: 1, phase: 1, state: 'in_production', locked: true, episode: { id: 'ep1', title: 'Opener' }, event: null },
    { id: 's2', slot_number: 2, phase: 1, state: 'needs_event', locked: false, episode: null, event: null },
    { id: 's3', slot_number: 3, phase: 1, state: 'needs_event', locked: false, episode: null, event: null },
  ] }],
};
const episodes = [{ id: 'ep1', title: 'Opener', status: 'draft', episode_number: 1, season_number: 2 }];
const release = { state: 'active', schedule: { day: 'sun' }, seasons: [], slots: {}, episodes: [{ episode_id: 'ep1', season_number: 2, number: 1, date: '2099-11-01', source: 'schedule', due: 'soon', days_until: 2 }] };
const coverage = { parts: [{ phase: 1, title: 'Foundation', gaps: [{ goal_id: 'g1', title: 'Save coins' }] }] };
const update = (seasons) => ({
  since: '2026-10-25T09:00:00.000Z', now: '2026-10-26T09:00:00.000Z',
  since_yesterday: { went_live: { total: 0, auto: 0, items: [] }, scheduled: { total: 0, items: [] }, new_characters: { total: 0, items: [] }, automatic: { facts: [], voices_built: [], findings_resolved: {} } },
  waiting: [],
  coming_up: { until: '2026-10-29T09:00:00.000Z', posts: [], episodes: [], events: [], deals: [], slots: [] },
  cost: { spent_usd: 0, budget_usd: 50, left_usd: 50, share: 0, features: [] },
  seasons,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});
function mock(seasons) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const path = url.split('?')[0];
    if (path === '/api/v1/daily-update') return { data: update(seasons) };
    if (path === '/api/v1/world/show-1/arc') return { data: { arc } };
    if (path === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap } };
    if (path === '/api/v1/world/show-1/events') return { data: { events: [] } };
    if (path === '/api/v1/episodes') return { data: { episodes, total: episodes.length } };
    if (path === '/api/v1/opportunities/show-1') return { data: { opportunities: [] } };
    if (path === '/api/v1/world/show-1/release-schedule') return { data: { data: release } };
    if (path === '/api/v1/world/show-1/season/goal-coverage') return { data: coverage };
    return { data: {} };
  });
}

describe('DailyUpdate: the season', () => {
  test('each season in progress with the Season page\'s own Needs attention, same items, same words', async () => {
    mock([{ show_id: 'show-1', show: 'Styling Adventures', arc_id: 'arc-2', season_number: 2, title: 'Glow' }]);
    render(<MemoryRouter><DailyUpdate /></MemoryRouter>);
    const box = await screen.findByTestId('du-season-attention-show-1');
    const expected = attentionItems({ showId: 'show-1', arc, roadmap, events: [], episodes, coverage, release, opps: [], isCurrent: true });
    expect(expected.length).toBeGreaterThanOrEqual(3);
    await waitFor(() => expect(within(box).getAllByRole('link')).toHaveLength(expected.length));
    const rows = within(box).getAllByRole('link');
    expect(rows.map((r) => r.querySelector('.satt-row-title').textContent)).toEqual(expected.map((i) => i.title));
    expect(rows[0].textContent).toMatch(/Episode 1 releases in 2 days/);
    // Each row opens its fix on that show's Season page (or the Release tab).
    expect(within(box).getByTestId('szn-attention-slots-1').getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=2');
    expect(within(box).getByTestId('szn-attention-gap-1').getAttribute('href')).toBe('/shows/show-1/season?tab=goals');
    const section = screen.getByTestId('du-seasons');
    expect(within(section).getByRole('link', { name: 'Styling Adventures · Season 2: Glow' }).getAttribute('href')).toBe('/shows/show-1/season');
    expect(within(section).getByTestId('du-slot-focus').textContent).toBe('');
  });

  test('no season in progress: no section', async () => {
    mock([]);
    render(<MemoryRouter><DailyUpdate /></MemoryRouter>);
    await screen.findByTestId('du-coming');
    expect(screen.queryByTestId('du-seasons')).toBeNull();
  });
});

/**
 * Results as one page (Evoni's Episode mock, 2026-10-05): how it went, the
 * money, Lala's stats and goals, and what viewers and her feed see.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import EpisodeResultsSummary, { ResultsShare } from './EpisodeResultsSummary';

const MONEY = { lines: [{ key: 'fee', label: 'Reel fee (on approval)', signed: 439, state: 'pending' }, { key: 'entry', label: 'Entry (comped by host)', signed: -50, covered: true, state: 'covered' }], projection: { projected_net: 439, posted_net: 0, conditional: [] } };
const renderPage = (episode) => {
  const onOpenTab = vi.fn();
  render(<MemoryRouter><EpisodeResultsSummary episode={{ id: 'ep-1', show_id: 'show-1', ...episode }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
  return { onOpenTab };
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { designed_intent: 'pass' } } };
    if (url === '/api/v1/world/show-1/episodes/ep-1/money') return { data: { data: MONEY } };
    if (url === '/api/v1/characters/lala/state?show_id=show-1') return { data: { state: { coins: 1900, reputation: 8, brand_trust: 7, influence: 7, stress: 2 } } };
    if (url === '/api/v1/world/show-1/goals?status=active') return { data: { goals: [{ id: 'g1', title: 'Follow up with STUDIO BY SABLE', description: 'A reason to work together again', status: 'active' }] } };
    if (url === '/api/v1/feed-posts/episode/ep-1') return { data: { data: [] } };
    return { data: {} };
  });
});

describe('Results summary', () => {
  // Evoni, 2026-10-22 (Results layout): until it is completed, one card of
  // what fills in then, and the money; no "after Complete" rows.
  test('before Complete: one card of what fills in then (designed Pass), and the money as an estimate', async () => {
    renderPage({});
    const pending = screen.getByTestId('results-pending');
    expect(await within(pending).findByText('Pass')).toBeTruthy();
    expect(pending.textContent).toContain('Fills in at Complete');
    expect(within(pending).getByText('Open the events').getAttribute('href')).toBe('/shows/show-1/season?tab=events');
    expect(screen.getByText('Not completed yet')).toBeTruthy();
    expect((await screen.findByTestId('results-net')).textContent).toBe('Net for the episodeestimate +439');
    expect(screen.getByText('Entry (comped by host)').closest('li').textContent).toContain('0 covered');
    for (const id of ['results-how', 'results-stats', 'results-goals', 'results-evaluation', 'results-share']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.queryByText(/after Complete/)).toBeNull();
  });

  test('after Complete: the actual tier, each stat change, the goals, and the evaluation under it', async () => {
    renderPage({ evaluation_json: { tier_final: 'slay', score: 91, stat_deltas: { coins: 439, stress: -1 }, breakdown: { outfit_match: { value: 30 } } } });
    expect(await within(screen.getByTestId('results-how')).findByText('Slay')).toBeTruthy();
    expect(screen.getByText('Completed · 91/100')).toBeTruthy();
    expect((await screen.findByTestId('results-stat-stress')).textContent).toContain('−1');
    expect(await screen.findByText('Follow up with STUDIO BY SABLE')).toBeTruthy();
    // Her goals are kept on the Season page's Goals tab (2026-10-25).
    expect(within(screen.getByTestId('results-goals')).getByRole('link', { name: "Open Lala's goals" }).getAttribute('href')).toBe('/shows/show-1/season?tab=goals');
    const evaluation = screen.getByTestId('results-evaluation');
    expect(within(evaluation).getByText('outfit match')).toBeTruthy();
    expect(within(evaluation).getByText('+30')).toBeTruthy();
  });

  test('share is on Distribution: a missing teaser says so and opens the Overview; Lala\'s posts link', async () => {
    const onOpenTab = vi.fn();
    render(<MemoryRouter><ResultsShare episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
    const teaser = screen.getByTestId('results-teaser');
    expect(teaser.textContent).toContain('Missing');
    fireEvent.click(within(teaser).getByRole('button', { name: 'Write teaser' }));
    expect(onOpenTab).toHaveBeenCalledWith('overview');
    expect(screen.getByText("Open Lala's posts").getAttribute('href')).toBe('/shows/show-1/world?tab=feed');
  });
});

/**
 * Results as one page (Evoni's Episode mock, 2026-10-05): how it went, the
 * money, Lala's stats and goals, and what viewers and her feed see.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import EpisodeResultsSummary from './EpisodeResultsSummary';

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
  test('before Complete: designed Pass, actual ?, the money as an estimate, stats after Complete', async () => {
    renderPage({});
    const how = screen.getByTestId('results-how');
    expect(await within(how).findByText('Pass')).toBeTruthy();
    expect(how.textContent).toContain('?');
    expect(screen.getByText('Not completed yet')).toBeTruthy();
    expect((await screen.findByTestId('results-net')).textContent).toBe('Net for the episodeestimate +439');
    expect(screen.getByText('Entry (comped by host)').closest('li').textContent).toContain('0 covered');
    expect((await screen.findByText('1,900')).closest('li').textContent).toContain('after Complete');
    expect(await screen.findByText('Follow up with STUDIO BY SABLE')).toBeTruthy();
  });

  test('after Complete: the actual tier and each stat change', async () => {
    renderPage({ evaluation_json: { tier_final: 'slay', score: 91, stat_deltas: { coins: 439, stress: -1 } } });
    expect(await within(screen.getByTestId('results-how')).findByText('Slay')).toBeTruthy();
    expect(screen.getByText('Completed · 91/100')).toBeTruthy();
    expect((await screen.findByTestId('results-stat-stress')).textContent).toContain('−1');
  });

  test('share: a missing teaser says so and opens the Overview; platform copy opens Distribution', async () => {
    const { onOpenTab } = renderPage({});
    const teaser = screen.getByTestId('results-teaser');
    expect(teaser.textContent).toContain('Missing');
    fireEvent.click(within(teaser).getByRole('button', { name: 'Write teaser' }));
    expect(onOpenTab).toHaveBeenCalledWith('overview');
    fireEvent.click(screen.getByRole('button', { name: 'Open Distribution' }));
    expect(onOpenTab).toHaveBeenCalledWith('distribution');
    expect(screen.getByText("Open Lala's Feed").getAttribute('href')).toBe('/shows/show-1/world?tab=feed');
  });
});

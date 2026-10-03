/**
 * The Overview's four questions (ShowOverview): in production, attention,
 * next (the next ready event and the season's next slot), recent changes;
 * a new show sees its first steps.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import ShowOverview, { episodesInProduction, recentActivity } from './ShowOverview';

const ROADMAP = {
  season_number: 1, next_slot_number: 7,
  phases: [{ phase: 1, slots: [
    { slot_number: 6, label: 'S1 · E6', intention: { story_purpose: 'A win' } },
    { slot_number: 7, label: 'S1 · E7', intention: { story_purpose: 'Her first real setback' } },
  ] }],
};
const renderIt = (props = {}) => {
  const goTo = vi.fn();
  render(<MemoryRouter><ShowOverview showId="show-1" goTo={goTo} {...props} /></MemoryRouter>);
  return goTo;
};

describe('ShowOverview helpers', () => {
  test('in production: draft to in review, not accepted, in episode order', () => {
    const eps = [
      { id: 'c', episode_number: 3, status: 'in_review' },
      { id: 'a', episode_number: 1, status: 'published' },
      { id: 'b', episode_number: 2, status: 'draft' },
      { id: 'd', episode_number: 4, status: 'scripted', evaluation_status: 'accepted' },
    ];
    expect(episodesInProduction(eps).map((e) => e.id)).toEqual(['b', 'c']);
  });

  test('recent activity: stat changes and decisions, newest first, five at most', () => {
    const items = recentActivity(
      [{ id: 1, created_at: '2026-10-01', episode_title: 'Gala Night' }],
      [{ id: 2, created_at: '2026-10-02', type: 'outfit_choice' }],
    );
    expect(items.map((i) => i.text)).toEqual(['Decision: outfit choice', "Gala Night changed Lala's stats"]);
    expect(recentActivity(Array.from({ length: 9 }, (_, i) => ({ id: i, created_at: `2026-09-0${i + 1}` })), []).length).toBe(5);
  });
});

describe('ShowOverview', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });

  test('names the season\'s next slot and opens the Season Plan', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { roadmap: ROADMAP } });
    const goTo = renderIt({ episodes: [{ id: 'e', status: 'published' }], events: [{ id: 'x', status: 'used', used_in_episode_id: 'e' }] });
    const slot = await screen.findByTestId('sov-next-slot');
    await waitFor(() => expect(slot.textContent).toContain('Next slot: S1 · E7'));
    expect(slot.textContent).toContain('Her first real setback');
    fireEvent.click(within(slot).getByRole('button', { name: 'Season Plan' }));
    expect(goTo).toHaveBeenCalledWith('season');
    expect(screen.getByTestId('sov-producing').textContent).toContain('Nothing in production');
    expect(screen.getByTestId('sov-attention').textContent).toContain('Nothing needs attention.');
    expect(screen.queryByTestId('sov-first-steps')).toBeNull();
  });

  test('a season that fails to load says so, with Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ data: { roadmap: ROADMAP } });
    renderIt();
    const slot = await screen.findByTestId('sov-next-slot');
    await waitFor(() => expect(slot.textContent).toContain("Couldn't load the season."));
    fireEvent.click(within(slot).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(slot.textContent).toContain('Next slot: S1 · E7'));
  });

  test('a new show sees its first steps; Lala\'s state is one line linking to her history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { roadmap: null } });
    const goTo = renderIt({ charState: { state: { coins: 500, reputation: 3 } } });
    expect(screen.getByTestId('sov-first-steps')).toBeTruthy();
    const lala = screen.getByTestId('sov-lala');
    expect(lala.textContent).toContain('coins 500');
    fireEvent.click(within(lala).getByRole('button', { name: /Full state/ }));
    expect(goTo).toHaveBeenCalledWith('characters-list');
    await waitFor(() => expect(screen.getByTestId('sov-next-slot').textContent).toContain('No season planned yet.'));
  });
});

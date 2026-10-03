/**
 * Episodes → Production (moved from the show page): the episodes as a grid,
 * a list or a board, and one way to start an episode, the new-episode flow.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/episodeService', () => ({ default: { updateEpisode: vi.fn(), deleteEpisode: vi.fn() } }));

import episodeService from '../../services/episodeService';
import ShowEpisodesBoard from './ShowEpisodesBoard';

let where;
function Where() { const l = useLocation(); where = l.pathname; return null; }
const EPISODES = [
  { id: 'ep-2', episode_number: 2, title: 'Press Day', status: 'scripted', evaluation_json: '{"tier_final":"pass","score":81}' },
  { id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft', evaluation_status: 'accepted' },
];
const renderIt = (episodes = EPISODES, onChanged = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/shows/show-1/world']}>
      <Routes>
        <Route path="/shows/:id/world" element={<ShowEpisodesBoard showId="show-1" episodes={episodes} onChanged={onChanged} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return onChanged;
};

describe('ShowEpisodesBoard', () => {
  beforeEach(() => { where = null; Object.values(episodeService).forEach((fn) => fn.mockReset()); });

  test('the list view, in episode order, opens an episode', () => {
    renderIt();
    expect(screen.getByText('2 episodes · 1 completed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '≡ List' }));
    const rows = [...document.querySelectorAll('.seb-table tbody tr')].map((r) => r.children[1].textContent);
    expect(rows).toEqual(['Gala Night', 'Press Day']);
    // No money column: the episode's money is in Results, from the ledger.
    expect(document.querySelector('.seb-table thead').textContent).not.toMatch(/P&L/);
    fireEvent.click(screen.getByText('Press Day'));
    expect(where).toBe('/episodes/ep-2');
  });

  test('New Episode is the new-episode flow, also from an empty show', () => {
    renderIt([]);
    expect(screen.getByText('No episodes yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '+ New Episode' })[0]);
    expect(where).toBe('/shows/show-1/new-episode');
  });

  test('deleting asks first; Cancel deletes nothing; OK deletes and reloads', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(episodeService.deleteEpisode).mockResolvedValue({});
    const onChanged = renderIt();
    // The grid is in episode order: the first card's Delete is Gala Night's.
    const [first] = screen.getAllByTitle('Delete');
    fireEvent.click(first);
    expect(ask).toHaveBeenCalled();
    expect(episodeService.deleteEpisode).not.toHaveBeenCalled();
    ask.mockReturnValue(true);
    fireEvent.click(first);
    await waitFor(() => expect(episodeService.deleteEpisode).toHaveBeenCalledWith('ep-1'));
    expect(onChanged).toHaveBeenCalled();
    ask.mockRestore();
  });
});

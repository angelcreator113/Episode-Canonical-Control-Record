/**
 * Episodes → Production (moved from the show page; Evoni's mock 2026-10-07):
 * Now producing with From the event, then the season pipeline as a board
 * (the default), a grid or a list, and one way to start an episode, the
 * new-episode flow.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/episodeService', () => ({ default: { updateEpisode: vi.fn(), deleteEpisode: vi.fn() } }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../Episodes/EpisodeProductionChecklist', async (orig) => ({ ...(await orig()), loadProductionChecks: vi.fn(async () => ({ checks: null, linkedEvent: null })) }));

import episodeService from '../../services/episodeService';
import api from '../../services/api';
import { loadProductionChecks } from '../Episodes/EpisodeProductionChecklist';
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
  beforeEach(() => {
    where = null;
    Object.values(episodeService).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(loadProductionChecks).mockReset().mockResolvedValue({ checks: null, linkedEvent: null });
  });

  test('the list view, in episode order, opens an episode', () => {
    renderIt();
    expect(screen.getByTestId('seb-count').textContent).toBe('2 episodes');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    const rows = [...document.querySelectorAll('.seb-table tbody tr')].map((r) => r.children[1].textContent);
    expect(rows).toEqual(['Gala Night', 'Press Day']);
    // No money column: the episode's money is in Results, from the ledger.
    expect(document.querySelector('.seb-table thead').textContent).not.toMatch(/P&L/);
    fireEvent.click(within(document.querySelector('.seb-table')).getByText('Press Day'));
    expect(where).toBe('/episodes/ep-2');
  });

  test('New Episode is the new-episode flow, also from an empty show', () => {
    renderIt([]);
    // The board says it in a line; Grid shows the empty state.
    expect(screen.getByText(/^No episodes yet\. An episode starts from an event/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(screen.getByText('No episodes yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '+ New episode' })[0]);
    expect(where).toBe('/shows/show-1/new-episode');
  });

  test('deleting asks first; Cancel deletes nothing; OK deletes and reloads', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(episodeService.deleteEpisode).mockResolvedValue({});
    const onChanged = renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
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

describe('ShowEpisodesBoard — Now producing and the pipeline (Evoni\'s mock, 2026-10-07)', () => {
  const ROADMAP = {
    season_number: 1,
    phases: [{ slots: [
      { id: 's1', slot_number: 1, label: 'S1 · E1', episode: { id: 'ep-1' } },
      { id: 's2', slot_number: 2, label: 'S1 · E2', episode: null, intention: { story_purpose: 'Lala lands her first real styling opportunity' } },
      { id: 's3', slot_number: 3, label: 'S1 · E3', episode: null },
    ] }],
  };
  const EVENT = {
    id: 'ev-1', name: 'Wearable Experiments Studio Session', payment_amount: 439,
    event_date: 'Thu, Nov 12', event_time: '6:30 PM',
    canon_consequences: { automation: { venue_name: "STUDIO BY SABLE's Studio", venue_location_id: 'loc-1' } },
  };
  const DRAFT = { id: 'ep-1', episode_number: 1, season_number: 1, title: 'I Designed My Outfit', status: 'draft', description: 'Lala steps into the studio.', categories: ['fashion design', 'grwm'] };

  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
      if (url.endsWith('/season/roadmap')) return { data: { roadmap: ROADMAP } };
      if (url === '/api/v1/world/locations') return { data: { locations: [{ id: 'loc-1', name: "STUDIO BY SABLE's Studio", city: 'Echo Park' }] } };
      return { data: {} };
    });
    vi.mocked(loadProductionChecks).mockReset().mockResolvedValue({ checks: {}, linkedEvent: EVENT });
    Object.values(episodeService).forEach((fn) => fn.mockReset());
  });

  test('Now producing: code, status, logline, tags, the stage, and the script still to generate', async () => {
    renderIt([DRAFT]);
    const hero = await screen.findByTestId('seb-hero');
    expect(hero.textContent).toContain('Now producing · S1 E1');
    expect(hero.textContent).toContain('Draft');
    expect(hero.textContent).toContain('Lala steps into the studio.');
    expect([...hero.querySelectorAll('.seb-tags li')].map((li) => li.textContent)).toEqual(['fashion design', 'grwm']);
    expect(hero.querySelector('[aria-current="step"]').textContent).toBe('Planning');
    expect(screen.getByRole('link', { name: 'Generate Script' }).getAttribute('href')).toBe('/episodes/ep-1?tab=scripts');
    expect(screen.getByRole('link', { name: 'Open episode' }).getAttribute('href')).toBe('/episodes/ep-1');
  });

  test('From the event reads the venue through the automation copy, with its DREAM city', async () => {
    renderIt([DRAFT]);
    await waitFor(() => expect(screen.getByTestId('seb-event').textContent).toContain('Echo Park'));
    const ev = screen.getByTestId('seb-event').textContent;
    expect(ev).toContain('Wearable Experiments Studio Session');
    expect(ev).toContain("STUDIO BY SABLE's Studio · Echo Park");
    expect(ev).toContain('Thu, Nov 12 · 6:30 PM');
    expect(ev).toContain('Earns 439 coins');
    expect(ev).toContain('Still needed:');
    // The venue is set (in the automation copy), so Place does not ask for it.
    expect(ev).not.toMatch(/Place: [^;]*venue/);
  });

  test('the board: five stages, the open slots under Planning, and the summary line', async () => {
    renderIt([DRAFT, { id: 'ep-9', episode_number: 9, title: 'Gala', status: 'in_review' }]);
    await waitFor(() => expect(screen.getByTestId('seb-count').textContent).toBe('2 episodes · 2 open slots'));
    const cols = [...document.querySelectorAll('.seb-col')];
    expect(cols.map((c) => c.querySelector('.seb-col-head span').textContent)).toEqual(['Planning', 'Script', 'Production', 'Edit', 'Released']);
    expect(cols[0].textContent).toContain('S1 E1 · Draft');
    expect(cols[0].textContent).toContain('S1 · E2 · open slot');
    expect(cols[0].textContent).toContain('Lala lands her first real styling opportunity');
    expect(cols[3].textContent).toContain('Gala');
  });

  test('dropping a card on another stage sets that stage\'s status', async () => {
    const onChanged = renderIt([DRAFT]);
    vi.mocked(episodeService.updateEpisode).mockResolvedValue({});
    const card = await screen.findByRole('button', { name: /I Designed My Outfit/ });
    const scriptCol = [...document.querySelectorAll('.seb-col')][1];
    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(scriptCol);
    fireEvent.drop(scriptCol);
    await waitFor(() => expect(episodeService.updateEpisode).toHaveBeenCalledWith('ep-1', { status: 'scripted' }));
    expect(onChanged).toHaveBeenCalled();
  });
});

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
    fireEvent.click(screen.getAllByRole('button', { name: 'New episode' })[0]);
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
    expect(hero.querySelector('.seb-badge').textContent).toBe('S1 E1');
    expect(hero.querySelector('.seb-badge.is-status').textContent).toBe('Draft');
    expect(hero.textContent).toContain('Lala steps into the studio.');
    expect([...hero.querySelectorAll('.seb-tags li:not(.seb-tag-add)')].map((li) => li.textContent)).toEqual(['fashion design', 'grwm']);
    // The seven steps (2026-10-17), derived; a new draft is at Planning.
    expect([...hero.querySelectorAll('.seb-step-label')].map((l) => l.textContent)).toEqual(['Planning', 'Script', 'Production', 'Edit', 'Thumbnail', 'Review', 'Release']);
    expect(hero.querySelector('[aria-current="step"] .seb-step-label').textContent).toBe('Planning');
    expect(screen.getByRole('link', { name: /Edit Thumbnail/ }).getAttribute('href')).toBe('/template-studio/youtube?episode=ep-1');
    expect(screen.getByRole('link', { name: 'Generate Script' }).getAttribute('href')).toBe('/episodes/ep-1?tab=scripts');
    expect(screen.getByRole('link', { name: 'Open episode' }).getAttribute('href')).toBe('/episodes/ep-1');
  });

  test("the card shows the episode's thumbnail, else the Studio's current one", async () => {
    renderIt([{ ...DRAFT, thumbnail_url: 'https://cdn.example/ep1.jpg' }]);
    await waitFor(() => expect(screen.getByTestId('seb-hero').querySelector('.seb-thumb img')?.getAttribute('src')).toBe('https://cdn.example/ep1.jpg'));
  });

  test("with no thumbnail_url, the card shows the Studio's current thumbnail", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/episodes/ep-1/saved')
      ? { data: { data: [{ id: 't-1', isPrimary: true, url: 'https://cdn.example/saved.jpg' }] } }
      : { data: {} }));
    renderIt([DRAFT]);
    await waitFor(() => expect(screen.getByTestId('seb-hero').querySelector('.seb-thumb img')?.getAttribute('src')).toBe('https://cdn.example/saved.jpg'));
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
    expect(cols.map((c) => c.querySelector('.seb-col-name > span').textContent)).toEqual(['Planning', 'Script', 'Production', 'Edit', 'Released']);
    // The code once (on the thumbnail), no status chip repeating the column (Evoni, 2026-10-22 layout list).
    expect(cols[0].querySelector('[data-testid="seb-card-ep-1"]').textContent).toBe('S1 E1I Designed My Outfit0 of 24 checks');
    expect(cols[0].textContent).toContain('S1 · E2Open Slot');
    expect(cols[1].textContent).toContain('No episodes in script stage yet');
    expect(cols[0].textContent).toContain('Lala lands her first real styling opportunity');
    expect(cols[3].textContent).toContain('Gala');
  });

  test('dropping a card on another stage sets that stage\'s status', async () => {
    const onChanged = renderIt([DRAFT]);
    vi.mocked(episodeService.updateEpisode).mockResolvedValue({});
    const card = await screen.findByTestId('seb-card-ep-1');
    const scriptCol = [...document.querySelectorAll('.seb-col')][1];
    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(scriptCol);
    fireEvent.drop(scriptCol);
    await waitFor(() => expect(episodeService.updateEpisode).toHaveBeenCalledWith('ep-1', { status: 'scripted' }));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('ShowEpisodesBoard — the Episode Pipeline mock (2026-10-17)', () => {
  const DRAFT = { id: 'ep-1', episode_number: 1, season_number: 1, title: 'I Designed My Outfit', status: 'draft', categories: ['grwm'] };
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(loadProductionChecks).mockReset().mockResolvedValue({ checks: {}, linkedEvent: null });
    Object.values(episodeService).forEach((fn) => fn.mockReset());
  });

  test('Add Tag saves the episode\u2019s categories and reloads', async () => {
    vi.mocked(episodeService.updateEpisode).mockResolvedValue({});
    const onChanged = renderIt([DRAFT]);
    fireEvent.click(await screen.findByRole('button', { name: /Add Tag/ }));
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'Wearable Art' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(episodeService.updateEpisode).toHaveBeenCalledWith('ep-1', { categories: ['grwm', 'Wearable Art'] }));
    expect(onChanged).toHaveBeenCalled();
  });

  test('search narrows every column; the card opens the episode', async () => {
    renderIt([DRAFT, { id: 'ep-9', episode_number: 9, season_number: 1, title: 'Gala', status: 'in_review' }]);
    fireEvent.change(await screen.findByLabelText('Search episodes'), { target: { value: 'gala' } });
    expect(screen.queryByTestId('seb-card-ep-1')).toBeNull();
    const gala = screen.getByTestId('seb-card-ep-9');
    expect(within(gala).queryByRole('button', { name: 'Continue' })).toBeNull();
    fireEvent.click(within(gala).getByRole('button', { name: 'Gala' }));
    expect(where).toBe('/episodes/ep-9');
  });

  test('the menu holds the checklist and Edit details', async () => {
    renderIt([DRAFT]);
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: /Checklist/ }).getAttribute('href')).toBe('/episodes/ep-1?tab=checklist');
    expect(screen.getByRole('menuitem', { name: 'Edit details' }).getAttribute('href')).toBe('/episodes/ep-1/edit');
  });
});

// Evoni, 2026-10-22 (layout list): the slim Now producing card, lean board
// cards with a ⋯ "Move to", and one stage at a time on a phone.
describe('ShowEpisodesBoard — layout', () => {
  const DRAFT = { id: 'ep-1', episode_number: 1, season_number: 1, title: 'I Designed My Outfit', status: 'draft' };
  const BUILD = { id: 'ep-4', episode_number: 4, season_number: 1, title: 'Gala Night', status: 'in_build', thumbnail_url: 'https://cdn.example/4.jpg', script_content: 'x' };
  beforeEach(() => {
    where = null;
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(loadProductionChecks).mockReset().mockResolvedValue({ checks: null, linkedEvent: null });
    Object.values(episodeService).forEach((fn) => fn.mockReset());
  });

  test('Now producing is one card: the episode, the event and the steps along its foot', async () => {
    renderIt([DRAFT]);
    const card = (await screen.findByTestId('seb-hero')).querySelector('.seb-hero-card');
    for (const part of ['.seb-hero-art', '.seb-hero-main', '.seb-hero-event', '.seb-hero-steps']) expect(card.querySelector(`:scope > ${part}`), part).toBeTruthy();
    expect(card.querySelector('.seb-hero-kicker').textContent).toBe('Now producingS1 E1Draft');
  });

  test('a card shows its code once and a line only when it says something new', async () => {
    renderIt([DRAFT, BUILD]);
    const build = await screen.findByTestId('seb-card-ep-4');
    // A picture: the code is a chip; "In build" would repeat the column, so no line.
    expect(build.querySelector('.seb-chip').textContent).toBe('S1 E4');
    expect(build.querySelector('.seb-card-line')).toBeNull();
    expect(build.textContent).not.toContain('In build');
  });

  test('⋯ moves a card to another stage without dragging', async () => {
    vi.mocked(episodeService.updateEpisode).mockResolvedValue({});
    const onChanged = renderIt([DRAFT, BUILD]);
    const card = await screen.findByTestId('seb-card-ep-1');
    fireEvent.click(within(card).getByRole('button', { name: 'Move I Designed My Outfit' }));
    const menu = within(card).getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Move to Script', 'Move to Production', 'Move to Edit', 'Move to Released']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Move to Production' }));
    await waitFor(() => expect(episodeService.updateEpisode).toHaveBeenCalledWith('ep-1', { status: 'in_build' }));
    expect(onChanged).toHaveBeenCalled();
    // Opening the menu did not open the episode.
    expect(where).toBeNull();
  });

  test('on a phone, the stage tabs pick the one column shown; it starts on Now producing\'s stage', async () => {
    renderIt([DRAFT, BUILD]);
    const board = await screen.findByTestId('seb-board');
    const tabs = screen.getByRole('group', { name: 'Stage' });
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['Planning 1', 'Script 0', 'Production 1', 'Edit 0', 'Released 0']);
    expect(screen.getByTestId('seb-hero').querySelector('.seb-hero-title').textContent).toBe('I Designed My Outfit');
    expect(board.dataset.phoneStage).toBe('planning');
    fireEvent.click(within(tabs).getByRole('button', { name: /Production/ }));
    expect(board.dataset.phoneStage).toBe('production');
    expect(within(tabs).getByRole('button', { name: /Production/ }).getAttribute('aria-pressed')).toBe('true');
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, 'ShowEpisodesBoard.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 600px\) \{[^@]*\.seb-board\[data-phone-stage="planning"\] > \.seb-col\[data-stage="planning"\]/);
  });
});

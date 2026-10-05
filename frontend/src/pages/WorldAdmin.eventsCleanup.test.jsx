/**
 * Producer Mode -> Events: cleanup and pagination (Task #2360, Evoni's
 * Events page redesign of 2026-09-30, PR A).
 *
 * - 9 cards a page. Filters, search and sort run before paging and send
 *   the queue back to page 1. The page lives in the URL (?evpage=N) so it
 *   survives a refresh.
 * - The panels below the queue are gone: Story Logic Warnings and its
 *   header badge, Draft Events, the Episode -> Event map, the coverage /
 *   difficulty / budget totals and the Season Arc. Wardrobe conflicts show
 *   as a chip on the affected card. Ideas opens as a drawer from the header.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const pad = (n) => String(n).padStart(2, '0');

// 50 events: 45 drafts, 5 used. Two share a name, which the story logic
// checker flags, so the warnings panel and badge would have shown. ev-46's
// dress code shares no word with the show's wardrobe: a conflict.
const EVENTS = Array.from({ length: 50 }, (_, i) => {
  const n = i + 1;
  const used = n > 45;
  return {
    id: `ev-${pad(n)}`,
    show_id: 'show-1',
    name: n === 2 ? 'Event 01' : `Event ${pad(n)}`,
    status: used ? 'used' : 'draft',
    used_in_episode_id: used ? `ep-${n}` : null,
    prestige: 5,
    cost_coins: 10,
    dress_code_keywords: n === 46 ? ['sequin', 'couture', 'gold'] : [],
    canon_consequences: { automation: {} },
  };
});
const EPISODES = EVENTS.filter((e) => e.used_in_episode_id)
  .map((e, i) => ({ id: e.used_in_episode_id, episode_number: i + 1, title: `Ep ${i + 1}`, status: 'draft' }));
const WARDROBE = [{ id: 'w-1', show_id: 'show-1', style: 'casual', category: 'denim', color: 'blue', tags: [] }];

function SearchProbe() {
  const loc = useLocation();
  return <div data-testid="search">{loc.search}</div>;
}

function renderQueue(search = '?tab=events') {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<><WorldAdmin /><SearchProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

const cardIds = () => screen.queryAllByTestId(/^event-card-ev-\d+$/).map((el) => el.dataset.testid.replace('event-card-', ''));
const pageStatus = () => screen.getByTestId('events-page-status').textContent;

describe('WorldAdmin events queue — cleanup and pagination (Task #2360)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: WARDROBE } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('50 events make 6 pages of 9 (the last holds 5), with Previous / Next and page numbers', async () => {
    renderQueue();
    await waitFor(() => expect(cardIds()).toHaveLength(9));

    expect(pageStatus()).toBe('Page 1 of 6');
    for (let n = 1; n <= 6; n += 1) expect(screen.getByTestId(`events-page-${n}`)).toBeTruthy();
    expect(screen.queryByTestId('events-page-7')).toBeNull();
    expect(screen.getByTestId('events-page-prev').disabled).toBe(true);

    fireEvent.click(screen.getByTestId('events-page-next'));
    await waitFor(() => expect(pageStatus()).toBe('Page 2 of 6'));
    expect(screen.getByTestId('search').textContent).toContain('evpage=2');

    fireEvent.click(screen.getByTestId('events-page-6'));
    await waitFor(() => expect(cardIds()).toHaveLength(5));
    expect(screen.getByTestId('events-page-next').disabled).toBe(true);
    expect(screen.getByTestId('events-page-6').getAttribute('aria-current')).toBe('page');
  });

  test('the page survives a refresh: ?evpage=3 opens on page 3', async () => {
    renderQueue('?tab=events&evpage=3');
    await waitFor(() => expect(pageStatus()).toBe('Page 3 of 6'));
    // Sorted by name: page 3 holds the 19th to 27th events.
    expect(cardIds()).toEqual(['ev-19', 'ev-20', 'ev-21', 'ev-22', 'ev-23', 'ev-24', 'ev-25', 'ev-26', 'ev-27']);
  });

  test('a status filter applies before paging and resets to page 1', async () => {
    renderQueue('?tab=events&evpage=4');
    await waitFor(() => expect(pageStatus()).toBe('Page 4 of 6'));

    fireEvent.click(screen.getByTestId('events-filter-used'));

    await waitFor(() => expect(cardIds()).toEqual(['ev-46', 'ev-47', 'ev-48', 'ev-49', 'ev-50']));
    // Five used events fit on one page: no pager, and the URL is page 1.
    expect(screen.queryByTestId('events-pager')).toBeNull();
    expect(screen.getByTestId('search').textContent).not.toContain('evpage');
  });

  test('search and sort each reset to page 1', async () => {
    renderQueue('?tab=events&evpage=5');
    await waitFor(() => expect(pageStatus()).toBe('Page 5 of 6'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search events' }), { target: { value: 'Event' } });
    await waitFor(() => expect(pageStatus()).toBe('Page 1 of 6'));

    fireEvent.click(screen.getByTestId('events-page-3'));
    await waitFor(() => expect(pageStatus()).toBe('Page 3 of 6'));
    fireEvent.change(screen.getByDisplayValue('Sort: Name'), { target: { value: 'created' } });
    await waitFor(() => expect(pageStatus()).toBe('Page 1 of 6'));
    expect(screen.getByTestId('search').textContent).not.toContain('evpage');
  });

  test('the bottom panels and the warnings badge are gone', async () => {
    renderQueue();
    await waitFor(() => expect(cardIds()).toHaveLength(9));

    expect(screen.queryByTestId('events-warnings')).toBeNull();
    expect(screen.queryByTestId('events-warnings-link')).toBeNull();
    expect(screen.queryByText(/story logic warning/i)).toBeNull();
    expect(screen.queryByText(/Draft Events/)).toBeNull();
    expect(screen.queryByText(/Episode → Event Map/)).toBeNull();
    expect(screen.queryByText(/Total Event Budget/)).toBeNull();
    expect(screen.queryByText(/Avg Difficulty/)).toBeNull();
    expect(screen.queryByText(/episodes linked/)).toBeNull();
    expect(screen.queryByText(/Season Arc/)).toBeNull();
    expect(screen.queryByText(/Wardrobe Conflicts/)).toBeNull();
    // Ideas is no longer a panel on the page; it opens as a drawer.
    expect(screen.queryByTestId('events-ideas')).toBeNull();
    expect(screen.getByTestId('events-ideas-button')).toBeTruthy();
  });

  test('the header Ideas button opens Feed opportunities and templates in a drawer; close and Escape shut it', async () => {
    renderQueue();
    await waitFor(() => expect(cardIds()).toHaveLength(9));

    fireEvent.click(screen.getByTestId('events-ideas-button'));
    const drawer = await screen.findByRole('dialog', { name: /Ideas — Feed opportunities & event templates/ });
    expect(drawer.getAttribute('data-testid')).toBe('events-ideas');
    expect(within(drawer).getByText(/Pipeline — Feed → Opportunities → Events/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('events-ideas-close'));
    await waitFor(() => expect(screen.queryByTestId('events-ideas')).toBeNull());

    fireEvent.click(screen.getByTestId('events-ideas-button'));
    await screen.findByTestId('events-ideas');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('events-ideas')).toBeNull());
  });

  test('a wardrobe conflict is a chip on the affected card only', async () => {
    renderQueue('?tab=events&evpage=6');
    await waitFor(() => expect(cardIds()).toHaveLength(5));

    const chip = screen.getByTestId('event-card-conflict-ev-46');
    expect(chip.textContent).toContain('Wardrobe conflict');
    expect(chip.getAttribute('title')).toContain('wants [sequin, couture, gold]');
    expect(screen.queryAllByTestId(/^event-card-conflict-/)).toHaveLength(1);
  });
});

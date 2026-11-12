/**
 * Event Library: deleting one event (Evoni, 2026-11-12; Phase 1, Production
 * Data Safety, PR 1).
 *
 * The server decides (DELETE /world/:showId/events/:eventId). The page
 *   - says, before asking, what a delete removes and that there is no undo
 *     here;
 *   - shows the server's message for a deleted draft, with the preparation
 *     that went with it;
 *   - keeps a used event on the page and shows what holds it, with a link to
 *     the episode or the season plan.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventLibrary from './EventLibrary';

const EVENTS = [
  { id: 'ev-01', show_id: 'show-1', name: 'Loose Draft', status: 'draft', used_in_episode_id: null, prestige: 5, cost_coins: 0, canon_consequences: { automation: {} } },
  { id: 'ev-02', show_id: 'show-1', name: 'The Gala', status: 'draft', used_in_episode_id: null, prestige: 5, cost_coins: 0, canon_consequences: { automation: {} } },
];

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/season?tab=events']}>
      <Routes>
        <Route path="/shows/:showId/season" element={<><EventLibrary showId="show-1" /><Where /></>} />
        <Route path="/episodes/:episodeId" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

async function chooseDelete(eventId) {
  const card = await screen.findByTestId(`event-card-${eventId}`);
  fireEvent.click(within(card).getByRole('button', { name: /more/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
}

describe('EventLibrary: deleting one event', () => {
  let confirm;
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [] } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: [] } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => confirm.mockRestore());

  test('the question says what goes with the event, that there is no undo here, and that a used event is never deleted', async () => {
    confirm.mockReturnValue(false);
    renderLibrary();
    await chooseDelete('ev-01');
    expect(confirm).toHaveBeenCalledTimes(1);
    const question = confirm.mock.calls[0][0];
    expect(question).toMatch(/no longer appear anywhere in the app/);
    expect(question).toMatch(/its own cost lines and deliverables that nothing else uses yet/);
    expect(question).toMatch(/There is no undo here/);
    expect(question).toMatch(/An event that an episode or the season plan uses is never deleted/);
    // Declined: nothing is sent.
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('a deleted draft leaves the page, and the server\'s message is shown', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true, deleted: 'ev-01', also_removed: { deliverables: 1, costs: 2 },
      message: '"Loose Draft" was deleted, with its 1 deliverable and 2 cost lines. They no longer appear anywhere in the app.' } });
    renderLibrary();
    await chooseDelete('ev-01');
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-01'));
    await waitFor(() => expect(screen.queryByTestId('event-card-ev-01')).toBeNull());
    expect(screen.getByText(/"Loose Draft" was deleted, with its 1 deliverable and 2 cost lines/)).toBeTruthy();
    expect(screen.getByTestId('event-card-ev-02')).toBeTruthy();
  });

  test('a used event stays on the page; the banner says what holds it and links to the episode and the season plan', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409, data: {
      success: false, code: 'EVENT_IN_USE', event: { id: 'ev-02', name: 'The Gala' },
      blocked_by: [
        { kind: 'episode', label: 'Episode 7 "Gala Night" was started from it', link: '/episodes/ep-7', episode_id: 'ep-7' },
        { kind: 'season_slots', label: 'It is in the season plan at S1 · E4', link: '/shows/show-1/season?tab=roadmap' },
        { kind: 'opportunity', label: 'The opportunity it was made for is still open' },
      ],
      error: '"The Gala" can\'t be deleted.',
    } } });
    renderLibrary();
    await chooseDelete('ev-02');
    const banner = await screen.findByTestId('event-in-use');
    expect(banner.textContent).toContain('“The Gala” can’t be deleted.');
    expect(banner.textContent).toContain('Episode 7 "Gala Night" was started from it');
    expect(banner.textContent).toContain('It is in the season plan at S1 · E4');
    expect(banner.textContent).toContain('The opportunity it was made for is still open');
    expect(banner.textContent).toContain('Nothing was deleted.');
    // The event is still listed.
    expect(screen.getByTestId('event-card-ev-02')).toBeTruthy();
    // Links only where the server gave one.
    const links = within(banner).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Open the episode', '/episodes/ep-7'],
      ['Open the season plan', '/shows/show-1/season?tab=roadmap'],
    ]);
    fireEvent.click(links[0]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-7'));
  });

  test('any other failure shows the server\'s words', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409, data: { success: false, code: 'RETRY', error: 'Someone else changed this at the same moment. Nothing was saved: try again.' } } });
    renderLibrary();
    await chooseDelete('ev-01');
    expect(await screen.findByText(/Someone else changed this at the same moment/)).toBeTruthy();
    expect(screen.getByTestId('event-card-ev-01')).toBeTruthy();
  });
});

/**
 * Episode Overview when a read fails (Evoni, 2026-11-12): the page names what
 * didn't load and offers Retry. A failed events read is not "No events
 * linked", and the event linker is not offered while the events are unknown.
 * Successful reads, empty or not, are as before.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', description: 'Lala arrives late.' };
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', outfit_pieces: [] };
const UNLINKED = { id: 'ev-2', show_id: 'show-1', name: 'Rooftop Soirée', used_in_episode_id: null };
let briefFails;
const renderTab = () => render(
  <MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} checks={{ done: 1, total: 2 }} balance={100} /></MemoryRouter>,
);
const linker = () => screen.getByRole('combobox', { name: 'Link an event' });

describe('EpisodeOverviewTab: a failed read is said, not shown as empty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    briefFails = false;
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [EVENT] });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') { if (briefFails) throw new Error('Network Error'); return { data: { data: { episode_id: 'ep-1' } } }; }
      if (url === '/api/v1/world/show-1/events') return { data: { events: [UNLINKED] } };
      return { data: {} };
    });
  });

  test('the events read fails: the page says so with Retry, the card does not say "No events linked", and the linker is off', async () => {
    vi.mocked(getEpisodeEvents).mockRejectedValue(new Error('Network Error'));
    renderTab();
    const banner = await screen.findByTestId('eov-load-failed');
    expect(banner.textContent).toContain("Couldn't load this episode's events.");
    expect(banner.textContent).toContain('nothing was changed');
    expect(screen.getByTestId('eov-events-failed').textContent).toContain("Couldn't load this episode's events.");
    expect(screen.queryByText('No events linked')).toBeNull();
    expect(linker().disabled).toBe(true);
    expect(linker().textContent).toContain("Events didn't load");
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Retry reads again: the event shows, the note goes, and the linker is back', async () => {
    vi.mocked(getEpisodeEvents).mockRejectedValue(new Error('Network Error'));
    renderTab();
    await screen.findByTestId('eov-load-failed');
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [EVENT] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());
    expect(screen.queryByTestId('eov-events-failed')).toBeNull();
    await waitFor(() => expect(linker().disabled).toBe(false));
    expect(linker().textContent).toContain('+ Link an event…');
  });

  test('the brief read fails: named in the note, with Retry', async () => {
    briefFails = true;
    renderTab();
    const banner = await screen.findByTestId('eov-load-failed');
    expect(banner.textContent).toContain('the story brief');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  test('every read succeeds and the episode has no events: "No events linked" and the linker, unchanged', async () => {
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
    renderTab();
    expect(await screen.findByText('No events linked')).toBeTruthy();
    expect(screen.queryByTestId('eov-load-failed')).toBeNull();
    await waitFor(() => expect(linker().disabled).toBe(false));
  });

  // Out-of-order answers (review follow-up, 2026-11-12): only the newest
  // run of the page's reads is applied.
  describe('a slow earlier read never overrides a newer one', () => {
    const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
    const settle = () => new Promise((r) => setTimeout(r, 0));

    test('an earlier read that fails late does not bring the error back after Retry succeeded', async () => {
      // Run 1: this episode's events fail at once; the show's events list is still on its way.
      const slowList = deferred();
      let listCalls = 0;
      vi.mocked(getEpisodeEvents).mockRejectedValueOnce(new Error('Network Error'));
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { episode_id: 'ep-1' } } };
        if (url === '/api/v1/world/show-1/events') { listCalls += 1; return listCalls === 1 ? slowList.promise : { data: { events: [UNLINKED] } }; }
        return { data: {} };
      });
      renderTab();
      await screen.findByTestId('eov-load-failed');

      // Run 2 (Retry): everything loads.
      vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [EVENT] });
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());
      await waitFor(() => expect(linker().disabled).toBe(false));

      // Run 1's slow read now fails: it is an old answer, and changes nothing.
      slowList.reject(new Error('Network Error (late)'));
      await settle();
      expect(screen.queryByTestId('eov-load-failed')).toBeNull();
      expect(linker().disabled).toBe(false);
      expect(linker().textContent).toContain('+ Link an event…');
    });

    test('an earlier read that succeeds late does not replace what the newer read loaded', async () => {
      // Run 1: this episode's events are slow; the brief fails at once, so Retry is offered.
      const slowEvents = deferred();
      const OLD = { id: 'ev-old', show_id: 'show-1', name: 'An Older Answer', outfit_pieces: [] };
      vi.mocked(getEpisodeEvents).mockReturnValueOnce(slowEvents.promise);
      briefFails = true;
      renderTab();
      await screen.findByTestId('eov-load-failed');

      // Run 2 (Retry): the events load.
      briefFails = false;
      vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [EVENT] });
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
      await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());

      // Run 1's slow read answers at last, with older data: not applied.
      slowEvents.resolve({ events: [OLD] });
      await settle();
      expect(screen.queryByText('An Older Answer')).toBeNull();
      expect(screen.getAllByText('Velour Awards Night').length).toBeGreaterThan(0);
    });
  });
});

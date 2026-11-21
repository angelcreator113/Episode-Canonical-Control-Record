/**
 * The Overview tab tells the page its brief and its scene sets (onRead,
 * PR-08 of docs/design/2026-11-studio-home-episode-command-center.md), so
 * the page's production checklist does not ask for them again. Each is told
 * once per load, with the answer or as failed; the tab itself behaves as it
 * did, with or without a listener.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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
const BRIEF = { episode_id: 'ep-1', narrative_purpose: 'She proves it.' };
const SETS = [{ id: 'set-1', name: 'Maison Miel' }];
let fails;
let bodies;
const renderTab = (props = {}) => render(
  <MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} checks={{ done: 1, total: 2 }} balance={100} {...props} /></MemoryRouter>,
);
const toldFor = (onRead, key) => onRead.mock.calls.filter(([, k]) => k === key);

describe('EpisodeOverviewTab: what it tells the page it has read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fails = {};
    bodies = { brief: { data: BRIEF }, sets: { data: SETS } };
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') { if (fails.brief) throw new Error('Network Error'); return { data: bodies.brief }; }
      if (url === '/api/v1/episodes/ep-1/scene-sets') { if (fails.sets) throw new Error('Network Error'); return { data: bodies.sets }; }
      return { data: {} };
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  test('both answered: each is told once, with the episode it is for and what the tab holds', async () => {
    const onRead = vi.fn();
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'brief')).toEqual([['ep-1', 'brief', { ok: true, value: BRIEF }]]);
    expect(toldFor(onRead, 'sceneSets')).toEqual([['ep-1', 'sceneSets', { ok: true, value: SETS }]]);
  });

  test('no brief and no scene sets are answers: told as null and []', async () => {
    bodies = { brief: { data: null }, sets: { data: [] } };
    const onRead = vi.fn();
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'brief')[0][2]).toEqual({ ok: true, value: null });
    expect(toldFor(onRead, 'sceneSets')[0][2]).toEqual({ ok: true, value: [] });
  });

  test('a failed brief read is told as failed, and the tab still names it with Retry; Retry tells the new answer', async () => {
    fails.brief = true;
    const onRead = vi.fn();
    renderTab({ onRead });
    expect((await screen.findByTestId('eov-load-failed')).textContent).toContain('the story brief');
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'brief')).toEqual([['ep-1', 'brief', { ok: false }]]);
    fails.brief = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(4));
    expect(toldFor(onRead, 'brief')[1][2]).toEqual({ ok: true, value: BRIEF });
    await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());
  });

  test('a failed scene-sets read is told as failed and logged as before', async () => {
    fails.sets = true;
    const onRead = vi.fn();
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'sceneSets')).toEqual([['ep-1', 'sceneSets', { ok: false }]]);
    expect(console.error).toHaveBeenCalledWith('[EpisodeOverviewTab] scene sets load failed:', expect.any(Error));
  });

  test('an answer the checklist would read differently is told as failed: an empty body, scene sets under another name', async () => {
    const onRead = vi.fn();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: null };
      if (url === '/api/v1/episodes/ep-1/scene-sets') return { data: { sceneSets: SETS } };
      return { data: {} };
    });
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'brief')[0][2].ok).toBe(false);
    expect(toldFor(onRead, 'sceneSets')[0][2].ok).toBe(false);
  });

  test('a read that cannot be asked for: both are told as failed, once, and it is logged', async () => {
    const onRead = vi.fn();
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/episodes/ep-1/scene-sets') throw new Error('could not ask');
      return Promise.resolve({ data: {} });
    });
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(toldFor(onRead, 'brief')).toEqual([['ep-1', 'brief', { ok: false }]]);
    expect(toldFor(onRead, 'sceneSets')).toEqual([['ep-1', 'sceneSets', { ok: false }]]);
    expect(console.error).toHaveBeenCalledWith('[EpisodeOverview] load stopped early:', expect.any(Error));
  });

  test('the brief cannot be asked for while the scene sets are still out: each is told once, and the later answer tells nothing more', async () => {
    const onRead = vi.fn();
    let answerSets;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/episode-brief/ep-1') throw new Error('could not ask');
      if (url === '/api/v1/episodes/ep-1/scene-sets') return new Promise((resolve) => { answerSets = resolve; });
      return Promise.resolve({ data: {} });
    });
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    answerSets({ data: { data: SETS } });
    await new Promise((r) => { setTimeout(r, 20); });
    expect(onRead).toHaveBeenCalledTimes(2);
    expect(toldFor(onRead, 'sceneSets')).toEqual([['ep-1', 'sceneSets', { ok: false }]]);
  });

  test("another episode opens while the first one's brief is still out: its late failure is told for neither", async () => {
    const onRead = vi.fn();
    let failFirst;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/episode-brief/ep-1') return new Promise((_resolve, reject) => { failFirst = reject; });
      if (url === '/api/v1/episode-brief/ep-2') return Promise.resolve({ data: { data: { episode_id: 'ep-2' } } });
      if (url.endsWith('/scene-sets')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    });
    const props = { show: { id: 'show-1' }, onUpdate: vi.fn(), onOpenTab: vi.fn(), checks: { done: 1, total: 2 }, balance: 100, onRead };
    const view = render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} {...props} /></MemoryRouter>);
    await waitFor(() => expect(toldFor(onRead, 'sceneSets').length).toBe(1));
    view.rerender(<MemoryRouter><EpisodeOverviewTab episode={{ ...EPISODE, id: 'ep-2' }} {...props} /></MemoryRouter>);
    await waitFor(() => expect(onRead).toHaveBeenCalledWith('ep-2', 'brief', { ok: true, value: { episode_id: 'ep-2' } }));
    const before = onRead.mock.calls.length;
    failFirst(new Error('Network Error'));
    await new Promise((r) => { setTimeout(r, 20); });
    expect(onRead.mock.calls.length).toBe(before);
    expect(toldFor(onRead, 'brief').map(([id]) => id)).toEqual(['ep-2']);
  });

  test('a listener that throws does not break the tab', async () => {
    const onRead = vi.fn(() => { throw new Error('listener broke'); });
    renderTab({ onRead });
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('overview-next-step')).toBeTruthy();
    expect(screen.queryByTestId('eov-load-failed')).toBeNull();
  });

  test('with no listener the tab loads as it always did', async () => {
    renderTab();
    expect(await screen.findByTestId('overview-next-step')).toBeTruthy();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1'));
    expect(screen.queryByTestId('eov-load-failed')).toBeNull();
  });
});

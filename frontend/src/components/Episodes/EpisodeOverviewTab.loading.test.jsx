/**
 * The Episode Overview while its reads are out (the loading-state fix,
 * 2026-11-19): what has not been read yet is said to be loading, never
 * shown as "none". Loading, empty, failed and ready are four things. The
 * next step's button waits only for the one read that decides where it
 * goes. Each test holds answers back and lets them go one at a time.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));
vi.mock('./EpisodeStyleBoard', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', description: 'Lala arrives late.' };
const WITH_SCRIPT = { ...EPISODE, script_content: '(Beat 1) Lala reads the invitation.' };
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', prestige: 7, outfit_pieces: [], link: { anchor: true } };
const UNLINKED = { id: 'ev-2', show_id: 'show-1', name: 'Rooftop Soirée', used_in_episode_id: null };
const BRIEF = { episode_id: 'ep-1', narrative_purpose: 'She proves it.', event_id: null };

const URLS = {
  brief: (id = 'ep-1') => `/api/v1/episode-brief/${id}`,
  script: (id = 'ep-1') => `/api/v1/episodes/${id}/scripts?includeAllVersions=false`,
  eventList: '/api/v1/world/show-1/events',
  outfit: (id = 'ep-1') => `/api/v1/wardrobe/outfit/${id}`,
};

/** A promise a test settles when it chooses. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let held; // url -> deferred, for the reads a test holds back
let answers; // url -> body, for the rest
const hold = (url) => { held[url] = deferred(); return held[url]; };
const release = (d, body) => act(async () => { d.resolve(body); });
const refuse = (d) => act(async () => { d.reject(new Error('Network Error')); });

const renderTab = (props = {}) => render(
  <MemoryRouter>
    <EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} balance={100} {...props} />
  </MemoryRouter>,
);
const nextStepEl = () => screen.getByTestId('overview-next-step');
const goButton = () => screen.queryByTestId('overview-next-step-go');
const tile = (key) => screen.getByTestId(`overview-tile-${key}`).textContent;
const linker = () => screen.getByRole('combobox', { name: 'Link an event' });

describe('EpisodeOverviewTab: loading is not shown as "none"', () => {
  let events;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    held = {};
    answers = {
      [URLS.brief()]: { data: BRIEF },
      [URLS.script()]: { data: [] },
      [URLS.eventList]: { events: [UNLINKED] },
    };
    events = null;
    vi.mocked(getEpisodeEvents).mockImplementation(() => (events ? events.promise : Promise.resolve({ events: [EVENT] })));
    vi.mocked(api.get).mockImplementation((url) => {
      if (held[url]) return held[url].promise;
      return Promise.resolve({ data: url in answers ? answers[url] : {} });
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  // ── The events card, the linker and the Prestige tile ────────────────
  test('the events read is out: "Loading…", no count, no "No events linked", the linker off, Prestige a dash; then the event', async () => {
    events = deferred();
    renderTab();
    expect(await screen.findByTestId('eov-events-loading')).toBeTruthy();
    expect(screen.queryByText('No events linked')).toBeNull();
    expect(document.querySelector('.eov-count')).toBeNull();
    expect(linker().disabled).toBe(true);
    expect(linker().textContent).toContain('Loading events…');
    expect(tile('prestige')).toContain('—');
    expect(tile('prestige')).not.toContain('Not set');
    // The planned look comes with the events, so the Look tile waits for them too.
    await screen.findByTestId('overview-brief-state');
    expect(tile('look')).toContain('—');
    expect(tile('look')).not.toContain('Not chosen');
    await release(events, { events: [EVENT] });
    expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('eov-events-loading')).toBeNull();
    expect(tile('prestige')).toContain('7 / 10');
    await waitFor(() => expect(linker().disabled).toBe(false));
  });

  test('the events read answers with none: "No events linked", a 0 count and Prestige "Not set", as before', async () => {
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
    renderTab();
    expect(await screen.findByText('No events linked')).toBeTruthy();
    expect(document.querySelector('.eov-count').textContent).toBe('0');
    expect(tile('prestige')).toContain('Not set');
    expect(screen.queryByTestId('eov-events-loading')).toBeNull();
  });

  test('the events read fails: the existing failure wording, and Prestige says it could not be read', async () => {
    vi.mocked(getEpisodeEvents).mockRejectedValue(new Error('Network Error'));
    renderTab();
    expect((await screen.findByTestId('eov-events-failed')).textContent).toContain("Couldn't load this episode's events.");
    expect(screen.queryByTestId('eov-events-loading')).toBeNull();
    expect(linker().textContent).toContain("Events didn't load");
    expect(tile('prestige')).toContain('—');
    expect(tile('prestige')).toContain('could not be read');
  });

  test("the show's event list is out: the linker says so and is off, though the episode's own events are in", async () => {
    const list = hold(URLS.eventList);
    renderTab();
    expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
    expect(linker().disabled).toBe(true);
    expect(linker().textContent).toContain('Loading events…');
    expect(linker().textContent).not.toContain('No unlinked events available');
    await release(list, { data: { events: [UNLINKED] } });
    await waitFor(() => expect(linker().disabled).toBe(false));
    expect(linker().textContent).toContain('+ Link an event…');
  });

  // ── The Story brief card ─────────────────────────────────────────────
  test('the brief is out: "Loading the brief…" and no fields; then the fields and the chip', async () => {
    const brief = hold(URLS.brief());
    renderTab();
    expect(await screen.findByTestId('overview-brief-loading')).toBeTruthy();
    expect(screen.queryByTestId('overview-brief-state')).toBeNull();
    expect(screen.queryByText('Narrative purpose')).toBeNull();
    await release(brief, { data: { data: BRIEF } });
    expect(await screen.findByTestId('overview-brief-state')).toBeTruthy();
    expect(screen.getByText('Narrative purpose')).toBeTruthy();
    expect(screen.queryByTestId('overview-brief-loading')).toBeNull();
  });

  test('the brief fails: said in the card and in the note with Retry; Retry shows it loading again, then the brief', async () => {
    const first = hold(URLS.brief());
    renderTab();
    await screen.findByTestId('overview-brief-loading');
    await refuse(first);
    expect((await screen.findByTestId('overview-brief-failed')).textContent).toContain("couldn't be loaded");
    expect(screen.getByTestId('eov-load-failed').textContent).toContain('the story brief');
    expect(screen.queryByTestId('overview-brief-loading')).toBeNull();
    const second = hold(URLS.brief());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('overview-brief-loading')).toBeTruthy();
    expect(screen.queryByTestId('overview-brief-failed')).toBeNull();
    await release(second, { data: { data: BRIEF } });
    expect(await screen.findByTestId('overview-brief-state')).toBeTruthy();
  });

  test('Retry keeps what had already answered on screen while it is read again', async () => {
    answers[URLS.script()] = null;
    held[URLS.script()] = { promise: Promise.reject(new Error('Network Error')) };
    renderTab();
    await screen.findByTestId('eov-load-failed');
    expect(await screen.findByTestId('overview-brief-state')).toBeTruthy();
    expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
    // Everything is asked again, and the brief and the events are held back this time.
    const brief = hold(URLS.brief());
    events = deferred();
    delete held[URLS.script()];
    answers[URLS.script()] = { data: [] };
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('eov-load-failed')).toBeNull());
    expect(screen.getByTestId('overview-brief-state')).toBeTruthy();
    expect(screen.queryByTestId('overview-brief-loading')).toBeNull();
    expect(screen.getAllByText('Velour Awards Night').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('eov-events-loading')).toBeNull();
    await release(brief, { data: { data: BRIEF } });
    await release(events, { events: [EVENT] });
  });

  // ── The Look tile ────────────────────────────────────────────────────
  test("the look waits for the brief and, when the brief names an event, the locked outfit: a dash, not \"Not chosen\"", async () => {
    const brief = hold(URLS.brief());
    const outfit = hold(URLS.outfit());
    renderTab();
    await screen.findByTestId('overview-brief-loading');
    expect(tile('look')).toContain('—');
    expect(tile('look')).not.toContain('Not chosen');
    await release(brief, { data: { data: { ...BRIEF, event_id: 'ev-1' } } });
    await screen.findByTestId('overview-brief-state');
    expect(tile('look')).toContain('—');
    await release(outfit, { data: { items: [{ id: 'p1' }, { id: 'p2' }] } });
    await waitFor(() => expect(tile('look')).toContain('2 pieces locked'));
  });

  test('no look anywhere, once everything has answered: "Not chosen", as before', async () => {
    renderTab();
    await screen.findByTestId('overview-brief-state');
    await waitFor(() => expect(tile('look')).toContain('Not chosen'));
  });

  // ── The next step ────────────────────────────────────────────────────
  test('no script text on the episode, the script check out: no step is named and there is no button, whatever else has answered', async () => {
    const script = hold(URLS.script());
    renderTab({ checks: { done: 3, total: 5 }, checksStatus: 'ready' });
    await screen.findByTestId('overview-brief-state');
    expect(nextStepEl().textContent).toContain('Checking for a script…');
    expect(nextStepEl().textContent).not.toContain('Generate the script');
    expect(goButton()).toBeNull();
    await release(script, { data: { data: [] } });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Generate the script'));
    expect(goButton().textContent).toContain('Generate Script');
  });

  test('the script check finds a script: the step is production, not "Generate the script"', async () => {
    const script = hold(URLS.script());
    renderTab({ checks: { done: 3, total: 5 }, checksStatus: 'ready' });
    await screen.findByTestId('overview-brief-state');
    expect(goButton()).toBeNull();
    await release(script, { data: { data: [{ content: 'one two three' }] } });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Work through production'));
    expect(nextStepEl().textContent).toContain('2 production checks left.');
    expect(goButton().textContent).toContain('Open Checklist');
  });

  test('the script check fails: said, with no button, and Retry above', async () => {
    held[URLS.script()] = { promise: Promise.reject(new Error('Network Error')) };
    renderTab();
    await waitFor(() => expect(nextStepEl().textContent).toContain("Couldn't check for a script"));
    expect(goButton()).toBeNull();
    expect(screen.getByTestId('eov-load-failed').textContent).toContain('the script check');
  });

  test('no script, the brief still out: the button is there at once; the sentence does not say the brief is done', async () => {
    const brief = hold(URLS.brief());
    renderTab({ checksStatus: 'loading' });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Generate the script'));
    expect(goButton().textContent).toContain('Generate Script');
    expect(nextStepEl().textContent).toContain('Checking the brief…');
    expect(nextStepEl().textContent).not.toContain('The brief is done');
    await release(brief, { data: { data: BRIEF } });
    await waitFor(() => expect(nextStepEl().textContent).toContain('The brief is missing'));
  });

  test('script text on the episode: the step waits for the checklist only, not for the script check or the brief', async () => {
    hold(URLS.script());
    hold(URLS.brief());
    const view = renderTab({ episode: WITH_SCRIPT, checksStatus: 'loading' });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Checking the production checklist…'));
    expect(goButton()).toBeNull();
    expect(screen.getByTestId('overview-next-step-meta').textContent).toBe('Production checklist: checking…');
    view.rerender(
      <MemoryRouter>
        <EpisodeOverviewTab episode={WITH_SCRIPT} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} balance={100} checks={{ done: 4, total: 6 }} checksStatus="ready" />
      </MemoryRouter>,
    );
    expect(nextStepEl().textContent).toContain('Work through production');
    expect(goButton().textContent).toContain('Open Checklist');
    expect(screen.getByTestId('overview-next-step-meta').textContent).toBe('Production checklist: 4 of 6 done');
  });

  // ── The checklist line ───────────────────────────────────────────────
  test('the checklist could not be checked: said, with the Checklist tab to check again; never a count and never "complete"', async () => {
    const onOpenTab = vi.fn();
    renderTab({ episode: WITH_SCRIPT, checksStatus: 'failed', onOpenTab });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Work through production'));
    expect(screen.getByTestId('overview-next-step-meta').textContent).toBe("Production checklist: couldn't be checked. Open the Checklist tab to check again.");
    expect(nextStepEl().textContent).not.toMatch(/\d+ of \d+/);
    expect(nextStepEl().textContent).not.toContain('Complete the episode');
    fireEvent.click(goButton());
    expect(onOpenTab).toHaveBeenCalledWith('checklist');
  });

  test('some checks could not be read: verified complete, incomplete and couldn\'t be checked are three numbers', async () => {
    renderTab({
      episode: WITH_SCRIPT, checks: { done: 9, total: 14 }, checksStatus: 'ready',
      checksRead: { done: 9, total: 14, incomplete: 3, unreadable: 2, unreadableIds: ['scene_plan', 'scene_images'] },
    });
    await waitFor(() => expect(screen.getByTestId('overview-next-step-meta').textContent).toBe(
      "Production checklist: 9 of 14 verified complete · 3 incomplete · 2 couldn't be checked. Open the Checklist tab to check again.",
    ));
    expect(nextStepEl().textContent).toContain('5 production checks left.');
  });

  test('every check readable, or nothing said about what was read: the plain count, as before', async () => {
    const view = renderTab({
      episode: WITH_SCRIPT, checks: { done: 9, total: 14 }, checksStatus: 'ready',
      checksRead: { done: 9, total: 14, incomplete: 5, unreadable: 0, unreadableIds: [] },
    });
    await waitFor(() => expect(screen.getByTestId('overview-next-step-meta').textContent).toBe('Production checklist: 9 of 14 done'));
    view.rerender(
      <MemoryRouter>
        <EpisodeOverviewTab episode={WITH_SCRIPT} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} balance={100} checks={{ done: 9, total: 14 }} checksStatus="ready" checksRead={null} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('overview-next-step-meta').textContent).toBe('Production checklist: 9 of 14 done');
  });

  test('a page that says nothing about the checklist (no status): no line and the old sentence, as before', async () => {
    renderTab({ episode: WITH_SCRIPT });
    await waitFor(() => expect(nextStepEl().textContent).toContain('Work through production'));
    expect(nextStepEl().textContent).toContain('The script is written.');
    expect(screen.queryByTestId('overview-next-step-meta')).toBeNull();
  });

  // ── Another episode ──────────────────────────────────────────────────
  test('another episode: its areas start as loading again, and the first one\'s late answers change nothing', async () => {
    const props = { show: { id: 'show-1' }, onUpdate: vi.fn(), onOpenTab: vi.fn(), balance: 100 };
    const view = render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} {...props} /></MemoryRouter>);
    await screen.findByTestId('overview-brief-state');
    expect((await screen.findAllByText('Velour Awards Night')).length).toBeGreaterThan(0);
    const brief2 = hold(URLS.brief('ep-2'));
    const script2 = hold(URLS.script('ep-2'));
    events = deferred();
    view.rerender(<MemoryRouter><EpisodeOverviewTab episode={{ ...EPISODE, id: 'ep-2' }} {...props} /></MemoryRouter>);
    expect(await screen.findByTestId('eov-events-loading')).toBeTruthy();
    expect(nextStepEl().textContent).toContain('Checking for a script…');
    expect(goButton()).toBeNull();
    await release(script2, { data: { data: [] } });
    await release(brief2, { data: { data: { episode_id: 'ep-2' } } });
    await release(events, { events: [] });
    expect(await screen.findByText('No events linked')).toBeTruthy();
    expect(goButton().textContent).toContain('Generate Script');
  });
});

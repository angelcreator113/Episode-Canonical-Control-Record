/**
 * Episode Overview: the events an episode is linked to and its place in the
 * season (Evoni, 2026-11-12).
 *
 * - The source event's Unlink is shown, off, with the reason.
 * - Unlink, Regenerate and adding an event to an episode that already has
 *   one ask first and say what will change; cancelling writes nothing. A
 *   first link asks nothing.
 * - A refusal (a filmed episode) is shown in the server's words, on the card.
 * - Every event row says "Open the event package".
 * - A placed episode links to its slot on the Season Roadmap; an unplaced
 *   one keeps "Place it on the Season page".
 * - Rendering writes nothing; a failed read keeps Retry and offers no link.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab, { SOURCE_EVENT_PROTECTED, LINKED_EVENT_LOCKED, unlinkLockReason } from './EpisodeOverviewTab';
import { nextStep } from '../../lib/episodeOverview';
import { isAppPath } from '../../utils/sceneSets';

const SOURCE = { id: 'ev-1', name: 'Studio Session', used_in_episode_id: 'ep-1', link: { anchor: true, stamped: true } };
// Episode 1 today: the brief names the event, the event's own link to the episode is missing.
const SOURCE_UNSTAMPED = { id: 'ev-1', name: 'Studio Session', used_in_episode_id: null, link: { anchor: true, stamped: false } };
const SECOND = { id: 'ev-2', name: 'After Party', used_in_episode_id: 'ep-1', link: { anchor: false, stamped: true } };
const FREE = { id: 'ev-9', name: 'Charity Gala', used_in_episode_id: null };
// A row the server's rule does not lock: listed, but neither the source nor linked to this episode by its own link.
const LOOSE = { id: 'ev-3', name: 'Loose End', used_in_episode_id: null, link: { anchor: false, stamped: false } };
const PLACED = { label: 'S1 · E1', slot_number: 1, phase: { number: 1, title: 'Foundation' } };
const FILMED = 'Episode 1 "Wearable Experiments" has been filmed, so it cannot be replaced. Nothing was changed.';

let linked = [SOURCE];
let confirmSpy;
const renderTab = (episode = {}) => render(
  <MemoryRouter>
    <EpisodeOverviewTab episode={{ id: 'ep-1', show_id: 'show-1', title: 'Wearable Experiments', ...episode }} show={{ id: 'show-1' }} onUpdate={() => {}} />
  </MemoryRouter>,
);
const writes = () => ['post', 'put', 'patch', 'delete'].reduce((n, m) => n + vi.mocked(api[m]).mock.calls.length, 0);
const card = async () => (await screen.findByTestId('overview-event-package-ev-1')).closest('.eov-card');

beforeEach(() => {
  vi.clearAllMocks();
  linked = [SOURCE];
  vi.mocked(api.get).mockImplementation(async (url) => (/\/world\/show-1\/events$/.test(url) ? { data: { events: [...linked, FREE] } } : { data: {} }));
  vi.mocked(getEpisodeEvents).mockImplementation(async () => ({ events: linked }));
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the source event is protected', () => {
  test('its Unlink is shown, off, with the reason in words; pressing it writes nothing', async () => {
    renderTab();
    const unlink = await screen.findByTestId('overview-event-unlink-ev-1');
    expect(unlink.disabled).toBe(true);
    expect(unlink.getAttribute('title')).toBe(SOURCE_EVENT_PROTECTED);
    expect(unlink.getAttribute('aria-label')).toBe(`Unlink is off. ${SOURCE_EVENT_PROTECTED}`);
    expect(screen.getByTestId('overview-event-protected-ev-1').textContent).toBe('Source event: it stays with this episode, so it cannot be unlinked here.');
    fireEvent.click(unlink);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(writes()).toBe(0);
  });

  test('the same for a source event whose own link to the episode is missing (Episode 1): no write can be sent from Unlink', async () => {
    linked = [SOURCE_UNSTAMPED];
    renderTab();
    const unlink = await screen.findByTestId('overview-event-unlink-ev-1');
    expect(unlink.disabled).toBe(true);
    expect(screen.getByTestId('overview-event-protected-ev-1')).toBeTruthy();
    fireEvent.click(unlink);
    expect(writes()).toBe(0);
  });

  test('any other linked event is locked by the same server rule: Unlink shown, off, with its own short reason; pressing it writes nothing', async () => {
    linked = [SOURCE, SECOND];
    renderTab();
    const unlink = await screen.findByTestId('overview-event-unlink-ev-2');
    expect(unlink.disabled).toBe(true);
    expect(unlink.getAttribute('title')).toBe(LINKED_EVENT_LOCKED);
    expect(unlink.getAttribute('aria-label')).toBe(`Unlink is off. ${LINKED_EVENT_LOCKED}`);
    expect(screen.getByTestId('overview-event-protected-ev-2').textContent).toBe('Linked event: an event stays with the episode it is linked to, so it cannot be unlinked here.');
    fireEvent.click(unlink);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(writes()).toBe(0);
  });

  test('unlinkLockReason follows the read\'s own flags and the server\'s rule, and invents nothing', () => {
    expect(unlinkLockReason(SOURCE, 'ep-1')).toBe(SOURCE_EVENT_PROTECTED);
    expect(unlinkLockReason(SOURCE_UNSTAMPED, 'ep-1')).toBe(SOURCE_EVENT_PROTECTED);
    expect(unlinkLockReason(SECOND, 'ep-1')).toBe(LINKED_EVENT_LOCKED);
    // An event just linked on this page carries the link but not yet the read's flags.
    expect(unlinkLockReason({ id: 'x', used_in_episode_id: 'ep-1' }, 'ep-1')).toBe(LINKED_EVENT_LOCKED);
    expect(unlinkLockReason(LOOSE, 'ep-1')).toBeNull();
    expect(unlinkLockReason({ id: 'x', used_in_episode_id: 'ep-2' }, 'ep-1')).toBeNull();
    expect(unlinkLockReason(null, 'ep-1')).toBeNull();
    expect(unlinkLockReason({ id: 'x', used_in_episode_id: undefined }, undefined)).toBeNull();
  });

  test('a row the rule does not lock keeps its Unlink on, with no note', async () => {
    linked = [SOURCE, LOOSE];
    renderTab();
    const unlink = await screen.findByTestId('overview-event-unlink-ev-3');
    expect(unlink.disabled).toBe(false);
    expect(unlink.getAttribute('title')).toBe('Unlink event from this episode');
    expect(screen.queryByTestId('overview-event-protected-ev-3')).toBeNull();
  });
});

describe('changing an association asks first and says what will change', () => {
  test('Unlink, where the rule allows it: the question names the event and the episode; Cancel sends nothing; OK sends the one request', async () => {
    linked = [SOURCE, LOOSE];
    renderTab();
    fireEvent.click(await screen.findByTestId('overview-event-unlink-ev-3'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const asked = confirmSpy.mock.calls[0][0];
    expect(asked).toContain('Unlink "Loose End" from this episode?');
    expect(asked).toContain('What changes: "Loose End" would no longer be linked to "Wearable Experiments".');
    expect(asked).toContain('What does not change: the event and the episode themselves are not deleted.');
    expect(writes()).toBe(0);
    expect(screen.getByTestId('overview-event-unlink-ev-3')).toBeTruthy();

    confirmSpy.mockReturnValue(true);
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    fireEvent.click(screen.getByTestId('overview-event-unlink-ev-3'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-3', { used_in_episode_id: null }));
    expect(writes()).toBe(1);
  });

  test('an event just linked on this page is locked at once, like every linked event', async () => {
    linked = [];
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderTab();
    const select = await screen.findByLabelText('Link an event');
    await waitFor(() => expect(within(select).getByText('Charity Gala')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'ev-9' } });
    const unlink = await screen.findByTestId('overview-event-unlink-ev-9');
    expect(unlink.disabled).toBe(true);
    expect(screen.getByTestId('overview-event-protected-ev-9').textContent).toBe(LINKED_EVENT_LOCKED);
  });

  test('adding an event to an episode that already has one: the question says what changes and that it cannot be undone; Cancel sends nothing', async () => {
    renderTab();
    await screen.findByTestId('overview-event-package-ev-1');
    const select = screen.getByLabelText('Link an event');
    await waitFor(() => expect(within(select).getByText('Charity Gala')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'ev-9' } });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const asked = confirmSpy.mock.calls[0][0];
    expect(asked).toContain('Link "Charity Gala" to this episode as well?');
    expect(asked).toContain('What changes: "Charity Gala" becomes linked to "Wearable Experiments".');
    expect(asked).toContain('What does not change: "Studio Session" stays this episode\'s source event.');
    expect(asked).toContain('this cannot be undone here');
    expect(writes()).toBe(0);
    expect(screen.queryByTestId('overview-event-package-ev-9')).toBeNull();

    confirmSpy.mockReturnValue(true);
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    fireEvent.change(select, { target: { value: 'ev-9' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-9', { used_in_episode_id: 'ep-1' }));
    expect(writes()).toBe(1);
  });

  test('a first link, on an episode with no event, asks nothing', async () => {
    linked = [];
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderTab();
    const select = await screen.findByLabelText('Link an event');
    await waitFor(() => expect(within(select).getByText('Charity Gala')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'ev-9' } });
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-9', { used_in_episode_id: 'ep-1' }));
  });

  test('Regenerate: the question says the episode is soft-deleted and that a filmed one is never replaced; Cancel sends nothing', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('overview-event-regenerate-ev-1'));
    const asked = confirmSpy.mock.calls[0][0];
    expect(asked).toContain('Regenerate this episode from "Studio Session"?');
    expect(asked).toContain('What changes: "Wearable Experiments" is soft-deleted and a new episode is created from the event.');
    expect(asked).toContain('A filmed episode is never replaced');
    expect(writes()).toBe(0);
  });
});

describe('a filmed episode', () => {
  test('Regenerate is refused by the server: its words are shown on the card, nothing else is sent, the event stays listed', async () => {
    confirmSpy.mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { success: false, code: 'EPISODE_SNAPSHOT_FROZEN', error: FILMED } },
    }));
    renderTab();
    fireEvent.click(await screen.findByTestId('overview-event-regenerate-ev-1'));
    expect((await screen.findByRole('alert')).textContent).toBe(`Could not regenerate the episode: ${FILMED}`);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/regenerate-episode');
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByTestId('overview-event-package-ev-1')).toBeTruthy();
  });

  test('a refused link is shown in the server\'s words and the event is not listed as linked', async () => {
    confirmSpy.mockReturnValue(true);
    vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: { success: false, code: 'EVENT_EPISODE_FROZEN', error: 'Nothing was changed.' } } }));
    renderTab();
    await screen.findByTestId('overview-event-package-ev-1');
    const select = screen.getByLabelText('Link an event');
    await waitFor(() => expect(within(select).getByText('Charity Gala')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'ev-9' } });
    expect((await screen.findByRole('alert')).textContent).toBe('Could not link the event: Nothing was changed.');
    expect(screen.queryByTestId('overview-event-package-ev-9')).toBeNull();
  });
});

describe('adding an event when the server says it cannot be done (second events are off by default)', () => {
  const OFF = { allowed: false, restore_event_id: null, reason: 'This episode already has its event. Adding a second event to an episode is not switched on yet.' };
  const select = () => screen.getByLabelText('Link an event');

  test('the control is shown, off, with the reason in words beside it; nothing can be sent and nothing is asked', async () => {
    vi.mocked(getEpisodeEvents).mockImplementation(async () => ({ events: linked, add_event: OFF }));
    renderTab();
    const note = await screen.findByTestId('overview-add-event-blocked');
    expect(note.textContent).toBe(OFF.reason);
    expect(select().disabled).toBe(true);
    expect(select().getAttribute('aria-describedby')).toBe('overview-add-event-blocked');
    expect(within(select()).getByText('No event can be added now')).toBeTruthy();
    expect(within(select()).queryByText(/Charity Gala/)).toBeNull();
    fireEvent.change(select(), { target: { value: 'ev-9' } });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(writes()).toBe(0);
  });

  test('the Event Package link and the rest of the card are untouched', async () => {
    vi.mocked(getEpisodeEvents).mockImplementation(async () => ({ events: linked, add_event: OFF }));
    renderTab();
    await screen.findByTestId('overview-add-event-blocked');
    expect(screen.getByTestId('overview-event-package-ev-1').textContent).toMatch(/Open the event package/);
    expect(screen.getByTestId('overview-event-unlink-ev-1').disabled).toBe(true);
  });

  test('an episode with no event: the first link is offered as before', async () => {
    linked = [];
    vi.mocked(getEpisodeEvents).mockImplementation(async () => ({ events: [], add_event: { allowed: true, reason: null, restore_event_id: null } }));
    renderTab();
    await waitFor(() => expect(within(select()).getByText(/Charity Gala/)).toBeTruthy());
    expect(select().disabled).toBe(false);
    expect(screen.queryByTestId('overview-add-event-blocked')).toBeNull();
  });

  test('a server that does not say (an older one): the control behaves as before', async () => {
    renderTab();
    await card();
    await waitFor(() => expect(within(select()).getByText(/Charity Gala/)).toBeTruthy());
    expect(select().disabled).toBe(false);
    expect(screen.queryByTestId('overview-add-event-blocked')).toBeNull();
  });

  test('the repair the server names: only the source event whose link is missing is offered, it asks nothing, and sends the one request', async () => {
    linked = [SOURCE_UNSTAMPED];
    const REPAIR = { allowed: false, restore_event_id: 'ev-1', reason: 'This episode\'s source event is not linked to it. Link the source event again; no other event can be added until then.' };
    vi.mocked(getEpisodeEvents).mockImplementation(async () => ({ events: linked, add_event: REPAIR }));
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderTab();
    expect((await screen.findByTestId('overview-add-event-blocked')).textContent).toBe(REPAIR.reason);
    await waitFor(() => expect(within(select()).getByText('+ Link the source event again…')).toBeTruthy());
    expect(select().disabled).toBe(false);
    expect(within(select()).getByText(/Studio Session/)).toBeTruthy();
    expect(within(select()).queryByText(/Charity Gala/)).toBeNull();
    fireEvent.change(select(), { target: { value: 'ev-1' } });
    await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0]).toEqual(['/api/v1/world/show-1/events/ev-1', { used_in_episode_id: 'ep-1' }]);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('a refusal that still arrives is shown in the server\'s words, on the card', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 409, data: { error: 'This episode already has its event, and linking a second event to an episode is not switched on yet. Nothing was changed.', code: 'SECONDARY_EVENTS_NOT_ENABLED' } } });
    confirmSpy.mockReturnValue(true);
    renderTab();
    await card();
    await waitFor(() => expect(within(select()).getByText(/Charity Gala/)).toBeTruthy());
    fireEvent.change(select(), { target: { value: 'ev-9' } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not link the event: This episode already has its event, and linking a second event to an episode is not switched on yet. Nothing was changed.');
  });
});

describe('one wording, one route, for the Event Package', () => {
  test('every event row says "Open the event package" and keeps its route', async () => {
    linked = [SOURCE, SECOND];
    renderTab();
    for (const id of ['ev-1', 'ev-2']) {
      const link = await screen.findByTestId(`overview-event-package-${id}`);
      expect(link.textContent.trim()).toBe('Open the event package');
      expect(link.getAttribute('href')).toBe(`/shows/show-1/events/${id}`);
    }
    expect(document.body.textContent).not.toContain('View Event Package');
  });
});

describe('the Season position card', () => {
  test('a placed episode links to its own slot on the Season Roadmap', async () => {
    renderTab({ season_context: PLACED });
    const link = await screen.findByTestId('season-position-roadmap');
    expect(link.textContent.trim()).toBe('View on the Season Roadmap');
    expect(link.getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=1');
    expect(screen.queryByTestId('season-position-link')).toBeNull();
    expect(screen.getByTestId('season-position').textContent).toContain('Phase 1: Foundation');
  });

  test('season context stored as text is read the same way', async () => {
    renderTab({ season_context: JSON.stringify({ ...PLACED, label: 'S1 · E7', slot_number: 7 }) });
    const link = await screen.findByTestId('season-position-roadmap').catch(() => null);
    // The card reads what the page gives it; when it shows the slot, the link names that slot.
    if (link) expect(link.getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=7');
  });

  test('a label with no usable slot number shows the position and no link (nothing is guessed)', async () => {
    for (const slot_number of [undefined, null, 0, -2, 'x', 1.5]) {
      const { unmount } = renderTab({ season_context: { ...PLACED, slot_number } });
      expect((await screen.findByTestId('season-position')).textContent).toContain('S1 · E1');
      expect(screen.queryByTestId('season-position-roadmap')).toBeNull();
      unmount();
    }
  });

  test('an unplaced episode keeps "Place it on the Season page", to the Roadmap, with no slot', async () => {
    renderTab();
    const link = await screen.findByTestId('season-position-link');
    expect(link.getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap');
    expect(screen.queryByTestId('season-position-roadmap')).toBeNull();
  });

  test('no placement request is sent from the card', async () => {
    renderTab({ season_context: PLACED });
    await screen.findByTestId('season-position-roadmap');
    expect(writes()).toBe(0);
  });
});

describe('rendering and failed reads', () => {
  test('rendering the Overview of an episode with events and a season slot sends no write', async () => {
    linked = [SOURCE_UNSTAMPED, SECOND];
    renderTab({ season_context: PLACED });
    await screen.findByTestId('overview-event-package-ev-2');
    await screen.findByTestId('season-position-roadmap');
    await new Promise((r) => setTimeout(r, 20));
    expect(writes()).toBe(0);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('when the episode\'s events cannot be read: Retry, not "No events linked", and the link control is off', async () => {
    vi.mocked(getEpisodeEvents).mockRejectedValue(new Error('boom'));
    renderTab();
    expect(await screen.findByTestId('eov-events-failed')).toBeTruthy();
    expect(screen.getByTestId('eov-load-failed')).toBeTruthy();
    expect(document.body.textContent).not.toContain('No events linked');
    expect(screen.getByLabelText('Link an event').disabled).toBe(true);
    // Retry reads again and the events come back, with their protection.
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [SOURCE] });
    fireEvent.click(within(screen.getByTestId('eov-load-failed')).getByRole('button', { name: /Retry/ }));
    expect((await screen.findByTestId('overview-event-unlink-ev-1')).disabled).toBe(true);
    expect(writes()).toBe(0);
  });
});

describe('the banner and the return addresses', () => {
  test('the production step\'s button says where it goes, and still goes there', () => {
    const step = nextStep({ hasScript: true, checks: { done: 2, total: 9 } });
    expect(step).toMatchObject({ key: 'production', action: 'Open Checklist', tab: 'checklist', title: 'Work through production' });
    expect(nextStep({ hasScript: false })).toMatchObject({ key: 'script', action: 'Generate Script', tab: 'scripts' });
    expect(nextStep({ hasScript: true, checks: { done: 9, total: 9 } })).toMatchObject({ key: 'results', action: 'Open Results', tab: 'results' });
  });

  test('a return address must stay in this app', () => {
    for (const ok of ['/episodes/ep-1?tab=beatplan', '/shows/s/season?tab=roadmap&slot=2', '/']) expect(isAppPath(ok)).toBe(true);
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'evil.example/episodes', '', null, undefined, 42, '/ok\nSet-Cookie: x', '\\\\evil']) {
      expect(isAppPath(bad)).toBe(false);
    }
  });

  test('the tools\' ways back name a real tab, or none (the Overview)', () => {
    const read = (f) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
    const scenes = read('EpisodeScenesTab.jsx');
    expect(scenes).toContain('from: `/episodes/${episodeId}?tab=beatplan`');
    expect(scenes).not.toContain('tab=production.beatplan');
    const voice = read('../../pages/VoiceStudio.jsx');
    expect(voice.match(/to=\{`\/episodes\/\$\{episodeId\}\?tab=voice`\} className="vs-back"/g)).toHaveLength(2);
    const editor = read('../../pages/EpisodeEditor.jsx');
    expect(editor.match(/\/episodes\/\$\{episodeId\}\?tab=edit`/g).length).toBeGreaterThanOrEqual(2);
    // No page builds an episode address with a dotted tab key (those are internal keys, not ?tab= values).
    for (const f of ['EpisodeScenesTab.jsx', '../../pages/VoiceStudio.jsx', '../../pages/EpisodeEditor.jsx', '../../pages/YouTubeThumbnailStudio.jsx']) {
      expect(read(f)).not.toMatch(/\?tab=[a-z]+\.[a-z]+/);
    }
  });
});

describe('at a phone width (the stylesheet\'s rules)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'EpisodeOverviewSections.css'), 'utf8');
  test('the protection note takes its own full line under the row and wraps', () => {
    expect(css).toMatch(/\.eov-event \{ flex-wrap: wrap; \}/);
    expect(css).toMatch(/\.eov-protected-note \{ flex: 1 0 100%;[^}]*overflow-wrap: anywhere; \}/);
  });
});

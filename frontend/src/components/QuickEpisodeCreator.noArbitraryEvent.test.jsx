/**
 * QuickEpisodeCreator edit mode never writes an event the episode doesn't own
 * (Task #1916). It read the show's event list and fell back to its first
 * event when none was stamped to the episode, so saving rewrote an unrelated
 * event. It now reads the episode's own event from GET /episodes/:id/events;
 * with none, no event is updated.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../services/api';
import QuickEpisodeCreator from './QuickEpisodeCreator';

const EPISODE_ID = 'ep-1';
const SHOW_ID = 'show-1';
const OWN_EVENT = { id: 'ev-own', name: 'The Gala', prestige: 7, strictness: 6, cost_coins: 120 };
// Other events of the show: the old code took the first of these.
const SHOW_EVENTS = [
  { id: 'ev-other', name: 'Someone Else\'s Brunch', used_in_episode_id: 'ep-9', cost_coins: 40 },
  { id: 'ev-loose', name: 'Unused Mixer', used_in_episode_id: null, cost_coins: 10 },
];

const link = (over = {}) => ({ anchor: true, anchor_source: 'stamped', stamped: true, stamped_elsewhere: false, ...over });

function mockLoad(episodeEvents) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/episodes/${EPISODE_ID}`) {
      return { data: { data: { id: EPISODE_ID, show_id: SHOW_ID, title: 'Gala Night', episode_number: 3, season_number: 1, description: '' } } };
    }
    if (url === `/api/v1/episodes/${EPISODE_ID}/events`) {
      return { data: { success: true, events: episodeEvents } };
    }
    if (url.startsWith(`/api/v1/world/${SHOW_ID}/events`)) return { data: { events: SHOW_EVENTS } };
    if (url === `/api/v1/shows/${SHOW_ID}`) return { data: { show: { id: SHOW_ID, name: 'Styling Adventures' } } };
    return { data: {} };
  });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={[`/episodes/${EPISODE_ID}/quick-edit`]}>
      <Routes>
        <Route path="/episodes/:episodeId/quick-edit" element={<QuickEpisodeCreator />} />
        <Route path="/episodes/:episodeId" element={<div>episode page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const eventWrites = () => [
  ...vi.mocked(api.put).mock.calls.map(([url, body]) => ({ method: 'PUT', url, body })),
  ...vi.mocked(api.post).mock.calls.map(([url, body]) => ({ method: 'POST', url, body })),
].filter((c) => c.url.includes('/events'));

async function save() {
  fireEvent.click(await screen.findByRole('button', { name: /Save Changes/ }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EPISODE_ID}`, expect.anything()));
}

const eventNameInput = () => screen.getByText('Event Name *').parentElement.querySelector('input');

describe('QuickEpisodeCreator edit — only the episode\'s own event (#1916)', () => {
  let errSpy;
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    localStorage.clear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errSpy.mockRestore());

  test('an unlinked episode loads no event, and saving writes no event', async () => {
    mockLoad([]);
    renderEditor();

    const note = await screen.findByTestId('quick-episode-event-link');
    expect(note.textContent).toContain('No event linked');
    expect(eventNameInput().value).toBe('');
    expect(screen.queryByDisplayValue(SHOW_EVENTS[0].name)).toBeNull();

    await save();
    await screen.findByText('episode page');
    expect(eventWrites()).toEqual([]);
  });

  test('a linked episode updates only its own event', async () => {
    mockLoad([{ ...OWN_EVENT, link: link() }]);
    renderEditor();

    expect((await screen.findByTestId('quick-episode-event-link')).textContent).toContain('The Gala');
    await waitFor(() => expect(eventNameInput().value).toBe('The Gala'));

    await save();
    await screen.findByText('episode page');
    const writes = eventWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: 'PUT', url: `/api/v1/world/${SHOW_ID}/events/ev-own` });
    expect(writes[0].body).toMatchObject({ name: 'The Gala', cost_coins: 120 });
  });

  test('an event now used by another episode is named but never written', async () => {
    mockLoad([{ ...OWN_EVENT, link: link({ anchor_source: 'brief', stamped: false, stamped_elsewhere: true }) }]);
    renderEditor();

    expect((await screen.findByTestId('quick-episode-event-link')).textContent).toContain('used by another episode');
    expect(eventNameInput().value).toBe('');
    fireEvent.change(eventNameInput(), { target: { value: 'Renamed' } });

    await save();
    await screen.findByText('episode page');
    expect(eventWrites()).toEqual([]);
  });

  test('if the episode\'s event can\'t be loaded, saving writes no event', async () => {
    mockLoad([]);
    const base = vi.mocked(api.get).getMockImplementation();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === `/api/v1/episodes/${EPISODE_ID}/events`) throw new Error('network down');
      return base(url);
    });
    renderEditor();

    expect((await screen.findByTestId('quick-episode-event-link')).textContent).toContain('couldn');
    expect(errSpy).toHaveBeenCalled();
    fireEvent.change(eventNameInput(), { target: { value: 'New Event' } });

    await save();
    await screen.findByText('episode page');
    expect(eventWrites()).toEqual([]);
  });

  test('a failed event update is logged and told, and the form stays open', async () => {
    mockLoad([{ ...OWN_EVENT, link: link() }]);
    vi.mocked(api.put).mockImplementation(async (url) => {
      if (url.includes('/events/')) throw Object.assign(new Error('boom'), { response: { data: { error: 'Event locked' } } });
      return { data: {} };
    });
    renderEditor();
    await waitFor(() => expect(eventNameInput().value).toBe('The Gala'));

    await save();
    expect(await screen.findByText(/its event wasn't updated: Event locked/)).toBeTruthy();
    expect(screen.queryByText('episode page')).toBeNull();
    expect(errSpy).toHaveBeenCalledWith('[QuickEpisodeCreator] event update failed:', expect.any(Error));
  });

  test('an unlinked episode creates and links an event only when one is named', async () => {
    mockLoad([]);
    vi.mocked(api.post).mockImplementation(async (url) => (
      url === `/api/v1/world/${SHOW_ID}/events` ? { data: { event: { id: 'ev-new' } } } : { data: {} }
    ));
    renderEditor();
    await screen.findByTestId('quick-episode-event-link');
    fireEvent.change(eventNameInput(), { target: { value: 'Fresh Soirée' } });

    await save();
    await screen.findByText('episode page');
    const writes = eventWrites();
    expect(writes.map((w) => `${w.method} ${w.url}`)).toEqual([
      `POST /api/v1/world/${SHOW_ID}/events`,
      `POST /api/v1/world/${SHOW_ID}/events/ev-new/inject`,
    ]);
    expect(writes[1].body).toEqual({ episode_id: EPISODE_ID });
  });
});

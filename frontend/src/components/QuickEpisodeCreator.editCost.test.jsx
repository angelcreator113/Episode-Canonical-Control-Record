/**
 * QuickEpisodeCreator edit mode — the event's cost round-trips (Task #2167).
 *
 * The editor loads the linked event's cost from cost_coins and saves it back
 * as cost_coins, the column the event PUT reads. Before this, it loaded
 * `cost` (never returned, so every event showed 50) and sent `cost` (ignored).
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
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
const EVENT_ID = 'ev-1';

function mockLoad(event) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/episodes/${EPISODE_ID}`) {
      return { data: { data: { id: EPISODE_ID, show_id: SHOW_ID, title: 'Gala Night', episode_number: 3, season_number: 1, description: '' } } };
    }
    // The episode's own event comes from GET /episodes/:id/events (#1916).
    if (url === `/api/v1/episodes/${EPISODE_ID}/events`) {
      return { data: { success: true, anchor_event_id: EVENT_ID, events: [{
        id: EVENT_ID, used_in_episode_id: EPISODE_ID, name: 'The Gala', prestige: 7, strictness: 6, ...event,
        link: { anchor: true, anchor_source: 'stamped', stamped: true, stamped_elsewhere: false },
      }] } };
    }
    if (url === `/api/v1/shows/${SHOW_ID}`) return { data: { show: { id: SHOW_ID, name: 'Styling Adventures' } } };
    return { data: {} };
  });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
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

async function saveAndGetEventBody() {
  fireEvent.click(await screen.findByRole('button', { name: /Save Changes/ }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(
    `/api/v1/world/${SHOW_ID}/events/${EVENT_ID}`, expect.anything(),
  ));
  const call = vi.mocked(api.put).mock.calls.find(([url]) => url === `/api/v1/world/${SHOW_ID}/events/${EVENT_ID}`);
  return call[1];
}

describe('QuickEpisodeCreator edit — event cost', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    localStorage.clear();
  });

  test('a 200-coin event loads as 200 and saves back as cost_coins: 200', async () => {
    mockLoad({ cost_coins: 200 });
    renderEditor();

    expect(await screen.findByDisplayValue('200')).toBeTruthy();
    const body = await saveAndGetEventBody();
    expect(body.cost_coins).toBe(200);
    expect(body).not.toHaveProperty('cost');
  });

  test('a free event loads as free and saves back as cost_coins: 0', async () => {
    mockLoad({ cost_coins: 0 });
    renderEditor();

    const free = await screen.findByRole('checkbox');
    await waitFor(() => expect(free.checked).toBe(true));
    const body = await saveAndGetEventBody();
    expect(body.cost_coins).toBe(0);
    expect(body).not.toHaveProperty('cost');
  });
});

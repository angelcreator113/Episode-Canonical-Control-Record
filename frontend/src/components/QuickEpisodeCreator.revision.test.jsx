/**
 * The initial-write contract (architecture A1c R1, Evoni, 2026-10-27): a new
 * episode's first script is saved against the revision its create answer
 * gave, or the one the event inject returned after writing its tag, so it
 * never writes over a script saved to the episode by anyone else meanwhile.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import QuickEpisodeCreator from './QuickEpisodeCreator';

const SHOW_ID = 'show-1';
const CREATED = `sr1-${'a'.repeat(40)}`;
const INJECTED = `sr1-${'b'.repeat(40)}`;

const renderCreator = () => render(
  <MemoryRouter initialEntries={[`/shows/${SHOW_ID}/quick`]}>
    <Routes>
      <Route path="/shows/:showId/quick" element={<QuickEpisodeCreator />} />
      <Route path="/episodes/:episodeId" element={<div>episode page</div>} />
    </Routes>
  </MemoryRouter>,
);
const field = (label) => screen.getByText(label).parentElement.querySelector('input');

let injectFails;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  localStorage.clear();
  injectFails = false;
  vi.mocked(api.get).mockResolvedValue({ data: {} });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes') return { data: { data: { id: 'ep-new' }, script_revision: CREATED } };
    if (url === `/api/v1/world/${SHOW_ID}/events`) return { data: { event: { id: 'ev-new' } } };
    if (url.endsWith('/inject')) {
      if (injectFails) throw Object.assign(new Error('refused'), { response: { status: 409, data: { code: 'INJECT_BLOCKED_BY_LOCK' } } });
      return { data: { success: true, script_revision: INJECTED } };
    }
    return { data: {} };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

async function create() {
  renderCreator();
  fireEvent.change(await waitFor(() => field('Title *')), { target: { value: 'Garden Night' } });
  fireEvent.change(field('Event Name *'), { target: { value: 'Velour Garden Soirée' } });
  fireEvent.click(screen.getByRole('button', { name: /Create Episode/ }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-new', expect.objectContaining({ script_content: expect.any(String) })));
  return vi.mocked(api.put).mock.calls.find(([url]) => url === '/api/v1/episodes/ep-new')[1];
}

describe('QuickEpisodeCreator: the first script is saved against its revision', () => {
  test('after the inject, the inject\'s revision', async () => {
    expect((await create()).script_revision).toBe(INJECTED);
  });

  test('with no inject, the create answer\'s revision', async () => {
    injectFails = true;
    expect((await create()).script_revision).toBe(CREATED);
  });
});

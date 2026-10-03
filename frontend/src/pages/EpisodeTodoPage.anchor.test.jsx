/**
 * The run sheet reads the episode's own events (audit LINK-01,
 * 2026-10-03): GET /episodes/:id/events, never the show's event list. It
 * shows the event it was made from and says when the episode's source
 * event is now another.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EpisodeTodoPage, { runSheetEvent } from './EpisodeTodoPage';

const GALA = { id: 'ev-gala', name: 'Gala Night', link: { anchor: true, anchor_source: 'brief' } };
const BRUNCH = { id: 'ev-brunch', name: 'Brunch', link: { anchor: false, stamped: true } };
const EVENTS = { anchor_event_id: 'ev-gala', events: [GALA, BRUNCH] };
let todo;
const renderIt = () => render(
  <MemoryRouter initialEntries={['/episodes/ep-1/todo']}>
    <Routes><Route path="/episodes/:episodeId/todo" element={<EpisodeTodoPage />} /></Routes>
  </MemoryRouter>,
);
const reads = () => vi.mocked(api.get).mock.calls.map(([u]) => u);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: todo } };
    if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { social_tasks: [] } };
    if (url === '/api/v1/episodes/ep-1/events') return { data: EVENTS };
    return { data: {} };
  });
});

describe('runSheetEvent', () => {
  test('the sheet\'s event when the episode lists it, else the anchor; stale when they differ', () => {
    expect(runSheetEvent(EVENTS, 'ev-gala')).toEqual({ event: GALA, anchor: GALA, stale: false });
    expect(runSheetEvent(EVENTS, 'ev-brunch')).toEqual({ event: BRUNCH, anchor: GALA, stale: true });
    expect(runSheetEvent(EVENTS, 'ev-gone')).toEqual({ event: GALA, anchor: GALA, stale: true });
    expect(runSheetEvent(EVENTS, null)).toEqual({ event: GALA, anchor: GALA, stale: false });
    expect(runSheetEvent({ events: [] }, 'ev-gala')).toEqual({ event: null, anchor: null, stale: false });
  });
});

describe('Run Sheet: the episode\'s event', () => {
  test('reads the episode\'s events, not the show\'s list; the anchor is the header', async () => {
    todo = { show_id: 'show-1', event_id: 'ev-gala', tasks: [{ slot: 'dress', label: 'Outfit', required: true, completed: false }] };
    renderIt();
    expect((await screen.findByTestId('run-sheet-event')).textContent).toContain('Gala Night');
    expect(screen.queryByTestId('run-sheet-stale')).toBeNull();
    expect(reads()).toContain('/api/v1/episodes/ep-1/events');
    expect(reads().some((u) => u.includes('/world/show-1/events'))).toBe(false);
  });

  test('a sheet made from another event says which, and names the current source event', async () => {
    todo = { show_id: 'show-1', event_id: 'ev-brunch', tasks: [{ slot: 'dress', label: 'Outfit', required: true, completed: false }] };
    renderIt();
    expect((await screen.findByTestId('run-sheet-event')).textContent).toContain('Brunch');
    expect((await screen.findByTestId('run-sheet-stale')).textContent).toBe(
      'This run sheet was made from Brunch. The episode\'s source event is now Gala Night.',
    );
  });
});

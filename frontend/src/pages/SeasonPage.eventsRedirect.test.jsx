/**
 * The event library left Producer Mode (Evoni's restructure, step 2,
 * 2026-10-25): an old link to it, /shows/:id/world?tab=events&event=<id>
 * (the New Episode choose-host flow, the Event Package's Edit details, old
 * bookmarks), lands on the Season page's Events tab with that event's
 * editor open, and the event leaves the address so a close stays closed.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';
import SeasonPage from './SeasonPage';

const EVENTS = [
  { id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', status: 'draft', prestige: 5, canon_consequences: { automation: {} } },
  { id: 'ev-2', show_id: 'show-1', name: 'Atelier Night', status: 'draft', prestige: 6, canon_consequences: { automation: {} } },
];

let where;
function Where() {
  where = useLocation();
  return null;
}
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/shows/:id/world" element={<><WorldAdmin /><Where /></>} />
      <Route path="/shows/:showId/season" element={<><SeasonPage /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

describe('Old links to the event library', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url === '/api/v1/shows/show-1') return { data: { data: { id: 'show-1', name: 'Show' } } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('?tab=events&event=<id> opens the Season page\'s Events tab with that event\'s editor open', async () => {
    renderAt('/shows/show-1/world?tab=events&event=ev-2');
    await waitFor(() => expect(where.pathname).toBe('/shows/show-1/season'));
    expect(new URLSearchParams(where.search).get('tab')).toBe('events');
    // The Edit details modal, on the event the link named.
    expect(await screen.findByDisplayValue('Atelier Night')).toBeTruthy();
    expect(screen.queryByDisplayValue('Velour Launch')).toBeNull();
    // Its id leaves the address once it is open, so closing it stays closed.
    await waitFor(() => expect(new URLSearchParams(where.search).get('event')).toBeNull());
    expect(new URLSearchParams(where.search).get('tab')).toBe('events');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByDisplayValue('Atelier Night')).toBeNull());
    expect(screen.getByTestId('event-card-ev-2')).toBeTruthy();
  });

  test('?tab=events alone opens the Season page\'s Events tab with no editor open', async () => {
    renderAt('/shows/show-1/world?tab=events');
    await waitFor(() => expect(`${where.pathname}${where.search}`).toBe('/shows/show-1/season?tab=events'));
    expect(await screen.findByTestId('event-card-ev-1')).toBeTruthy();
    expect(screen.queryByDisplayValue('Velour Launch')).toBeNull();
  });
});

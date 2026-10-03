/**
 * The legacy creation doors open the host-first starter (audit IA-03,
 * 2026-10-03): /episodes/create and /shows/:showId/quick-episode land on
 * /shows/:showId/new-episode, for the show they name, else the active
 * show, else a choice, else the shows list. Neither renders a blank
 * creation form.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import NewEpisodeRedirect, { newEpisodePath } from './NewEpisodeRedirect';
import { rememberShow } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/create" element={<NewEpisodeRedirect />} />
      <Route path="/shows/:showId/quick-episode" element={<NewEpisodeRedirect />} />
      <Route path="/shows/:showId/new-episode" element={<Where />} />
      <Route path="/shows" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: SHOWS } });
});

describe('the legacy creation doors', () => {
  test('/shows/:showId/quick-episode and /episodes/create?show_id= open that show\'s New Episode', async () => {
    renderAt('/shows/show-a/quick-episode');
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-a/new-episode');
    expect(newEpisodePath('show-b')).toBe('/shows/show-b/new-episode');
  });

  test('/episodes/create?show_id= names the show', async () => {
    renderAt('/episodes/create?show_id=show-b');
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-b/new-episode');
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/shows');
  });

  test('/episodes/create opens the active show\'s New Episode', async () => {
    rememberShow('show-b');
    renderAt('/episodes/create');
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-b/new-episode');
  });

  test('several shows and none active: asks which; none: the shows list; a failed read: an alert', async () => {
    renderAt('/episodes/create');
    await screen.findByTestId('show-chooser');
    fireEvent.click(screen.getByTestId('show-chooser-show-a'));
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-a/new-episode');
  });

  test('no shows: the shows list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    renderAt('/episodes/create');
    expect((await screen.findByTestId('where')).textContent).toBe('/shows');
  });

  test('a failed shows read: an alert, no redirect', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    renderAt('/episodes/create');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('where')).toBeNull();
    spy.mockRestore();
  });
});

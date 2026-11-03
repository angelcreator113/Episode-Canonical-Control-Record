/**
 * Sidebar → Editor (Evoni, 2026-11-03): every episode by show with where its
 * edit stands, and no jump into the last episode opened.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  episodeAPI: { getAll: vi.fn() },
}));

import api, { episodeAPI } from '../services/api';
import EditorHub, { groupByShow, editSummary } from './EditorHub';

const SHOW_A = { id: 'show-a', name: 'Styling Adventures', color: '#B8962E' };
const SHOW_B = { id: 'show-b', name: 'Before Lala', color: '#7a5' };
const EPISODES = [
  { id: 'e3', episode_number: 3, title: 'A New Alliance', status: 'draft', show_id: 'show-a', show: SHOW_A },
  { id: 'e1', episode_number: 1, title: 'Opening Night', status: 'in_build', show_id: 'show-a', show: SHOW_A },
  { id: 'e2', episode_number: 2, title: 'The Closet', status: 'draft', show_id: 'show-a', show: SHOW_A },
  { id: 'b1', episode_number: 1, title: 'Chapter One', status: 'draft', show_id: 'show-b', show: SHOW_B },
];
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const findings = {
  e1: { edit_revision: '14', counts: { blocking: 2, warning: 1 }, findings: [{ severity: 'blocking', beat: 3 }, { severity: 'blocking', beat: 3 }, { severity: 'warning', beat: 1 }] },
  e2: { edit_revision: '0', counts: { blocking: 14, warning: 0 }, findings: [] },
  e3: { edit_revision: '5', counts: { blocking: 0, warning: 0 }, findings: [] },
  b1: { edit_revision: '2', counts: { blocking: 0, warning: 2 }, findings: [] },
};

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}</p>; }
const renderAt = (url = '/studio/editor') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/studio/editor" element={<EditorHub />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('EditorHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(episodeAPI.getAll).mockResolvedValue({ data: { data: EPISODES, pagination: {} } });
    vi.mocked(api.get).mockImplementation((url) => {
      const id = url.match(/episodes\/([^/]+)\/edit\/findings/)?.[1];
      return id && findings[id] ? ok(findings[id]) : Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  test('groups episodes by show, in episode order', () => {
    expect(groupByShow(EPISODES).map((g) => [g.name, g.episodes.map((e) => e.episode_number)])).toEqual([
      ['Before Lala', [1]], ['Styling Adventures', [1, 2, 3]],
    ]);
  });

  test('sums up an edit: not started, blocking beats, warnings', () => {
    expect(editSummary(findings.e1)).toEqual({ started: true, revision: '14', blocking: 2, warning: 1, blockedBeats: 1 });
    expect(editSummary(findings.e2).started).toBe(false);
  });

  test('lists every episode with where its edit stands, and does not jump into the last one opened', async () => {
    localStorage.setItem('working-episode-id', 'e2');
    renderAt();
    const e1 = await screen.findByTestId('ehub-ep-e1');
    expect(screen.queryByTestId('where')).toBeNull();
    await waitFor(() => expect(within(e1).getByText('Edit revision 14')).toBeTruthy());
    expect(within(e1).getByText(/2 blocking · 1 of 14 beats/)).toBeTruthy();
    expect(within(e1).getByText(/1 warning$/)).toBeTruthy();
    await waitFor(() => expect(within(screen.getByTestId('ehub-ep-e2')).getByText('Not started')).toBeTruthy());
    expect(within(screen.getByTestId('ehub-ep-e2')).getByText('Last opened')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByTestId('ehub-ep-e3')).getByText(/Nothing blocking/)).toBeTruthy());
    expect(within(e1).getByRole('link', { name: /Open episode 1 Opening Night/ }).getAttribute('href')).toBe('/episodes/e1/editor');
    expect(within(e1).getByRole('link', { name: 'Details' }).getAttribute('href')).toBe('/episodes/e1?tab=edit');
    for (const m of ['post', 'patch', 'put', 'delete']) expect(api[m]).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledTimes(4); // each edit read once
  });

  test('a show chip shows only that show; search narrows the list', async () => {
    renderAt();
    await screen.findByTestId('ehub-ep-e1');
    fireEvent.click(screen.getByRole('button', { name: /Before Lala/ }));
    expect(screen.queryByTestId('ehub-ep-e1')).toBeNull();
    expect(screen.getByTestId('ehub-ep-b1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All shows/ }));
    fireEvent.change(screen.getByLabelText('Find an episode'), { target: { value: 'closet' } });
    expect(screen.getByTestId('ehub-ep-e2')).toBeTruthy();
    expect(screen.queryByTestId('ehub-ep-e1')).toBeNull();
  });

  test('opening an episode remembers it as the last opened', async () => {
    renderAt();
    fireEvent.click(within(await screen.findByTestId('ehub-ep-e3')).getByRole('link', { name: /Open episode 3/ }));
    expect(localStorage.getItem('working-episode-id')).toBe('e3');
    expect(screen.getByTestId('where').textContent).toBe('/episodes/e3/editor');
  });

  test('where the episode edit is off it says so once and stops asking', async () => {
    vi.mocked(api.get).mockImplementation(() => Promise.reject(Object.assign(new Error('off'), { response: { status: 404, data: { code: 'EPISODE_EDIT_OFF' } } })));
    renderAt();
    expect(await screen.findByTestId('ehub-off')).toBeTruthy();
    expect(api.get.mock.calls.length).toBeLessThanOrEqual(4);
    expect(screen.queryByText(/Reading the edit/)).toBeNull();
  });

  test('?episode_id= still opens that episode in the editor (old links)', () => {
    renderAt('/studio/editor?episode_id=e1');
    expect(screen.getByTestId('where').textContent).toBe('/episodes/e1/editor');
  });
});

/**
 * Edit details returns to the tab it was opened from (PR-05 of
 * docs/design/2026-11-studio-home-episode-command-center.md): Back and Save
 * both, from different tabs; with no origin, a mismatched episode or a
 * malformed one, the episode as before. Creating an episode is unchanged.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import QuickEpisodeCreator from './QuickEpisodeCreator';
import { withReturn, tabOrigin } from '../utils/returnPath';

const EP = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const SHOW = 'show-1';

function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
const open = (search = '') => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/edit${search}`]}>
    <Routes>
      <Route path="/episodes/:episodeId/edit" element={<><QuickEpisodeCreator /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const q = (from, label) => `?from=${encodeURIComponent(from)}${label ? `&fromLabel=${encodeURIComponent(label)}` : ''}`;
const fromTab = (tab) => `?${withReturn('/x', tabOrigin(EP, tab)).split('?')[1]}`;
const where = () => screen.getByTestId('where').textContent;
const save = async () => fireEvent.click(await screen.findByRole('button', { name: /Save Changes/ }));
const writes = () => ['post', 'put', 'patch', 'delete'].reduce((n, m) => n + vi.mocked(api[m]).mock.calls.length, 0);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/episodes/${EP}`) return { data: { data: { id: EP, show_id: SHOW, title: 'Gala Night', episode_number: 3, season_number: 1, description: '' } } };
    if (url === `/api/v1/episodes/${EP}/events`) return { data: { success: true, anchor_event_id: null, events: [] } };
    if (url === `/api/v1/shows/${SHOW}`) return { data: { show: { id: SHOW, name: 'Styling Adventures' } } };
    return { data: {} };
  });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
// The page is taken down before the mocks lose their answers, so no effect still pending runs against an empty client.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Edit details: Back', () => {
  test('no origin: back to the episode, as before, and nothing is written', async () => {
    open();
    const back = await screen.findByTestId('qec-back');
    expect(back.getAttribute('title')).toBe('Go back');
    fireEvent.click(back);
    await waitFor(() => expect(where()).toBe(`/episodes/${EP}`));
    expect(writes()).toBe(0);
  });

  test('opened from a tab: back to that tab, named, and nothing is written', async () => {
    for (const [tab, label] of [['checklist', 'Checklist'], ['scripts', 'Script'], ['wardrobe', 'Wardrobe'], ['summary', 'Summary']]) {
      const view = open(fromTab(tab));
      const back = await screen.findByTestId('qec-back');
      expect(back.getAttribute('title')).toBe(`Back to ${label}`);
      expect(back.getAttribute('aria-label')).toBe(`Back to ${label}`);
      fireEvent.click(back);
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}?tab=${tab}`));
      expect(writes()).toBe(0);
      view.unmount();
    }
  });

  test('another episode\'s tab, an outside address and a malformed one: back to this episode', async () => {
    for (const from of [`/episodes/${OTHER}?tab=checklist`, 'https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/episodes/%E0%A4%A']) {
      const view = open(q(from, 'Checklist'));
      const back = await screen.findByTestId('qec-back');
      expect(back.getAttribute('title')).toBe('Go back');
      fireEvent.click(back);
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}`));
      view.unmount();
    }
  });
});

describe('Edit details: Save', () => {
  test('no origin: saves, then the episode, as before', async () => {
    open();
    await save();
    await waitFor(() => expect(where()).toBe(`/episodes/${EP}`));
    expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}`, expect.anything());
  });

  test('opened from a tab: saves, then that tab', async () => {
    for (const tab of ['checklist', 'money', 'distribution']) {
      vi.mocked(api.put).mockClear();
      const view = open(fromTab(tab));
      await save();
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}?tab=${tab}`));
      expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}`, expect.anything());
      view.unmount();
    }
  });

  test('the origin changes nothing that is saved', async () => {
    const a = open();
    await save();
    await waitFor(() => expect(where()).toBe(`/episodes/${EP}`));
    const plain = JSON.stringify(vi.mocked(api.put).mock.calls);
    a.unmount();
    vi.mocked(api.put).mockClear();
    localStorage.clear();
    open(fromTab('checklist'));
    await save();
    await waitFor(() => expect(where()).toBe(`/episodes/${EP}?tab=checklist`));
    expect(JSON.stringify(vi.mocked(api.put).mock.calls)).toBe(plain);
  });

  test('another episode\'s tab or an outside address: saves, then this episode', async () => {
    for (const from of [`/episodes/${OTHER}?tab=checklist`, 'https://evil.example/x', '//evil.example']) {
      const view = open(q(from, 'Checklist'));
      await save();
      await waitFor(() => expect(where()).toBe(`/episodes/${EP}`));
      view.unmount();
    }
  });

  test('a save that fails stays on the page', async () => {
    vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 500, data: { error: 'Server said no' } } }));
    open(fromTab('checklist'));
    await save();
    expect(await screen.findByText('Server said no')).toBeTruthy();
    expect(where()).toBe(`/episodes/${EP}/edit${fromTab('checklist')}`);
  });

  test('the origin adds no read', async () => {
    const urls = () => vi.mocked(api.get).mock.calls.map(([u]) => u).sort();
    const a = open();
    await screen.findByRole('button', { name: /Save Changes/ });
    const without = urls();
    a.unmount();
    vi.mocked(api.get).mockClear();
    open(fromTab('checklist'));
    await screen.findByRole('button', { name: /Save Changes/ });
    expect(urls()).toEqual(without);
  });
});

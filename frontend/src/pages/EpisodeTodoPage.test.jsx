/**
 * EpisodeTodoPage — Track 6 CP7 behavioral tests (file 7 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers. Promise.all + .catch
 * fallback semantics preserved at call site.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

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

import apiClient from '../services/api';
import {
  getEpisodeTodoApi,
  getEpisodeTodoSocialApi,
  getEpisodeApi,
  completeTodoSlotApi,
  completeSocialTodoSlotApi,
} from './EpisodeTodoPage';

describe('EpisodeTodoPage — Track 6 CP7 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getEpisodeTodoApi GET on /episodes/:episodeId/todo', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
    await getEpisodeTodoApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo');
  });

  test('getEpisodeTodoSocialApi GET on /episodes/:episodeId/todo/social', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { social_tasks: [] } });
    await getEpisodeTodoSocialApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/social');
  });

  test('getEpisodeApi GET on /episodes/:episodeId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { episode: {} } });
    await getEpisodeApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('completeTodoSlotApi POST on /episodes/:episodeId/todo/complete/:slot', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, tasks: [], completion: 0 } });
    await completeTodoSlotApi('ep-1', 'slot-3', { completed: true });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/episodes/ep-1/todo/complete/slot-3',
      { completed: true },
    );
  });

  test('completeSocialTodoSlotApi POST on /episodes/:episodeId/todo/complete-social/:slot', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, social_tasks: [] } });
    await completeSocialTodoSlotApi('ep-1', 'slot-2', { completed: false });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/episodes/ep-1/todo/complete-social/slot-2',
      { completed: false },
    );
  });

  test('getEpisodeTodoApi rejection propagates (caller must .catch fallback)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(getEpisodeTodoApi('missing')).rejects.toThrow('not found');
  });

  test('completeTodoSlotApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
    await expect(completeTodoSlotApi('ep-1', 's-1', {})).rejects.toThrow('forbidden');
  });
});

// ── The way back (PR-05): the tab the Run Sheet was opened from ───────────
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach } from 'vitest';
import EpisodeTodoPage from './EpisodeTodoPage';
import { withReturn, tabOrigin } from '../utils/returnPath';

describe('EpisodeTodoPage: the way back (PR-05)', () => {
  const EP = '11111111-2222-4333-8444-555555555555';
  const OTHER = '99999999-2222-4333-8444-555555555555';
  const SHEET = { id: 'todo-1', tasks: [{ slot: 'dress', label: 'Find the dress', completed: false }] };
  const open = (search = '', sheet = SHEET) => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === `/api/v1/episodes/${EP}/todo`) return { data: { data: sheet } };
      if (url === `/api/v1/episodes/${EP}`) return { data: { data: { id: EP, title: 'Gala Night', show_id: 'show-1' } } };
      return { data: {} };
    });
    return render(
      <MemoryRouter initialEntries={[`/episodes/${EP}/todo${search}`]}>
        <Routes><Route path="/episodes/:episodeId/todo" element={<EpisodeTodoPage />} /></Routes>
      </MemoryRouter>,
    );
  };
  const q = (from, label) => `?from=${encodeURIComponent(from)}${label ? `&fromLabel=${encodeURIComponent(label)}` : ''}`;

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  // The page is taken down BEFORE the mocks lose their answers. The Run Sheet
  // makes one more read (the episode's events) in an effect after it loads;
  // on a slow runner that effect was still pending when the test ended, ran
  // during the automatic unmount, and found a client with no answer (main's
  // Validate run 44280379388).
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  /** The page's last read has been made, so nothing is still pending when a test ends. */
  const settled = () => waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/events`));

  test('no origin: "Back to Episode", to the episode, as before', async () => {
    open();
    const back = await screen.findByTestId('run-sheet-back');
    await settled();
    expect(back.getAttribute('href')).toBe(`/episodes/${EP}`);
    expect(back.textContent.trim()).toBe('← Back to Episode');
  });

  test('opened from the Checklist: "Back to Checklist", to that tab', async () => {
    open(`?${withReturn('/x', tabOrigin(EP, 'checklist')).split('?')[1]}`);
    const back = await screen.findByTestId('run-sheet-back');
    await settled();
    expect(back.getAttribute('href')).toBe(`/episodes/${EP}?tab=checklist`);
    expect(back.textContent.trim()).toBe('← Back to Checklist');
  });

  test('opened from other tabs: each returns to its own', async () => {
    for (const tab of ['scripts', 'wardrobe', 'money', 'summary']) {
      const view = open(`?${withReturn('/x', tabOrigin(EP, tab)).split('?')[1]}`);
      expect((await screen.findByTestId('run-sheet-back')).getAttribute('href')).toBe(`/episodes/${EP}?tab=${tab}`);
      await settled();
      view.unmount();
    }
  });

  test('another episode\'s tab, an outside address and a malformed one fall back to the episode', async () => {
    for (const from of [`/episodes/${OTHER}?tab=checklist`, 'https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/episodes/%E0%A4%A', '/episodes/']) {
      const view = open(q(from, 'Checklist'));
      const back = await screen.findByTestId('run-sheet-back');
      await settled();
      expect(back.getAttribute('href')).toBe(`/episodes/${EP}`);
      expect(back.textContent.trim()).toBe('← Back to Episode');
      view.unmount();
    }
  });

  test('the label is shown as text and does not change the address', async () => {
    open(q(`/episodes/${EP}?tab=checklist`, '<b>//evil.example</b>'));
    const back = await screen.findByTestId('run-sheet-back');
    await settled();
    expect(back.getAttribute('href')).toBe(`/episodes/${EP}?tab=checklist`);
    expect(back.textContent.trim()).toBe('← Back to <b>//evil.example</b>');
    expect(back.querySelector('b')).toBeNull();
  });

  test('with no run sheet yet, the same way back is offered', async () => {
    const view = open(q(`/episodes/${EP}?tab=checklist`, 'Checklist'), null);
    const back = await screen.findByTestId('run-sheet-back-empty');
    await settled();
    expect(back.getAttribute('href')).toBe(`/episodes/${EP}?tab=checklist`);
    expect(back.textContent).toBe('Back to Checklist');
    view.unmount();
    open('', null);
    const plain = await screen.findByTestId('run-sheet-back-empty');
    await settled();
    expect(plain.getAttribute('href')).toBe(`/episodes/${EP}`);
    expect(plain.textContent).toBe('Back to Episode');
  });

  test('the origin adds no request: the same reads with it and without', async () => {
    const urls = () => vi.mocked(apiClient.get).mock.calls.map(([u]) => u).sort();
    const a = open();
    await screen.findByTestId('run-sheet-back');
    await settled();
    const without = urls();
    a.unmount();
    vi.mocked(apiClient.get).mockClear();
    open(q(`/episodes/${EP}?tab=checklist`, 'Checklist'));
    await screen.findByTestId('run-sheet-back');
    await settled();
    expect(urls()).toEqual(without);
  });
});

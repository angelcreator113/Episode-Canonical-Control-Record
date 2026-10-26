/**
 * My Little List ♡ on Production → Phone (Evoni, 2026-10-26, Phase 2): her
 * list at the beat and line picked, interactive; every item's wording, when
 * it shows and why not yet; wording saved for any item, shown or not.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import MyLittleListPanel from './MyLittleListPanel';

const K = (c) => `mll_${c.repeat(24)}`;
const REVIEW = {
  items: [
    { key: K('a'), kind: 'reminder', reason: null, label: 'Check my coins', title: 'Check my coins', note: null, shows_at: { beat: 0, line: 0 } },
    { key: K('b'), kind: 'deal', reason: 'not_known_yet', label: 'Wearable Experiments Studio Session', title: 'Look into that video offer', note: null, stage: 'considering', shows_at: { beat: 5, line: 3 } },
    { key: K('c'), kind: 'task', reason: 'needs_wording', label: 'Win over the creative director', title: null, note: null, shows_at: { beat: 5, line: 1 } },
    { key: K('d'), kind: 'reminder', reason: 'spoiler', label: 'Practice my catwalk', title: 'Practice my catwalk', leaked: ['runway'], shows_at: { beat: 0, line: 0 } },
  ],
  issues: [{ code: 'unknown_state', beat: 6, line: 2, raw: '[LEARNS: deal_signed]' }],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/review')
    ? { data: REVIEW }
    : { data: { items: [{ key: K('a'), title: 'Check my coins', note: null, done: false, can_check: true, can_edit: true, can_remove: true }], progress: { done: 0, total: 1 } } }));
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const rowFor = (label) => screen.getByText(label, { selector: '.mllp-label' }).closest('[data-testid="mllp-row"]');

test('her list and every item\'s wording, at the beat and line picked', async () => {
  render(<MyLittleListPanel episodeId="ep-1" />);
  expect(await screen.findByText('Wearable Experiments Studio Session')).toBeTruthy();
  expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list?beat=1&line=0');
  expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list/review?beat=1&line=0&all=1');
  expect(within(rowFor('Win over the creative director')).getByText('Needs your wording')).toBeTruthy();
  expect(within(rowFor('Wearable Experiments Studio Session')).getByText('From beat 5, line 4')).toBeTruthy();
  expect(within(rowFor('Practice my catwalk')).getByTestId('mllp-leak').textContent).toBe('Names: runway');
  expect(screen.getByTestId('mllp-issues').textContent).toContain('[LEARNS: deal_signed]');
  // Her list is interactive here.
  expect(await screen.findByTestId('mll-add')).toBeTruthy();
});

test('moving the beat and line reads both again', async () => {
  render(<MyLittleListPanel episodeId="ep-1" />);
  await screen.findByText('Wearable Experiments Studio Session');
  fireEvent.change(screen.getByTestId('mllp-beat'), { target: { value: '6' } });
  fireEvent.change(screen.getByTestId('mllp-line'), { target: { value: '2' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list/review?beat=6&line=1&all=1'));
  expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list?beat=6&line=1');
});

test('wording an item that needed it, and the deal before and after she says yes', async () => {
  render(<MyLittleListPanel episodeId="ep-1" />);
  await screen.findByText('Wearable Experiments Studio Session');
  const task = rowFor('Win over the creative director');
  fireEvent.change(within(task).getByTestId('mllp-words-input'), { target: { value: 'Make a good impression' } });
  fireEvent.click(within(task).getByTestId('mllp-words-save'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/ep-1/my-little-list/review/${K('c')}`, { title: 'Make a good impression' }));

  const deal = rowFor('Wearable Experiments Studio Session');
  const [before, after] = within(deal).getAllByTestId('mllp-words-input');
  fireEvent.change(after, { target: { value: 'Film the studio video' } });
  fireEvent.click(within(deal).getAllByTestId('mllp-words-save')[1]);
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/ep-1/my-little-list/review/${K('b')}`, { title: 'Film the studio video', stage: 'committed' }));
  expect(before.getAttribute('placeholder')).toBe('Look into that video offer');
});

test('a failed save says why and keeps the words typed', async () => {
  vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { code: 'PERSONAL_LIST_MIGRATION_PENDING' } } });
  render(<MyLittleListPanel episodeId="ep-1" />);
  await screen.findByText('Wearable Experiments Studio Session');
  const task = rowFor('Win over the creative director');
  fireEvent.change(within(task).getByTestId('mllp-words-input'), { target: { value: 'Make a good impression' } });
  fireEvent.click(within(task).getByTestId('mllp-words-save'));
  expect(await within(task).findByRole('alert')).toBeTruthy();
  expect(within(task).getByTestId('mllp-words-input').value).toBe('Make a good impression');
});

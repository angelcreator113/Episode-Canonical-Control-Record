/**
 * My Little List ♡ on the phone (Evoni, 2026-10-26, Phase 2): the shopping
 * list, the to-do by beat and the task list zones all draw Lala's own list,
 * read only from GET /my-little-list at the beat shown. None of them reads a
 * production list (/todo, /todo/social, /todo/at), so no label, brand,
 * source or deliverable reaches her phone. The zone keys stay as they were.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { CONTENT_TYPES } from './ScreenContentRenderer';
import { CONTENT_AREA_KINDS, contentAreaLabel } from './phone/ContentAreaPicker';

const LIST = {
  app: 'My Little List ♡',
  items: [
    { key: 'mll_aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Find something to wear', note: '2 of 3 pieces sorted · 640 coins spent', done: true, can_check: false, can_edit: true, can_remove: false },
    { key: 'mll_bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Film my video', note: null, done: false, can_check: false, can_edit: true, can_remove: false },
  ],
  progress: { done: 1, total: 2 },
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: LIST });
});

const renderZone = (content_type, beat = 12) => render(
  <ScreenContentRenderer episodeId="ep-1" showId="s-1" beat={beat} zones={[{ id: 'z1', content_type, x: 0, y: 0, w: 60, h: 60 }]} />,
);

describe('the list zones draw My Little List', () => {
  test.each(['shopping_list', 'todo', 'task_list'])('%s: her list at the beat, from the safe endpoint only', async (type) => {
    renderZone(type, 12);
    expect(await screen.findByText('Film my video')).toBeTruthy();
    expect(screen.getByTestId('my-little-list')).toBeTruthy();
    expect(screen.getByText('My Little List ♡')).toBeTruthy();
    const urls = vi.mocked(api.get).mock.calls.map(([u]) => u);
    expect(urls).toEqual(['/api/v1/episodes/ep-1/my-little-list?beat=12']);
    for (const u of urls) expect(u).not.toMatch(/\/todo(\/|\?|$)/);
  });

  test('on the phone it is read only: no add, and a box does not save', async () => {
    renderZone('todo');
    await screen.findByText('Film my video');
    expect(screen.queryByTestId('mll-add')).toBeNull();
    expect(screen.getAllByTestId('mll-box').every((b) => b.disabled)).toBe(true);
    expect(api.patch).not.toHaveBeenCalled();
  });

  test('the zone keys are kept, named for what they show now', () => {
    const byKey = Object.fromEntries(CONTENT_TYPES.map((t) => [t.key, t.label]));
    expect(byKey.task_list).toBe('My Little List ♡');
    expect(byKey.todo).toBe('My Little List ♡ (by beat)');
    expect(byKey.shopping_list).toBe('My Little List ♡ (getting ready)');
    expect(byKey.career_list).toBe('Career List');
  });

  test('the picker offers one My Little List; a screen saved with the old shopping_list area still says what it is', () => {
    const kinds = CONTENT_AREA_KINDS.filter((k) => ['todo', 'shopping_list'].includes(k.content_type));
    expect(kinds).toEqual([expect.objectContaining({ key: 'my_little_list', label: 'My Little List ♡', content_type: 'todo' })]);
    expect(contentAreaLabel({ content_type: 'shopping_list' })).toBe('My Little List ♡ (getting ready)');
  });

  test('outside an episode it reads nothing', async () => {
    render(<ScreenContentRenderer showId="s-1" zones={[{ id: 'z1', content_type: 'todo', x: 0, y: 0, w: 60, h: 60 }]} />);
    await waitFor(() => expect(screen.getByText('Shown in an episode')).toBeTruthy());
    expect(api.get).not.toHaveBeenCalled();
  });
});

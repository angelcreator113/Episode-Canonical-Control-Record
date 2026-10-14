/**
 * Lala's to-do list by beat on her phone (Task 3191; Evoni, 2026-10-14,
 * phone phase 3 rulings 3 and 6): the server says the beat's list; the deal
 * checklist is her note headed with where the deal happens, each item ticked
 * at its cue and "ready to approve" until approved. Nothing moves a status.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { CONTENT_TYPES, todoAtUrl } from './ScreenContentRenderer';
import { CONTENT_AREA_KINDS } from './phone/ContentAreaPicker';

const DEAL = {
  label: "At STUDIO BY SABLE's Studio",
  locked: true,
  items: [
    { deliverable_id: 'd-reel', label: 'One reel in the coat', status: 'pending', delivered: true, ready_to_approve: true },
    { deliverable_id: 'd-story', label: 'Three stories', status: 'approved', delivered: true, ready_to_approve: false },
    { deliverable_id: 'd-tag', label: 'Tag the host', status: 'pending', delivered: false, ready_to_approve: false },
  ],
};
const MODE_BY_BEAT = { 8: 'shopping', 10: 'deal', 12: 'career' };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    const at = url.match(/\/todo\/at\?beat=(\d+)$/);
    if (at) return { data: { data: { mode: MODE_BY_BEAT[at[1]], deal: DEAL } } };
    if (url.startsWith('/api/v1/episodes/ep-1/todo?beat=')) return { data: { data: { tasks: [{ slot: 'dress', label: 'A showstopper', completed: true }] } } };
    if (url.startsWith('/api/v1/shows/s-1/career-list')) return { data: { data: { goals: [{ id: 'g1', title: 'Land a cover', status: 'active' }], brands: [], milestones: [] } } };
    return { data: { data: null } };
  });
});

const renderAt = (beat) => render(
  <ScreenContentRenderer episodeId="ep-1" showId="s-1" beat={beat} zones={[{ id: 'z1', content_type: 'todo', x: 0, y: 0, w: 60, h: 50 }]} />,
);

describe("Lala's to-do list by beat", () => {
  test('a registered content type, offered in the picker', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'todo')).toMatchObject({ group: 'messages' });
    expect(CONTENT_AREA_KINDS.find((k) => k.content_type === 'todo')).toMatchObject({ label: 'To-do by beat' });
    expect(todoAtUrl('ep-1', 10)).toBe('/api/v1/episodes/ep-1/todo/at?beat=10');
    expect(todoAtUrl('ep-1', null)).toBe('/api/v1/episodes/ep-1/todo/at');
  });

  test('the area switches list by beat: shopping while she dresses, the deal, then her career', async () => {
    renderAt(8);
    expect(await screen.findByTestId('phone-shopping-list')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo?beat=8');
    renderAt(10);
    expect(await screen.findByTestId('phone-deal-checklist')).toBeTruthy();
    renderAt(12);
    expect(await screen.findByTestId('phone-career-list')).toBeTruthy();
  });

  test('the deal note is headed with its location; a ticked item reads ready to approve until approved; no status is moved', async () => {
    renderAt(10);
    const note = await screen.findByTestId('phone-deal-checklist');
    expect(note.textContent).toContain("At STUDIO BY SABLE's Studio");
    const items = screen.getAllByTestId('phone-deal-item');
    expect(items.map((i) => i.dataset.delivered)).toEqual(['true', 'true', 'false']);
    expect(items[0].textContent).toContain('ready to approve');
    expect(items[1].textContent).not.toContain('ready to approve');
    expect(items[2].querySelector('.evd-line-text').className).not.toContain('is-crossed');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });
});

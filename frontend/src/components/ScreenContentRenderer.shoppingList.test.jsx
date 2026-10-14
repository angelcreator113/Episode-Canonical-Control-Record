/**
 * Lala's Shopping list on her phone (Task 3179; Lala's Phone spec §5, §13):
 * the episode's wardrobe list drawn on the Event Package paper, her own
 * handwritten note; a line is crossed off once her look fills it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { ShoppingListRenderer, CONTENT_TYPES } from './ScreenContentRenderer';
import { CONTENT_AREA_KINDS } from './phone/ContentAreaPicker';

const TASKS = [
  { slot: 'shoes', label: 'Find heels that make every step count', order: 2, completed: false },
  { slot: 'dress', label: 'Find a showstopper', order: 1, completed: true },
  { slot: 'purse', label: 'A crystal clutch', order: 3, completed: false },
];

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { tasks: TASKS } } });
});

describe("Lala's Shopping list on the phone", () => {
  test('a registered content type, offered in the picker', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'shopping_list')).toMatchObject({ label: 'Shopping List', group: 'messages' });
    expect(CONTENT_AREA_KINDS.find((k) => k.content_type === 'shopping_list')).toMatchObject({ label: 'Shopping list', tone: 'pink' });
  });

  test("reads the episode's wardrobe list and draws each line in order on her paper", async () => {
    render(<ShoppingListRenderer episodeId="ep-1" />);
    const paper = await screen.findByTestId('phone-shopping-list');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo');
    expect(paper.className).toBe('evd-paper is-phone');
    expect(paper.textContent).toContain("Lala's shopping list");
    expect(screen.getAllByTestId('phone-shopping-line').map((l) => l.textContent)).toEqual([
      '✓Find a showstopper', 'Find heels that make every step count', 'A crystal clutch',
    ]);
  });

  test('only a filled line is crossed off', async () => {
    render(<ShoppingListRenderer episodeId="ep-1" />);
    const lines = await screen.findAllByTestId('phone-shopping-line');
    expect(lines.map((l) => l.dataset.crossed)).toEqual(['true', 'false', 'false']);
    expect(lines[0].querySelector('.evd-line-text').className).toContain('is-crossed');
    expect(lines[1].querySelector('.evd-line-text').className).not.toContain('is-crossed');
  });

  test('outside an episode, and before a list exists, it says so', async () => {
    render(<ShoppingListRenderer />);
    expect(screen.getByText('Shopping list · shown in an episode')).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
    vi.mocked(api.get).mockResolvedValue({ data: { data: null, message: 'No to-do list yet.' } });
    render(<ShoppingListRenderer episodeId="ep-2" />);
    expect(await screen.findByText('No shopping list yet')).toBeTruthy();
  });

  test('a shopping_list content area renders it on a phone screen', async () => {
    render(<ScreenContentRenderer episodeId="ep-1" showId="s-1" zones={[{ id: 'z1', content_type: 'shopping_list', x: 0, y: 0, w: 60, h: 50 }]} />);
    expect(await screen.findByTestId('phone-shopping-list')).toBeTruthy();
  });

  test('at a beat of the script, the list is crossed off as of that beat (Task 3188)', async () => {
    render(<ScreenContentRenderer episodeId="ep-1" showId="s-1" beat={8} zones={[{ id: 'z1', content_type: 'shopping_list', x: 0, y: 0, w: 60, h: 50 }]} />);
    await screen.findByTestId('phone-shopping-list');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo?beat=8');
  });
});

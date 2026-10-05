/**
 * Assets → Wardrobe, the closet, to Evoni's redesign (2026-10-05): the Show
 * row splits what Lala owns from what she would buy, the Sets pill shows the
 * pieces in a matching set, the pills carry their counts, and a card says
 * Owned or what the piece costs in coins.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const ITEMS = [
  { id: 'w1', name: 'Lilac Slip Dress', brand: 'Maison Belle', clothing_category: 'dress', is_owned: true, price: 420, times_worn: 1 },
  { id: 'w2', name: 'Pearl Drops', brand: 'Lumiere', clothing_category: 'jewelry', is_owned: false, coin_cost: 260 },
  { id: 'w3', name: 'Safari Top', clothing_category: 'top', is_owned: true, outfit_set_id: 's1', outfit_set_name: 'Safari set' },
  { id: 'w4', name: 'Lace Skirt', clothing_category: 'bottom', is_owned: false, price: 210 },
];

const renderIt = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=wardrobe-items']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);
const shown = () => screen.queryAllByTestId(/^wardrobe-card-/).map((el) => el.dataset.testid.replace('wardrobe-card-', '')).sort();

describe('Producer Mode closet', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Show', metadata: {} } } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: ITEMS, pagination: { total: ITEMS.length } } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the header, the pill counts and the cards', async () => {
    renderIt();
    await waitFor(() => expect(shown()).toEqual(['w1', 'w2', 'w3', 'w4']));
    expect(screen.getByTestId('wardrobe-count').textContent).toBe('4 pieces');
    expect(screen.getByTestId('wardrobe-cat-all').textContent).toBe('All 4');
    expect(screen.getByTestId('wardrobe-cat-sets').textContent).toBe('Sets 1');
    expect(screen.getByTestId('wardrobe-own-w1').textContent).toBe('Owned');
    expect(screen.getByTestId('wardrobe-own-w2').textContent).toBe('To buy');
    expect(screen.getByTestId('wardrobe-cost-w1').textContent).toBe('Owned');
    expect(screen.getByTestId('wardrobe-cost-w2').textContent).toBe('260 coins');
    expect(screen.getByTestId('wardrobe-cost-w4').textContent).toBe('210 coins'); // no coin_cost: the price
  });

  test('the Show row: Lala owns, To buy, Never used', async () => {
    renderIt();
    await waitFor(() => expect(shown()).toHaveLength(4));
    expect(screen.getByTestId('wardrobe-show-owned').textContent).toBe('Lala owns 2');
    fireEvent.click(screen.getByTestId('wardrobe-show-owned'));
    await waitFor(() => expect(shown()).toEqual(['w1', 'w3']));
    fireEvent.click(screen.getByTestId('wardrobe-show-to_buy'));
    await waitFor(() => expect(shown()).toEqual(['w2', 'w4']));
    fireEvent.click(screen.getByTestId('wardrobe-show-staging'));
    await waitFor(() => expect(shown()).toEqual(['w2', 'w3', 'w4']));
    fireEvent.click(screen.getByTestId('wardrobe-show-all'));
    await waitFor(() => expect(shown()).toHaveLength(4));
  });

  test('Sets shows the pieces in a set; the chosen pill again clears it', async () => {
    renderIt();
    await waitFor(() => expect(shown()).toHaveLength(4));
    fireEvent.click(screen.getByTestId('wardrobe-cat-sets'));
    await waitFor(() => expect(shown()).toEqual(['w3']));
    expect(screen.getByTestId('wardrobe-cat-sets').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('wardrobe-cat-sets'));
    await waitFor(() => expect(shown()).toHaveLength(4));
  });
});

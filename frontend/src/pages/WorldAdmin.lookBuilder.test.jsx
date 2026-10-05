/**
 * The look builder beside the closet (Evoni's Producer Mode redesign,
 * 2026-10-05): it builds the look for the episode in production, starting
 * from its saved outfit; a card adds or removes a piece; a piece out of
 * Lala's reach cannot go in; Save sends the whole look to
 * /wardrobe/lock-outfit-atomic.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const DRESS = { id: 'w1', name: 'Lilac Slip Dress', clothing_category: 'dress', is_owned: true };
const SHOES = { id: 'w2', name: 'Crimson Pump', clothing_category: 'shoes', is_owned: false, lock_type: 'coin', coin_cost: 200 };
const PEARLS = { id: 'w3', name: 'Pearl Drops', clothing_category: 'jewelry', is_owned: false, lock_type: 'coin', coin_cost: 5000 };
const GIFT = { id: 'w4', name: 'Black Satin Clutch', clothing_category: 'bag', color: 'black', is_owned: true };

const renderIt = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=wardrobe-items']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);

describe('Producer Mode look builder', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Show', metadata: {} } } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: [DRESS, SHOES, PEARLS, GIFT], pagination: { total: 4 } } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { data: [{ id: 'ep-1', episode_number: 1, status: 'draft', title: 'One' }] } };
      if (url.startsWith('/api/v1/characters/lala/state')) return { data: { state: { coins: 500, reputation: 3 } } };
      if (url === '/api/v1/wardrobe/outfit/ep-1') return { data: { items: [DRESS] } };
      if (url === '/api/v1/episodes/ep-1/events') return { data: { events: [{ id: 'ev-1', name: 'Studio Session', dress_code: 'black satin', link: { anchor: true } }] } };
      if (url === '/api/v1/world/show-1/events/ev-1/financial-forecast') return { data: { success: true, income: { total: 650 }, expenses: { total: 0 } } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, coins_spent: 200, locked: [] } });
  });

  test('the panel starts from the saved look; a card adds a piece; Save sends the look', async () => {
    renderIt();
    const panel = await screen.findByTestId('look-builder');
    await waitFor(() => expect(panel.textContent).toContain('Episode 1 · Studio Session'));
    expect(panel.textContent).toContain('Dress code: black satin');
    await waitFor(() => expect(within(panel).getByTestId('look-row-body').textContent).toContain('Lilac Slip Dress'));
    expect(screen.getByTestId('wardrobe-look-w1').textContent).toBe('In look');
    // Not savable yet: no shoes.
    expect(within(panel).getByTestId('look-save').disabled).toBe(true);
    expect(panel.textContent).toContain('Pick shoes');

    fireEvent.click(screen.getByTestId('wardrobe-look-w2'));
    await waitFor(() => expect(within(panel).getByTestId('look-row-shoes').textContent).toContain('Crimson Pump'));
    const money = within(panel).getByTestId('look-money').textContent;
    expect(money).toContain('−200 coins');
    expect(money).toContain('+650 coins');
    expect(money).toContain('950 coins'); // 500 - 200 + 650

    fireEvent.click(within(panel).getByTestId('look-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe/lock-outfit-atomic', {
      episode_id: 'ep-1', show_id: 'show-1', wardrobe_ids: ['w1', 'w2'],
    }));
    await waitFor(() => expect(panel.textContent).toContain('Lala spent 200 coins'));
  });

  test('a piece out of reach cannot go in; Matches dress code filters by the event', async () => {
    renderIt();
    await screen.findByTestId('look-builder');
    const pearls = await screen.findByTestId('wardrobe-look-w3');
    expect(pearls.disabled).toBe(true);
    expect(pearls.getAttribute('title')).toBe('Lala needs 5000 coins for this piece');
    fireEvent.click(await screen.findByTestId('wardrobe-show-dress_code'));
    await waitFor(() => expect(screen.queryAllByTestId(/^wardrobe-card-/).map((el) => el.dataset.testid)).toEqual(['wardrobe-card-w4']));
  });
});

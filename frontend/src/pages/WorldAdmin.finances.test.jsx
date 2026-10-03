/**
 * Lala's in-world finances have one home: Cast & Continuity → Lala's
 * Finances (it was a pop-up opened from the Wardrobe toolbar). The Wardrobe's
 * coin pill and each episode's P&L in Results link to it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const CONFIG = { starting_balance: 1900, current_balance: 2450, goals: [{ id: 'g1', threshold: 5000, reward_coins: 200, label: '🌟 Rising Star' }] };
let where;
function Where() { const l = useLocation(); where = `${l.pathname}${l.search}`; return null; }
const renderAt = (tab) => render(
  <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
    <Routes><Route path="/shows/:id/world" element={<><WorldAdmin /><Where /></>} /></Routes>
  </MemoryRouter>,
);
const tabButton = (name) => screen.getByRole('button', { name });

describe("Lala's Finances: one home", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Styling Adventures' } } };
      if (url === '/api/v1/shows/show-1/financial-config') return { data: CONFIG };
      if (url === '/api/v1/shows/show-1/financial-summary') {
        return { data: { totals: { income: 900, expenses: 350 }, trend: [], by_episode: [{ episode_id: 'ep-1', income: 300, expenses: 100 }] } };
      }
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { data: [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }] } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('it is a section of Cast & Continuity, not a pop-up, and loads its summary', async () => {
    renderAt('finances');
    const section = await screen.findByTestId('lala-finances');
    expect(within(section).getByRole('heading', { name: "💰 Lala's Finances" })).toBeTruthy();
    expect(tabButton("Lala's Finances").style.color).toBe('rgb(99, 102, 241)');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/financial-summary'));
    // A page section: no fixed overlay around it.
    expect(section.closest('[style*="position: fixed"]')).toBeNull();
  });

  test('the goal ladder saves from the page, and Discard puts the saved values back', async () => {
    renderAt('finances');
    const section = await screen.findByTestId('lala-finances');
    fireEvent.click(within(section).getByRole('button', { name: 'Goals' }));
    const balance = await within(section).findByDisplayValue('1900');
    fireEvent.change(balance, { target: { value: '2500' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Discard changes' }));
    expect(within(section).getByDisplayValue('1900')).toBeTruthy();
    fireEvent.change(within(section).getByDisplayValue('1900'), { target: { value: '2500' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Save & re-seed' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/financial-config', expect.objectContaining({ starting_balance: 2500 })));
    expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/seed-balance', { force: true });
  });

  test('the Wardrobe\'s coin pill opens it', async () => {
    renderAt('wardrobe-items');
    fireEvent.click(await screen.findByTestId('wardrobe-finance-pill'));
    await waitFor(() => expect(where).toBe('/shows/show-1/world?tab=finances'));
    expect(await screen.findByTestId('lala-finances')).toBeTruthy();
  });

  test('an episode\'s P&L in Results links to it', async () => {
    renderAt('episodes-ledger');
    fireEvent.click(await screen.findByText('Gala Night'));
    fireEvent.click(await screen.findByTestId('ledger-finances-link-ep-1'));
    await waitFor(() => expect(where).toBe('/shows/show-1/world?tab=finances'));
  });
});

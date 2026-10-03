/**
 * Producer Mode → Episodes → Episode Ledger reads each episode's P&L and the
 * totals from the ledger (§8(aa) M4; Episode Money Phase A, Task #2278):
 * /financial-summary's by_episode, not episodes.total_income/total_expenses.
 * Its event reference shows no cost_coins tag (§8(ff) Q14, Season Arc PR 8).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

// The columns disagree with the ledger on purpose: 999 / 1640 are stale.
const EPISODE = { id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft', total_income: 999, total_expenses: 1640 };

function renderLedger() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/world?tab=episodes-ledger']}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Episode Ledger reads the ledger (#2278)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [EPISODE] } };
      if (url === '/api/v1/shows/show-1/financial-summary') {
        return { data: { by_episode: [{ episode_id: 'ep-1', income: 300, expenses: 100, net: 200 }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the totals are the ledger\'s, not the columns\'', async () => {
    renderLedger();

    await waitFor(() => expect(screen.getByText('Total Income')).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/financial-summary');
    const card = (label) => screen.getByText(label).parentElement;
    expect(card('Total Income').textContent).toContain('300');
    expect(card('Total Expenses').textContent).toContain('100');
    expect(card('Net P&L').textContent).toContain('+200');
    expect(screen.queryByText('999')).toBeNull();
    expect(screen.queryByText('1,640')).toBeNull();
  });

  test("an episode's P&L card is the ledger's", async () => {
    renderLedger();
    fireEvent.click(await screen.findByText('Gala Night'));

    await waitFor(() => expect(screen.getByText('💰 Episode P&L')).toBeTruthy());
    const pnl = screen.getByText('💰 Episode P&L').parentElement;
    expect(pnl.textContent).toContain('300');
    expect(pnl.textContent).toContain('100');
    expect(pnl.textContent).toContain('200');
    expect(pnl.textContent).not.toContain('999');
  });

  test('the event reference carries no 🪙 cost_coins tag (§8(ff) Q14)', async () => {
    const withScript = { ...EPISODE, script_content: 'Lala arrives at the Rose Gala. Then the Press Day pitch.' };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [withScript] } };
      if (url === '/api/v1/world/show-1/events') {
        return { data: { events: [{ id: 'ev-1', name: 'Rose Gala', prestige: 7, cost_coins: 4321, strictness: 5, used_in_episode_id: 'ep-1' }] } };
      }
      if (url === '/api/v1/shows/show-1/financial-summary') return { data: { by_episode: [] } };
      return { data: {} };
    });
    renderLedger();
    fireEvent.click(await screen.findByText('Gala Night'));

    const reference = (await screen.findByText('💌 Event')).parentElement;
    expect(reference.textContent).toContain('Rose Gala');
    expect(reference.textContent).toContain('⭐ 7');
    expect(reference.textContent).not.toContain('4321');
    expect(reference.textContent).not.toContain('🪙');
  });

  // The saved event–episode link, not the event's name in the script.
  test('the event is the one linked to the episode, not one whose name the script mentions', async () => {
    const withScript = { ...EPISODE, script_content: 'Lala arrives at the Rose Gala.' };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [withScript] } };
      if (url === '/api/v1/world/show-1/events') {
        return { data: { events: [
          { id: 'ev-1', name: 'Rose Gala', prestige: 7 }, // named in the script, linked elsewhere
          { id: 'ev-2', name: 'Press Day', prestige: 4, used_in_episode_id: 'ep-1' },
        ] } };
      }
      if (url === '/api/v1/shows/show-1/financial-summary') return { data: { by_episode: [] } };
      return { data: {} };
    });
    renderLedger();
    fireEvent.click(await screen.findByText('Gala Night'));
    const reference = (await screen.findByText('💌 Event')).parentElement;
    expect(reference.textContent).toContain('Press Day');
    expect(reference.textContent).not.toContain('Rose Gala');
  });
});

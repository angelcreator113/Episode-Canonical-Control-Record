/**
 * ShowSettings "Reset Lala's Stats" leaves coins alone (§8(y) Q5; Task #2249).
 *
 * The reset sent coins: 500 through POST /characters/lala/state/update. Under
 * D1 that books a ledger adjustment to 500, the career-money reset Q5 rules
 * out. It now resets the story stats only.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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

import api from '../services/api';
import ShowSettings from './ShowSettings';

const SHOW_ID = 'show-1';

function renderAdvanced() {
  return render(
    <MemoryRouter initialEntries={[`/shows/${SHOW_ID}/settings?tab=advanced`]}>
      <Routes>
        <Route path="/shows/:id/settings" element={<ShowSettings />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ShowSettings: Reset Lala's Stats", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: { show: { id: SHOW_ID, title: 'Styling Adventures' } } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(api.post).mockReset();
  });

  test('resets the story stats and sends no coins', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAdvanced();

    fireEvent.click(await screen.findByRole('button', { name: /Reset Stats/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/characters/lala/state/update');
    expect(body).toMatchObject({ show_id: SHOW_ID, reputation: 1, brand_trust: 1, influence: 1, stress: 0 });
    expect(body).not.toHaveProperty('coins');
    expect(window.confirm.mock.calls[0][0]).toMatch(/Coins are not changed/);
  });

  test('says on the card that coins are not changed', async () => {
    renderAdvanced();
    expect(await screen.findByText(/Coins are not changed/)).toBeTruthy();
  });

  test('nothing is sent when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAdvanced();

    fireEvent.click(await screen.findByRole('button', { name: /Reset Stats/ }));

    expect(api.post).not.toHaveBeenCalled();
  });
});

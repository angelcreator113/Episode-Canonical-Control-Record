/**
 * Finalize Financials in the event's Edit details modal (Evoni, 2026-11-13):
 * it books real money, so it is an admin's, as completion is. The API
 * refuses anyone else itself; this is the screen saying so instead of
 * offering a button that would be refused.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import AuthContext from '../../contexts/AuthContext';
import { FinalizeFinancials } from './EventDetailsModal';

const setToast = vi.fn();
const renderAs = (user) => render(
  <AuthContext.Provider value={{ user }}>
    <FinalizeFinancials showId="show-1" episodeId="ep-1" setToast={setToast} />
  </AuthContext.Provider>,
);

beforeEach(() => {
  setToast.mockReset();
  vi.mocked(api.post).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Finalize Financials', () => {
  test.each([['an editor', { id: 'u2', groups: ['editor'] }], ['nobody signed in', null]])('%s gets no button, only who can, and nothing is posted', (_n, user) => {
    renderAs(user);
    expect(screen.queryByTestId('finalize-financials')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('finalize-admin-note').textContent).toBe("Only an admin can finalize this episode's financials.");
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  test('an admin finalizes: one post to the finalize route, and the result is said', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { transactions: [{}, {}], balance_after: 950, summary: { net_profit: -50 } } } });
    renderAs({ id: 'u1', groups: ['ADMIN'] });
    fireEvent.click(screen.getByTestId('finalize-financials'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('2 transactions executed — balance: 950 coins (-50 net)'));
    expect(vi.mocked(api.post).mock.calls).toEqual([['/api/v1/world/show-1/episodes/ep-1/finalize-financials']]);
    expect(screen.getByTestId('finalize-financials').disabled).toBe(false);
  });

  test('already finalized is said as that', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { already_finalized: true, balance: 950 } } });
    renderAs({ id: 'u1', groups: ['admin'] });
    fireEvent.click(screen.getByTestId('finalize-financials'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Already finalized — balance: 950'));
  });

  test('a refusal is said, and the button comes back', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('refused'), { response: { status: 403, data: { error: 'Admin only' } } }));
    renderAs({ id: 'u1', groups: ['admin'] });
    fireEvent.click(screen.getByTestId('finalize-financials'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Failed: Admin only'));
    expect(screen.getByTestId('finalize-financials').disabled).toBe(false);
  });
});

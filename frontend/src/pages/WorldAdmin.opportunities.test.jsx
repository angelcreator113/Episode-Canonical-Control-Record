/**
 * The show tab's opportunities (Evoni, 2026-10-19: "when i clicked it to try
 * and attach it to the show it marked it as complete instead of allowing me
 * to set it up"): attach one to an episode's beat 14, ask before completing,
 * undo the last step, and a held one says which episode's beat 14 it is.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import { OpportunitiesTab, S } from './WorldAdmin';

const SHOW = 'show-1';
const EPISODES = [{ id: 'ep-1', title: 'The Gala', episode_number: 3 }];
const history = (...statuses) => statuses.map((status) => ({ status, date: '2026-10-19' }));
const OPEN = { id: 'o1', name: 'Velour Cover', status: 'negotiating', opportunity_type: 'editorial', status_history: history('offered', 'considering', 'negotiating') };
const ACTIVE = { id: 'o2', name: 'Runway Walk', status: 'active', opportunity_type: 'runway', event_id: null, status_history: history('offered', 'active') };
const HELD = { id: 'o3', name: 'Sable Campaign', status: 'held', opportunity_type: 'campaign', offered_in_episode_id: 'ep-1', beat14_episode: { id: 'ep-1', title: 'The Gala' }, status_history: history('offered', 'held') };
const PEOPLE = [{ profile_id: 7, name: 'Sable Reyes', role: 'host' }];

let api;
let toast;
const renderTab = (opps = [OPEN, ACTIVE, HELD]) => {
  api.get.mockImplementation(async (url) => {
    if (url === `/api/v1/opportunities/${SHOW}`) return { data: { opportunities: opps } };
    if (url.endsWith('/beat14')) return { data: { data: { opportunity: null, people: PEOPLE, candidates: [] } } };
    return { data: {} };
  });
  return render(
    <MemoryRouter>
      <OpportunitiesTab showId={SHOW} api={api} S={S} setToast={toast} loadData={vi.fn()} episodes={EPISODES} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
  toast = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('attach to beat 14', () => {
  test('pick the episode, then who at its event offers it; the list is read again', async () => {
    api.put.mockResolvedValue({ data: { success: true } });
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    expect(screen.queryByTestId('opp-beat14-open-o2')).toBeNull();
    fireEvent.change(screen.getByTestId('opp-beat14-episode'), { target: { value: 'ep-1' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/api/v1/opportunities/${SHOW}/episode/ep-1/beat14`));
    fireEvent.change(await screen.findByTestId('opp-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/opportunities/${SHOW}/episode/ep-1/beat14`, { opportunity_id: 'o1', connector_profile_id: 7 }));
    await waitFor(() => expect(screen.queryByTestId('opp-beat14-form-o1')).toBeNull());
    expect(api.get.mock.calls.filter(([u]) => u === `/api/v1/opportunities/${SHOW}`).length).toBe(2);
  });

  test("the server's refusal is shown", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.put.mockRejectedValue({ response: { data: { error: 'That episode is completed.' } } });
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    fireEvent.change(screen.getByTestId('opp-beat14-episode'), { target: { value: 'ep-1' } });
    fireEvent.change(await screen.findByTestId('opp-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    expect((await screen.findByTestId('opp-beat14-error')).textContent).toBe('That episode is completed.');
    expect(console.error).toHaveBeenCalled();
  });

  test('a held one says which episode, linking to its Script tab, and offers no move or undo', async () => {
    renderTab();
    const label = await screen.findByTestId('opp-held-o3');
    expect(label.textContent).toBe('Beat 14 of The Gala');
    expect(label.querySelector('a').getAttribute('href')).toBe('/episodes/ep-1?tab=scripts');
    expect(screen.queryByTestId('opp-move-o3')).toBeNull();
    expect(screen.queryByTestId('opp-undo-o3')).toBeNull();
    expect(screen.queryByTestId('opp-beat14-open-o3')).toBeNull();
  });
});

describe('safer steps', () => {
  test('Move to completed asks first, and nothing moves on No', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    const move = await screen.findByTestId('opp-move-o2');
    expect(move.textContent).toBe('Move to completed');
    fireEvent.click(move);
    expect(confirm).toHaveBeenCalledWith('Mark Runway Walk completed? This also checks career goals and can unlock new opportunities.');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('an earlier step moves without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    api.post.mockResolvedValue({ data: { success: true, opportunity: { ...OPEN, status: 'booked' } } });
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-move-o1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/opportunities/${SHOW}/o1/advance`, { to_status: 'booked' }));
    expect(confirm).not.toHaveBeenCalled();
  });

  test('Schedule as Event asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    fireEvent.click((await screen.findAllByText(/Schedule as Event/))[0]);
    expect(confirm.mock.calls[0][0]).toMatch(/marks it booked/);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Undo last step puts the status back', async () => {
    api.post.mockResolvedValue({ data: { success: true, opportunity: { ...ACTIVE, status: 'offered' } } });
    renderTab();
    const undo = await screen.findByTestId('opp-undo-o2');
    expect(undo.getAttribute('title')).toMatch(/stays/);
    fireEvent.click(undo);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/opportunities/${SHOW}/o2/undo`));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Runway Walk → back to offered'));
  });
});

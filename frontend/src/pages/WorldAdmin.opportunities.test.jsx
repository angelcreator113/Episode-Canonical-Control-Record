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
    expect((await screen.findByTestId('opp-held-o3')).textContent).toBe('held for beat 14');
    // The episode and its link are on the "Offered in" line (Evoni, 2026-10-25).
    const line = screen.getByTestId('opp-offered-in-o3');
    expect(line.textContent).toBe("Offered in The Gala · held until it's done");
    expect(line.querySelector('a').getAttribute('href')).toBe('/episodes/ep-1?tab=scripts');
    expect(line.querySelector('a').getAttribute('title')).toBe('Beat 14 of The Gala');
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

describe('second pass (Script page re-audit, 2026-10-19)', () => {
  const withAttached = (opportunity) => api.get.mockImplementation(async (url) => {
    if (url === `/api/v1/opportunities/${SHOW}`) return { data: { opportunities: [OPEN] } };
    if (url.endsWith('/beat14')) return { data: { data: { opportunity, people: PEOPLE, candidates: [] } } };
    return { data: {} };
  });
  const renderWith = (episodes = EPISODES) => render(
    <MemoryRouter>
      <OpportunitiesTab showId={SHOW} api={api} S={S} setToast={toast} loadData={vi.fn()} episodes={episodes} />
    </MemoryRouter>,
  );

  test('an episode whose beat 14 already offers one warns, and attaching asks first; No sends nothing', async () => {
    withAttached({ id: 'o9', name: 'Panel Talk', status: 'held' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWith();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    fireEvent.change(screen.getByTestId('opp-beat14-episode'), { target: { value: 'ep-1' } });
    const warn = await screen.findByTestId('opp-beat14-replacing');
    expect(warn.textContent).toBe('Beat 14 of The Gala already offers Panel Talk; attaching replaces it. Panel Talk goes back to its earlier status, or is deleted if it was made for beat 14.');
    fireEvent.change(await screen.findByTestId('opp-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    expect(confirm.mock.calls[0][0]).toMatch(/^Beat 14 of The Gala already offers Panel Talk; .* Attach Velour Cover instead\?$/);
    expect(api.put).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    api.put.mockResolvedValue({ data: { success: true } });
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Velour Cover is beat 14's opportunity in The Gala"));
  });

  test('an episode with nothing attached, or with this one, attaches without asking', async () => {
    withAttached(null);
    const confirm = vi.spyOn(window, 'confirm');
    api.put.mockResolvedValue({ data: { success: true } });
    renderWith();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    fireEvent.change(screen.getByTestId('opp-beat14-episode'), { target: { value: 'ep-1' } });
    fireEvent.change(await screen.findByTestId('opp-beat14-from'), { target: { value: '7' } });
    expect(screen.queryByTestId('opp-beat14-replacing')).toBeNull();
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
  });

  test('completed episodes are not in the list', async () => {
    withAttached(null);
    renderWith([...EPISODES, { id: 'ep-2', title: 'Done One', episode_number: 2, evaluation_status: 'accepted' }]);
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    const options = [...screen.getByTestId('opp-beat14-episode').querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Choose…', '3. The Gala']);
  });

  test('Undo is not offered when the last step came from beat 14, or once expired', async () => {
    const released = { id: 'r1', name: 'Let Go', status: 'offered', opportunity_type: 'campaign', status_history: [{ status: 'offered' }, { status: 'held', previous_status: 'offered' }, { status: 'offered', note: 'No longer beat 14 of the episode' }] };
    const expired = { id: 'x1', name: 'Gone', status: 'expired', opportunity_type: 'campaign', status_history: history('offered', 'held', 'expired') };
    const undone = { id: 'u1', name: 'Back Again', status: 'considering', opportunity_type: 'campaign', status_history: [...history('offered', 'considering', 'negotiating'), { status: 'considering', note: 'Undone', undone_from: 'negotiating' }] };
    renderTab([released, expired, undone, ACTIVE]);
    await screen.findByTestId('opp-undo-o2');
    expect(screen.queryByTestId('opp-undo-r1')).toBeNull();
    expect(screen.queryByTestId('opp-undo-x1')).toBeNull();
    expect(screen.getByTestId('opp-undo-u1')).toBeTruthy();
  });

  test('a failed step logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValue({ response: { data: { error: 'Nope' } } });
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-move-o1'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Nope'));
    expect(err).toHaveBeenCalledWith('[OpportunitiesTab] advance failed:', expect.anything());
  });
});

describe('third pass (Script page audit 3, 2026-10-19)', () => {
  test('the attach form takes focus; Cancel gives it back to the card\'s button', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    expect(document.activeElement).toBe(screen.getByTestId('opp-beat14-episode'));
    fireEvent.click(screen.getByTestId('opp-beat14-cancel'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('opp-beat14-open-o1')));
  });

  test('after attaching, focus stays on the card', async () => {
    api.put.mockResolvedValue({ data: { success: true } });
    renderTab();
    fireEvent.click(await screen.findByTestId('opp-beat14-open-o1'));
    fireEvent.change(screen.getByTestId('opp-beat14-episode'), { target: { value: 'ep-1' } });
    fireEvent.change(await screen.findByTestId('opp-beat14-from'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('opp-beat14-attach'));
    await waitFor(() => expect(screen.queryByTestId('opp-beat14-form-o1')).toBeNull());
    await waitFor(() => expect(document.activeElement?.closest('[data-opp-card="o1"]')).toBeTruthy());
  });

  test('payments read as coins, and status colours are text tokens', async () => {
    renderTab([{ ...OPEN, status: 'offered', payment_amount: 500, status_history: history('offered') }]);
    expect((await screen.findByTestId('opp-payment-o1')).textContent).toBe('500 coins');
    expect(screen.getByText(/0 coins booked · 500 coins pipeline/)).toBeTruthy();
    // jsdom drops var() colours; the amber of before (2.15:1) is gone. Contrast measured in Chromium.
    expect(screen.getByTestId('opp-move-o1').getAttribute('style')).not.toMatch(/245, 158, 11|f59e0b/i);
  });
});

// Evoni, 2026-10-23: "I currently have an opportunity from episode 1 in the
// opportunities tab but I can't turn it into an event how should that work?"
describe('a held one says why, and can be released or scheduled now', () => {
  const WAITING = { ...HELD, beat14_episode: { id: 'ep-1', title: 'The Gala', episode_number: 3, evaluation_status: null } };
  const STUCK = { id: 'o4', name: 'Velour Ambassador', status: 'held', opportunity_type: 'ambassador', offered_in_episode_id: 'ep-9', beat14_episode: { id: 'ep-9', title: null, episode_number: 1, evaluation_status: 'accepted' }, status_history: history('held') };

  test('a held card waiting for its episode says so, linking to its evaluation', async () => {
    renderTab([WAITING]);
    expect((await screen.findByTestId('opp-held-why-text-o3')).textContent).toBe('Waits for The Gala to be completed. Offered if it lands, gone if it fails.');
    const link = screen.getByTestId('opp-held-why-o3').querySelector('a');
    expect(link.getAttribute('href')).toBe('/episodes/ep-1/evaluate');
  });

  test('one whose episode is completed but never settled says that, naming the episode by number', async () => {
    renderTab([STUCK]);
    expect((await screen.findByTestId('opp-held-why-text-o4')).textContent).toBe('Episode 1 is completed but this was never settled.');
    expect(screen.getByTestId('opp-offered-in-o4').textContent).toBe("Offered in S1 E1 · held until it's done");
    expect(screen.getByTestId('opp-held-why-o4').querySelector('a').getAttribute('href')).toBe('/episodes/ep-9/evaluate');
  });

  test('Release offer on the stuck one calls the endpoint without asking, and the card turns offered with Schedule as Event', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    api.post.mockResolvedValue({ data: { success: true, opportunity: { ...STUCK, status: 'offered', status_history: [...STUCK.status_history, { status: 'offered', note: 'Released by hand', tier: null, released: true }] } } });
    renderTab([STUCK]);
    fireEvent.click(await screen.findByTestId('opp-release-o4'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/opportunities/${SHOW}/o4/release`));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByTestId('opp-schedule-o4')).toBeTruthy();
    expect(screen.queryByTestId('opp-release-o4')).toBeNull();
    expect(screen.queryByTestId('opp-held-why-o4')).toBeNull();
    // Released by hand: Undo would go back to held, so it is not offered.
    expect(screen.queryByTestId('opp-undo-o4')).toBeNull();
    expect(toast).toHaveBeenCalledWith('Velour Ambassador is offered');
  });

  test('Release offer on one still waiting asks first; No sends nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab([WAITING]);
    fireEvent.click(await screen.findByTestId('opp-release-o3'));
    expect(confirm).toHaveBeenCalledWith("Offer Sable Campaign now? It is offered without waiting for The Gala's result. Beat 14 of The Gala still delivers it as the invitation.");
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Schedule as Event now shows only on held cards, and schedules after the confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab([OPEN, ACTIVE, WAITING]);
    await screen.findByTestId('opp-schedule-now-o3');
    expect(screen.queryByTestId('opp-schedule-now-o1')).toBeNull();
    expect(screen.queryByTestId('opp-schedule-now-o2')).toBeNull();
    expect(screen.queryByTestId('opp-schedule-o3')).toBeNull();
    fireEvent.click(screen.getByTestId('opp-schedule-now-o3'));
    expect(confirm).toHaveBeenCalledWith("Schedule Sable Campaign as an event now? It is offered and its event is created now, without waiting for The Gala's result. Beat 14 of The Gala still delivers it as the invitation.");
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    api.post.mockResolvedValue({ data: { success: true, data: { event_id: 'ev-9', guests: 0 } } });
    fireEvent.click(screen.getByTestId('opp-schedule-now-o3'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/feed-pipeline/${SHOW}/schedule/o3`));
    expect(await screen.findByText('✓ Event scheduled')).toBeTruthy();
    expect(screen.queryByTestId('opp-schedule-now-o3')).toBeNull();
  });
});

// Each one attached to an episode's beat 14 says which episode, by its code,
// and where it stands (Evoni, 2026-10-25).
describe('Offered in', () => {
  test('held, offered and expired, each linking to its episode; one never attached has no line', async () => {
    const ep5 = { id: 'ep-5', title: 'The Runway', episode_number: 5, season_number: 1 };
    const slotted = { id: 'ep-7', title: 'Second Act', episode_number: 25, season_number: 2, season_context: { label: 'S2 · E1' } };
    renderTab([
      { ...HELD, beat14_episode: ep5 },
      { id: 'o5', name: 'Velour Gifting', status: 'offered', opportunity_type: 'pr_gifting', offered_in_episode_id: 'ep-7', beat14_episode: slotted, status_history: history('held', 'offered') },
      { id: 'o6', name: 'Lost Panel', status: 'expired', opportunity_type: 'panel', offered_in_episode_id: 'ep-5', beat14_episode: ep5, status_history: history('held', 'expired') },
      OPEN,
    ]);
    const held = await screen.findByTestId('opp-offered-in-o3');
    expect(held.textContent).toBe("Offered in S1 E5 · held until it's done");
    expect(held.querySelector('a').getAttribute('href')).toBe('/episodes/ep-5?tab=scripts');
    expect(screen.getByTestId('opp-offered-in-o5').textContent).toBe('Offered in S2 · E1 · offered');
    expect(screen.getByTestId('opp-offered-in-o5').querySelector('a').getAttribute('href')).toBe('/episodes/ep-7?tab=scripts');
    expect(screen.getByTestId('opp-offered-in-o6').textContent).toBe('Offered in S1 E5 · expired');
    expect(screen.queryByTestId('opp-offered-in-o1')).toBeNull();
  });
});

/**
 * The season wrap-up (Evoni, 2026-10-26: Season page round 3) on the Results
 * tab: the plain recap from GET .../season/wrap-up, "Write the wrap-up" (one
 * AI call, nothing saved) into a textarea, and Save (PUT) only on Save.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MemoryRouter } from 'react-router-dom';
import SeasonWrapUp, { wrapUpPath } from './SeasonWrapUp';
import EpisodeLedger from './EpisodeLedger';
import { contrast, readToken } from '../../styles/contrast';

export const RECAP = {
  success: true,
  season: { arc_id: 'arc-1', season_number: 1, title: 'Soft Luxury Ascension', status: 'active', complete: false },
  next_season_number: 2,
  ready: true,
  episode_count: 3,
  finished_count: 2,
  goals: [
    { id: 'g1', title: 'Earn brand trust', icon: '🤝', status: 'completed', reached: true, current_value: 6, target_value: 6, metric_label: 'Brand Trust',
      main_events: [{ event_id: 'e1', name: 'Velvet Gala', code: 'E1', label: 'S1 · E1' }], also_helps: [], still_planned: 0 },
    { id: 'g2', title: 'Save 3,000 coins', icon: '🪙', status: 'active', reached: false, current_value: 1500, target_value: 3000, metric_label: 'Coins',
      main_events: [], also_helps: [{ event_id: 'e2', name: 'Paid runway', code: 'E2', label: 'S1 · E2' }], still_planned: 1 },
  ],
  goals_reached: [{ id: 'g1', title: 'Earn brand trust' }],
  best_episodes: [
    { id: 'ep2', title: 'Runway Rush', label: 'S1 · E2', tier: 'slay', score: 92 },
    { id: 'ep1', title: 'Gala Night', label: 'S1 · E1', tier: 'pass', score: 71 },
  ],
  money: { income: 2400, spend: 400, net: 2000, episodes_with_money: 2, top_earners: [{ episode_id: 'ep2', title: 'Runway Rush', income: 2400 }], top_spenders: [{ episode_id: 'ep1', title: 'Gala Night', spend: 400 }] },
  open_threads: [{ id: 't1', title: 'Who sent the roses', status: 'open' }],
  open_twists: [
    { id: 'w1', title: 'The torn invitation', status: 'planted', plant_label: 'S1 · E2', payoff_label: 'S1 · E9' },
    { id: 'w2', title: 'A second studio', status: 'planned', plant_label: 'S1 · E7', payoff_label: null },
  ],
  saved: null,
};

const makeApi = (recap = RECAP) => ({
  get: vi.fn(async () => ({ data: recap })),
  post: vi.fn(async () => ({ data: { success: true, draft: 'Lala reached brand trust at the Velvet Gala.' } })),
  put: vi.fn(async (url, body) => ({ data: { success: true, saved: { text: body.text, saved_at: '2026-10-26T12:00:00.000Z' } } })),
});

function renderWrap(api, route = '/shows/show-1/season?tab=results', setToast = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SeasonWrapUp showId="show-1" api={api} setToast={setToast} />
    </MemoryRouter>
  );
}

describe('Season wrap-up', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  test('the plain recap: goals with the events that moved them, best episodes, money and what is still open', async () => {
    const api = makeApi();
    renderWrap(api);
    expect(await screen.findByText('Season 1 wrap-up')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/wrap-up');
    const goals = screen.getByTestId('swu-goals');
    expect(goals.textContent).toContain('Earn brand trust');
    expect(goals.textContent).toContain('Reached');
    expect(goals.textContent).toContain('Main event: Velvet Gala (S1 · E1)');
    expect(goals.textContent).toContain('Also helped: Paid runway (S1 · E2)');
    expect(goals.textContent).toContain('1,500 of 3,000 Coins');
    const best = screen.getByTestId('swu-best');
    expect(best.textContent.indexOf('Runway Rush')).toBeLessThan(best.textContent.indexOf('Gala Night'));
    expect(best.textContent).toContain('Slay');
    const money = screen.getByTestId('swu-money');
    expect(money.textContent).toContain('2,400');
    expect(money.textContent).toContain('+2,000');
    const open = screen.getByTestId('swu-open');
    expect(open.textContent).toContain('Still open going into Season 2');
    expect(open.textContent).toContain('Who sent the roses');
    expect(open.textContent).toContain('Plant in S1 · E2 · pays off in S1 · E9');
    expect(open.textContent).toContain('Plant in S1 · E7 · no payoff yet');
    expect(screen.getByText(/2 of 3 episodes finished, 1 goal reached/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('reads the season shown (?season=N)', async () => {
    const api = makeApi();
    renderWrap(api, '/shows/show-1/season?tab=results&season=2');
    await screen.findByText('Season 1 wrap-up');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/wrap-up?season=2');
    expect(wrapUpPath('s', '2', '/draft')).toBe('/api/v1/world/s/season/wrap-up/draft?season=2');
    expect(wrapUpPath('s', 'bad')).toBe('/api/v1/world/s/season/wrap-up');
  });

  test('shows nothing before a finished episode', async () => {
    const api = makeApi({ ...RECAP, ready: false, finished_count: 0 });
    renderWrap(api);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('season-wrapup')).toBeNull();
  });

  test('a failed load says so and retries', async () => {
    const api = makeApi();
    api.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { data: { error: 'Server down' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWrap(api);
    expect((await screen.findByTestId('swu-load-error')).textContent).toContain('Server down');
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('Season 1 wrap-up')).toBeTruthy();
  });

  test('Write the wrap-up drafts into a textarea; nothing is saved until Save; Save keeps the edit', async () => {
    const api = makeApi();
    const setToast = vi.fn();
    renderWrap(api, undefined, setToast);
    fireEvent.click(await screen.findByTestId('swu-write'));
    const box = await screen.findByTestId('swu-text');
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/wrap-up/draft');
    expect(box.value).toBe('Lala reached brand trust at the Velvet Gala.');
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'Edited by Evoni.' } });
    fireEvent.click(screen.getByTestId('swu-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/wrap-up', { text: 'Edited by Evoni.' }));
    expect((await screen.findByTestId('swu-saved')).textContent).toContain('Edited by Evoni.');
    expect(screen.queryByTestId('swu-text')).toBeNull();
    expect(setToast).toHaveBeenCalledWith('Season wrap-up saved.');
    expect(screen.getByTestId('swu-write').textContent).toContain('Write it again');
  });

  test('Discard drops the draft without saving; a failed draft says why', async () => {
    const api = makeApi();
    renderWrap(api);
    fireEvent.click(await screen.findByTestId('swu-write'));
    await screen.findByTestId('swu-text');
    fireEvent.click(screen.getByTestId('swu-discard'));
    expect(screen.queryByTestId('swu-text')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValueOnce(Object.assign(new Error('429'), { response: { data: { error: 'AI daily budget exceeded. Nothing was drafted.' } } }));
    fireEvent.click(screen.getByTestId('swu-write'));
    expect((await screen.findByRole('alert')).textContent).toContain('budget');
    expect(screen.queryByTestId('swu-text')).toBeNull();
  });

  test('a saved wrap-up shows, opens for editing, and asks before a new draft replaces an edit', async () => {
    const api = makeApi({ ...RECAP, saved: { text: 'The saved recap.', saved_at: '2026-10-25T10:00:00.000Z' } });
    renderWrap(api);
    expect((await screen.findByTestId('swu-saved')).textContent).toContain('The saved recap.');
    fireEvent.click(screen.getByTestId('swu-edit'));
    const box = screen.getByTestId('swu-text');
    expect(box.value).toBe('The saved recap.');
    fireEvent.change(box, { target: { value: 'My own changes' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByTestId('swu-write'));
    expect(confirm).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(box.value).toBe('My own changes');
    fireEvent.click(screen.getByTestId('swu-discard'));
    expect(screen.getByTestId('swu-saved').textContent).toContain('The saved recap.');
  });

  test('colours only through tokens, and the button pairs hold 4.5:1', () => {
    const jsx = readFileSync(resolve(__dirname, 'SeasonWrapUp.jsx'), 'utf8');
    const css = readFileSync(resolve(__dirname, 'SeasonWrapUp.css'), 'utf8');
    const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
    expect(jsx).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'], ['--lala-ink', '--lala-gold'], ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'], ['--warning-text', '--warning-bg'], ['--lala-gold-text', '--surface-bg'],
    ]) {
      expect(contrast(readToken([tokens], fg), readToken([tokens], bg))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the Results tab\'s Episode Ledger shows it above the episode list', async () => {
    const api = makeApi();
    api.get.mockImplementation(async (url) => (url.includes('/season/wrap-up') ? { data: RECAP } : { data: {} }));
    render(
      <MemoryRouter initialEntries={['/shows/show-1/season?tab=results']}>
        <EpisodeLedger showId="show-1" api={api} episodes={[{ id: 'ep1', episode_number: 1, title: 'Gala Night' }]} />
      </MemoryRouter>
    );
    const wrap = await screen.findByTestId('season-wrapup');
    const row = screen.getByTestId('ledger-row-ep1');
    // eslint-disable-next-line no-bitwise
    expect(wrap.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

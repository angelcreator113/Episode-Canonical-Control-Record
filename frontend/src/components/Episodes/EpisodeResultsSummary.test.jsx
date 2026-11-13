/**
 * Results as one page (Evoni's Episode mock, 2026-10-05): how it went, the
 * money, Lala's stats and goals, and what viewers and her feed see.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import EpisodeResultsSummary, { ResultsShare } from './EpisodeResultsSummary';
import AuthContext from '../../contexts/AuthContext';

const MONEY = { lines: [{ key: 'fee', label: 'Reel fee (on approval)', signed: 439, state: 'pending' }, { key: 'entry', label: 'Entry (comped by host)', signed: -50, covered: true, state: 'covered' }], projection: { projected_net: 439, posted_net: 0, conditional: [] } };
const renderPage = (episode) => {
  const onOpenTab = vi.fn();
  render(<MemoryRouter><EpisodeResultsSummary episode={{ id: 'ep-1', show_id: 'show-1', ...episode }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
  return { onOpenTab };
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { designed_intent: 'pass' } } };
    if (url === '/api/v1/world/show-1/episodes/ep-1/money') return { data: { data: MONEY } };
    if (url === '/api/v1/characters/lala/state?show_id=show-1') return { data: { state: { coins: 1900, reputation: 8, brand_trust: 7, influence: 7, stress: 2 } } };
    if (url === '/api/v1/world/show-1/goals?status=active') return { data: { goals: [{ id: 'g1', title: 'Follow up with STUDIO BY SABLE', description: 'A reason to work together again', status: 'active' }] } };
    if (url === '/api/v1/feed-posts/episode/ep-1') return { data: { data: [] } };
    return { data: {} };
  });
});

describe('Results summary', () => {
  // Evoni, 2026-10-22 (Results layout): until it is completed, one card of
  // what fills in then, and the money; no "after Complete" rows.
  test('before Complete: one card of what fills in then (designed Pass), and the money as an estimate', async () => {
    renderPage({});
    const pending = screen.getByTestId('results-pending');
    expect(await within(pending).findByText('Pass')).toBeTruthy();
    expect(pending.textContent).toContain('Fills in at Complete');
    // Completing is offered here, on the episode (2026-11-12); with no signed-in admin in this render, it says who can.
    expect(within(pending).queryByText('Open the events')).toBeNull();
    expect(within(pending).getByTestId('results-complete-admin-only')).toBeTruthy();
    expect(screen.getByText('Not completed yet')).toBeTruthy();
    expect((await screen.findByTestId('results-net')).textContent).toBe('Net for the episodeestimate +439');
    expect(screen.getByText('Entry (comped by host)').closest('li').textContent).toContain('0 covered');
    for (const id of ['results-how', 'results-stats', 'results-goals', 'results-evaluation', 'results-share']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.queryByText(/after Complete/)).toBeNull();
  });

  test('after Complete: the actual tier, each stat change, the goals, and the evaluation under it', async () => {
    renderPage({ evaluation_json: { tier_final: 'slay', score: 91, stat_deltas: { coins: 439, stress: -1 }, breakdown: { outfit_match: { value: 30 } } } });
    expect(await within(screen.getByTestId('results-how')).findByText('Slay')).toBeTruthy();
    expect(screen.getByText('Completed · 91/100')).toBeTruthy();
    expect((await screen.findByTestId('results-stat-stress')).textContent).toContain('−1');
    expect(await screen.findByText('Follow up with STUDIO BY SABLE')).toBeTruthy();
    // Her goals are kept on the Season page's Goals tab (2026-10-25).
    expect(within(screen.getByTestId('results-goals')).getByRole('link', { name: "Open Lala's goals" }).getAttribute('href')).toBe('/shows/show-1/season?tab=goals');
    const evaluation = screen.getByTestId('results-evaluation');
    expect(within(evaluation).getByText('outfit match')).toBeTruthy();
    expect(within(evaluation).getByText('+30')).toBeTruthy();
  });

  test('share is on Distribution: a missing teaser says so and opens the Overview; Lala\'s posts link', async () => {
    const onOpenTab = vi.fn();
    render(<MemoryRouter><ResultsShare episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
    const teaser = screen.getByTestId('results-teaser');
    expect(teaser.textContent).toContain('Missing');
    fireEvent.click(within(teaser).getByRole('button', { name: 'Write teaser' }));
    expect(onOpenTab).toHaveBeenCalledWith('overview');
    expect(screen.getByText("Open Lala's posts").getAttribute('href')).toBe('/shows/show-1/world?tab=feed');
  });
});


describe('Complete episode, from the episode\'s own Results (Evoni, 2026-11-12)', () => {
  const ADMIN = { user: { id: 'u1', groups: ['admin'] } };
  const EDITOR = { user: { id: 'u2', groups: ['editor'] } };
  const refused = (status, data) => Object.assign(new Error('refused'), { response: { status, data } });
  let confirmSpy;
  const renderResults = ({ auth = ADMIN, episode = {}, onCompleted = vi.fn(async () => {}) } = {}) => {
    const onOpenTab = vi.fn();
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <EpisodeResultsSummary episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala Night', ...episode }} showId="show-1" onOpenTab={onOpenTab} onCompleted={onCompleted} />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    return { onOpenTab, onCompleted };
  };

  beforeEach(() => {
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: { success: true, data: { evaluation: { tier: 'pass', score: 71 } } } });
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('an episode not completed yet offers Complete here; it no longer sends her to the event in Producer Mode', async () => {
    renderResults();
    expect(await screen.findByTestId('results-complete-btn')).toBeTruthy();
    expect(screen.getByTestId('results-pending').textContent).not.toMatch(/from its event in Producer Mode/);
    expect(screen.queryByText('Open the events')).toBeNull();
  });

  test('it needs only the episode: no event, and no link from an event back to the episode, is read to offer it', async () => {
    renderResults({ episode: { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' } });
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    await screen.findByTestId('results-complete-notice');
    expect(vi.mocked(api.post).mock.calls).toEqual([['/api/v1/world/show-1/episodes/ep-1/complete']]);
    expect(vi.mocked(api.get).mock.calls.some(([url]) => /\/events/.test(url))).toBe(false);
  });

  test('completed: the page reloads the episode for the stored result, and says the result shown is the stored one', async () => {
    const { onCompleted } = renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    expect((await screen.findByTestId('results-complete-notice')).textContent).toBe('Completed. The result below is the one stored for this episode.');
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('results-complete-refusal')).toBeNull();
  });

  test('cancelled at the question: nothing is sent', async () => {
    confirmSpy.mockReturnValue(false);
    renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    await new Promise((r) => setTimeout(r, 10));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('already completed: said as that, the stored result reloaded, never an error', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { already_completed: true } } });
    const { onCompleted } = renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    expect((await screen.findByTestId('results-complete-notice')).textContent).toBe('This episode was already completed. Nothing was booked again.');
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('a refusal stays on screen in the server\'s words, with where to resolve it, until dismissed', async () => {
    vi.mocked(api.post).mockRejectedValue(refused(400, { success: false, error: 'This would take Lala to -120 coins.', code: 'INSUFFICIENT_COINS' }));
    const { onOpenTab, onCompleted } = renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Not enough coins to complete');
    expect(alert.textContent).toContain('This would take Lala to -120 coins.');
    expect(alert.textContent).toContain('Nothing was booked.');
    expect(onCompleted).not.toHaveBeenCalled();
    // It does not go away by itself.
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByTestId('results-complete-action'));
    expect(onOpenTab).toHaveBeenCalledWith('money');
    fireEvent.click(screen.getByTestId('results-complete-dismiss'));
    expect(screen.queryByRole('alert')).toBeNull();
    // The button is still there to try again once resolved.
    expect(screen.getByTestId('results-complete-btn').disabled).toBe(false);
  });

  test('a refusal that names a page links to it (reopened terms: the event package)', async () => {
    vi.mocked(api.post).mockRejectedValue(refused(409, { success: false, error: 'The terms are reopened.', code: 'EVENT_TERMS_REOPENED', event: { id: 'ev-7' } }));
    renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    const link = await screen.findByTestId('results-complete-action');
    expect(link.getAttribute('href')).toBe('/shows/show-1/events/ev-7');
  });

  test('a lock conflict offers Try again, which sends the same request again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(refused(409, { success: false, error: 'Someone else changed this at the same moment. Nothing was saved: try again.', code: 'RETRY' }));
    renderResults();
    fireEvent.click(await screen.findByTestId('results-complete-btn'));
    fireEvent.click(await screen.findByTestId('results-complete-action'));
    await screen.findByTestId('results-complete-notice');
    expect(vi.mocked(api.post).mock.calls).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('someone who is not an admin is told so and has no button; the server refuses them too', async () => {
    renderResults({ auth: EDITOR });
    expect((await screen.findByTestId('results-complete-admin-only')).textContent).toMatch(/Only an admin can complete an episode/);
    expect(screen.queryByTestId('results-complete-btn')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a completed episode shows its result and no Complete button', async () => {
    renderResults({ episode: { evaluation_status: 'accepted', evaluation_json: { tier_final: 'pass', score: 71 } } });
    await screen.findByTestId('results-how');
    expect(screen.queryByTestId('results-complete-btn')).toBeNull();
  });
});

/**
 * Results → Evaluation and Results → Story (the Results redesign,
 * 2026-10-08): what they show, and Story's generate buttons say what
 * happened without editing the page by hand.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import { EpisodeResultsEvaluation, EpisodeResultsStory } from './EpisodeResultsPages';

const EVAL = {
  tier_final: 'pass', score: 78, narrative_lines: { short: 'Lala held her own.' },
  breakdown: { outfit_match: { value: 22, detail: 'Black tie' }, financials: { value: -4, detail: 'Over budget' } },
  stat_deltas: { coins: 150, stress: 2 },
  social_task_bonuses: { detail: { total: 3, completed: 2, completion_rate: 67 } },
  financial_summary: { total_income: 300, total_expenses: 160 },
};
const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  // Results → Story loads the episode's story record (EpisodeStoryRecord).
  vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url.endsWith('/canon')
    ? { stories: [], pending: 0 } : { record: null, cast: [], threads: [] } }));
});

describe('Results → Evaluation', () => {
  test('milestone attribution: nothing is shown when the completion had none to record', () => {
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: JSON.stringify(EVAL) }} />);
    expect(screen.queryByTestId('results-milestone-attribution')).toBeNull();
  });

  test.each([[false], [true]])('milestone attribution as stored (embedded: %s): decided by an admin, with the reward, the decision, who and when', (embedded) => {
    const attribution = { status: 'DECIDED', candidates: [
      { tx_id: 'tx-1', goal_id: 'rising-star', label: 'Rising Star', threshold: 1500, amount: 200, reason: 'in_range', decision: 'not_this_episode', decided_by: { id: 'u1', name: 'Evoni' }, decided_at: '2026-11-13T18:00:00.000Z' },
      { tx_id: 'tx-2', goal_id: 'old', label: null, threshold: null, amount: 50, reason: 'range_unknown', decision: 'this_episode', decided_by: { id: 'u1', name: null }, decided_at: '2026-11-13T18:00:00.000Z' },
    ] };
    renderIn(<EpisodeResultsEvaluation embedded={embedded} episode={{ id: 'ep-1', evaluation_json: JSON.stringify({ ...EVAL, milestone_attribution: attribution }) }} />);
    const block = screen.getByTestId('results-milestone-attribution');
    expect(within(block).getByTestId('results-milestone-status').textContent).toBe('Decided by an admin');
    const first = within(block).getByTestId('results-milestone-row-tx-1');
    expect(first.textContent).toContain('Rising Star · 200 coins · goal at 1,500');
    expect(first.textContent).toContain('Not this episode\'s');
    expect(first.textContent).toContain('Evoni');
    const second = within(block).getByTestId('results-milestone-row-tx-2');
    expect(second.textContent).toContain('old · 50 coins · this episode\'s balance movement could not be rebuilt');
    expect(second.textContent).toContain('This episode\'s');
    expect(second.textContent).toContain('u1');
  });

  test('milestone attribution left unverified says so, and that it was not guessed', () => {
    const attribution = { status: 'UNVERIFIED', candidates: [{ tx_id: 'tx-1', goal_id: 'g', label: 'Rising Star', threshold: 1500, amount: 200, reason: 'in_range', decision: null }] };
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: JSON.stringify({ ...EVAL, milestone_attribution: attribution }) }} />);
    const block = screen.getByTestId('results-milestone-attribution');
    expect(within(block).getByTestId('results-milestone-status').textContent).toBe('Unverified');
    expect(block.textContent).toContain('it was not guessed');
    expect(within(block).getByTestId('results-milestone-row-tx-1').textContent).toContain('Undecided');
  });

  test('not evaluated: says so', () => {
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1' }} />);
    expect(screen.getByTestId('results-evaluation-empty').textContent).toContain('Not evaluated yet');
  });

  test('the verdict, the breakdown, stat changes and the money', () => {
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: JSON.stringify(EVAL) }} />);
    const page = screen.getByTestId('results-evaluation');
    expect(page.textContent).toContain('Pass');
    expect(page.textContent).toContain('78/100');
    expect(page.textContent).toContain('Lala held her own.');
    expect(within(page).getByText('outfit match').closest('li').textContent).toContain('+22');
    expect(within(page).getByText('financials').closest('li').textContent).toContain('-4');
    // Stress going up is bad; coins going up is good.
    expect(within(page).getByText('Stress').closest('.ers-delta').className).toContain('is-bad');
    expect(within(page).getByText('Coins').closest('.ers-delta').className).toContain('is-good');
    expect(page.textContent).toContain('2/3');
    expect(within(page).getByText('Net').closest('li').textContent).toContain('+140');
  });

  test('evaluation JSON that does not parse reads as not evaluated', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: '{nope' }} />);
    expect(screen.getByTestId('results-evaluation-empty')).toBeTruthy();
  });
});

describe('Results → Story', () => {
  test('a format generates, says it is writing, then that it is done', async () => {
    let resolve;
    vi.mocked(api.post).mockImplementation(() => new Promise((r) => { resolve = r; }));
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    fireEvent.click(screen.getByTestId('results-story-snippet'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/generate-story', { format: 'snippet' });
    expect(screen.getByTestId('results-story-snippet').textContent).toContain('Writing…');
    expect(screen.getByTestId('results-story-recap').disabled).toBe(true);
    resolve({ data: { success: true } });
    await waitFor(() => expect(screen.getByTestId('results-story-snippet').textContent).toContain('Done · in Stories'));
    expect(screen.getByTestId('results-story-recap').disabled).toBe(false);
  });

  test('a failure says so and can be tried again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Budget reached' } } });
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    fireEvent.click(screen.getByTestId('results-story-recap'));
    await screen.findByText('Budget reached');
    expect(screen.getByTestId('results-story-recap').textContent).toContain('Failed · try again');
  });

  test('the path starts with the story record', async () => {
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    expect(await screen.findByRole('button', { name: /Read the finished script/ })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/book-from-show/episodes/ep-1/record');
  });

  test('the Stories Library is a link', () => {
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    expect(screen.getByRole('link', { name: /Open Stories Library/ }).getAttribute('href')).toBe('/stories');
  });
});

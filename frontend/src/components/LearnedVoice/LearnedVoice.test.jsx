/**
 * Character voices that learn (Evoni, 2026-10-25): the Voice & Pulse tab's
 * "How they really sound" and "Learned voice", and her Your voice page.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import LearnedVoice from './LearnedVoice';
import YourVoicePage from '../../pages/YourVoicePage';
import { voiceKeyOf, groupRules, newestLines, learnSummary, isVoiceNotReady } from '../../lib/characterVoice';

const VOICE = {
  characterKey: 'lala', name: 'Lala', profile_voice: null,
  rules: [
    { id: 1, rule_text: 'Keeps it to two sentences', rule_type: 'length', context: 'gameplay', status: 'proposed', size: 'major', auto_applied: false, from_episode_number: 4, signal_count: 3, example_original: 'I love it. It is perfect. Truly.', example_edited: 'I love it. Perfect.', check_json: { type: 'max_sentences', n: 2 }, created_at: '2026-10-20' },
    { id: 2, rule_text: 'Says "bestie" instead of "friend"', context: 'cutscene', status: 'active', size: 'small', auto_applied: true, from_episode_number: 5, signal_count: 1, created_at: '2026-10-21' },
    { id: 3, rule_text: 'Never apologises first', context: null, status: 'active', size: 'major', auto_applied: false, from_episode_number: 2, created_at: '2026-10-10' },
    { id: 4, rule_text: 'Long dreamy monologues', context: 'gameplay', status: 'superseded', from_episode_number: 1, created_at: '2026-09-01' },
    { id: 5, rule_text: 'Dismissed one', status: 'dismissed', created_at: '2026-10-01' },
  ],
  lines: [
    { id: 'l1', text: 'Okay bestie, we are going.', context: 'gameplay', episode_number: 5, beat_number: 6, source: 'approved', created_at: '2026-10-22' },
    { id: 'l2', text: 'The night remembers us.', context: 'narration', episode_number: null, beat_number: null, source: 'book', created_at: '2026-10-23' },
  ],
  counts: {},
};

const show = (props = {}) => render(<MemoryRouter><LearnedVoice characterKey="lala" name="Lala" {...props} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: VOICE });
  vi.mocked(api.post).mockResolvedValue({ data: { ok: true } });
});

describe('Learned voice', () => {
  test('how they really sound, waiting, applied, approved and the timeline', async () => {
    show();
    const lines = await screen.findByTestId('lv-lines');
    expect(api.get).toHaveBeenCalledWith('/api/v1/voice/characters/lala');
    // Newest first, with context and where.
    const items = within(lines).getAllByRole('listitem');
    expect(items[0].textContent).toContain('The night remembers us.');
    expect(items[0].textContent).toContain('Narration');
    expect(items[0].textContent).toContain('Book');
    expect(items[1].textContent).toContain('Gameplay');
    expect(items[1].textContent).toContain('Episode 5 · beat 6');

    const waiting = screen.getByTestId('lv-waiting');
    expect(waiting.textContent).toContain('Keeps it to two sentences');
    expect(waiting.textContent).toContain('AI wroteI love it. It is perfect. Truly.');
    expect(waiting.textContent).toContain('You changed it toI love it. Perfect.');
    expect(waiting.textContent).toContain('from episode 4 · 3 edits');
    expect(screen.getByTestId('lv-auto').textContent).toContain('Says "bestie" instead of "friend"');
    expect(screen.getByTestId('lv-active').textContent).toContain('Never apologises first');
    expect(screen.getByTestId('lv-active').textContent).toContain('Everywhere');
    expect(document.body.textContent).not.toContain('Dismissed one');

    // Earlier (grown out of) starts folded.
    const fold = screen.getByRole('button', { name: /Earlier \(grown out of\)/ });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Long dreamy monologues')).toBeNull();
    fireEvent.click(fold);
    expect(screen.getByTestId('lv-earlier').textContent).toContain('Episode 1Long dreamy monologues');
  });

  test('the context filter narrows lines and rules; rules for everywhere stay', async () => {
    show();
    await screen.findByTestId('lv-lines');
    fireEvent.click(screen.getByRole('button', { name: 'Cutscene' }));
    expect(screen.getByRole('button', { name: 'Cutscene' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('lv-lines')).toBeNull();
    expect(screen.queryByTestId('lv-waiting')).toBeNull();
    expect(screen.getByTestId('lv-auto')).toBeTruthy();
    expect(screen.getByTestId('lv-active').textContent).toContain('Never apologises first');
  });

  test('Approve, Dismiss and Undo post and reload', async () => {
    show();
    await screen.findByTestId('lv-waiting');
    fireEvent.click(within(screen.getByTestId('lv-rule-1')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/voice/rules/1/approve'));
    await waitFor(() => expect(screen.getByTestId('lv-status').textContent).toContain('Approved'));
    expect(api.get).toHaveBeenCalledTimes(2);

    fireEvent.click(within(screen.getByTestId('lv-rule-1')).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/voice/rules/1/dismiss'));
    await waitFor(() => expect(screen.getByTestId('lv-status').textContent).toBe('Dismissed.'));

    fireEvent.click(within(screen.getByTestId('lv-rule-2')).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/voice/rules/2/undo'));
    await waitFor(() => expect(screen.getByTestId('lv-status').textContent).toContain('Undone'));
  });

  test('an action that fails says so and logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Rule is gone' } } }));
    show();
    await screen.findByTestId('lv-waiting');
    fireEvent.click(within(screen.getByTestId('lv-rule-1')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByTestId('lv-status').textContent).toBe('Rule is gone'));
    expect(err).toHaveBeenCalledWith('[LearnedVoice] approve failed:', expect.any(Error));
    err.mockRestore();
  });

  test('Learn now says what it learned and reloads', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { proposed: 1, applied: [{ id: 9 }] } });
    show();
    await screen.findByTestId('lv-lines');
    fireEvent.click(screen.getByTestId('lv-learn'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/voice/learn/lala');
    expect(await screen.findByTestId('lv-learn-result')).toHaveProperty('textContent', '2 new rules: 1 applied, 1 waiting for you');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('Learn now rate-limited says to wait', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 429 } }));
    show();
    await screen.findByTestId('lv-lines');
    fireEvent.click(screen.getByTestId('lv-learn'));
    await waitFor(() => expect(screen.getByTestId('lv-status').textContent).toContain('try again in a minute'));
    err.mockRestore();
  });

  test('nothing learned yet says how to start', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { characterKey: 'marcus', name: 'Marcus', rules: [], lines: [] } });
    show({ characterKey: 'marcus', name: 'Marcus' });
    expect((await screen.findByTestId('lv-empty')).textContent).toContain('Nothing learned yet');
    expect(screen.getByTestId('lv-learn')).toBeTruthy();
  });

  test.each([404, 409])('the database update not run (%i) is a plain note', async (status) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('x'), { response: { status, data: { code: 'MIGRATION_PENDING' } } }));
    show();
    expect((await screen.findByTestId('lv-not-ready')).textContent).toContain("database update that adds them hasn't run");
    expect(screen.queryByTestId('lv-learn')).toBeNull();
    err.mockRestore();
  });

  test('another failure offers Try again', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }));
    show();
    await screen.findByTestId('lv-error');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('lv-lines')).toBeTruthy();
    err.mockRestore();
  });

  test('Your voice page loads hers as justawoman', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { characterKey: 'justawoman', name: 'JustAWoman', rules: [], lines: [{ id: 'x', text: 'I built this.', context: 'narration', source: 'book', created_at: '2026-10-01' }] } });
    render(<MemoryRouter><YourVoicePage /></MemoryRouter>);
    expect(await screen.findByText('How you really sound')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/voice/characters/justawoman');
    expect(screen.getByRole('heading', { name: 'Your voice, learned' })).toBeTruthy();
  });
});

describe('lib/characterVoice', () => {
  test('voiceKeyOf: her names, Lala, the slug, the name', () => {
    expect(voiceKeyOf({ character_key: 'JustAWoman' })).toBe('justawoman');
    expect(voiceKeyOf({ character_key: 'prime_x', display_name: 'JAWIHP' })).toBe('justawoman');
    expect(voiceKeyOf({ character_key: 'just_a_woman_in_her_prime' })).toBe('justawoman');
    expect(voiceKeyOf({ character_key: 'lala_main', display_name: 'Lala' })).toBe('lala');
    expect(voiceKeyOf({ character_key: 'marcus_reid', display_name: 'Marcus' })).toBe('marcus_reid');
    expect(voiceKeyOf({ display_name: 'Studio by Sable' })).toBe('studio_by_sable');
    expect(voiceKeyOf(null)).toBeNull();
  });
  test('groupRules, newestLines, learnSummary, isVoiceNotReady', () => {
    const g = groupRules(VOICE.rules);
    expect([g.waiting, g.autoApplied, g.active, g.earlier].map((l) => l.map((r) => r.id))).toEqual([[1], [2], [3], [4]]);
    expect(groupRules(null).waiting).toEqual([]);
    expect(newestLines(VOICE.lines, 'gameplay').map((l) => l.id)).toEqual(['l1']);
    expect(learnSummary({ proposed: 0, applied: 1 })).toBe('1 new rule: 1 applied, 0 waiting for you');
    expect(learnSummary({})).toBe('Nothing new to learn yet.');
    expect(isVoiceNotReady({ response: { status: 409 } })).toBe(true);
    expect(isVoiceNotReady({ response: { status: 500 } })).toBe(false);
  });
});

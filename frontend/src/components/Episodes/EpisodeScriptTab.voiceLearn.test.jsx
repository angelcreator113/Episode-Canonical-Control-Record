/**
 * Character voices that learn (Evoni, 2026-10-25) on the Script tab: a kept
 * rewrite is a signal to the speaker's voice (fire-and-forget), and "Ready
 * to film?" flags lines that break a learned rule the script can check.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { sendRewriteSignal } from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nMe: Hi besties.\nLala: I love it. This is it. Truly it. Literally.\n\n## BEAT: 2 · Login Sequence\nMe: Logging in.\nMarcus: Hey there.';
const RULES = [
  { id: 11, characterKey: 'lala', rule_text: 'Keeps it short', context: 'gameplay', check_json: { type: 'max_sentences', n: 2 } },
  { id: 12, characterKey: 'marcus', rule_text: 'Never says hey', context: null, check_json: { type: 'banned_word', word: 'hey' } },
];
const renderTab = (script = SCRIPT) => {
  const r = render(
    <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
  );
  const toggle = screen.queryByTestId('script-health-toggle');
  if (toggle?.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
  return r;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
});

describe('sendRewriteSignal', () => {
  test('posts the speaker, her line and the one she kept', async () => {
    await sendRewriteSignal('ep-1', 4, 'Lala: "Old words."', 'Lala: "New words."');
    expect(api.post).toHaveBeenCalledWith('/api/v1/voice/signals', { episodeId: 'ep-1', beatNumber: 4, speaker: 'Lala', original: 'Old words.', edited: 'New words.' });
  });

  test('a failure is logged, never thrown', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }));
    await expect(sendRewriteSignal('ep-1', 1, 'Me: a', 'Me: b')).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith('[EpisodeScript] voice signal failed:', expect.any(Error));
    // A mock that returns nothing (no promise) is caught too.
    vi.mocked(api.post).mockReturnValueOnce(undefined);
    expect(() => sendRewriteSignal('ep-1', 1, 'Me: a', 'Me: c')).not.toThrow();
    err.mockRestore();
  });

  test('nothing is sent without an episode, a speaker or a change', () => {
    expect(sendRewriteSignal(null, 1, 'Me: a', 'Me: b')).toBeNull();
    expect(sendRewriteSignal('ep-1', 1, '(She sits.)', '(She stands.)')).toBeNull();
    expect(sendRewriteSignal('ep-1', 1, 'Me: same', 'Me: same')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Ready to film? voice drift', () => {
  test('flags lines that break a learned rule, mapping speakers with /voice/speakers', async () => {
    vi.mocked(api.get).mockImplementation(async (url, opts) => {
      if (url === '/api/v1/voice/episode/ep-1/rules') return { data: RULES };
      if (url === '/api/v1/voice/speakers') {
        expect(opts).toEqual({ params: { episodeId: 'ep-1' } });
        return { data: [{ speaker: 'Marcus', characterKey: 'marcus', name: 'Marcus' }] };
      }
      return { data: { data: [] } };
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-health-voice-drift-11-beat-1').textContent).toContain('Lala usually keeps it to 2 sentences — beat 1, line 2'));
    expect(screen.getByTestId('script-health-voice-drift-12-beat-2').textContent).toContain("Marcus doesn't say “hey” — beat 2, line 2");
    fireEvent.click(screen.getByTestId('script-health-open-voice-drift-12-beat-2'));
    expect(screen.getByTestId('script-beat-2').className).toContain('is-open');
    expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === '/api/v1/voice/episode/ep-1/rules')).toHaveLength(1);
  });

  test('a low note (a phrase not heard lately) shows but is not counted', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/voice/episode/ep-1/rules'
      ? { data: [{ id: 13, characterKey: 'justawoman', check_json: { type: 'uses_phrase', phrase: 'besties', every_n_lines: 1 } }] }
      : { data: { data: [] } }));
    renderTab('## BEAT: 1 · Opening Ritual\nMe: Hi there.');
    const row = await screen.findByTestId('script-health-voice-drift-low-13');
    expect(row.className).toBe('is-low');
    expect(row.textContent).toContain('JustAWoman usually says “besties”');
  });

  test('the endpoints missing (not ready) changes nothing and logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url).startsWith('/api/v1/voice/')) throw Object.assign(new Error('nf'), { response: { status: 404 } });
      return { data: { data: [] } };
    });
    renderTab();
    await waitFor(() => expect(err).toHaveBeenCalledWith('[EpisodeScriptTab] voice rules not loaded:', expect.any(Error)));
    expect(err).toHaveBeenCalledWith('[EpisodeScriptTab] voice speakers not loaded:', expect.any(Error));
    expect(screen.getByTestId('script-health')).toBeTruthy();
    expect(document.querySelector('[data-testid^="script-health-voice-drift"]')).toBeNull();
    err.mockRestore();
  });
});

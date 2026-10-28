// Her learned reading pace (Evoni, 2026-10-28): her full-episode take with
// beat markers teaches it; the Script tab's timings and the teleprompter's
// use it, with a switch back to the standard 150, and plain words while
// there are too few takes.
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader from '../components/Teleprompter/TeleprompterReader';
import EpisodeScriptTab from '../components/Episodes/EpisodeScriptTab';
import { learnedPace, NOT_ENOUGH } from '../lib/learnedPace';
import { teleprompterScript } from '../lib/teleprompterLines';
import { scriptSeconds, formatRuntime } from '../lib/scriptRuntime';

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
// Three beats: 100 of her words (40 s at 150), Lala's 15 (6 s), a tap (3 s).
const beat = (n, name) => [`## BEAT: ${n} · ${name}`, `Me: ${words(100)}`, `Lala: ${words(15)}`, '[UI:OPEN closet]'].join('\n');
const SCRIPT = [beat(1, 'Opening Ritual'), beat(2, 'Login Sequence'), beat(3, 'Welcome')].join('\n\n');
// Each beat really took 41 s: 9 s for Lala and the tap, 32 s for her 100
// words: 0.8 of the estimate, 188 words a minute.
const TAKE = {
  id: 'take-1', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 125,
  beat_marks: [{ beat: 1, t: 2 }, { beat: 2, t: 43 }, { beat: 3, t: 84 }],
};

let stored;
const mockApi = (clips) => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-clips/ep-1') return { data: { data: clips } };
    if (url === '/api/v1/shows/show-1/reading-pace') return { data: { success: true, data: stored } };
    return { data: { data: [] } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (url !== '/api/v1/shows/show-1/reading-pace') return { data: {} };
    const mine = stored.justawoman || { use: 'mine', episodes: {} };
    if (body.use) mine.use = body.use;
    if (body.episode_id) mine.episodes = { ...mine.episodes, [body.episode_id]: { ratios: body.ratios, takes: body.takes, at: '2026-10-28T12:00:00Z' } };
    stored = { ...stored, justawoman: mine };
    return { data: { success: true, data: stored } };
  });
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  stored = {};
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('learned pace: the figures', () => {
  test('the take gives 188 words a minute from three beats', () => {
    const { beats } = teleprompterScript(SCRIPT);
    const p = learnedPace(beats, [TAKE]);
    expect(p).toMatchObject({ wpm: 188, factor: 0.8, beatsUsed: 3, takesUsed: 1, confident: true });
    expect(p.beatTimes).toEqual({ 1: 41, 2: 41, 3: 41 });
  });
});

describe('learned pace on the Script tab', () => {
  const renderTab = () => render(
    <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
  );

  test('learns her pace from the take, saves it on the show, and the timings use it until she switches back', async () => {
    mockApi([TAKE]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-pace-text').textContent).toBe('Your pace: 188 words/min (from 1 take) — timings use it'));
    expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/reading-pace', expect.objectContaining({ performer: 'justawoman', episode_id: 'ep-1', ratios: [0.8, 0.8, 0.8], takes: 1 }));
    const beats = teleprompterScript(SCRIPT).beats.map((b) => ({ lines: b.raw }));
    const mine = formatRuntime(scriptSeconds(beats, { wpm: 188 }));
    const standard = formatRuntime(scriptSeconds(beats));
    expect(mine).not.toBe(standard);
    expect(screen.getByTestId('script-runtime').textContent).toBe(mine);
    expect(screen.getByTestId('reading-pace-mine').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('reading-pace-standard'));
    expect(screen.getByTestId('script-runtime').textContent).toBe(standard);
    expect(screen.getByTestId('reading-pace-text').textContent).toBe('Your pace: 188 words/min (from 1 take) — timings use the standard 150');
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/reading-pace', { performer: 'justawoman', use: 'standard' }));
    fireEvent.click(screen.getByTestId('reading-pace-mine'));
    expect(screen.getByTestId('script-runtime').textContent).toBe(mine);
  });

  test('"Ready to film?" says whose pace its running time uses', async () => {
    mockApi([TAKE]);
    renderTab();
    const toggle = screen.queryByTestId('script-health-toggle');
    if (toggle?.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByTestId('script-health').textContent).toContain('your lines at your pace, 188 words a minute; others at 150'));
  });

  test('with no take to learn from: the standard estimate, in plain words', async () => {
    mockApi([]);
    renderTab();
    expect(screen.getByTestId('reading-pace').textContent).toContain(NOT_ENOUGH);
    const beats = teleprompterScript(SCRIPT).beats.map((b) => ({ lines: b.raw }));
    expect(screen.getByTestId('script-runtime').textContent).toBe(formatRuntime(scriptSeconds(beats)));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reading-pace-mine')).toBeNull();
  });

  test('the show-wide pace from another episode is used here too', async () => {
    stored = { justawoman: { use: 'mine', episodes: { 'ep-0': { ratios: [0.75, 0.75, 0.75, 0.75], takes: 2, at: '2026-10-20T00:00:00Z' } } } };
    mockApi([]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-pace-text').textContent).toBe('Your pace: 200 words/min (from 2 takes) — timings use it'));
  });

  test('the show cannot be reached: the copy on this device is used', async () => {
    window.localStorage.setItem('lala.readingPace.v1.show-1', JSON.stringify({ justawoman: { use: 'mine', episodes: { 'ep-0': { ratios: [0.75, 0.75, 0.75], takes: 1 } } } }));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('reading-pace')) throw new Error('offline');
      return { data: { data: [] } };
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTab();
    expect(screen.getByTestId('reading-pace-text').textContent).toBe('Your pace: 200 words/min (from 1 take) — timings use it');
    await waitFor(() => expect(err).toHaveBeenCalled());
    err.mockRestore();
  });
});

describe('learned pace on the teleprompter', () => {
  const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', showId: 'show-1', title: 'Ep 1' };

  test('each beat shows the estimate against her takes, and the switch is in the settings', async () => {
    mockApi([TAKE]);
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    // At her pace: 100 words at 188 (32 s) + 9 s = 0:41.
    await waitFor(() => expect(screen.getByTestId('stp-beat-pace-1').textContent).toBe('estimated 0:41 · your takes 0:41'));
    expect(screen.getByTestId('stp-reading-pace-text').textContent).toContain('Your pace: 188 words/min');
    fireEvent.click(screen.getByTestId('stp-reading-pace-standard'));
    expect(screen.getByTestId('stp-beat-pace-1').textContent).toBe('estimated 0:49 · your takes 0:41');
  });

  test('with no takes: no beat times, and the plain line', async () => {
    mockApi([]);
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
    expect(screen.queryByTestId('stp-beat-pace-1')).toBeNull();
    expect(screen.getByTestId('stp-reading-pace').textContent).toContain(NOT_ENOUGH);
  });
});

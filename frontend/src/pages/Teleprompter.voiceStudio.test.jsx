// B2b (Evoni, 2026-10-28): with Voice Studio on, the Teleprompter plays only
// the current approved takes from the playable list, each from its approved
// trim; every other line is silent and says why; the old voice clips never
// play, not even for the same words. Voice Studio off: the old clips play as
// before. Cutscene lines and Prime's own lines never play a take.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { resetVoiceStudioStatus } from '../lib/voiceStudioApi';
import { studioVoice, SILENT } from '../lib/teleprompterVoiceStudio';

const SCRIPT = [
  '## BEAT: 8 · Transformation Loop',
  'Lala: "Gorgeous darling, truly gorgeous."',
  'Guest: "Love the look!"',
  'Lala: "Spin for me."',
  'JustAWoman: "This is the one."',
  '## BEAT: 12 · The Cutscene',
  'Lala: "Watch this."',
].join('\n');
const REV = 'sr1-abc';
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', scriptRevision: REV, title: 'Ep 3' };

const take = (beat, line, extra = {}) => ({
  approval_id: `a-${beat}-${line}`, beat_number: beat, line_index: line, candidate_id: 'c', revision_id: 'r',
  in_ms: 1200, out_ms: 3700, s3_key: `k-${beat}-${line}`, audio_url: `https://bucket/vs-${beat}-${line}.wav`, ...extra,
});
// Legacy clips for every line, the same words: none of them may play with Voice Studio on.
const LEGACY = [
  { id: 'v0', beat_number: 8, line_index: 0, speaker: 'Lala', line_text: 'Gorgeous darling, truly gorgeous.', url: 'https://bucket/legacy-0.webm', duration_seconds: 7.5 },
  { id: 'v1', beat_number: 8, line_index: 1, speaker: 'Guest', line_text: 'Love the look!', url: 'https://bucket/legacy-1.webm', duration_seconds: 2 },
  { id: 'v2', beat_number: 8, line_index: 2, speaker: 'Lala', line_text: 'Spin for me.', url: 'https://bucket/legacy-2.webm', duration_seconds: 2 },
];

let audios;
class FakeAudio {
  constructor(src) {
    this.src = src; this.paused = true; this.listeners = {}; this.readyState = 0; this.currentTime = 0; this.seeks = [];
    this.play = vi.fn(async () => { if (playRefused) throw new Error('NotAllowedError'); this.paused = false; });
    this.pause = vi.fn(() => { this.paused = true; });
    audios.push(this);
  }
  set currentTime(v) { this._t = v; this.seeks?.push(v); }
  // With a running clock (set by a test) the time moves on as a real element's would.
  get currentTime() { return this._clock ? this._clock.from + (Date.now() - this._clock.start) / 1000 : this._t; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn); }
  emit(name) { (this.listeners[name] || []).forEach((f) => f()); }
  meta() { this.readyState = 1; this.emit('loadedmetadata'); }
  at(seconds) { this._t = seconds; this.emit('timeupdate'); }
}

class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType || 'audio/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'audio/webm;codecs=opus';

let status; // 'on' | 'off' | 'error'
let playable;
let playRefused;
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/voice-studio/status') {
      if (status === 'on') return { data: { success: true, data: { on: true } } };
      const e = new Error(status === 'off' ? '404' : 'Network Error');
      if (status === 'off') e.response = { status: 404, data: { code: 'VOICE_STUDIO_OFF' } };
      throw e;
    }
    if (url === '/api/v1/voice-studio/ep-1/playable') {
      if (playable instanceof Error) throw playable;
      return { data: { success: true, data: playable } };
    }
    if (url === '/api/v1/script-voice-clips/ep-1') return { data: { data: LEGACY } };
    return { data: { data: [] } };
  });
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  resetVoiceStudioStatus();
  status = 'on';
  playRefused = false;
  playable = { script_revision: REV, takes: [take(8, 0), take(12, 0), take(8, 3)], held: [{ approval_id: 'h1', beat_number: 8, line_index: 1, state: 'needs_review', reason_text: 'The script was saved since this take was approved or re-confirmed. Check it still fits.' }] };
  audios = [];
  mockApi();
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines' }));
  window.Audio = FakeAudio;
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (url.endsWith('/sources')) return { data: { data: { source: { id: 's-new' } } } };
    if (url.endsWith('/candidates')) return { data: { data: { candidate: { id: 'c-new' } } } };
    if (url.endsWith('/associate')) return { data: { data: { association: { id: 'as-new' } } } };
    throw new Error(`unexpected post ${url}`);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete window.Audio; delete window.MediaRecorder; });

const activeLine = () => document.querySelector('[data-at="true"]');
const note = () => screen.queryByTestId('stp-studio-note')?.textContent || null;
const next = () => fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: 'PageDown' });
const open = async (src = source) => {
  render(<TeleprompterReader source={src} startBeat={8} onClose={() => {}} />);
  await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([u]) => u === '/api/v1/voice-studio/status')).toBe(true));
};

describe('studioVoice (the playable list, by line)', () => {
  test('current takes by beat and index; held ones and takes without audio are notes; another script plays nothing', () => {
    const v = studioVoice({
      script_revision: REV,
      takes: [take(8, 0), take(8, 2, { audio_url: null })],
      held: [{ beat_number: 8, line_index: 1, state: 'revoked' }, { beat_number: 8, line_index: 1, state: 'moved', reason_text: null }],
    }, REV);
    expect(v.byLine.get('8:0')).toMatchObject({ url: 'https://bucket/vs-8-0.wav', in_ms: 1200, out_ms: 3700, duration_seconds: 2.5 });
    expect(v.byLine.has('8:2')).toBe(false);
    expect(v.notes.get('8:2').text).toBe(SILENT.missing);
    expect(v.notes.get('8:1')).toMatchObject({ state: 'moved' }); // in force says more than withdrawn
    expect(v.notes.get('8:1').text).toBe('Silent · Moved in Voice Studio: The line moved within the beat. Confirm the take is still for it.');
    const stale = studioVoice({ script_revision: 'sr1-old', takes: [take(8, 0)], held: [] }, REV);
    expect(stale).toMatchObject({ stale: true });
    expect(stale.byLine.size).toBe(0);
    expect(studioVoice({ script_revision: REV, takes: [take(8, 0)] }, null).stale).toBe(true);
    expect(studioVoice({ script_revision: REV, takes: [take(8, 0, { in_ms: 3000, out_ms: 3000 })], held: [] }, REV).byLine.size).toBe(0);
  });
});

describe('Voice Studio on', () => {
  test('plays the approved take from its trim: seeks to in, stops at out, counts out − in', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle').textContent).toContain('Play approved takes'));
    expect(activeLine().textContent).toContain('Gorgeous darling');
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios.length).toBe(1));
    const a = audios[0];
    expect(a.src).toBe('https://bucket/vs-8-0.wav');
    expect(a.play).not.toHaveBeenCalled(); // waits for the length to seek to in
    act(() => a.meta());
    expect(a.seeks).toEqual([1.2]);
    await waitFor(() => expect(a.play).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('3s'); // 2.5 s, the trim
    expect(note()).toBeNull();
    // Before out it plays on; at out it stops and the next line comes up.
    const pauses = a.pause.mock.calls.length;
    act(() => a.at(3.0));
    expect(a.pause.mock.calls.length).toBe(pauses);
    expect(activeLine().textContent).toContain('Gorgeous darling');
    act(() => a.at(3.7));
    expect(a.pause.mock.calls.length).toBeGreaterThan(pauses);
    await waitFor(() => expect(activeLine().textContent).toContain('Love the look'));
    expect(audios.every((x) => !String(x.src).includes('legacy'))).toBe(true);
  });

  test('stops at out on time, not only on the next timeupdate (which can come a quarter second late)', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios.length).toBe(1));
    const a = audios[0];
    act(() => a.meta());
    await waitFor(() => expect(a.play).toHaveBeenCalledTimes(1));
    const pauses = a.pause.mock.calls.length;
    const started = Date.now();
    act(() => { a._clock = { from: 1.2, start: Date.now() }; a.emit('playing'); }); // its clock runs; no timeupdate from here on
    await waitFor(() => expect(a.pause.mock.calls.length).toBeGreaterThan(pauses), { timeout: 4000 });
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(2400);
    expect(took).toBeLessThan(3200);
    await waitFor(() => expect(activeLine().textContent).toContain('Love the look'));
  });

  test('a held approval is silent and says why; a line with no approval says so; the old clip never plays', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    next();
    expect(activeLine().textContent).toContain('Love the look');
    await waitFor(() => expect(note()).toMatch(/^Silent · Needs review in Voice Studio: The script was saved since/));
    next();
    expect(activeLine().textContent).toContain('Spin for me');
    expect(note()).toBe(SILENT.none);
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.map((x) => x.src)).toEqual(['https://bucket/vs-8-0.wav']);
  });

  test('approval withdrawn since the page loaded: a reload of the list leaves the line silent', async () => {
    playable = { script_revision: REV, takes: [], held: [{ approval_id: 'a-8-0', beat_number: 8, line_index: 0, state: 'revoked', reason_text: 'The approval was withdrawn.' }] };
    await open();
    await waitFor(() => expect(note()).toMatch(/withdrawn/i));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test('the list was made for another script: nothing plays, and it says to reload', async () => {
    playable = { ...playable, script_revision: 'sr1-newer' };
    await open();
    await waitFor(() => expect(note()).toBe(SILENT.stale));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test('an approved take with no audio URL is silent and says so', async () => {
    playable = { script_revision: REV, takes: [take(8, 0, { audio_url: null })], held: [] };
    await open();
    await waitFor(() => expect(note()).toBe(SILENT.missing));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test('a take the browser refuses to play says so, and the line still moves on after its length', async () => {
    playRefused = true;
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios.length).toBe(1));
    act(() => audios[0].meta());
    await waitFor(() => expect(note()).toBe(SILENT.playFailed));
    await waitFor(() => expect(activeLine().textContent).toContain('Love the look'), { timeout: 4000 });
  });

  test('the list could not be loaded: nothing plays, not the old clips either', async () => {
    playable = new Error('500');
    await open();
    await waitFor(() => expect(note()).toBe(SILENT.failed));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test("Prime's own line never plays a take (reading as Lala)", async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', readAs: 'Lala' }));
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    next(); next(); next();
    expect(activeLine().textContent).toContain('This is the one');
    expect(note()).toBeNull();
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test('a cutscene line never plays its take, and says nothing about one', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', readAs: 'Guest' }));
    render(<TeleprompterReader source={source} startBeat={12} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    expect(activeLine().textContent).toContain('Watch this');
    expect(note()).toBeNull();
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });
});

describe('Voice Studio off or unknown', () => {
  test('off: the old clip plays whole, as before (no seek), and no Voice Studio list is asked for', async () => {
    status = 'off';
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle').textContent).toContain('Play voice clips'));
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios.length).toBe(1));
    expect(audios[0].src).toBe('https://bucket/legacy-0.webm');
    await waitFor(() => expect(audios[0].play).toHaveBeenCalled());
    expect(audios[0].seeks).toEqual([]);
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('8s');
    expect(note()).toBeNull();
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.endsWith('/playable'))).toBe(false);
  });

  test("unknown (the check failed): nothing plays and it says so; the old clips don't stand in", async () => {
    status = 'error';
    await open();
    await waitFor(() => expect(note()).toBe(SILENT.unknown));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });
});

describe('refreshing the approvals (B2b-1, B2b-3)', () => {
  const playableCalls = () => vi.mocked(api.get).mock.calls.filter(([u]) => u.endsWith('/playable')).length;
  const press = () => fireEvent.click(screen.getByTestId('stp-play'));

  test('every Play asks afresh; a take withdrawn in between does not play on the next Play', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    const before = playableCalls();
    press();
    await waitFor(() => expect(playableCalls()).toBe(before + 1));
    await waitFor(() => expect(audios.length).toBe(1));
    act(() => audios[0].meta());
    await waitFor(() => expect(audios[0].play).toHaveBeenCalledTimes(1));
    press(); // pause
    playable = { script_revision: REV, takes: [], held: [{ approval_id: 'a-8-0', beat_number: 8, line_index: 0, state: 'revoked', reason_text: 'The approval was withdrawn.' }] };
    press(); // play again: asks afresh, and the withdrawn take is gone
    await waitFor(() => expect(playableCalls()).toBe(before + 2));
    await waitFor(() => expect(note()).toMatch(/withdrawn/i));
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    expect(audios[0].paused).toBe(true);
  });

  test('nothing plays until the fresh list answers; a refresh that fails plays nothing (fail closed)', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    let answer;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/voice-studio/status') return { data: { data: { on: true } } };
      if (url.endsWith('/playable')) return new Promise((resolve, reject) => { answer = { resolve, reject }; });
      return { data: { data: [] } };
    });
    press();
    await waitFor(() => expect(answer).toBeTruthy());
    await new Promise((r) => setTimeout(r, 30));
    expect(audios.every((a) => a.play.mock.calls.length === 0)).toBe(true);
    await act(async () => { answer.reject(new Error('500')); });
    await waitFor(() => expect(note()).toBe(SILENT.failed));
    await new Promise((r) => setTimeout(r, 30));
    expect(audios.every((a) => a.play.mock.calls.length === 0)).toBe(true);
  });

  test('back to the tab: a fresh list that withdrew the take stops it mid-line; an unchanged one carries on', async () => {
    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    press();
    await waitFor(() => expect(audios.length).toBe(1));
    act(() => audios[0].meta());
    await waitFor(() => expect(audios[0].play).toHaveBeenCalledTimes(1));
    // Unchanged: the same take object, no new audio, no restart.
    const calls = playableCalls();
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(playableCalls()).toBe(calls + 1));
    await new Promise((r) => setTimeout(r, 30));
    expect(audios.length).toBe(1);
    expect(audios[0].paused).toBe(false);
    // Withdrawn meanwhile: it stops.
    playable = { script_revision: REV, takes: [], held: [] };
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(audios[0].paused).toBe(true));
    await waitFor(() => expect(note()).toBe(SILENT.none));
  });

  test('a take that fails to play asks for a fresh list once (a fresh link), not again and again', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    press();
    await waitFor(() => expect(audios.length).toBe(1));
    const calls = playableCalls();
    // The fresh list carries a fresh link for the same take.
    playable = { ...playable, takes: playable.takes.map((t) => (t.approval_id === 'a-8-0' ? { ...t, audio_url: 'https://bucket/vs-8-0.wav?fresh=1' } : t)) };
    act(() => audios[0].emit('error'));
    await waitFor(() => expect(playableCalls()).toBe(calls + 1));
    await waitFor(() => expect(audios.length).toBe(2));
    expect(audios[1].src).toBe('https://bucket/vs-8-0.wav?fresh=1');
    act(() => audios[1].emit('error'));
    await new Promise((r) => setTimeout(r, 50));
    expect(playableCalls()).toBe(calls + 1);
    expect(note()).toBe(SILENT.playFailed);
  });

  test('Voice Studio status unknown at first: Play asks again, and plays once it answers on', async () => {
    status = 'error';
    await open();
    await waitFor(() => expect(note()).toBe(SILENT.unknown));
    status = 'on';
    press();
    await waitFor(() => expect(audios.length).toBe(1));
    expect(audios[0].src).toBe('https://bucket/vs-8-0.wav');
  });
});

describe('recording from the teleprompter with Voice Studio on', () => {
  test('records an unapproved Voice Studio take for the line and links to Voice Studio; no old clip, no approval', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-record').textContent).toContain('Record a take'));
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    expect(screen.queryByTestId('stp-voice-panel')).toBeNull(); // the old recorder and its player
    expect(screen.queryByTestId('vr-clip-audio')).toBeNull();
    const link = screen.getByTestId('stp-studio-link');
    expect(link.getAttribute('href')).toBe('/episodes/ep-1?tab=voice&beat=8&line=0');
    fireEvent.click(screen.getByTestId('stp-studio-start'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-stop').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-studio-stop'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-save')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-studio-save'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-result').textContent).toMatch(/not approved/));
    const posts = vi.mocked(api.post).mock.calls.map(([u, body]) => [u, body]);
    expect(posts.map(([u]) => u)).toEqual(['/api/v1/voice-studio/ep-1/sources', '/api/v1/voice-studio/ep-1/candidates', '/api/v1/voice-studio/ep-1/candidates/c-new/associate']);
    expect(posts[2][1]).toEqual({ script_revision: REV, beat_number: 8, line_index: 0 });
    expect(posts.some(([u]) => /approve|script-voice-clips/.test(u))).toBe(false);
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.includes('script-voice-clips'))).toBe(false);
  });

  test('a refused save says so and offers to carry on from the step that failed, never uploading twice', async () => {
    let tieFails = true;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/sources')) return { data: { data: { source: { id: 's-new' } } } };
      if (url.endsWith('/candidates')) return { data: { data: { candidate: { id: 'c-new' } } } };
      if (url.endsWith('/associate')) {
        if (tieFails) { const e = new Error('Network Error'); throw e; }
        return { data: { data: {} } };
      }
      throw new Error(url);
    });
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-record')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    fireEvent.click(screen.getByTestId('stp-studio-start'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-stop').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-studio-stop'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-save')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-studio-save'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-result').textContent).toMatch(/only tying it to the line is left/));
    tieFails = false;
    fireEvent.click(screen.getByTestId('stp-studio-retry'));
    await waitFor(() => expect(screen.getByTestId('stp-studio-result').textContent).toMatch(/not approved/));
    const urls = vi.mocked(api.post).mock.calls.map(([u]) => u);
    expect(urls.filter((u) => u.endsWith('/sources'))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith('/candidates'))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith('/associate'))).toHaveLength(2);
  });

  test('Voice Studio off: the old recorder and its clip player are as before', async () => {
    status = 'off';
    await open();
    await waitFor(() => expect(screen.getByTestId('stp-voice-record').textContent).toContain('Record voice'));
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    expect(screen.getByTestId('stp-voice-panel')).toBeTruthy();
    expect(screen.getByTestId('vr-clip-audio').getAttribute('src')).toBe('https://bucket/legacy-0.webm');
    expect(screen.queryByTestId('stp-studio-record')).toBeNull();
  });
});

// Teleprompter batch 1 (Evoni, 2026-10-20): follow my voice, rehearsal
// times per beat, pause/emphasis/breath marks, mic meter and framing grid.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { lineSeconds, beatSeconds } from '../lib/scriptRuntime';
import { SAVED_KEY, diffText } from '../lib/rehearsal';

const VOICE = ['## BEAT: 1 · Opening Ritual', 'Me: "Hello there my friends."', 'Lala: "Hi."', 'Me: "Okay let us start."'].join('\n');
const voiceSource = { kind: 'script', scriptText: VOICE, episodeId: 'ep-1', title: 'Voice' };

let recogs;
class FakeRecognition {
  constructor() { recogs.push(this); this.results = []; this.running = false; }
  start() { this.running = true; this.onstart?.(); }
  stop() { this.running = false; }
  abort() { this.running = false; this.aborted = true; }
}
// The recogniser hears a new phrase (a new result).
const say = (text) => act(() => {
  const r = recogs[recogs.length - 1];
  r.results.push([{ transcript: text }]);
  r.onresult({ resultIndex: r.results.length - 1, results: r.results });
});

let tracks;
let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['f'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

let sample; // what the analyser reads: 128 is silence
class FakeAudioContext {
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createAnalyser() { return { fftSize: 32, getByteTimeDomainData(buf) { buf.fill(sample); } }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

const atLine = () => document.querySelector('[data-at="true"]')?.textContent;
const settings = (v) => window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  recogs = [];
  recorders = [];
  tracks = [{ stop: vi.fn() }];
  sample = 200;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.MediaRecorder;
  delete window.webkitSpeechRecognition;
  delete window.SpeechRecognition;
  delete window.AudioContext;
});

describe('Follow my voice', () => {
  test('without speech recognition the option is off: "Needs Chrome or Edge"', () => {
    render(<TeleprompterReader source={voiceSource} onClose={() => {}} />);
    const btn = screen.getByTestId('stp-pace-voice');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Needs Chrome or Edge');
  });

  test('scrolls with the words she says, tolerates skips, never goes back; others auto-advance; pause stops listening', () => {
    window.webkitSpeechRecognition = FakeRecognition;
    settings({ countdown: false });
    vi.useFakeTimers();
    render(<TeleprompterReader source={voiceSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-pace-voice'));
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).pacing).toBe('voice');
    expect(screen.getByTestId('stp-listening').textContent).toContain('Press Play');
    fireEvent.click(screen.getByTestId('stp-play'));
    const r = recogs[0];
    expect(r.running).toBe(true);
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    expect(r.lang).toBe(navigator.language || 'en-US');
    expect(screen.getByTestId('stp-listening').textContent).toContain('Listening');
    expect(atLine()).toContain('Hello there');
    say('hello there');
    expect(document.querySelectorAll('.stp-w.is-said')).toHaveLength(2);
    // Heard again: no move back, no move on.
    say('hello');
    expect(document.querySelectorAll('.stp-w.is-said')).toHaveLength(2);
    // "my" skipped: "friends" still matches; the line is done, Lala's comes up.
    say('friends');
    expect(atLine()).toContain('Hi.');
    expect(screen.getByTestId('stp-quiet').textContent).toContain('Stay quiet · react');
    // Lala's line goes on by itself after its estimate.
    act(() => { vi.advanceTimersByTime(Math.max(200, lineSeconds('Lala: "Hi."') * 1000) + 10); });
    expect(atLine()).toContain('Okay let us start.');
    say('okay lit');
    expect(document.querySelectorAll('.stp-w.is-said')).toHaveLength(5); // "lit" is "let", one letter off
    fireEvent.click(screen.getByTestId('stp-play')); // pause
    expect(r.aborted).toBe(true);
  });

  test('a blocked microphone is said plainly', () => {
    window.webkitSpeechRecognition = FakeRecognition;
    settings({ countdown: false, pacing: 'voice' });
    render(<TeleprompterReader source={voiceSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    act(() => { recogs[0].onerror({ error: 'not-allowed' }); recogs[0].onend(); });
    expect(screen.getByTestId('stp-status').textContent).toContain('The microphone is blocked for Follow my voice');
    expect(recogs).toHaveLength(1); // no restart after a blocked mic
  });

  test('runs while recording: the recorder and the recogniser both run', async () => {
    window.webkitSpeechRecognition = FakeRecognition;
    settings({ countdown: false, pacing: 'voice' });
    render(<TeleprompterReader source={voiceSource} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await screen.findByTestId('stp-preview');
    fireEvent.click(screen.getByTestId('stp-record'));
    await screen.findByTestId('stp-recording');
    expect(recorders[0].state).toBe('recording');
    expect(recogs[recogs.length - 1].running).toBe(true);
    // A browser that can't share the mic says so.
    act(() => { recogs[recogs.length - 1].onerror({ error: 'audio-capture' }); });
    expect(screen.getByTestId('stp-status').textContent).toContain("can't listen while it records");
  });
});

describe('Mic meter and framing grid', () => {
  test('Follow my voice opens the mic for the meter while reading', async () => {
    window.webkitSpeechRecognition = FakeRecognition;
    window.AudioContext = FakeAudioContext;
    settings({ pacing: 'voice' });
    render(<TeleprompterReader source={voiceSource} onClose={() => {}} />);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    const meter = await screen.findByTestId('stp-meter');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(Number(meter.getAttribute('data-level'))).toBeGreaterThan(0);
  });

  // Evoni, 2026-10-25: it warned 3 seconds into a take, before she had spoken.
  const startTake = async () => {
    render(<TeleprompterReader source={voiceSource} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await act(async () => {}); // the camera promise
    expect(screen.getByTestId('stp-preview')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-record'));
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByTestId('stp-recording')).toBeTruthy();
  };
  // A render between ticks, as in the browser.
  const run = (ms) => { for (let t = 0; t < ms; t += 250) act(() => { vi.advanceTimersByTime(250); }); };

  test('a mic silent from the start: nothing for 8 seconds, then "yet — check it\'s on"; sound clears it', async () => {
    window.AudioContext = FakeAudioContext;
    sample = 128;
    vi.useFakeTimers();
    await startTake();
    run(7500);
    expect(screen.queryByTestId('stp-silent')).toBeNull(); // the old rule warned at 3 seconds
    run(1000);
    expect(screen.getByTestId('stp-silent').textContent).toBe("No sound from your mic yet — check it's on");
    expect(screen.getByTestId('stp-silent').getAttribute('data-silent')).toBe('never');
    sample = 220;
    run(500);
    expect(Number(screen.getByTestId('stp-meter').getAttribute('data-level'))).toBe(100);
    expect(screen.queryByTestId('stp-silent')).toBeNull();
  });

  test('sound, then quiet: a pause to think is fine; 15 seconds quiet warns; sound clears it', async () => {
    window.AudioContext = FakeAudioContext;
    sample = 220;
    vi.useFakeTimers();
    await startTake();
    run(4000);
    sample = 128;
    run(6000); // past 8 seconds, but she spoke: no "yet"
    expect(screen.queryByTestId('stp-silent')).toBeNull();
    run(8000); // 14 seconds quiet
    expect(screen.queryByTestId('stp-silent')).toBeNull();
    run(1500);
    expect(screen.getByTestId('stp-silent').textContent).toBe('No sound from your mic');
    expect(screen.getByTestId('stp-silent').getAttribute('data-silent')).toBe('lost');
    sample = 220;
    run(500);
    expect(screen.queryByTestId('stp-silent')).toBeNull();
  });

  test('the framing grid toggles over the camera preview and is remembered', async () => {
    render(<TeleprompterReader source={voiceSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await screen.findByTestId('stp-preview');
    expect(screen.queryByTestId('stp-grid')).toBeNull();
    fireEvent.click(screen.getByTestId('stp-grid-toggle'));
    expect(screen.getByTestId('stp-preview').parentElement.querySelector('[data-testid=stp-grid]')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).grid).toBe(true);
  });
});

describe('Rehearsal times', () => {
  const TWO = ['## BEAT: 1 · Opening Ritual', 'Me: "One two three four five."', '(She sits.)', '## BEAT: 8 · Transformation Loop', 'Lala: "Gown."'].join('\n');
  const src = { kind: 'script', scriptText: TWO, episodeId: 'ep-9', title: 'Two' };

  test('times each beat while running, in the jump list and the summary; Reset; Save to this device', () => {
    settings({ countdown: false });
    vi.useFakeTimers();
    const { unmount } = render(<TeleprompterReader source={src} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    act(() => { vi.advanceTimersByTime(5000); });
    fireEvent.click(screen.getByTestId('stp-play'));
    act(() => { vi.advanceTimersByTime(5000); }); // paused: not counted
    expect(screen.getByTestId('stp-jump').options[0].textContent).toBe('1 · Opening Ritual · 5s');
    fireEvent.click(screen.getByTestId('stp-rehearsal-toggle'));
    const est = beatSeconds(['Me: "One two three four five."', '(She sits.)']);
    expect(screen.getAllByTestId('stp-rehearsal-row').map((r) => r.textContent)).toEqual([`Beat 1: 5s · est. ${est}s · ${diffText(5, est)}`]);
    fireEvent.click(screen.getByTestId('stp-rehearsal-save'));
    expect(JSON.parse(window.localStorage.getItem(SAVED_KEY('ep-9'))).beats).toEqual({ 1: 5 });
    expect(screen.getByTestId('stp-rehearsal-note').textContent).toContain('Saved on this device');
    unmount();
    // Kept for the session, and the saved times show beside them.
    render(<TeleprompterReader source={src} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-rehearsal-toggle'));
    expect(screen.getByTestId('stp-rehearsal-row').textContent).toContain('last saved 5s');
    fireEvent.click(screen.getByTestId('stp-rehearsal-reset'));
    expect(screen.queryByTestId('stp-rehearsal-row')).toBeNull();
    expect(window.localStorage.getItem(SAVED_KEY('ep-9'))).not.toBeNull();
  });

  test('pasted text has no rehearsal times', () => {
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hello.' }} onClose={() => {}} />);
    expect(screen.queryByTestId('stp-rehearsal-toggle')).toBeNull();
  });
});

describe('Reading marks', () => {
  const MARKED = ['## BEAT: 1 · Opening Ritual', 'Me: "Wait // for *it* (breath) now."', '[breath]', '(breath)', 'Lala: "Okay."'].join('\n');

  test('pause, emphasis and breath show as marks, never their characters, in a script', () => {
    render(<TeleprompterReader source={{ kind: 'script', scriptText: MARKED, episodeId: 'ep-1', title: 'M' }} onClose={() => {}} />);
    const page = screen.getByTestId('stp-page');
    expect(page.textContent).not.toMatch(/\/\/|\*|\(breath\)|\[breath\]/);
    expect(screen.getAllByTestId('stp-mark-pause')).toHaveLength(1);
    expect(screen.getByTestId('stp-em').textContent).toBe('it');
    expect(screen.getAllByTestId('stp-mark-breath')).toHaveLength(3);
    expect(screen.getAllByTestId('stp-breath')).toHaveLength(2);
  });

  test('and in pasted text', () => {
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hold on // *really* hold on [breath] go.' }} onClose={() => {}} />);
    const p = screen.getByTestId('stp-para');
    expect(p.textContent).not.toMatch(/\/\/|\*|\[breath\]/);
    expect(p.querySelector('[data-testid=stp-mark-pause]')).toBeTruthy();
    expect(p.querySelector('[data-testid=stp-em]').textContent).toBe('really');
    expect(p.querySelector('[data-testid=stp-mark-breath]')).toBeTruthy();
  });

  test('pacing by line times, a // pause holds the line one second more', () => {
    const SCRIPT = ['## BEAT: 1 · Opening Ritual', 'Lala: "Hi // there."', 'Me: "Next."'].join('\n');
    settings({ countdown: false, pacing: 'lines', pace: 1 });
    vi.useFakeTimers();
    render(<TeleprompterReader source={{ kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'P' }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    const hold = (lineSeconds('Lala: "Hi // there."') + 1) * 1000;
    act(() => { vi.advanceTimersByTime(hold - 20); });
    expect(atLine()).toContain('Hi');
    act(() => { vi.advanceTimersByTime(40); });
    expect(atLine()).toContain('Next.');
  });
});

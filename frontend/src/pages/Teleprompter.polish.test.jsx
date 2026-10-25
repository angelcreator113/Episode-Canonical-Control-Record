// Teleprompter polish (Evoni, 2026-10-25, recording on her phone): in Read &
// record the bar leads with ● Record and Play is a smaller "Practice" with a
// banner that it is not recording ("I read 9 minutes thinking I was
// recording"); the review sheet's buttons wrap two to a row on a phone.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."',
  'JustAWoman: "Let us go."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const BANNER = 'Practicing — not recording. Tap ● Record to record.';

let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.opts = opts; this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['f'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  recorders = [];
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 1 }));
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete window.MediaRecorder; });

const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });
async function openRecord() {
  render(<TeleprompterReader source={source} startBeat={2} countdownMs={10} onClose={() => {}} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
}

describe('Read & record: ● Record leads, Play is Practice', () => {
  test('outside Read & record nothing changes: the big Play leads, no Practice, no Record', () => {
    render(<TeleprompterReader source={source} startBeat={2} onClose={() => {}} />);
    const bar = screen.getByTestId('stp-controls');
    const play = screen.getByTestId('stp-play');
    expect(bar.firstElementChild).toBe(play);
    expect(play.className).toContain('is-primary');
    expect(play.getAttribute('aria-label')).toBe('Play');
    expect(screen.queryByTestId('stp-record')).toBeNull();
    fireEvent.click(play);
    expect(screen.queryByTestId('stp-practicing')).toBeNull();
  });

  test('Read & record on: Record is first and red; Practice is next, smaller, and says what it does', async () => {
    await openRecord();
    const bar = screen.getByTestId('stp-controls');
    const record = screen.getByTestId('stp-record');
    const play = screen.getByTestId('stp-play');
    expect(bar.firstElementChild).toBe(record);
    expect(record.className).toContain('is-rec');
    expect(record.className).toContain('is-lead');
    expect(record.textContent).toContain('Record beat 2 · take 1');
    expect(record.nextElementSibling).toBe(play);
    expect(play.className).not.toContain('is-primary');
    expect(play.textContent).toBe('Practice');
    expect(play.getAttribute('aria-label')).toBe('Practice — scroll without recording');
    expect(screen.queryByTestId('stp-practicing')).toBeNull();
  });

  test('Practice scrolls with a banner that stays through a pause and goes when a take starts', async () => {
    await openRecord();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-play').textContent).toBe('Pause');
    expect(screen.getByTestId('stp-play').getAttribute('aria-label')).toBe('Pause practice');
    expect(screen.getByTestId('stp-practicing').textContent.trim()).toBe(BANNER);
    expect(recorders).toHaveLength(0); // not recording
    fireEvent.click(screen.getByTestId('stp-play')); // pause
    expect(screen.getByTestId('stp-play').textContent).toBe('Practice');
    expect(screen.getByTestId('stp-practicing')).toBeTruthy(); // persistent
    fireEvent.click(screen.getByTestId('stp-record'));
    expect(screen.queryByTestId('stp-practicing')).toBeNull();
    tick(30);
    expect(recorders[0].state).toBe('recording');
    // Recording: the Stop & review / Pause bar is as before.
    expect(screen.getByTestId('stp-controls').firstElementChild).toBe(screen.getByTestId('stp-stop'));
    expect(screen.getByTestId('stp-play').getAttribute('aria-label')).toBe('Pause the take');
    fireEvent.click(screen.getByTestId('stp-stop'));
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(screen.queryByTestId('stp-practicing')).toBeNull();
    expect(screen.getByTestId('stp-play').textContent).toBe('Practice');
  });

  test('Space still plays and pauses in Read & record (and shows the banner); Read & record off clears it', async () => {
    await openRecord();
    const root = screen.getByTestId('teleprompter');
    root.focus();
    fireEvent.keyDown(root, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-practicing')).toBeTruthy();
    fireEvent.keyDown(document.activeElement, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    expect(screen.queryByTestId('stp-practicing')).toBeNull();
    const play = screen.getByTestId('stp-play');
    expect(play.className).toContain('is-primary');
    expect(play.getAttribute('aria-label')).toBe('Play');
    expect(screen.getByTestId('stp-controls').firstElementChild).toBe(play);
  });
});

describe('the review sheet buttons fit on a phone', () => {
  const css = readFileSync(resolve(__dirname, 'Teleprompter.css'), 'utf8');
  test('Save across the top; the rest two to a row under 600px; labels wrap inside their buttons', () => {
    const phone = css.slice(css.lastIndexOf('Review sheet on a phone'));
    expect(phone).toMatch(/\.stp-review-actions \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(phone).toMatch(/\.stp-review-actions \.stp-btn\.stp-save \{ grid-column: 1 \/ -1; \}/);
    expect(css).toMatch(/\.stp-review-actions \.stp-btn:not\(\.stp-save\) \{[^}]*min-width: 0;[^}]*white-space: normal;/);
  });

  test('the review sheet keeps Save first, then Download, Retake and Discard', async () => {
    await openRecord();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    tick(400);
    fireEvent.click(screen.getByTestId('stp-stop'));
    vi.useRealTimers();
    const review = await screen.findByTestId('stp-review');
    const ids = [...review.querySelector('.stp-review-actions').children].map((b) => b.getAttribute('data-testid'));
    expect(ids[0]).toBe('stp-save');
    expect(ids).toEqual(expect.arrayContaining(['stp-download-take', 'stp-retake', 'stp-discard']));
  });
});

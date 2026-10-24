// Ending and saving a take (Evoni, 2026-10-24: "On the teleprompter I have no
// clear way of ending and saving a recording"): a big Stop & review while a
// take runs, Pause that pauses the recording, a one-beat take that ends by
// itself, and a review sheet with Save take, Retake, Discard and Next beat.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY, ENDING_MS } from '../components/Teleprompter/TeleprompterReader';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."', // 0.4s
  'JustAWoman: "Let us go."', // 1.2s
  '## BEAT: 3 · Inbox',
  'JustAWoman: "Mail time."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const activeLine = () => document.querySelector('[data-at="true"]');

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
  vi.mocked(api.post).mockImplementation(async (url, form) => ({ data: { data: { id: 'clip-new', beat_number: null, is_favorite: false, start_line: null, label: form.get('label') } } }));
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: 'clip-new', ...body } } }));
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  // Even with the 3-2-1 off, a take counts in.
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
// Read & record on beat 2, camera ready, then fake timers.
async function openBeat2() {
  render(<TeleprompterReader source={source} startBeat={2} countdownMs={10} onClose={() => {}} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
}
async function recordAndStop() {
  await openBeat2();
  fireEvent.click(screen.getByTestId('stp-record'));
  tick(30);
  tick(400);
  fireEvent.click(screen.getByTestId('stp-stop'));
  vi.useRealTimers();
  return screen.findByTestId('stp-review');
}

describe('a take: Stop & review is the way out', () => {
  test('mid-take the bar is a big Stop & review with Pause beside it; the rest hides and comes back after', async () => {
    await openBeat2();
    expect(screen.getByTestId('stp-start-line')).toBeTruthy();
    expect(screen.getByTestId('stp-scope-beat')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-record'));
    // The 3-2-1 always runs for a take (the setting is for reading); Stop is already the big button.
    expect(screen.getByTestId('stp-countdown').textContent).toBe('3');
    expect(screen.getByTestId('stp-stop').textContent).toBe('Stop');
    tick(30);
    expect(recorders[0].state).toBe('recording');
    const bar = screen.getByTestId('stp-controls');
    const stop = screen.getByTestId('stp-stop');
    expect(bar.className).toContain('is-take');
    expect(bar.firstElementChild).toBe(stop);
    expect(stop.className).toContain('is-stop');
    expect(stop.textContent).toBe('Stop & review');
    expect(screen.getByTestId('stp-play').textContent).toBe('Pause');
    expect(screen.getByTestId('stp-play').getAttribute('aria-label')).toBe('Pause the take');
    expect(screen.getByTestId('stp-recording').textContent).toMatch(/^ REC 0:00· Stop & review when you're done· Stop when done$/);
    ['stp-record-mode', 'stp-scope-beat', 'stp-scope-episode', 'stp-start-line', 'stp-takes-toggle', 'stp-more', 'stp-mirror', 'stp-pace-lines', 'stp-record'].forEach((id) => {
      expect(screen.queryByTestId(id)).toBeNull();
    });
    expect(screen.getByTestId('stp-pace')).toBeTruthy(); // the pace stays
    fireEvent.click(stop);
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(screen.queryByTestId('stp-review')).toBeNull();
    ['stp-record-mode', 'stp-scope-beat', 'stp-start-line', 'stp-takes-toggle', 'stp-more', 'stp-record'].forEach((id) => {
      expect(screen.getByTestId(id)).toBeTruthy();
    });
    expect(screen.getByTestId('stp-controls').className).not.toContain('is-take');
  });

  test('Stop during the 3-2-1 stops before anything is recorded', async () => {
    await openBeat2();
    fireEvent.click(screen.getByTestId('stp-record'));
    fireEvent.click(screen.getByTestId('stp-stop'));
    expect(screen.queryByTestId('stp-countdown')).toBeNull();
    tick(100);
    expect(recorders).toHaveLength(0);
    expect(screen.getByTestId('stp-record')).toBeTruthy();
  });

  test('Pause pauses the scroll and the recording of a one-beat take; take time leaves the pause out', async () => {
    await openBeat2();
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    tick(300);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(recorders[0].state).toBe('paused');
    expect(screen.getByTestId('stp-play').textContent).toBe('Resume');
    tick(10000);
    // Paused: the line does not move on and the take does not end.
    expect(activeLine().textContent).toContain('Okay.');
    expect(screen.getByTestId('stp-recording').textContent).toContain('PAUSED 0:00');
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(recorders[0].state).toBe('recording');
    expect(screen.getByTestId('stp-play').textContent).toBe('Pause');
    tick(1000);
    expect(screen.getByTestId('stp-recording').textContent).toMatch(/REC 0:01/);
    fireEvent.click(screen.getByTestId('stp-stop'));
    vi.useRealTimers();
    const review = await screen.findByTestId('stp-review');
    expect(within(review).getByTestId('stp-review-name').textContent).toBe('Beat 2 · Login Sequence · take 1 · 0:01');
  });

  test("a one-beat take ends by itself: the last line's time, \"Ending the take…\" for 2 seconds, then the review; never saved", async () => {
    await openBeat2();
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    expect(activeLine().textContent).toContain('Okay.');
    tick(400);
    expect(activeLine().textContent).toContain('Let us go.');
    expect(screen.queryByTestId('stp-ending')).toBeNull();
    tick(1200);
    expect(screen.getByTestId('stp-ending').textContent).toContain('Ending the take…');
    expect(recorders[0].state).toBe('recording');
    expect(ENDING_MS).toBe(2000);
    tick(ENDING_MS - 100);
    expect(recorders[0].state).toBe('recording');
    tick(150);
    expect(recorders[0].state).toBe('inactive');
    vi.useRealTimers();
    const review = await screen.findByTestId('stp-review');
    expect(within(review).getByRole('heading', { name: 'Your take' })).toBeTruthy();
    expect(screen.queryByTestId('stp-ending')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Pause while it is ending keeps the take going', async () => {
    await openBeat2();
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    tick(400);
    tick(1200);
    expect(screen.getByTestId('stp-ending')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.queryByTestId('stp-ending')).toBeNull();
    tick(5000);
    expect(recorders[0].state).toBe('paused');
    expect(screen.queryByTestId('stp-review')).toBeNull();
  });

  test('Enter or S stops and reviews; Enter in the pace slider does not', async () => {
    await openBeat2();
    const root = screen.getByTestId('teleprompter');
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    fireEvent.keyDown(screen.getByTestId('stp-pace'), { key: 'Enter' });
    expect(recorders[0].state).toBe('recording');
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(recorders[0].state).toBe('inactive');
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-discard'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    fireEvent.keyDown(root, { key: 's' });
    expect(recorders[1].state).toBe('inactive');
  });

  test('Escape while recording asks before throwing the take away', async () => {
    const onClose = vi.fn();
    render(<TeleprompterReader source={source} startBeat={2} countdownMs={1} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-record'));
    await screen.findByTestId('stp-recording');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: 'Escape' });
    expect(window.confirm).toHaveBeenCalledWith('A take is recording. Stop and leave the teleprompter?');
    expect(onClose).not.toHaveBeenCalled();
    expect(recorders[0].state).toBe('recording');
  });
});

describe('the review sheet', () => {
  test('"Your take" with its name and length; Save take to the episode\'s Files; then Next beat → ready to record', async () => {
    const review = await recordAndStop();
    expect(within(review).getByRole('heading', { name: 'Your take' })).toBeTruthy();
    expect(within(review).getByTestId('stp-review-name').textContent).toBe('Beat 2 · Login Sequence · take 1 · 0:00');
    const save = screen.getByTestId('stp-save');
    expect(save.textContent).toBe("Save taketo the episode's Files");
    expect(save.className).toContain('is-primary');
    expect(review.querySelector('.stp-review-actions').firstElementChild).toBe(save);
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files: Beat 2 · Login Sequence · take 1"));
    expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-new', { beat_number: 2, start_line: 0 }, { keepSession: true });
    expect(screen.queryByTestId('stp-review')).toBeNull();
    const next = screen.getByTestId('stp-next-beat');
    expect(next.textContent).toBe('Next beat ');
    expect(next.getAttribute('aria-label')).toMatch(/^Next beat: 3 · .+, ready to record$/);
    fireEvent.click(next);
    expect(screen.getByTestId('stp-jump').value).toBe('2');
    expect(screen.getByTestId('stp-record').textContent).toContain('Record beat 3 · take 1');
    expect(screen.queryByTestId('stp-next-beat')).toBeNull();
    expect(activeLine().textContent).toContain('Mail time.');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('stp-record')));
  });

  test('no Next beat after the last beat', async () => {
    render(<TeleprompterReader source={source} startBeat={3} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-record'));
    await screen.findByTestId('stp-recording');
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
    expect(screen.queryByTestId('stp-next-beat')).toBeNull();
  });

  test('Retake throws this take away and counts the next one in', async () => {
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-retake'));
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take');
    expect(screen.getByTestId('stp-countdown')).toBeTruthy();
    await waitFor(() => expect(recorders).toHaveLength(2));
    expect(recorders[1].state).toBe('recording');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Discard asks; yes goes back to the start of the beat with nothing saved', async () => {
    await recordAndStop();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(window.confirm).toHaveBeenCalledWith('Throw this take away? It has not been saved.');
    expect(screen.getByTestId('stp-review')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(activeLine().textContent).toContain('Okay.');
    expect(screen.getByTestId('stp-record').textContent).toContain('Record beat 2 · take 1');
    expect(recorders).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a failed save keeps the review with Retry; the error says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 413 } }));
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('The take is too big to upload.');
    expect(screen.getByTestId('stp-save').textContent).toBe('Retry');
    expect(screen.queryByTestId('stp-next-beat')).toBeNull();
  });
});

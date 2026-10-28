// Where a take starts and ends (Evoni, 2026-10-28): "Continue from beat N"
// after a full take that stopped early (its markers then start at that
// beat), the beats a take covers in its review and in the Full episode
// takes, overlaps between her full takes, and the take's width, height and
// thumbnail measured in the browser going up with it.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
// The browser's measure of the take (lib/videoProbe), faked: nothing is decoded here.
vi.mock('../lib/videoProbe', async () => {
  const actual = await vi.importActual('../lib/videoProbe');
  return { ...actual, probeVideo: vi.fn(async () => ({ seconds: null, width: 1280, height: 720, thumbnail: 'data:image/jpeg;base64,/9j/CC==', problems: [] })) };
});

import api from '../services/api';
import { fakeTakeUploads } from '../test/fakeTakeUploads';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import TakesPanel from '../components/Teleprompter/TeleprompterTakes';
import { probeVideo } from '../lib/videoProbe';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."',
  'JustAWoman: "Let us go."',
  '## BEAT: 11 · The Event',
  'Lala: "Wow look at this room."', // 5 words: 2s
  'JustAWoman: "She is glowing."', // 3 words: 1.2s
  '## BEAT: 14 · Ending',
  'JustAWoman: "Bye."', // 0.4s
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const activeLine = () => document.querySelector('[data-at="true"]');
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.opts = opts; this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['f'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

// Her last full take stopped at beat 2.
const STOPPED_EARLY = { id: 'f1', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 300, created_at: '2026-10-27T10:00:00Z',
  url_raw: 'https://bucket/f1.webm', beat_number: null, beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 5 }] };
let clipRows;
let uploads;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  clipRows = [STOPPED_EARLY];
  recorders = [];
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episode-clips/ep-1' ? { data: { data: clipRows } } : { data: { data: [] } }));
  uploads = fakeTakeUploads(api, async (url, form) => ({ data: { data: { id: 'clip-new', beat_number: null, beat_marks: null, label: form.get('label') }, stored: ['beat_marks'] } }));
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: url.split('/').pop(), ...body } } }));
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: true, pacing: 'lines', pace: 1 }));
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete window.MediaRecorder; });

async function openRecord() {
  render(<TeleprompterReader source={source} countdownMs={10} onClose={() => {}} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
}

describe('Continue from where a take stopped', () => {
  test('offers the next beat in the script; it records the whole episode from there, the markers starting at that beat', async () => {
    await openRecord();
    const btn = await screen.findByTestId('stp-continue');
    expect(btn.textContent).toContain('Continue from beat 11 · The Event');
    expect(btn.textContent).toContain('Full episode · take 1 ended in beat 2');
    fireEvent.click(btn);
    expect(screen.getByTestId('stp-scope-episode').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-episode-from').value).toBe('this');
    expect(screen.getByTestId('stp-record').textContent).toContain('take 2');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30); // the 3-2-1
    expect(activeLine().textContent).toContain('Wow look at this room.');
    tick(2000);
    tick(1200);
    tick(400); // the end of beat 14 ends the take
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
    expect(within(screen.getByTestId('stp-review-marks')).getAllByTestId('stp-mark').map((b) => b.textContent)).toEqual(['Beat 11 · 0:00.0', 'Beat 14 · 0:03.2']);
    expect(screen.getByTestId('stp-review-range').textContent.trim()).toBe('Beats 11 → 14 · ended in beat 14 · Cliffhanger');
    // Saved: the markers start at beat 11; the browser's width, height and thumbnail go with it.
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(uploads.completes).toHaveLength(1));
    expect(JSON.parse(uploads.starts[0].body.beat_marks)).toEqual([{ beat: 11, t: 0 }, { beat: 14, t: 3.2 }]);
    expect(uploads.starts[0].body).toMatchObject({ width: 1280, height: 720 });
    expect(uploads.completes[0].body).toEqual({ thumbnail: 'data:image/jpeg;base64,/9j/CC==' });
    expect(probeVideo).toHaveBeenCalledWith(expect.any(File), { knownSeconds: expect.any(Number) });
  });

  test('no offer when her latest full take reached the last beat, or it is someone else\'s', async () => {
    clipRows = [{ ...STOPPED_EARLY, beat_marks: [{ beat: 1, t: 0 }, { beat: 14, t: 300 }] }, { ...STOPPED_EARLY, id: 'l1', performer: 'lala' }];
    await openRecord();
    await waitFor(() => expect(screen.getByTestId('stp-scope-episode')).toBeTruthy());
    expect(screen.queryByTestId('stp-continue')).toBeNull();
  });
});

describe('Takes panel: the beats a full take covers', () => {
  test('each full take says its beats and where it ended, and the takes it overlaps', () => {
    const full = [
      { id: 'f22', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 1320, url_raw: 'https://b/f22.webm',
        beat_marks: Array.from({ length: 11 }, (_, i) => ({ beat: i + 1, t: i * 110 })) },
      { id: 'f8', performer: 'justawoman', label: 'Full episode · take 2', duration_seconds: 480, url_raw: 'https://b/f8.webm',
        beat_marks: [...Array.from({ length: 9 }, (_, i) => ({ beat: i + 1, t: 0 })), { beat: 10, t: 9.4 }, { beat: 11, t: 10.4 }, { beat: 12, t: 162.5 }, { beat: 13, t: 239.2 }, { beat: 14, t: 399.3 }] },
    ];
    render(<TakesPanel takes={[]} beatNumber={11} onFavorite={() => {}} fullTakes={full} />);
    const rows = within(screen.getByTestId('stp-full-takes')).getAllByTestId('stp-full-take');
    expect(within(rows[0]).getByTestId('stp-full-range').textContent.trim()).toBe('Beats 1 → 11 · ended in beat 11 · The Event');
    expect(within(rows[1]).getByTestId('stp-full-range').textContent.trim()).toBe('Beats 10 → 14 · ended in beat 14 · Cliffhanger');
    expect(within(rows[0]).getByTestId('stp-full-overlap').textContent.trim()).toBe('Overlaps Full episode · take 2 on beats 10–11');
    expect(within(rows[1]).getByTestId('stp-full-overlap').textContent.trim()).toBe('Overlaps Full episode · take 1 on beats 10–11');
  });
});

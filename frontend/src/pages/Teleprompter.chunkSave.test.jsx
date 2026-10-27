// Saving a take in parts (Evoni, 2026-10-27: a 22-minute take failed with
// "ENOSPC: no space left on device, write"): the take goes up in 8 MB
// slices with a percent; Retry after a failure sends only the slices not
// sent yet; the server's plain message shows (never a raw code) and says the
// take is still on the phone. Take numbers count unsaved takes kept on the
// phone; a download carries the date and time.
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { fakeTakeUploads } from '../test/fakeTakeUploads';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { setTakeStore } from '../lib/takeStore';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."',
  'JustAWoman: "Let us go."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const MB = 1024 * 1024;

let recorders;
let takeBytes;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(takeBytes)], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

// A take store in memory: kept takes (unsaved) to offer, and what the save keeps with a take.
function memoryStore(kept = []) {
  const takes = new Map();
  const pieces = [];
  return {
    available: true,
    takes,
    begin: async (id, { key, type, meta }) => { takes.set(id, { id, key, type, meta, startedAt: Date.now() }); return true; },
    addChunk: async (id, seq, data, t) => { pieces.push({ takeId: id, seq, t, data }); return true; },
    update: vi.fn(async (id, patch = {}) => {
      const row = takes.get(id);
      if (!row) return false;
      takes.set(id, { ...row, ...patch, meta: { ...(row.meta || {}), ...(patch.meta || {}) } });
      return true;
    }),
    chunks: async (id) => pieces.filter((p) => p.takeId === id).sort((a, b) => a.seq - b.seq),
    unsaved: async () => kept,
    remove: async (id) => { takes.delete(id); return true; },
  };
}

let uploads;
let store;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  recorders = [];
  takeBytes = 10;
  store = memoryStore();
  setTakeStore(store);
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
  uploads = fakeTakeUploads(api, async (url, form) => ({ data: { data: { id: 'clip-new', beat_number: 2, is_favorite: false, start_line: 0, label: form.get('label') }, stored: ['start_line'], not_stored: [] } }));
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: 'clip-new', ...body } } }));
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 1 }));
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setTakeStore(null); delete window.MediaRecorder; });

const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });
async function openBeat2() {
  render(<TeleprompterReader source={source} startBeat={2} countdownMs={10} onClose={() => {}} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
}
async function recordAndStop() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  fireEvent.click(screen.getByTestId('stp-record'));
  tick(30);
  tick(400);
  fireEvent.click(screen.getByTestId('stp-stop'));
  vi.useRealTimers();
  return screen.findByTestId('stp-review');
}

describe('a take goes up in 8 MB parts', () => {
  test('a 17 MB take is three parts; one that fails stops the save; Retry sends only the parts not sent yet', async () => {
    takeBytes = 17 * MB;
    let failPart2 = true;
    vi.mocked(api.put).mockImplementation(async (url, data, cfg) => {
      uploads.parts.push({ url, data, cfg });
      cfg?.onUploadProgress?.({ loaded: data.size });
      if (url.endsWith('/parts/2') && failPart2) {
        failPart2 = false;
        throw Object.assign(new Error('400'), { response: { status: 400, data: { error: 'Part 2 arrived incomplete. Try again.' } } });
      }
      return { data: { success: true } };
    });
    await openBeat2();
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Part 2 arrived incomplete. Try again. Your take is still safe on this phone — tap Retry.');
    expect(screen.getByTestId('stp-save').textContent).toBe('Retry');
    expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2']);
    expect(uploads.parts[0].data.size).toBe(8 * MB);
    expect(uploads.parts[0].cfg.headers['Content-Type']).toBe('application/octet-stream');
    // How far it got is kept with the take on the phone.
    const takeId = [...store.takes.keys()][0];
    expect(store.update).toHaveBeenCalledWith(takeId, { meta: { upload: expect.objectContaining({ uploadId: 'up-1', done: [1] }) } });

    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files: Beat 2 · Login Sequence · take 1"));
    // No second start; only parts 2 and 3 went the second time.
    expect(uploads.starts).toHaveLength(1);
    expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2', '2', '3']);
    expect(uploads.parts[3].data.size).toBe(1 * MB);
    expect(uploads.completes).toHaveLength(1);
    expect(store.update).toHaveBeenLastCalledWith(takeId, { meta: { upload: null } });
  });

  test('the review shows the upload percent while it saves', async () => {
    takeBytes = 17 * MB;
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    vi.mocked(api.put).mockImplementation(async (url, data, cfg) => {
      uploads.parts.push({ url });
      cfg?.onUploadProgress?.({ loaded: data.size });
      if (url.endsWith('/parts/2')) await held;
      return { data: { success: true } };
    });
    await openBeat2();
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-progress-note').textContent).toBe('Uploading the take… 94%'));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('94');
    release();
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
  });
});

describe('plain words when a save fails', () => {
  test('a full server disk (507): the server\'s plain message, which says the take is still on the phone', async () => {
    const friendly = 'The server ran out of room while saving this take. Your take is still safe on this phone — tap Retry later.';
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('507'), { response: { status: 507, data: { success: false, error: friendly } } }));
    await openBeat2();
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent.trim()).toBe(friendly);
    expect(screen.getByTestId('stp-review')).toBeTruthy();
  });

  test('a raw code from an older server is never shown', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500, data: { success: false, error: 'ENOSPC: no space left on device, write' } } }));
    await openBeat2();
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/ENOSPC/);
    expect(alert.textContent).toContain('The server had a problem saving it. Your take is still safe on this phone — tap Retry.');
  });
});

describe('take names', () => {
  test('an unsaved take kept on the phone for this beat counts: the next one is take 2', async () => {
    store = memoryStore([{ id: 'old', key: 'episode:ep-1', startedAt: Date.now() - 60000, count: 3, meta: { scope: 'beat', beatNumber: 2, readAs: 'JustAWoman', label: 'Beat 2 · Login Sequence · take 1', takeNo: 1 } }]);
    setTakeStore(store);
    await openBeat2();
    await screen.findByTestId('stp-recover');
    await waitFor(() => expect(screen.getByTestId('stp-record').textContent).toContain('Record beat 2 · take 2'));
    // A kept take for another beat does not count here.
    expect(screen.getByTestId('stp-record').textContent).not.toContain('take 3');
  });

  test('a discarded take still counts, and the download carries the date and time', async () => {
    await openBeat2();
    await recordAndStop();
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { names.push(this.download); });
    fireEvent.click(screen.getByTestId('stp-download-take'));
    expect(names[0]).toMatch(/^Beat 2 - Login Sequence - take 1 - \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.webm$/);
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(screen.getByTestId('stp-record').textContent).toContain('Record beat 2 · take 2');
    await recordAndStop();
    expect(screen.getByTestId('stp-review-name').textContent).toMatch(/^Beat 2 · Login Sequence · take 2/);
  });
});

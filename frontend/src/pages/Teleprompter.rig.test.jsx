// Rig mode (Evoni, 2026-10-28: she reads off a beam-splitter teleprompter;
// the device under the glass can't film her). Flip upside down turns the
// reading area and everything over it; Rig mode is only the words, Mirror
// on, no camera, the screen kept on, the remote's QR code open, remembered
// on this device; the phone's take commands count in, scroll and stop the
// rig, which shows only a small "Recording on phone" dot. Save while you
// record: a take's parts go up while it records, Save completes it without
// sending anything twice, Discard throws the upload away.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

import api from '../services/api';
import { fakeTakeUploads } from '../test/fakeTakeUploads';
import TeleprompterReader, { SETTINGS_KEY, RIG_KEY, readSettings } from '../components/Teleprompter/TeleprompterReader';
import { setTakeStore } from '../lib/takeStore';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  'Lala: "Okay besties."',
  '## BEAT: 2 · Login Sequence',
  'JustAWoman: "Let us go."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const TOKEN = 'A'.repeat(43);
const MB = 1024 * 1024;

let recorders;
class ChunkRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || 'video/webm'; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  emit(bytes) { this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)], { type: 'video/webm' }) }); }
  stop() { this.state = 'inactive'; this.emit(MB); this.onstop?.(); }
}
ChunkRecorder.isTypeSupported = (t) => t === 'video/webm';

function memoryStore() {
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
    unsaved: async () => [],
    remove: async (id) => { takes.delete(id); return true; },
  };
}

let pending;
let uploads;
let wakeLock;
let getUserMedia;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  pending = [];
  recorders = [];
  setTakeStore(memoryStore());
  vi.mocked(api.get).mockImplementation(async (url, opts) => {
    if (url === '/api/v1/teleprompter-remote/s1/commands') {
      const after = Number(opts?.params?.after) || 0;
      const commands = pending.filter((c) => c.seq > after);
      return { data: { data: { seq: commands.length ? commands[commands.length - 1].seq : after, commands, ended: false } } };
    }
    return { data: { data: [] } };
  });
  uploads = fakeTakeUploads(api, async () => ({ data: { data: { id: 'clip-new', beat_number: 1, label: 'x' }, stored: ['start_line'], not_stored: [] } }), {
    other: async (url) => (url === '/api/v1/teleprompter-remote'
      ? { data: { data: { id: 's1', token: TOKEN, expires_at: '2026-10-28T18:05:00Z', command_seq: 0 } } }
      : { data: { data: {} } }),
  });
  vi.mocked(api.delete).mockResolvedValue({ data: { data: { ended: true } } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false }));
  window.MediaRecorder = ChunkRecorder;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  wakeLock = { request: vi.fn(async () => ({ released: false, release: vi.fn(async () => {}), addEventListener: vi.fn() })) };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock });
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); setTakeStore(null); delete window.MediaRecorder; });

const root = () => screen.getByTestId('teleprompter');
const view = () => screen.getByTestId('stp-view');
const lastState = () => {
  const puts = vi.mocked(api.put).mock.calls.filter(([u]) => u === '/api/v1/teleprompter-remote/s1/state');
  return puts.length ? puts[puts.length - 1][1].state : null;
};

describe('Flip upside down', () => {
  test('sits next to Mirror, turns the reading area over (both can be on), is remembered; the controls are not turned', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    const flip = screen.getByTestId('stp-flip');
    expect(flip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('stp-mirror').nextElementSibling).toBe(flip);
    fireEvent.click(flip);
    fireEvent.click(screen.getByTestId('stp-mirror'));
    expect(root().className).toMatch(/is-flipped/);
    expect(root().className).toMatch(/is-mirrored/);
    expect(readSettings()).toMatchObject({ flipV: true, mirror: true });
    // The page, its beat headings and its cutscene banner are inside what flips; the controls are not.
    expect(view().contains(screen.getByTestId('stp-page'))).toBe(true);
    expect(view().contains(document.querySelector('.stp-beat-head'))).toBe(true);
    expect(view().contains(screen.getByTestId('stp-controls'))).toBe(false);
    fireEvent.click(flip);
    expect(root().className).not.toMatch(/is-flipped/);
  });

  test('the 3-2-1 and the silence cue are inside the flipped area', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: true, flipV: true, pacing: 'lines' }));
    render(<TeleprompterReader source={source} countdownMs={2000} onClose={() => {}} />);
    expect(root().className).toMatch(/is-flipped/);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(view().contains(screen.getByTestId('stp-countdown'))).toBe(true);
  });

  test('an older device with no flipV saved reads it as off', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mirror: true }));
    expect(readSettings()).toMatchObject({ mirror: true, flipV: false });
  });
});

describe('Rig mode', () => {
  test('Mirror on (Flip kept), only the words on black, no camera, screen kept on, the QR code open; remembered on this device', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, flipV: true }));
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-rig-toggle'));
    expect(root().className).toMatch(/is-rig/);
    expect(root().className).toMatch(/is-mirrored/);
    expect(root().className).toMatch(/is-flipped/);
    expect(window.localStorage.getItem(RIG_KEY)).toBe('on');
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/teleprompter-remote', { episode_id: 'ep-1' });
    await waitFor(() => expect(wakeLock.request).toHaveBeenCalledWith('screen'));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByTestId('stp-preview')).toBeNull();
    expect(screen.queryByTestId('stp-record-mode')).toBeNull();
    // The state tells the phone it is a rig, and what the next take is called.
    await waitFor(() => expect(lastState()).toMatchObject({ rig: true, phoneTake: false, takeLabel: 'Beat 1 · Opening Ritual · take 1', takeNo: 1, performer: 'justawoman', readAs: 'JustAWoman', episodeId: 'ep-1', scope: 'beat' }));
    // A new visit on this device opens in rig mode, the QR code with it.
    cleanup();
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    expect(root().className).toMatch(/is-rig/);
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-rig-toggle'));
    expect(root().className).not.toMatch(/is-rig/);
    expect(window.localStorage.getItem(RIG_KEY)).toBeNull();
  });

  test('the phone starts a take: the rig counts in and scrolls, shows only the red dot; the phone\'s Stop stops it', async () => {
    window.localStorage.setItem(RIG_KEY, 'on');
    render(<TeleprompterReader source={source} countdownMs={10} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    pending.push({ seq: 1, command: 'phone_take_start' });
    await waitFor(() => expect(screen.getByTestId('stp-rig-recording').textContent).toContain('Recording on phone'), { timeout: 3000 });
    expect(view().contains(screen.getByTestId('stp-rig-recording'))).toBe(true);
    // The QR code steps aside once the phone is driving; nothing else shows.
    expect(screen.queryByTestId('stp-remote-qr')).toBeNull();
    expect(screen.queryByTestId('stp-recording')).toBeNull();
    await waitFor(() => expect(lastState()).toMatchObject({ phoneTake: true, playing: true, running: true }), { timeout: 3000 });
    // The next take is numbered on from this one.
    await waitFor(() => expect(lastState().takeLabel).toBe('Beat 1 · Opening Ritual · take 2'));
    pending.push({ seq: 2, command: 'phone_take_pause' });
    await waitFor(() => expect(lastState()).toMatchObject({ phoneTake: true, playing: false }), { timeout: 3000 });
    pending.push({ seq: 3, command: 'phone_take_stop' });
    await waitFor(() => expect(screen.queryByTestId('stp-rig-recording')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(lastState()).toMatchObject({ phoneTake: false, playing: false }));
  });

  test('the rig picks what the phone\'s take records: Whole episode tells the phone, with the full-take name', async () => {
    window.localStorage.setItem(RIG_KEY, 'on');
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-scope-episode'));
    await waitFor(() => expect(lastState()).toMatchObject({ scope: 'episode', takeLabel: 'Full episode · take 1', beat: 1, rig: true }));
  });

  test('the older commands still work the same', async () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-remote-toggle'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    pending.push({ seq: 1, command: 'bigger' });
    await waitFor(() => expect(lastState()).toMatchObject({ size: 44, rig: false }), { timeout: 3000 });
  });
});

describe('Save while you record', () => {
  async function recordHere() {
    render(<TeleprompterReader source={source} startBeat={2} countdownMs={10} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-record'));
    await waitFor(() => expect(screen.getByTestId('stp-stop').textContent).toContain('Stop & review'));
    return recorders[recorders.length - 1];
  }

  test('parts go up while recording; after Stop the review says how much is saved; Save completes it, nothing sent twice', async () => {
    const rec = await recordHere();
    rec.emit(5 * MB);
    rec.emit(5 * MB);
    await waitFor(() => expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1']));
    expect(uploads.starts[0].body).toMatchObject({ size_unknown: true, performer: 'justawoman', label: 'Beat 2 · Login Sequence · take 1', beat_number: 2, content_type: 'video/webm' });
    expect(uploads.starts[0].body.filename).toBe('beat-2-take-1.webm');
    expect(uploads.starts[0].body).not.toHaveProperty('size');
    expect(uploads.parts[0].data.size).toBe(8 * MB);
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    // The last (smaller) part goes up while she reviews: 11 MB, two parts.
    await waitFor(() => expect(screen.getByTestId('stp-live-saved').textContent).toBe('Saved while recording: 100%. Save take finishes it.'));
    expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2']);
    expect(uploads.parts[1].data.size).toBe(3 * MB);
    expect(uploads.completes).toHaveLength(0); // never saved by itself
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files: Beat 2 · Login Sequence · take 1"));
    expect(uploads.starts).toHaveLength(1);
    expect(uploads.parts).toHaveLength(2);
    expect(uploads.completes).toHaveLength(1);
    expect(uploads.completes[0].body).toMatchObject({ size: 11 * MB, fields: expect.objectContaining({ beat_number: 2, label: 'Beat 2 · Login Sequence · take 1' }) });
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('Save pressed while parts are still going up waits for them: no part twice', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    vi.mocked(api.put).mockImplementation(async (url, data) => {
      uploads.parts.push({ url, data });
      if (url.endsWith('/parts/2')) await gate;
      return { data: { success: true } };
    });
    const rec = await recordHere();
    rec.emit(9 * MB);
    await waitFor(() => expect(uploads.parts).toHaveLength(1));
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    await waitFor(() => expect(uploads.parts).toHaveLength(2));
    fireEvent.click(screen.getByTestId('stp-save'));
    await new Promise((r) => { setTimeout(r, 30); });
    expect(uploads.completes).toHaveLength(0);
    release();
    await waitFor(() => expect(uploads.completes).toHaveLength(1));
    expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2']);
  });

  test('Discard throws the upload away on the server', async () => {
    const rec = await recordHere();
    rec.emit(9 * MB);
    await waitFor(() => expect(uploads.parts).toHaveLength(1));
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-discard'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/uploads/up-1'));
    expect(api.delete.mock.calls.filter(([u]) => u.includes('/uploads/'))).toHaveLength(1);
    expect(uploads.completes).toHaveLength(0);
  });

  test('a part that fails while recording: Save sends only the rest (the Retry flow), and the parts sent are kept with the take', async () => {
    let fail = true;
    vi.mocked(api.put).mockImplementation(async (url, data) => {
      uploads.parts.push({ url, data });
      if (url.endsWith('/parts/2') && fail) { fail = false; throw Object.assign(new Error('400'), { response: { status: 400, data: { error: 'Part 2 arrived incomplete. Try again.' } } }); }
      return { data: { success: true } };
    });
    const rec = await recordHere();
    rec.emit(17 * MB);
    await waitFor(() => expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2']));
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    await waitFor(() => expect(screen.getByTestId('stp-live-saved').textContent).toMatch(/Saved while recording: \d+%/));
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
    expect(uploads.starts).toHaveLength(1);
    expect(uploads.parts.map((p) => p.url.split('/').pop())).toEqual(['1', '2', '2', '3']);
    expect(uploads.completes).toHaveLength(1);
  });
});

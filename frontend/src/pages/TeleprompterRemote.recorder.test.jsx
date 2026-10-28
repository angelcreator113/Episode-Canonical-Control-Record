// "Record on this phone" (Rig mode; Evoni, 2026-10-28): the phone behind the
// glass records; its Record starts the rig (phone_take_start), Stop stops
// both, the rig ending the take stops it here too; the beat markers come
// from the rig's state, placed earlier by the state's age and the round
// trip; the take saves to the episode's Files with the rig's name, number
// and performer; the back camera by default, switchable.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { fakeTakeUploads } from '../test/fakeTakeUploads';
import TeleprompterRemote from './TeleprompterRemote';
import { stateLag, takePlan, CAMERA_KEY, RIG_SEND_S } from '../components/Teleprompter/PhoneRecorder';
import { setTakeStore } from '../lib/takeStore';
import { COMMANDS } from '../lib/teleprompterRemoteApi';

const TOKEN = 'A'.repeat(43);
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || 'video/webm'; this.state = 'inactive'; this.opts = opts; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

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

// The rig's state the phone reads, and the commands the phone sent.
let rig;
let sent;
let getUserMedia;
let uploads;
beforeEach(async () => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  recorders = [];
  sent = [];
  rig = {
    rig: true, running: false, recording: false, reviewing: false, phoneTake: false, scope: 'episode', beat: 1, beatName: 'Opening Ritual',
    episodeId: 'ep-1', takeLabel: 'Full episode · take 3', takeNo: 3, performer: 'justawoman', readAs: 'JustAWoman', startLine: 0, pacing: 'steady',
  };
  setTakeStore(memoryStore());
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    if (opts.method === 'POST') {
      const { command } = JSON.parse(opts.body);
      sent.push(command);
      if (command === 'phone_take_start') rig = { ...rig, phoneTake: true, running: true };
      if (command === 'phone_take_stop') rig = { ...rig, phoneTake: false, running: false };
      return reply(200, { success: true, data: { seq: sent.length, state: rig } });
    }
    return reply(200, { success: true, data: { state: rig, expires_at: '2026-10-28T18:05:00Z', seq: sent.length, state_age_ms: 300 } });
  }));
  uploads = fakeTakeUploads(api, async (url, form) => ({ data: { data: { id: 'clip-9', label: form.get('label'), beat_marks: [] }, stored: ['beat_marks'], not_stored: [] } }));
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem('authToken', 'signed-in');
  window.location.hash = `#${TOKEN}`;
  // The hashchange the line above fires lands now, not after the page renders.
  await new Promise((r) => { setTimeout(r, 0); });
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn(async () => ({ released: false, release: vi.fn(async () => {}), addEventListener: vi.fn() })) } });
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setTakeStore(null); delete window.MediaRecorder; window.location.hash = ''; });

async function openRecorder() {
  render(<TeleprompterRemote pollMs={40} />);
  fireEvent.click(await screen.findByTestId('tpr-record-here'));
  await waitFor(() => expect(screen.getByTestId('tpr-phone-record').disabled).toBe(false));
}

describe('helpers', () => {
  test('stateLag: the state\'s age, half the round trip and the rig\'s sending delay, in seconds (capped)', () => {
    expect(stateLag({ ageMs: 300, rttMs: 200 })).toBeCloseTo(0.4 + RIG_SEND_S);
    expect(stateLag({})).toBeCloseTo(RIG_SEND_S);
    expect(stateLag({ ageMs: 60000, rttMs: 0 })).toBe(5);
  });
  test('takePlan: what the rig said about the take, validated', () => {
    expect(takePlan(rig)).toMatchObject({ scope: 'episode', episodeId: 'ep-1', label: 'Full episode · take 3', takeNo: 3, beat: 1, performer: 'justawoman' });
    expect(takePlan({ scope: 'beat', beat: 4, startLine: 2, performer: 'admin' })).toMatchObject({ scope: 'beat', beat: 4, startLine: 2, performer: 'justawoman' });
  });
  test('the phone_take_* commands are allowed on the page too', () => {
    ['phone_take_start', 'phone_take_stop', 'phone_take_pause', 'phone_take_resume'].forEach((c) => expect(COMMANDS).toContain(c));
  });
});

describe('Record on this phone', () => {
  test('opens the back camera by default; the front one is a tap away and remembered; never while recording', async () => {
    await openRecorder();
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toBe('environment');
    fireEvent.click(screen.getByTestId('tpr-switch-camera'));
    await waitFor(() => expect(getUserMedia.mock.calls.at(-1)[0].video.facingMode).toBe('user'));
    expect(window.localStorage.getItem(CAMERA_KEY)).toBe('user');
    await waitFor(() => expect(screen.getByTestId('tpr-preview').className).toMatch(/is-front/));
    expect(screen.getByTestId('tpr-next-take').textContent).toBe('Next: Full episode · take 3');
  });

  test('Record starts the rig; beat markers come from its state; the rig ending the take stops it here; Save puts it in Files with the rig\'s name', async () => {
    await openRecorder();
    fireEvent.click(screen.getByTestId('tpr-phone-record'));
    expect(sent).toEqual(['phone_take_start']);
    expect(recorders[0].opts).toMatchObject({ videoBitsPerSecond: 2_500_000 });
    await screen.findByTestId('tpr-rec-time');
    // The pad hides while recording (only Stop and Pause).
    expect(screen.queryByTestId('tpr-toggle')).toBeNull();
    // The rig moves on to beat 2 and then 4: two more markers, in order.
    rig = { ...rig, beat: 2 };
    await waitFor(() => expect(screen.getByTestId('tpr-phone-marks').textContent).toBe('Beat 2 · 2 markers'));
    rig = { ...rig, beat: 4 };
    await waitFor(() => expect(screen.getByTestId('tpr-phone-marks').textContent).toBe('Beat 4 · 3 markers'));
    // The rig reached the end of the script: it ends the take, and so does the phone.
    rig = { ...rig, phoneTake: false, running: false };
    await screen.findByTestId('tpr-review');
    expect(screen.getByTestId('tpr-rec-notice').textContent).toContain('The prompter ended the take.');
    expect(screen.getByTestId('tpr-review-name').textContent).toMatch(/^Full episode · take 3 · /);
    fireEvent.click(screen.getByTestId('tpr-save'));
    await waitFor(() => expect(screen.getByTestId('tpr-rec-notice').textContent.trim()).toBe("Saved to the episode's Files: Full episode · take 3"));
    const start = uploads.starts[0].body;
    expect(start).toMatchObject({ performer: 'justawoman', label: 'Full episode · take 3', filename: 'full-episode-take-3.webm', content_type: 'video/webm' });
    expect(start).not.toHaveProperty('beat_number');
    const marks = JSON.parse(start.beat_marks);
    expect(marks.map((m) => m.beat)).toEqual([1, 2, 4]);
    expect(marks[0].t).toBe(0);
    marks.slice(1).forEach((m, i) => expect(m.t).toBeGreaterThanOrEqual(marks[i].t));
    expect(uploads.completes).toHaveLength(1);
    expect(screen.queryByTestId('tpr-review')).toBeNull();
  });

  test('Stop on the phone stops the rig too; Pause and Resume go to the rig', async () => {
    await openRecorder();
    fireEvent.click(screen.getByTestId('tpr-phone-record'));
    await screen.findByTestId('tpr-rec-time');
    fireEvent.click(screen.getByTestId('tpr-phone-pause'));
    await waitFor(() => expect(sent).toContain('phone_take_pause'));
    fireEvent.click(screen.getByTestId('tpr-phone-pause'));
    await waitFor(() => expect(sent).toContain('phone_take_resume'));
    fireEvent.click(screen.getByTestId('tpr-phone-stop'));
    await screen.findByTestId('tpr-review');
    expect(sent.at(-1)).toBe('phone_take_stop');
    expect(screen.queryByTestId('tpr-rec-notice')).toBeNull();
  });

  test('a one-beat take saves with its beat and start line', async () => {
    rig = { ...rig, scope: 'beat', beat: 2, takeLabel: 'Beat 2 · Login Sequence · take 1 · from line 3', takeNo: 1, startLine: 2 };
    await openRecorder();
    fireEvent.click(screen.getByTestId('tpr-phone-record'));
    await screen.findByTestId('tpr-rec-time');
    fireEvent.click(screen.getByTestId('tpr-phone-stop'));
    await screen.findByTestId('tpr-review');
    fireEvent.click(screen.getByTestId('tpr-save'));
    await waitFor(() => expect(uploads.completes).toHaveLength(1));
    expect(uploads.starts[0].body).toMatchObject({ beat_number: 2, start_line: 2, label: 'Beat 2 · Login Sequence · take 1 · from line 3', filename: 'beat-2-take-1.webm' });
    expect(uploads.starts[0].body).not.toHaveProperty('beat_marks');
  });

  test('Discard asks, then throws the take away: nothing is uploaded, and Record is ready again', async () => {
    await openRecorder();
    fireEvent.click(screen.getByTestId('tpr-phone-record'));
    await screen.findByTestId('tpr-rec-time');
    fireEvent.click(screen.getByTestId('tpr-phone-stop'));
    await screen.findByTestId('tpr-review');
    fireEvent.click(screen.getByTestId('tpr-discard'));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('tpr-review')).toBeNull());
    expect(uploads.starts).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId('tpr-phone-record').disabled).toBe(false));
  });

  test('Record waits while the rig is busy with its own take', async () => {
    rig = { ...rig, recording: true };
    render(<TeleprompterRemote pollMs={40} />);
    fireEvent.click(await screen.findByTestId('tpr-record-here'));
    await screen.findByTestId('tpr-rig-busy');
    expect(screen.getByTestId('tpr-phone-record').disabled).toBe(true);
  });

  test('not signed in on this phone: no Save, a plain note, and Download still works', async () => {
    window.localStorage.removeItem('authToken');
    await openRecorder();
    fireEvent.click(screen.getByTestId('tpr-phone-record'));
    await screen.findByTestId('tpr-rec-time');
    fireEvent.click(screen.getByTestId('tpr-phone-stop'));
    await screen.findByTestId('tpr-review');
    expect(screen.queryByTestId('tpr-save')).toBeNull();
    expect(screen.getByTestId('tpr-sign-in').textContent).toMatch(/Sign in to the app on this phone/);
    expect(screen.getByTestId('tpr-download')).toBeTruthy();
    expect(uploads.starts).toHaveLength(0);
  });
});

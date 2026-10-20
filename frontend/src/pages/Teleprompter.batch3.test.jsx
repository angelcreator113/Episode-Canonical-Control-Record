// Teleprompter batch 3 (Evoni, 2026-10-20): the phone remote (QR code on the
// desktop, commands from the phone page) and voice clips (record a line in
// Lala's voice; the teleprompter plays it and waits for it).
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async (text) => `data:image/png;base64,QR(${text.length})`) } }));

import api from '../services/api';
import QRCode from 'qrcode';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import TeleprompterRemote from './TeleprompterRemote';
import { teleprompterIndexMap } from '../lib/teleprompterLines';
import { clipsByLine, withClip, isStale, voiceExtension, lineKey, pickVoiceType } from '../lib/voiceClipsApi';
import { remoteUrl, groupedCode, tokenFrom, expiryText } from '../lib/teleprompterRemoteApi';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties."',
  '## BEAT: 8 · Transformation Loop',
  'Lala: "Gorgeous darling, truly gorgeous."',
  '[UI: notify Mail]',
  'JustAWoman: "This is the one."',
  '(She turns to the mirror.)',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };
const TOKEN = 'A'.repeat(43);
const CLIP = { id: 'v1', episode_id: 'ep-1', beat_number: 8, line_index: 0, speaker: 'Lala', line_text: 'Gorgeous darling, truly gorgeous.', url: 'https://bucket/v1.webm', duration_seconds: 7.5 };

let audios;
class FakeAudio {
  constructor(src) { this.src = src; this.paused = true; this.listeners = {}; this.play = vi.fn(async () => { this.paused = false; }); this.pause = vi.fn(() => { this.paused = true; }); audios.push(this); }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn); }
  emit(name) { (this.listeners[name] || []).forEach((f) => f()); }
}
let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType || 'audio/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'audio/webm;codecs=opus' || t === 'video/webm';

// Remote commands the server hands out, oldest first.
let pending;
let voiceRows;
let voiceStatus;
let remoteStatus;
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url, opts) => {
    if (url === '/api/v1/script-voice-clips/ep-1') {
      if (voiceStatus === 409) { const e = new Error('409'); e.response = { status: 409, data: { code: 'MIGRATION_PENDING', error: 'not yet' } }; throw e; }
      return { data: { data: voiceRows } };
    }
    if (url === '/api/v1/teleprompter-remote/s1/commands') {
      const after = Number(opts?.params?.after) || 0;
      const commands = pending.filter((c) => c.seq > after);
      return { data: { data: { seq: commands.length ? commands[commands.length - 1].seq : after, commands, ended: false } } };
    }
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    if (url === '/api/v1/teleprompter-remote') {
      if (remoteStatus === 409) { const e = new Error('409'); e.response = { status: 409, data: { code: 'MIGRATION_PENDING' } }; throw e; }
      return { data: { data: { id: 's1', token: TOKEN, expires_at: '2026-10-20T18:05:00Z', command_seq: 0 } } };
    }
    if (url === '/api/v1/script-voice-clips/ep-1') {
      return { data: { data: { id: 'v-new', beat_number: Number(body.get('beat_number')), line_index: Number(body.get('line_index')), speaker: body.get('speaker'), line_text: body.get('line_text'), url: 'https://bucket/v-new.webm', duration_seconds: Number(body.get('duration_seconds')) } } };
    }
    return { data: { data: {} } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.delete).mockResolvedValue({ data: { data: { ended: true } } });
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  pending = [];
  voiceRows = [CLIP];
  voiceStatus = 200;
  remoteStatus = 201;
  audios = [];
  recorders = [];
  mockApi();
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false }));
  window.Audio = FakeAudio;
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  URL.createObjectURL = vi.fn(() => 'blob:voice');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); delete window.MediaRecorder; delete window.Audio; });

const activeLine = () => document.querySelector('[data-at="true"]');

describe('helpers', () => {
  test('teleprompterIndexMap skips lines the teleprompter does not show', () => {
    expect(teleprompterIndexMap(['Lala: "Hi."', '[UI: notify Mail]', 'Me: "Yes."', '[STAT: coins +5]', '(She waves.)'])).toEqual([0, null, 1, null, 2]);
  });
  test('voice clip helpers: one per line, stale when the words changed, extension by type', () => {
    const map = clipsByLine([CLIP]);
    expect(map.get(lineKey(8, 0)).id).toBe('v1');
    const next = withClip([CLIP], { ...CLIP, id: 'v2' });
    expect(next.map((c) => c.id)).toEqual(['v2']);
    expect(isStale(CLIP, 'Gorgeous  darling, truly gorgeous.')).toBe(false);
    expect(isStale(CLIP, 'Gorgeous, darling.')).toBe(true);
    expect(voiceExtension('audio/mp4')).toBe('.m4a');
    expect(voiceExtension('audio/webm;codecs=opus')).toBe('.webm');
    expect(pickVoiceType(FakeRecorder)).toBe('audio/webm;codecs=opus');
  });
  test('remote helpers: token in the fragment, typed code back to the token', () => {
    expect(remoteUrl('https://primepisodes.com', TOKEN)).toBe(`https://primepisodes.com/teleprompter/remote#${TOKEN}`);
    expect(groupedCode('abcdefghij')).toBe('abcd efgh ij');
    expect(tokenFrom(' abcd efgh ij ')).toBe('abcdefghij');
    expect(tokenFrom(`https://x/teleprompter/remote#${TOKEN}`)).toBe(TOKEN);
    expect(expiryText('nope')).toBeNull();
    expect(expiryText('2026-10-20T18:05:00Z')).toMatch(/^Ends at /);
  });
});

describe('Phone remote on the desktop', () => {
  test('opens a session and shows its QR code, the code typed out and when it ends', async () => {
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-remote-toggle'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/teleprompter-remote', { episode_id: 'ep-1' });
    expect(QRCode.toDataURL).toHaveBeenCalledWith(`${window.location.origin}/teleprompter/remote#${TOKEN}`, expect.any(Object));
    expect(screen.getByTestId('stp-remote-code').textContent.replace(/\s/g, '')).toBe(TOKEN);
    expect(screen.getByTestId('stp-remote-expiry').textContent).toMatch(/Ends at/);
  });

  test("applies the phone's commands in order: bigger, toggle; a take only in Read & record", async () => {
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-remote-toggle'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    expect(screen.getByTestId('stp-size').textContent).toContain('40');
    pending = [{ seq: 1, command: 'bigger' }, { seq: 2, command: 'bigger' }, { seq: 3, command: 'record_start' }, { seq: 4, command: 'toggle' }];
    await waitFor(() => expect(screen.getByTestId('stp-size').textContent).toContain('48'), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByTestId('stp-recording')).toBeNull();
    // Its state goes to the phone.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/teleprompter-remote/s1/state', { state: expect.objectContaining({ running: true, beat: 8, size: 48, recordMode: false }) }));
    // Each command applied once: later polls ask after seq 4.
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([u, o]) => u.endsWith('/commands') && o?.params?.after === 4)).toBe(true), { timeout: 3000 });
    expect(screen.getByTestId('stp-size').textContent).toContain('48');
  });

  test('End ends the session; leaving the reader ends it too', async () => {
    const { unmount } = render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-remote-toggle'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-end')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-remote-end'));
    expect(api.delete).toHaveBeenCalledWith('/api/v1/teleprompter-remote/s1');
    expect(screen.getByTestId('stp-remote-ended')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-remote-reopen'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-qr')).toBeTruthy());
    unmount();
    expect(vi.mocked(api.delete).mock.calls.length).toBe(2);
  });

  test("before the database update, the panel says so and nothing polls", async () => {
    remoteStatus = 409;
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-remote-toggle'));
    await waitFor(() => expect(screen.getByTestId('stp-remote-unavailable').textContent).toMatch(/database update/));
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.includes('/commands'))).toBe(false);
  });
});

describe('Phone remote page', () => {
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  afterEach(() => { window.location.hash = ''; });

  test('reads the token from the fragment, shows the state, sends a press with X-Remote-Token', async () => {
    window.location.hash = `#${TOKEN}`;
    const fetchMock = vi.fn(async (url, opts) => (opts.method === 'POST'
      ? reply(200, { success: true, data: { seq: 1, state: { running: true, beat: 8, beatName: 'Transformation Loop', pacing: 'lines', pace: 1 } } })
      : reply(200, { success: true, data: { state: { running: false, beat: 8, beatName: 'Transformation Loop', pacing: 'lines', pace: 1, size: 40, recordMode: false }, expires_at: '2026-10-20T18:05:00Z', seq: 0 } })));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-state').textContent).toBe('Paused'));
    expect(screen.getByTestId('tpr-beat').textContent).toBe('Beat 8 · Transformation Loop');
    expect(screen.queryByTestId('tpr-record_start')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/teleprompter-remote/phone/state');
    expect(fetchMock.mock.calls[0][1].headers['X-Remote-Token']).toBe(TOKEN);
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN);
    fireEvent.click(screen.getByTestId('tpr-toggle'));
    await waitFor(() => expect(screen.getByTestId('tpr-state').textContent).toBe('Running'));
    const post = fetchMock.mock.calls.find(([, o]) => o.method === 'POST');
    expect(post[0]).toBe('/api/v1/teleprompter-remote/phone/commands');
    expect(JSON.parse(post[1].body)).toEqual({ command: 'toggle' });
    expect(post[1].headers['X-Remote-Token']).toBe(TOKEN);
    vi.unstubAllGlobals();
  });

  test('Start take shows only in Read & record; an ended session says so', async () => {
    window.location.hash = `#${TOKEN}`;
    let gone = false;
    vi.stubGlobal('fetch', vi.fn(async () => (gone ? reply(410, { success: false, error: 'ended', code: 'SESSION_GONE' })
      : reply(200, { success: true, data: { state: { running: false, recordMode: true, recording: false }, expires_at: null, seq: 0 } }))));
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-record_start')).toBeTruthy());
    gone = true;
    fireEvent.click(screen.getByTestId('tpr-record_start'));
    await waitFor(() => expect(screen.getByTestId('tpr-gone').textContent).toMatch(/Session ended or expired/));
    vi.unstubAllGlobals();
  });

  test('with no token, a code can be typed', async () => {
    const fetchMock = vi.fn(async () => reply(200, { success: true, data: { state: null, expires_at: null, seq: 0 } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeleprompterRemote pollMs={60000} />);
    fireEvent.change(screen.getByTestId('tpr-code'), { target: { value: groupedCode(TOKEN) } });
    fireEvent.click(screen.getByTestId('tpr-connect'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][1].headers['X-Remote-Token']).toBe(TOKEN);
    vi.unstubAllGlobals();
  });
});

describe('Voice clips in the teleprompter', () => {
  test("plays the clip on the reading line, counts its own length, and waits for it in Pace by line times", async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines' }));
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    expect(activeLine().textContent).toContain('Gorgeous darling');
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios.length).toBe(1));
    expect(audios[0].src).toBe(CLIP.url);
    await waitFor(() => expect(audios[0].play).toHaveBeenCalled());
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('8s'); // 7.5s, not the estimate
    expect(screen.getByTestId('stp-quiet-voice')).toBeTruthy();
    // Pause pauses the clip; Play carries on.
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(audios[0].pause).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('stp-play'));
    await waitFor(() => expect(audios[0].play).toHaveBeenCalledTimes(2));
    // It holds until the clip ends, then the next line comes up.
    await new Promise((r) => setTimeout(r, 300));
    expect(activeLine().textContent).toContain('Gorgeous darling');
    act(() => audios[0].emit('ended'));
    await waitFor(() => expect(activeLine().textContent).toContain('This is the one'));
  });

  test('Play voice clips off: no clip plays and the estimate counts', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', playVoice: false }));
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle').getAttribute('aria-pressed')).toBe('false'));
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
    expect(screen.queryByTestId('stp-quiet-voice')).toBeNull();
    fireEvent.click(screen.getByTestId('stp-voice-toggle'));
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).playVoice).toBe(true);
  });

  test('reading as Lala, her own clip does not play', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', readAs: 'Lala' }));
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-play'));
    await new Promise((r) => setTimeout(r, 50));
    expect(audios.length).toBe(0);
  });

  test('Record voice records the line on the reading line and saves it as its clip', async () => {
    voiceRows = [];
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-record')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    const panel = screen.getByTestId('stp-voice-panel');
    expect(panel.textContent).toContain('Lala · beat 8, line 1');
    fireEvent.click(screen.getByTestId('vr-record'));
    await waitFor(() => expect(screen.getByTestId('vr-stop').disabled).toBe(false));
    expect(recorders[0].mimeType).toBe('audio/webm;codecs=opus');
    fireEvent.click(screen.getByTestId('vr-stop'));
    await waitFor(() => expect(screen.getByTestId('vr-take-audio')).toBeTruthy());
    fireEvent.click(screen.getByTestId('vr-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/script-voice-clips/ep-1', expect.any(FormData), { timeout: 0 }));
    const form = vi.mocked(api.post).mock.calls.find(([u]) => u.includes('script-voice-clips'))[1];
    expect(form.get('beat_number')).toBe('8');
    expect(form.get('line_index')).toBe('0');
    expect(form.get('speaker')).toBe('Lala');
    expect(form.get('line_text')).toBe('Gorgeous darling, truly gorgeous.');
    expect(form.get('audio').name).toBe('voice-beat-8-line-1.webm');
    await waitFor(() => expect(screen.getByTestId('stp-voice-record').textContent).toContain('✓'));
  });

  test('before the database update, voice clips say so and Record voice hides', async () => {
    voiceStatus = 409;
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-not-ready')).toBeTruthy());
    expect(screen.getByTestId('stp-voice-toggle').disabled).toBe(true);
    expect(screen.queryByTestId('stp-voice-record')).toBeNull();
  });

  test('in Read & record with clips, it says plainly to use headphones', async () => {
    render(<TeleprompterReader source={source} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toMatch(/Use headphones to keep them out of the take/));
  });
});

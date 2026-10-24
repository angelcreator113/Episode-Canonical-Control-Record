// Teleprompter audit 10 and 11 (2026-10-24), and the two hooks behind
// audit 2 and 3: the phone remote shows PAUSED, waits while the desktop
// reviews, and stops with "Stop & review"; an unsaved voice clip is guarded;
// useBackGuard and useWakeLock on their own.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterRemote from './TeleprompterRemote';
import TeleprompterReader from '../components/Teleprompter/TeleprompterReader';
import useBackGuard from '../hooks/useBackGuard';
import useWakeLock from '../hooks/useWakeLock';

const TOKEN = 'A'.repeat(43);
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const phoneWith = (state) => vi.fn(async () => reply(200, { success: true, data: { state, expires_at: null, seq: 0 } }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('audit 10: the phone knows paused, scope and reviewing', () => {
  beforeEach(() => { window.location.hash = `#${TOKEN}`; });

  test('a paused take reads PAUSED and its stop is "Stop & review"', async () => {
    vi.stubGlobal('fetch', phoneWith({ running: false, recordMode: true, recording: true, paused: true, scope: 'beat' }));
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-paused')).toBeTruthy());
    expect(screen.getByTestId('tpr-record_stop').textContent).toBe('Stop & review');
  });

  test('a running whole-episode take says so', async () => {
    vi.stubGlobal('fetch', phoneWith({ running: true, recordMode: true, recording: true, paused: false, scope: 'episode' }));
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-state').textContent).toContain('Recording · whole episode'));
  });

  test('while the desktop reviews a take (or can\'t record) Start take is off', async () => {
    vi.stubGlobal('fetch', phoneWith({ running: false, recordMode: true, recording: false, reviewing: true, canRecord: false }));
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-reviewing')).toBeTruthy());
    expect(screen.getByTestId('tpr-record_start').disabled).toBe(true);
    expect(screen.getByTestId('tpr-review-hint')).toBeTruthy();
  });

  test('camera not ready: Start take is off too', async () => {
    vi.stubGlobal('fetch', phoneWith({ running: false, recordMode: true, recording: false, reviewing: false, canRecord: false }));
    render(<TeleprompterRemote pollMs={60000} />);
    await waitFor(() => expect(screen.getByTestId('tpr-record_start').disabled).toBe(true));
  });
});

describe('audit 11: an unsaved voice clip is guarded', () => {
  const SCRIPT = ['## BEAT: 8 · Transformation Loop', 'Lala: "Gorgeous darling."', 'JustAWoman: "This is the one."'].join('\n');
  const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3' };
  let recorders;
  class FakeRecorder {
    constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) }); this.onstop?.(); }
  }
  FakeRecorder.isTypeSupported = (t) => t === 'audio/webm;codecs=opus';
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    recorders = [];
    vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
    window.MediaRecorder = FakeRecorder;
    URL.createObjectURL = vi.fn(() => 'blob:voice');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });
  afterEach(() => { delete window.MediaRecorder; });

  test('a recorded clip not saved: leaving and closing the recorder ask first; beat changes wait', async () => {
    const onClose = vi.fn();
    render(<TeleprompterReader source={source} startBeat={8} onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-record')).toBeTruthy());
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    fireEvent.click(screen.getByTestId('vr-record'));
    await waitFor(() => expect(screen.getByTestId('vr-stop').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('vr-stop'));
    await screen.findByTestId('vr-take-audio');
    fireEvent.click(screen.getByTestId('stp-close'));
    expect(window.confirm).toHaveBeenCalledWith('Your voice clip is not saved yet. Leave and lose it?');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('stp-voice-record'));
    expect(window.confirm).toHaveBeenLastCalledWith('Your voice clip is not saved yet. Close and lose it?');
    expect(screen.getByTestId('stp-voice-panel')).toBeTruthy();
    // Cancel in the panel throws the clip away on purpose; then nothing asks.
    fireEvent.click(screen.getByTestId('vr-discard'));
    vi.mocked(window.confirm).mockClear();
    fireEvent.click(screen.getByTestId('stp-close'));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useBackGuard', () => {
  test('pushes one entry; Back asks onBack; false puts the entry back; a pop onto its own entry is ignored, onto an older reader\'s is a Back; unmount takes it off', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onBack = vi.fn(() => false);
    const { unmount } = renderHook(() => useBackGuard(true, onBack));
    const mine = window.history.state.stpReader;
    expect(typeof mine).toBe('string');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { stpReader: mine } })); });
    expect(onBack).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(window.history.state.stpReader).toBe(mine);
    // An entry an earlier reader left (before a reload) is not this one's.
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { stpReader: 'rold' } })); });
    expect(onBack).toHaveBeenCalledTimes(2);
    unmount();
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('useWakeLock', () => {
  afterEach(() => { delete navigator.wakeLock; Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); });

  test('asks for the screen lock, asks again when the page comes back, lets go when off', async () => {
    const locks = [];
    const request = vi.fn(async () => { const l = Object.assign(new EventTarget(), { released: false, release: vi.fn(async () => { l.released = true; }) }); locks.push(l); return l; });
    navigator.wakeLock = { request };
    const { result, rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current).toBe(true));
    // The browser drops the lock when the page hides; coming back asks again.
    locks[0].released = true;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    rerender({ on: false });
    expect(locks[1].release).toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  test('no wake lock in this browser: nothing happens', () => {
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current).toBe(false);
  });
});

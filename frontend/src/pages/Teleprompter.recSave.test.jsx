// Teleprompter audit: recording and saving (Evoni, 2026-10-24: "fix all of
// them"). The 500 MB stop and download, Back asks, the take kept on the
// device and offered back, the screen kept on, a take that pauses when the
// phone looks away or the camera goes, an expired sign-in that keeps the
// take, the beat and markers sent with the upload, a pasted-text take that
// stays until Done, and the status line's two lines.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { setTakeStore, createTakeStore } from '../lib/takeStore';
import { fakeIndexedDB } from '../lib/fakeIndexedDB.testutil';
import { STOP_BYTES, LIMIT_NOTE, MARKS_NOT_KEPT } from '../lib/fullEpisodeTake';
import { TRACK_ENDED } from '../hooks/useTakeRecorder';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."',
  'JustAWoman: "Let us go."',
  '## BEAT: 3 · Inbox',
  'JustAWoman: "Mail time."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };

let recorders;
let tracks;
class FakeRecorder {
  constructor(stream, opts) { this.opts = opts; this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['f'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

const track = () => Object.assign(new EventTarget(), { stop: vi.fn() });
let posted;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  recorders = [];
  posted = null;
  tracks = [track(), track()];
  setTakeStore(createTakeStore(null));
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
  vi.mocked(api.post).mockImplementation(async (url, form) => {
    posted = form;
    return { data: { data: { id: 'clip-new', beat_number: Number(form.get('beat_number')) || null, is_favorite: false, start_line: Number(form.get('start_line')), label: form.get('label') }, stored: ['start_line'], not_stored: [] } };
  });
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: 'clip-new', ...body } } }));
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 1 }));
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete window.MediaRecorder;
  delete navigator.wakeLock;
  delete navigator.share;
  delete navigator.canShare;
  setTakeStore(null);
});

async function openRecord(props = {}) {
  const view = render(<TeleprompterReader source={source} startBeat={2} countdownMs={1} onClose={() => {}} {...props} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  return view;
}
async function startTake() {
  fireEvent.click(screen.getByTestId('stp-record'));
  await waitFor(() => expect(recorders.at(-1)?.state).toBe('recording'));
  return recorders.at(-1);
}
async function recordAndStop() {
  await openRecord();
  await startTake();
  fireEvent.click(screen.getByTestId('stp-stop'));
  return screen.findByTestId('stp-review');
}

describe('audit 1: the 500 MB limit', () => {
  test('a take stops by itself at 490 MB, says why, and can be downloaded from the review', async () => {
    await openRecord();
    const r = await startTake();
    act(() => { r.ondataavailable({ data: { size: STOP_BYTES } }); });
    await screen.findByTestId('stp-review');
    expect(screen.getByTestId('stp-status').textContent).toContain(LIMIT_NOTE);
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { names.push(this.download); });
    fireEvent.click(screen.getByTestId('stp-download-take'));
    expect(names).toEqual(['Beat 2 - Login Sequence - take 1.webm']);
    // The take stays for review (and Save) after the download.
    expect(screen.getByTestId('stp-review')).toBeTruthy();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:take');
  });
});

describe('audit 2: Back and a reload never lose a take silently', () => {
  test('Back with a take in review asks; No keeps the reader (and the guard), Yes closes it', async () => {
    const onClose = vi.fn();
    await openRecord({ onClose });
    expect(typeof window.history.state?.stpReader).toBe('string');
    await startTake();
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(window.confirm).toHaveBeenCalledWith('This take is not saved yet. Leave and lose it?');
    expect(onClose).not.toHaveBeenCalled();
    expect(typeof window.history.state?.stpReader).toBe('string');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Back with nothing unsaved just closes', async () => {
    const onClose = vi.fn();
    render(<TeleprompterReader source={source} onClose={onClose} />);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the pieces go to IndexedDB; after a reload the take is offered back, reviewed, saved, and forgotten', async () => {
    const idb = fakeIndexedDB();
    const store = createTakeStore(idb);
    setTakeStore(store);
    await openRecord();
    const r = await startTake();
    act(() => { r.ondataavailable({ data: new Blob(['piece-1'], { type: 'video/webm' }) }); });
    await waitFor(async () => expect((await store.unsaved('episode:ep-1'))[0]?.count).toBe(1));
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    // The take's Blob was put together from the store: both pieces.
    const made = vi.mocked(URL.createObjectURL).mock.calls.at(-1)[0];
    expect(made.size).toBe('piece-1'.length + 1);
    // "Reload": the reader goes without asking (the page went), the take stays on the device.
    cleanup();
    const [kept] = await store.unsaved('episode:ep-1');
    expect(kept).toMatchObject({ finished: true, count: 2, meta: { scope: 'beat', beatNumber: 2, label: 'Beat 2 · Login Sequence · take 1' } });

    render(<TeleprompterReader source={source} countdownMs={1} onClose={() => {}} />);
    const offer = await screen.findByTestId('stp-recover');
    expect(offer.textContent).toMatch(/You have an unsaved take from .* \(Beat 2 · Login Sequence · take 1\)/);
    fireEvent.click(screen.getByTestId('stp-recover-review'));
    await screen.findByTestId('stp-review');
    expect(screen.getByTestId('stp-review-name').textContent).toMatch(/^Beat 2 · Login Sequence · take 1/);
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
    expect(posted.get('beat_number')).toBe('2');
    await waitFor(async () => expect(await store.unsaved('episode:ep-1')).toEqual([]));
  });

  test('Throw it away forgets the kept take', async () => {
    const store = createTakeStore(fakeIndexedDB());
    setTakeStore(store);
    await store.begin('old', { key: 'episode:ep-1', type: 'video/webm', meta: {} });
    await store.addChunk('old', 0, new Blob(['x']));
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    await screen.findByTestId('stp-recover');
    fireEvent.click(screen.getByTestId('stp-recover-drop'));
    await waitFor(() => expect(screen.queryByTestId('stp-recover')).toBeNull());
    await waitFor(async () => expect(await store.unsaved('episode:ep-1')).toEqual([]));
  });

  test('leaving on purpose ("Leave and lose it?" yes) forgets the device copy too', async () => {
    const store = createTakeStore(fakeIndexedDB());
    setTakeStore(store);
    await openRecord();
    const r = await startTake();
    act(() => { r.ondataavailable({ data: new Blob(['p']) }); });
    await waitFor(async () => expect((await store.unsaved('episode:ep-1')).length).toBe(1));
    fireEvent.click(screen.getByTestId('stp-close'));
    expect(window.confirm).toHaveBeenCalledWith('A take is recording. Stop and leave the teleprompter?');
    await waitFor(async () => expect(await store.unsaved('episode:ep-1')).toEqual([]));
  });
});

describe('audit 3: screen lock, app switch, a camera taken away', () => {
  test('the screen is kept on while Read & record is on, asked again on coming back, and let go after', async () => {
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => Object.assign(new EventTarget(), { released: false, release }));
    navigator.wakeLock = { request };
    await openRecord();
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  test('the page hidden mid-take pauses it and says so; Resume carries on', async () => {
    await openRecord();
    const r = await startTake();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    expect(r.state).toBe('paused');
    expect(screen.getByTestId('stp-interrupted').textContent).toContain('The take paused while the phone was away — Resume or Stop & review.');
    expect(screen.getByTestId('stp-recording').textContent).toContain('PAUSED');
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(r.state).toBe('recording');
    expect(screen.queryByTestId('stp-interrupted')).toBeNull();
  });

  test('a camera track that ends pauses the take, hides the black preview, says so; Resume does nothing; Stop & review keeps it', async () => {
    await openRecord();
    const r = await startTake();
    expect(screen.getByTestId('stp-preview')).toBeTruthy();
    act(() => { tracks[0].dispatchEvent(new Event('ended')); });
    expect(r.state).toBe('paused');
    expect(screen.queryByTestId('stp-preview')).toBeNull();
    expect(screen.getByTestId('stp-status').textContent).toContain(TRACK_ENDED);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(r.state).toBe('paused');
    fireEvent.click(screen.getByTestId('stp-stop'));
    expect(await screen.findByTestId('stp-review')).toBeTruthy();
  });

  test('a muted track pauses the take too', async () => {
    await openRecord();
    const r = await startTake();
    act(() => { tracks[1].dispatchEvent(new Event('mute')); });
    expect(r.state).toBe('paused');
    expect(screen.getByTestId('stp-interrupted').textContent).toContain('The phone paused the camera or microphone');
  });
});

describe('audit 5: an expired sign-in keeps the take', () => {
  test('a quick signed-in check goes before the upload; an expired sign-in says what to do and the take stays', async () => {
    await recordAndStop();
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 }, sessionExpired: true }));
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Your sign-in expired. Sign in in another tab, then press Retry here.');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1', { keepSession: true });
    expect(api.post.mock.calls[0][2]).toMatchObject({ keepSession: true, timeout: 0 });
    expect(screen.getByTestId('stp-review')).toBeTruthy();
    expect(screen.getByTestId('stp-save').textContent).toBe('Retry');
  });

  test('a refreshed sign-in: press Retry', async () => {
    await recordAndStop();
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 }, authRefreshed: true }));
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('renewed now. Press Retry');
  });

  test('a check that says the sign-in is over stops before uploading', async () => {
    await recordAndStop();
    vi.mocked(api.get).mockImplementation(async (url, cfg) => {
      if (cfg?.keepSession) throw Object.assign(new Error('401'), { sessionExpired: true });
      return { data: { data: [] } };
    });
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Your sign-in expired');
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('audit 8 and 14: one request carries the beat, start line, markers and length', () => {
  test('a beat take: beat_number, start_line and seconds go with the upload; no PATCH when the server kept them', async () => {
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
    expect(posted.get('beat_number')).toBe('2');
    expect(posted.get('start_line')).toBe('0');
    expect(Number(posted.get('seconds'))).toBeGreaterThanOrEqual(0);
    expect(posted.get('beat_marks')).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
  });

  test('a whole-episode take: beat_marks go with the upload; kept → saved with markers; not kept → the plain note and Download markers', async () => {
    vi.mocked(api.post).mockImplementation(async (url, form) => {
      posted = form;
      return { data: { data: { id: 'clip-full', beat_number: null, beat_marks: JSON.parse(form.get('beat_marks')), is_favorite: false, start_line: null }, stored: ['beat_marks'], not_stored: [] } };
    });
    render(<TeleprompterReader source={source} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('stp-scope-episode'));
    await startTake();
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toMatch(/Saved to the episode's Files: Full episode · take 1 · 1 beat marker/));
    expect(JSON.parse(posted.get('beat_marks'))).toEqual([{ beat: 1, t: 0 }]);
    expect(posted.get('beat_number')).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();

    vi.mocked(api.post).mockImplementation(async () => ({ data: { data: { id: 'clip-full2', beat_number: null }, stored: [], not_stored: ['beat_marks'] } }));
    await startTake();
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain(MARKS_NOT_KEPT));
    expect(screen.getByTestId('stp-download-marks')).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('audit 6: a pasted-text take stays until Done', () => {
  test('download keeps the review (and the take URL); Done closes it, no question; the next take is take 2', async () => {
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { names.push(this.download); });
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hello there.' }} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    await startTake();
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-save'));
    expect(names).toHaveLength(1);
    expect(screen.getByTestId('stp-review')).toBeTruthy();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:take');
    expect(screen.getByTestId('stp-save').textContent).toBe('Download again');
    expect(screen.getByTestId('stp-discard').textContent).toBe(' Done');
    fireEvent.click(screen.getByTestId('stp-discard'));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take');
    expect(screen.getByTestId('stp-record').textContent).toContain('Record take 2');
  });

  test('where the phone can share files: "Save to Photos or Files" opens the share sheet with the take', async () => {
    const share = vi.fn(async () => {});
    navigator.canShare = vi.fn(() => true);
    navigator.share = share;
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hello there.' }} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    await startTake();
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-share-take'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].files[0].name).toMatch(/^Teleprompter take .*\.webm$/);
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain('Shared'));
    expect(screen.getByTestId('stp-review')).toBeTruthy();
  });
});

describe('audit 13: the headphones note after a save', () => {
  test('the saved notice and the headphones note show as two lines', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/script-voice-clips/ep-1'
      ? { data: { data: [{ id: 'v1', beat_number: 2, line_index: 0, speaker: 'Lala', line_text: 'Okay.', url: 'https://x/v.webm', duration_seconds: 1 }] } }
      : { data: { data: [] } }));
    await recordAndStop();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files"));
    expect(screen.getByTestId('stp-headphones').textContent).toContain('Use headphones');
  });
});

// The Teleprompter page and reader (Evoni, 2026-10-20: "I need a
// teleprompter for my script and I need a way to be able to read the script
// and record at the same time").
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import Teleprompter, { PASTE_KEY } from './Teleprompter';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import { lineSeconds } from '../lib/scriptRuntime';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties."',
  'Me: "Ready when you are."',
  '(She smiles at the camera.)',
  '[UI:OPEN closet]',
  '[STAT: coins -50]',
  '[WEAR: p1]',
  '[TRANSITION: cut to]',
  '## BEAT: 8 · Transformation Loop',
  'JustAWoman: "This is the one."',
  'Kelli: "Gorgeous."',
  '## BEAT: 11 · The Event',
  'JAWIHP: "We made it."',
].join('\n');

const EP = { id: 'ep-1', show_id: 'show-1', episode_number: 3, title: 'The Gala', script_content: SCRIPT };

let tracks;
let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.stream = stream; this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['frames'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm;codecs=vp9,opus';

function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/shows') return { data: { data: [{ id: 'show-1', name: 'Styling Adventures' }] } };
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { data: [EP, { id: 'ep-2', episode_number: 4, title: 'Empty one', script_content: '' }] } };
    if (url === '/api/v1/episodes/ep-1') return { data: { data: EP } };
    if (url === '/api/v1/episodes/ep-2') return { data: { data: { id: 'ep-2', show_id: 'show-1', title: 'Empty one', script_content: '' } } };
    if (url === '/api/v1/episode-clips/ep-1') return { data: { data: [{ id: 'c1', performer: 'justawoman', beat_number: 8 }, { id: 'c2', performer: 'lala', beat_number: 8 }] } };
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, form, cfg) => {
    cfg?.onUploadProgress?.({ loaded: 50, total: 100 });
    return { data: { data: { id: 'clip-new', beat_number: null, label: form.get('label') } } };
  });
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: 'clip-new', ...body } } }));
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  mockApi();
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  recorders = [];
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); delete window.MediaRecorder; });

const renderPage = (path = '/teleprompter') => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/teleprompter" element={<Teleprompter />} /></Routes></MemoryRouter>,
);

function Opener({ source, startBeat = null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open prompter</button>
      {open && <TeleprompterReader source={source} startBeat={startBeat} countdownMs={1} onClose={() => setOpen(false)} />}
    </>
  );
}
const scriptSource = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };

async function recordATake() {
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  fireEvent.click(screen.getByTestId('stp-record'));
  await screen.findByTestId('stp-recording');
  fireEvent.click(screen.getByTestId('stp-stop'));
  return screen.findByTestId('stp-review');
}

describe('Teleprompter page: the source', () => {
  test('pasted text is kept on this device and reads as written, paragraphs kept', () => {
    const { unmount } = renderPage();
    fireEvent.change(screen.getByTestId('stp-paste'), { target: { value: 'First line\nstill first.\n\nSecond paragraph.' } });
    expect(window.localStorage.getItem(PASTE_KEY)).toBe('First line\nstill first.\n\nSecond paragraph.');
    unmount();
    renderPage();
    expect(screen.getByTestId('stp-paste').value).toContain('Second paragraph.');
    fireEvent.click(screen.getByTestId('stp-start'));
    const paras = screen.getAllByTestId('stp-para');
    expect(paras.map((p) => p.textContent)).toEqual(['First line\nstill first.', 'Second paragraph.']);
    expect(screen.queryByTestId('stp-mode-mine')).toBeNull();
  });

  test('Start waits for something to read', () => {
    renderPage();
    expect(screen.getByTestId('stp-start').disabled).toBe(true);
  });

  test('pick a script: show, then episode, loads its saved script', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('stp-source-script'));
    await screen.findByRole('option', { name: 'Styling Adventures' });
    fireEvent.change(screen.getByTestId('stp-show'), { target: { value: 'show-1' } });
    await screen.findByRole('option', { name: 'Ep 3 · The Gala' });
    fireEvent.change(screen.getByTestId('stp-episode'), { target: { value: 'ep-1' } });
    expect((await screen.findByTestId('stp-script-ready')).textContent).toContain('3 beats');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
    fireEvent.change(screen.getByTestId('stp-start-beat'), { target: { value: '8' } });
    fireEvent.click(screen.getByTestId('stp-start'));
    expect(screen.getByTestId('stp-jump').value).toBe('1');
    expect(screen.getAllByTestId('stp-beat')).toHaveLength(3);
  });

  test('an episode with no script says so and does not start', async () => {
    renderPage('/teleprompter?episode=ep-2');
    await screen.findByTestId('stp-no-script');
    expect(screen.getByTestId('stp-start').disabled).toBe(true);
    expect(screen.queryByTestId('teleprompter')).toBeNull();
  });

  test('?episode=&beat= (the Script tab button) opens that script on that beat', async () => {
    renderPage('/teleprompter?episode=ep-1&beat=11');
    await screen.findByTestId('teleprompter');
    expect(screen.getByTestId('stp-jump').value).toBe('2');
    expect(screen.getByTestId('teleprompter').querySelector('.stp-episode').textContent).toBe('Ep 3 · The Gala');
  });
});

describe('Teleprompter reader: reading', () => {
  test('her lines are picked out, others are cues, cue lines hidden; "Everything the same" evens them', () => {
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    const root = screen.getByTestId('teleprompter');
    expect(root.className).toContain('is-mine');
    expect(screen.getAllByTestId('stp-mine').map((l) => l.textContent)).toEqual(['PrimeReady when you are.', 'JustAWomanThis is the one.', 'JAWIHPWe made it.']);
    expect(screen.getAllByTestId('stp-cue').map((l) => l.textContent)).toEqual(['LalaOkay besties.', 'KelliGorgeous.']);
    expect(screen.getByTestId('stp-direction').textContent).toBe('She smiles at the camera.');
    // [UI:] is an on-screen moment to react to (Evoni, 2026-10-23); the production tags stay hidden.
    expect(screen.getAllByTestId('stp-screen').map((l) => l.textContent)).toEqual(['On screenLala opens Closetreact']);
    expect(root.textContent).not.toMatch(/UI:|STAT|WEAR|TRANSITION|cut to|coins -50/);
    fireEvent.click(screen.getByTestId('stp-mode-same'));
    expect(root.className).toContain('is-same');
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).lineMode).toBe('same');
  });

  test('play/pause, speed, size and mirror; settings are remembered', () => {
    const { unmount } = render(<TeleprompterReader source={scriptSource} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-countdown-toggle')); // no 3-2-1
    const play = screen.getByTestId('stp-play');
    fireEvent.click(play);
    expect(play.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(play);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(screen.getByTestId('stp-speed'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('stp-larger'));
    fireEvent.click(screen.getByTestId('stp-mirror'));
    expect(screen.getByTestId('teleprompter').className).toContain('is-mirrored');
    expect(screen.getByTestId('stp-page').style.getPropertyValue('--stp-size')).toBe('44px');
    unmount();
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    expect(screen.getByTestId('stp-speed').value).toBe('9');
    expect(screen.getByTestId('stp-page').style.getPropertyValue('--stp-size')).toBe('44px');
    expect(screen.getByTestId('stp-mirror').getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY))).toMatchObject({ speed: 9, size: 44, mirror: true, countdown: false });
  });

  test('the 3-2-1 counts down before the scroll starts', async () => {
    render(<TeleprompterReader source={scriptSource} countdownMs={5} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.getByTestId('stp-countdown').textContent).toBe('3');
    await waitFor(() => expect(screen.queryByTestId('stp-countdown')).toBeNull());
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
  });

  test('keys: Space plays, Up/Down speed, PageDown/PageUp jump, Left/Right beats', () => {
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-countdown-toggle'));
    const root = screen.getByTestId('teleprompter');
    root.focus();
    fireEvent.keyDown(root, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(root, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    expect(screen.getByTestId('stp-speed').value).toBe('6');
    const box = screen.getByTestId('stp-scroll');
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 600 });
    box.scrollTop = 0;
    fireEvent.keyDown(root, { key: 'PageDown' });
    expect(box.scrollTop).toBe(300);
    fireEvent.keyDown(root, { key: 'PageUp' });
    expect(box.scrollTop).toBe(0);
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(screen.getByTestId('stp-jump').value).toBe('1');
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    expect(screen.getByTestId('stp-jump').value).toBe('0');
    fireEvent.click(screen.getByTestId('stp-next'));
    fireEvent.change(screen.getByTestId('stp-jump'), { target: { value: '2' } });
    expect(screen.getByTestId('stp-next').disabled).toBe(true);
  });

  test('focus moves in, Escape exits and focus goes back to the opener', () => {
    render(<Opener source={scriptSource} />);
    const opener = screen.getByText('Open prompter');
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('Teleprompter reader: read & record', () => {
  test('a picked script records one beat; Save uploads to the episode Files with its beat and name', async () => {
    render(<TeleprompterReader source={scriptSource} startBeat={8} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
    await screen.findByTestId('stp-preview');
    // One beat at a time; one take already in Files for beat 8 (hers), so this is take 2.
    expect(screen.getAllByTestId('stp-beat')).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId('stp-record').textContent).toContain('Record beat 8 · take 2'));
    fireEvent.click(screen.getByTestId('stp-record'));
    expect(screen.getByTestId('stp-countdown')).toBeTruthy();
    await screen.findByTestId('stp-recording');
    expect(recorders[0].mimeType).toBe('video/webm;codecs=vp9,opus');
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-jump').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('stp-stop'));
    const review = await screen.findByTestId('stp-review');
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('stp-review-video').getAttribute('src')).toBe('blob:take');
    expect(review.textContent).toContain('Beat 8 · Transformation Loop · take 2');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-new', { beat_number: 8 }, { keepSession: true }));
    const [url, form] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/episode-clips/ep-1');
    expect(form.get('performer')).toBe('justawoman');
    expect(form.get('label')).toBe('Beat 8 · Transformation Loop · take 2');
    expect(form.get('video').name).toBe('beat-8-take-2.webm');
    expect((await screen.findByTestId('stp-status')).textContent).toContain("Saved to the episode's Files: Beat 8 · Transformation Loop · take 2");
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(screen.getByTestId('stp-record').textContent).toContain('take 3');
  });

  test('a failed link keeps the take; Retry links it without uploading again', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Server busy' } } }));
    render(<TeleprompterReader source={scriptSource} startBeat={8} countdownMs={1} onClose={() => {}} />);
    await recordATake();
    fireEvent.click(screen.getByTestId('stp-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('not linked to Beat 8');
    expect(screen.getByTestId('stp-save').textContent).toBe('Retry');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('stp-review')).toBeNull());
  });

  test('Retake throws the take away', async () => {
    render(<TeleprompterReader source={scriptSource} countdownMs={1} onClose={() => {}} />);
    await recordATake();
    fireEvent.click(screen.getByTestId('stp-retake'));
    expect(screen.queryByTestId('stp-review')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('pasted text: the take downloads to the device, no upload', async () => {
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function c() { names.push(this.download); });
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hello there.' }} countdownMs={1} onClose={() => {}} />);
    await recordATake();
    expect(screen.getByTestId('stp-save').textContent).toBe('Download the take');
    fireEvent.click(screen.getByTestId('stp-save'));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^Teleprompter take \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.webm$/);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByTestId('stp-status').textContent).toContain('Downloaded');
  });

  test('camera blocked: a plain message, and reading still works', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    expect((await screen.findByTestId('stp-status')).textContent).toContain('Camera and microphone are blocked');
    expect(screen.getByTestId('stp-record').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('stp-countdown-toggle'));
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
  });

  test('no MediaRecorder or an insecure page: plain messages', async () => {
    delete window.MediaRecorder;
    const { unmount } = render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    expect((await screen.findByTestId('stp-status')).textContent).toContain("can't record video");
    unmount();
    window.MediaRecorder = FakeRecorder;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    expect((await screen.findByTestId('stp-status')).textContent).toContain('secure page');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  test('leaving with an unsaved take asks first; the camera is released on leaving', async () => {
    render(<Opener source={scriptSource} />);
    fireEvent.click(screen.getByText('Open prompter'));
    await recordATake();
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    window.confirm.mockReturnValueOnce(false);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(window.confirm).toHaveBeenCalledWith('This take is not saved yet. Leave and lose it?');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stp-close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });

  test('switching recording off releases the camera', async () => {
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await screen.findByTestId('stp-preview');
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await act(async () => {});
    tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(screen.queryByTestId('stp-preview')).toBeNull();
    expect(screen.getAllByTestId('stp-beat')).toHaveLength(3);
  });
});

// "If I choose for example to read Lala's line can we make it so I know how
// much time I should stay silent and react while JustAWoman is reading her
// lines?" (Evoni, 2026-10-20)
const LALA_LONG = 'Lala: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"';
const QUIET = ['## BEAT: 1 · Opening Ritual', LALA_LONG, 'Me: "Hi there."', '(She waves.)', 'Kelli: "Look."'].join('\n');
const quietSource = { kind: 'script', scriptText: QUIET, episodeId: 'ep-1', title: 'Quiet' };
const atLine = () => document.querySelector('[data-at="true"]')?.textContent;

describe('Teleprompter reader: Read as and silence cues', () => {
  afterEach(() => { vi.useRealTimers(); delete window.matchMedia; });

  test('Read as switches whose lines are big, and is remembered', () => {
    const { unmount } = render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    const pick = screen.getByTestId('stp-read-as');
    expect(pick.value).toBe('JustAWoman');
    expect([...pick.options].map((o) => o.value)).toEqual(['JustAWoman', 'Lala', 'Kelli']);
    fireEvent.change(pick, { target: { value: 'Lala' } });
    // Beat 11 is the cutscene: JustAWoman's comment over it stays hers to read (Evoni, 2026-10-23).
    expect(screen.getAllByTestId('stp-mine').map((l) => l.textContent)).toEqual(['LalaOkay besties.', 'JAWIHPWe made it.']);
    expect(screen.getAllByTestId('stp-cue')).toHaveLength(3);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).readAs).toBe('Lala');
    unmount();
    render(<TeleprompterReader source={scriptSource} onClose={() => {}} />);
    expect(screen.getByTestId('stp-read-as').value).toBe('Lala');
  });

  test("someone else's line on the reading line: Stay quiet, its estimated time from the Script tab's helper", () => {
    render(<TeleprompterReader source={quietSource} onClose={() => {}} />);
    expect(atLine()).toContain('one two three');
    const cue = screen.getByTestId('stp-quiet');
    expect(cue.textContent).toContain('Stay quiet · react');
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe(`${Math.ceil(lineSeconds(LALA_LONG))}s`);
    expect(lineSeconds(LALA_LONG)).toBe(6);
    expect(screen.getByTestId('stp-quiet-bar')).toBeTruthy();
    // Her line: no cue. An action: its own estimate.
    fireEvent.click(screen.getByTestId('stp-pace-lines'));
    const root = screen.getByTestId('teleprompter');
    fireEvent.keyDown(root, { key: 'PageDown' });
    expect(atLine()).toContain('Hi there.');
    expect(screen.queryByTestId('stp-quiet')).toBeNull();
    fireEvent.keyDown(root, { key: 'PageDown' });
    expect(screen.getByTestId('stp-quiet').textContent).toBe('Action · 3s');
    // Reading as Lala, her long line has no cue and JustAWoman's does.
    fireEvent.keyDown(root, { key: 'PageUp' });
    fireEvent.change(screen.getByTestId('stp-read-as'), { target: { value: 'Lala' } });
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe(`${Math.ceil(lineSeconds('Me: "Hi there."'))}s`);
  });

  test('steady scroll: the line on the reading line follows the scroll', () => {
    render(<TeleprompterReader source={quietSource} onClose={() => {}} />);
    const box = screen.getByTestId('stp-scroll');
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 600 });
    const tops = [200, 300, 400, 500];
    document.querySelectorAll('[data-line]').forEach((el) => { el.getBoundingClientRect = () => ({ top: tops[Number(el.dataset.line)] - box.scrollTop }); });
    box.getBoundingClientRect = () => ({ top: 0 });
    box.scrollTop = 110; // reading line at 110 + 200 + 4
    fireEvent.scroll(box);
    expect(atLine()).toContain('Hi there.');
    box.scrollTop = 210;
    fireEvent.scroll(box);
    expect(screen.getByTestId('stp-quiet').textContent).toBe('Action · 3s');
  });

  test('pace by line times holds each line for its time, scaled by the pace; the cue counts down', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pacing: 'lines', pace: 2, countdown: false }));
    vi.useFakeTimers();
    render(<TeleprompterReader source={quietSource} onClose={() => {}} />);
    expect(screen.getByTestId('stp-pace').value).toBe('2');
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(atLine()).toContain('one two three');
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('3s'); // 6s at x2
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('2s');
    act(() => { vi.advanceTimersByTime(1950); });
    expect(atLine()).toContain('one two three');
    act(() => { vi.advanceTimersByTime(100); });
    expect(atLine()).toContain('Hi there.');
    // 2 words: 0.8s, at x2 0.4s.
    act(() => { vi.advanceTimersByTime(399); });
    expect(atLine()).toContain('Hi there.');
    act(() => { vi.advanceTimersByTime(2); });
    expect(atLine()).toContain('She waves.');
    // Space pauses: the line holds.
    fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: ' ' });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(atLine()).toContain('She waves.');
    fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: 'ArrowDown' });
    expect(screen.getByTestId('stp-pace').value).toBe('1.9');
  });

  test('reduced motion: the number, no draining bar', () => {
    window.matchMedia = vi.fn((q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    render(<TeleprompterReader source={quietSource} onClose={() => {}} />);
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('6s');
    expect(screen.queryByTestId('stp-quiet-bar')).toBeNull();
  });

  test('pasted text with "Name: words" lines gets Read as; plain prose does not', () => {
    const { unmount } = render(<TeleprompterReader source={{ kind: 'text', text: 'Lala: "Hey."\nMe: "Hi."\n\n(They laugh.)' }} onClose={() => {}} />);
    expect([...screen.getByTestId('stp-read-as').options].map((o) => o.value)).toEqual(['JustAWoman', 'Lala']);
    expect(screen.getAllByTestId('stp-mine').map((l) => l.textContent)).toEqual(['PrimeHi.']);
    unmount();
    render(<TeleprompterReader source={{ kind: 'text', text: 'Just a speech.\n\nSecond part.' }} onClose={() => {}} />);
    expect(screen.queryByTestId('stp-read-as')).toBeNull();
    expect(screen.queryByTestId('stp-pace-lines')).toBeNull();
    expect(screen.getAllByTestId('stp-para')).toHaveLength(2);
  });
});

// On-screen moments and "Record whole episode" (Evoni, 2026-10-23: "I need
// to be able to record the script in one go … when lala is reacting or
// talking or things are being clicked on screen I need to react").
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY } from '../components/Teleprompter/TeleprompterReader';
import TakesPanel from '../components/Teleprompter/TeleprompterTakes';
import { teleprompterLines, teleprompterScript, teleprompterIndexMap } from '../lib/teleprompterLines';
import { screenLabel, screenLine, tidyTarget, SCREEN_SECONDS } from '../lib/teleprompterScreen';
import {
  cleanMarks, markClock, fullTakeName, isFullTake, fullTakes, hasMarksField, marksText, marksFileName, takeBytes, sizeText, MARKS_NOT_KEPT, FULL_BITRATE,
} from '../lib/fullEpisodeTake';

// ── Pure pieces ──────────────────────────────────────────────────────────

describe('on-screen moments: parsing and labels', () => {
  test('the friendly label from the verb', () => {
    expect(screenLabel('SHOW', 'phone')).toBe('Phone comes up');
    expect(screenLabel('HIDE', 'Phone')).toBe('Phone goes away');
    expect(screenLabel('NOTIFY', 'Mail')).toBe('Notification: Mail');
    expect(screenLabel('NOTIFY', 'Mail: You are invited')).toBe('Notification: Mail · “You are invited”');
    expect(screenLabel('NOTIFICATION', 'Gala invite')).toBe('Notification: Gala invite');
    expect(screenLabel('DM', 'Kelli')).toBe('DM: Kelli');
    expect(screenLabel('DM', 'Kelli: where are you')).toBe('DM: Kelli · “where are you”');
    expect(screenLabel('OPEN', 'Closet')).toBe('Lala opens Closet');
    expect(screenLabel('OPEN', 'closet')).toBe('Lala opens Closet');
    expect(screenLabel('SCROLL', 'ClosetItems x5')).toBe('Scrolls Closet Items');
    expect(screenLabel('POST', 'Gala look')).toBe('Posts: Gala look');
    expect(screenLabel('DISPLAY', 'InviteLetterOverlay')).toBe('Shows Invite Letter Overlay');
    expect(screenLabel('CLICK', 'MailIcon')).toBe('Lala taps Mail Icon');
    expect(screenLabel('TAP', 'voice')).toBe('Lala taps Voice');
    expect(screenLabel('VOICE_ACTIVATE', 'Lala')).toBe('Voice activate Lala');
    expect(screenLabel('PULSE', '')).toBe('Pulse');
    expect(tidyTarget('closet_items')).toBe('Closet items');
  });

  test('a [UI:] line is a 3-second screen cue with an icon; the production tags stay hidden', () => {
    expect(screenLine('[UI: notify Mail]')).toEqual({ kind: 'screen', who: null, verb: 'NOTIFY', target: 'Mail', text: 'Notification: Mail', icon: 'notify', seconds: SCREEN_SECONDS });
    expect(screenLine('[UI:SHOW phone]').icon).toBe('phone');
    expect(screenLine('[WEAR: p1]')).toBeNull();
    const lines = ['Lala: "Hi."', '[UI:SHOW phone]', '[WEAR: p1]', '[STAT: coins +5]', '[TRANSITION: cut to]', '[UI:CLICK MailIcon]', 'Me: "Yes."'];
    expect(teleprompterLines(lines, { screen: true }).map((l) => [l.kind, l.text])).toEqual([
      ['cue', 'Hi.'], ['screen', 'Phone comes up'], ['screen', 'Lala taps Mail Icon'], ['mine', 'Yes.'],
    ]);
    // Without the option, exactly as before (the Script tab and the voice clip index use this).
    expect(teleprompterLines(lines).map((l) => l.kind)).toEqual(['cue', 'mine']);
    expect(SCREEN_SECONDS).toBe(3);
  });

  test("teleprompterIndexMap is unchanged, and each script line's vi is that index (voice clips keep their lines)", () => {
    const raw = ['[UI:SHOW phone]', 'Lala: "Hi."', '[UI: notify Mail]', 'Me: "Yes."', '[STAT: coins +5]', '(She waves.)', '[UI:HIDE phone]'];
    expect(teleprompterIndexMap(raw)).toEqual([null, 0, null, 1, null, 2, null]);
    const beat = teleprompterScript(`## BEAT: 8 · Transformation Loop\n${raw.join('\n')}`).beats[0];
    expect(beat.lines.map((l) => [l.kind, l.vi])).toEqual([['screen', null], ['cue', 0], ['screen', null], ['mine', 1], ['direction', 2], ['screen', null]]);
    const viOfRaw = teleprompterIndexMap(raw).filter((i) => i != null);
    expect(beat.lines.filter((l) => l.kind !== 'screen').map((l) => l.vi)).toEqual(viOfRaw);
  });
});

describe('full-episode take helpers', () => {
  test('names, markers, sizes and the markers file', () => {
    expect(fullTakeName(2)).toBe('Full episode · take 2');
    expect(fullTakeName(1, 'Lala')).toBe('Full episode · take 1 · as Lala');
    expect(isFullTake({ label: 'Full episode · take 3' })).toBe(true);
    expect(isFullTake({ label: 'Beat 2 · take 1', beat_marks: [] })).toBe(true);
    expect(isFullTake({ label: 'Beat 2 · take 1' })).toBe(false);
    expect(fullTakes([{ id: 'a', label: 'Beat 1 · take 1' }, { id: 'b', label: 'Full episode · take 1' }]).map((c) => c.id)).toEqual(['b']);
    expect(hasMarksField({ beat_marks: null })).toBe(true);
    expect(hasMarksField({ id: 'x' })).toBe(false);
    expect(cleanMarks([{ beat: 2, t: 41.26 }, { beat: 1, t: 0 }, { beat: 2, t: 99 }, { beat: 15, t: 3 }, { beat: 3, t: 40000 }]))
      .toEqual([{ beat: 1, t: 0 }, { beat: 2, t: 41.3 }]);
    expect(cleanMarks(Array.from({ length: 40 }, (_, i) => ({ beat: (i % 14) + 1, t: i })))).toHaveLength(14);
    expect(markClock(65.34)).toBe('1:05.3');
    expect(markClock(3725.5)).toBe('1:02:05.5');
    expect(takeBytes(0, 60)).toBe(60 * ((FULL_BITRATE + 128000) / 8));
    expect(takeBytes(1234, 60)).toBe(1234);
    expect(sizeText(85 * 1024 * 1024)).toBe('≈ 85 MB');
    expect(marksFileName('Full episode · take 2')).toBe('Full episode - take 2 - beat markers.txt');
    const text = marksText('Full episode · take 2', [{ beat: 2, t: 6 }, { beat: 1, t: 0 }], 'Ep 3 · The Gala');
    expect(text).toContain('Full episode · take 2 · Ep 3 · The Gala');
    expect(text).toContain('Beat 1\t0:00.0\nBeat 2\t0:06.0');
    expect(text).toContain('beat_marks: [{"beat":1,"t":0},{"beat":2,"t":6}]');
  });
});

// ── The reader ───────────────────────────────────────────────────────────

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'JustAWoman: "Hello besties welcome back."', // 5 words: 2s
  '[UI:NOTIFY Mail: You are invited]', // 3s
  '[WEAR: p1]',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Okay."', // 0.4s
  'JustAWoman: "Let us go."', // 1.2s
  '## BEAT: 11 · The Event',
  'Lala: "Wow look at this room."',
  'JustAWoman: "She is glowing."',
  '## BEAT: 14 · Ending',
  'JustAWoman: "Bye."', // 0.4s
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

let clipRows;
let uploaded;
let patchStatus;
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episode-clips/ep-1' ? { data: { data: clipRows } } : { data: { data: [] } }));
  vi.mocked(api.post).mockImplementation(async (url, form) => ({ data: { data: { ...uploaded, label: form.get('label') } } }));
  vi.mocked(api.patch).mockImplementation(async (url, body) => {
    if (patchStatus === 409) { const e = new Error('409'); e.response = { status: 409, data: { error: "the database update hasn't run yet" } }; throw e; }
    return { data: { data: { id: url.split('/').pop(), ...uploaded, ...body } } };
  });
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  clipRows = [];
  uploaded = { id: 'clip-full', beat_number: null, is_favorite: false, start_line: null, beat_marks: null, url_raw: 'https://bucket/full.webm' };
  patchStatus = 200;
  recorders = [];
  mockApi();
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

describe('on-screen moments in the reader', () => {
  test('shown as an ON SCREEN cue; on the reading line it counts 3s × the pace; the toggle hides them and is remembered', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 0.5 }));
    const { unmount } = render(<TeleprompterReader source={source} startBeat={1} onClose={() => {}} />);
    const cue = screen.getByTestId('stp-screen');
    expect(cue.textContent).toBe('On screenNotification: Mail · “You are invited”react');
    expect(cue.querySelector('svg')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/WEAR|p1/);
    fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: 'PageDown' });
    expect(activeLine()).toBe(cue);
    expect(screen.getByTestId('stp-quiet').textContent).toContain('On screen · react');
    expect(screen.getByTestId('stp-quiet').textContent).toContain('Notification: Mail');
    expect(screen.getByTestId('stp-quiet-n').textContent).toBe('6s'); // 3s at ×0.5
    fireEvent.click(screen.getByTestId('stp-screen-toggle'));
    expect(screen.queryByTestId('stp-screen')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)).screen).toBe(false);
    unmount();
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    expect(screen.getByTestId('stp-screen-toggle').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('stp-screen')).toBeNull();
  });

  test('Pace by line times holds a moment 3 seconds, then moves on', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 1 }));
    vi.useFakeTimers();
    render(<TeleprompterReader source={source} startBeat={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(activeLine().getAttribute('data-testid')).toBe('stp-screen');
    act(() => { vi.advanceTimersByTime(2900); });
    expect(activeLine().getAttribute('data-testid')).toBe('stp-screen');
    act(() => { vi.advanceTimersByTime(150); });
    expect(activeLine().textContent).toContain('Okay.');
  });

  test('the cutscene (beats 11-13): a banner at its start, and other lines are watching time', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', readAs: 'Lala' }));
    render(<TeleprompterReader source={source} startBeat={11} onClose={() => {}} />);
    const banners = screen.getAllByTestId('stp-cutscene');
    expect(banners).toHaveLength(1);
    expect(banners[0].textContent.trim()).toBe('Cutscene · watch & comment');
    expect(banners[0].closest('[data-testid="stp-beat"]').textContent).toContain('11 · ');
    // Reading as Lala: in the cutscene Lala is the AI video; JustAWoman's comment is the line to read.
    expect(activeLine().textContent).toContain('Wow look at this room.');
    expect(screen.getByTestId('stp-quiet').textContent).toContain('Cutscene · watch');
    const mine = screen.getAllByTestId('stp-mine').map((l) => l.textContent);
    expect(mine).toContain('JustAWomanShe is glowing.');
    expect(mine).not.toContain('LalaWow look at this room.');
  });
});

describe('voice clips keep their lines with on-screen moments shown', () => {
  test("a clip recorded against line 2 still plays on that line, not the one a moment pushed into its place", async () => {
    const script = ['## BEAT: 8 · Transformation Loop', '[UI:SHOW phone]', 'Lala: "One."', 'JustAWoman: "Two."', '[UI: notify Mail]', 'Lala: "Three."'].join('\n');
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/script-voice-clips/ep-1'
      ? { data: { data: [{ id: 'v3', episode_id: 'ep-1', beat_number: 8, line_index: 2, speaker: 'Lala', line_text: 'Three.', url: 'https://bucket/v3.webm', duration_seconds: 4 }] } }
      : { data: { data: [] } }));
    window.Audio = class { constructor() { this.play = vi.fn(async () => {}); this.pause = vi.fn(); } addEventListener() {} removeEventListener() {} };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines' }));
    render(<TeleprompterReader source={{ ...source, scriptText: script }} startBeat={8} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-voice-toggle')).toBeTruthy());
    const root = screen.getByTestId('teleprompter');
    const seen = [];
    for (let k = 0; k < 4; k += 1) {
      fireEvent.keyDown(root, { key: 'PageDown' });
      seen.push([activeLine().textContent, !!screen.queryByTestId('stp-quiet-voice')]);
    }
    expect(seen).toEqual([
      ['LalaOne.', false], ['JustAWomanTwo.', false], ['On screenNotification: Mailreact', false], ['LalaThree.', true],
    ]);
    delete window.Audio;
  });
});

// Opens Read & record on the whole episode, camera ready.
async function openWhole(props = {}) {
  render(<TeleprompterReader source={source} countdownMs={10} onClose={() => {}} {...props} />);
  fireEvent.click(screen.getByTestId('stp-record-mode'));
  await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
  fireEvent.click(screen.getByTestId('stp-scope-episode'));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1'));
}
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('Record whole episode', () => {
  test('one take across beats: markers in take time with paused time left out; REC shows the beat; review lists the markers', async () => {
    await openWhole();
    expect(screen.getByTestId('stp-record').textContent).toContain('Record whole episode · take 1');
    expect(screen.getByTestId('stp-episode-from').value).toBe('first');
    // Every beat is on the page, not one at a time.
    expect(screen.getAllByTestId('stp-beat')).toHaveLength(4);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30); // the 3-2-1
    expect(recorders).toHaveLength(1);
    expect(recorders[0].opts).toMatchObject({ videoBitsPerSecond: 2_500_000 });
    expect(recorders[0].state).toBe('recording');
    expect(activeLine().textContent).toContain('Hello besties');
    tick(1000);
    // Pause pauses the recording too; ten seconds paused are not take time.
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(recorders[0].state).toBe('paused');
    tick(10000);
    expect(screen.getByTestId('stp-recording').textContent).toContain('PAUSED 0:01');
    expect(screen.getByTestId('stp-rec-beat').textContent).toBe('· Beat 1 of 14');
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(recorders[0].state).toBe('recording');
    tick(2000); // her line again from its start
    expect(activeLine().getAttribute('data-testid')).toBe('stp-screen');
    tick(3000); // the moment
    expect(activeLine().textContent).toContain('Okay.');
    tick(250);
    expect(screen.getByTestId('stp-rec-beat').textContent).toBe('· Beat 2 of 14');
    expect(screen.getByTestId('stp-recording').textContent).toMatch(/REC 0:06/);
    expect(screen.getByTestId('stp-rec-size').textContent).toMatch(/≈ \d+ MB/);
    // The beat did not end the take; Stop does.
    expect(recorders[0].state).toBe('recording');
    fireEvent.click(screen.getByTestId('stp-stop'));
    vi.useRealTimers();
    const review = await screen.findByTestId('stp-review');
    expect(review.textContent).toContain('Full episode · take 1');
    const marks = within(screen.getByTestId('stp-review-marks')).getAllByTestId('stp-mark').map((b) => b.textContent);
    expect(marks).toEqual(['Beat 1 · 0:00.0', 'Beat 2 · 0:06.0']);
  });

  test('the end of beat 14 ends the take and opens the review; "From this beat" starts there', async () => {
    await openWhole({ startBeat: 11 });
    fireEvent.change(screen.getByTestId('stp-episode-from'), { target: { value: 'this' } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    expect(activeLine().textContent).toContain('Wow look at this room.');
    tick(2000); // Lala, 5 words
    tick(1200); // JustAWoman, 3 words
    expect(activeLine().textContent).toContain('Bye.');
    tick(400);
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
    expect(recorders[0].state).toBe('inactive');
    expect(within(screen.getByTestId('stp-review-marks')).getAllByTestId('stp-mark').map((b) => b.textContent)).toEqual(['Beat 11 · 0:00.0', 'Beat 14 · 0:03.2']);
  });

  test('near 450 MB the REC bar warns that the 500 MB upload limit is near', async () => {
    await openWhole();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    expect(screen.queryByTestId('stp-rec-warn')).toBeNull();
    act(() => { recorders[0].ondataavailable({ data: { size: 455 * 1024 * 1024 } }); });
    tick(250);
    expect(screen.getByTestId('stp-rec-warn').textContent).toMatch(/Nearly 500 MB: that is the upload limit/);
    expect(recorders[0].state).toBe('recording'); // stopping is still hers
  });

  const recordTwoBeats = async () => {
    await openWhole();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByTestId('stp-record'));
    tick(30);
    tick(2000);
    tick(3000);
    tick(250);
    fireEvent.click(screen.getByTestId('stp-stop'));
    vi.useRealTimers();
    await screen.findByTestId('stp-review');
  };

  test('save: one file, beat_number left empty, then PATCH beat_marks; the takes panel lists it under Full episode with jump links', async () => {
    await recordTwoBeats();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain("Saved to the episode's Files: Full episode · take 1 · 2 beat markers"));
    expect(api.post).toHaveBeenCalledTimes(1);
    const form = vi.mocked(api.post).mock.calls[0][1];
    expect(form.get('label')).toBe('Full episode · take 1');
    expect(form.get('performer')).toBe('justawoman');
    expect(form.get('video').name).toBe('full-episode-take-1.webm');
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-full', { beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 5 }] }, { keepSession: true });
    expect(screen.queryByTestId('stp-download-marks')).toBeNull();
    expect(screen.getByTestId('stp-record').textContent).toContain('take 2');
    // The takes panel: a Full episode group; a marker plays the take from there.
    let seekTo = null;
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', { configurable: true, get() { return seekTo ?? 0; }, set(v) { seekTo = v; } });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get() { return 1; } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
    fireEvent.click(screen.getByTestId('stp-takes-toggle'));
    const group = screen.getByTestId('stp-full-takes');
    expect(within(group).getByTestId('stp-full-take').textContent).toContain('Full episode · take 1');
    const links = within(group).getAllByTestId('stp-mark');
    expect(links.map((b) => b.textContent)).toEqual(['Beat 1 · 0:00.0', 'Beat 2 · 0:05.0']);
    fireEvent.click(links[1]);
    await waitFor(() => expect(seekTo).toBe(5));
    expect(screen.getByTestId('stp-take-video').getAttribute('src')).toBe('https://bucket/full.webm');
    delete HTMLMediaElement.prototype.currentTime;
    delete HTMLMediaElement.prototype.readyState;
  });

  test('before the database update (no beat_marks on the upload): the video is saved, she is told plainly, and can download the markers', async () => {
    const { beat_marks: _gone, ...rest } = uploaded;
    uploaded = rest;
    await recordTwoBeats();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain(MARKS_NOT_KEPT));
    expect(MARKS_NOT_KEPT).toBe('Saved. Beat markers will be kept once the database update runs.');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.patch).not.toHaveBeenCalled();
    vi.mocked(URL.createObjectURL).mockClear();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByTestId('stp-download-marks'));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0];
    const text = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });
    expect(text).toContain('Beat 1\t0:00.0\nBeat 2\t0:05.0');
    expect(text).toContain('beat_marks: [{"beat":1,"t":0},{"beat":2,"t":5}]');
  });

  test('a 409 on the markers PATCH saves the video the same way', async () => {
    patchStatus = 409;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await recordTwoBeats();
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(screen.getByTestId('stp-status').textContent).toContain(MARKS_NOT_KEPT));
    expect(screen.getByTestId('stp-download-marks')).toBeTruthy();
    expect(screen.queryByTestId('stp-review')).toBeNull();
  });

  test('an unsaved full take asks before closing', async () => {
    await recordTwoBeats();
    const onClose = vi.fn();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('stp-close'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/not saved yet/));
    expect(screen.getByTestId('stp-review')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Takes panel: the Full episode group', () => {
  test('full-episode takes in their own group; markers once the server keeps them', () => {
    const full = [
      { id: 'f1', label: 'Full episode · take 1', duration_seconds: 900, url_raw: 'https://bucket/f1.webm', beat_marks: [{ beat: 2, t: 41.3 }, { beat: 1, t: 0 }] },
      { id: 'f2', label: 'Full episode · take 2', url_raw: 'https://bucket/f2.webm' },
    ];
    render(<TakesPanel takes={[]} beatNumber={1} onFavorite={() => {}} fullTakes={full} />);
    expect(screen.getByTestId('stp-takes-empty')).toBeTruthy();
    const rows = within(screen.getByTestId('stp-full-takes')).getAllByTestId('stp-full-take');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('15:00');
    expect(within(rows[0]).getAllByTestId('stp-mark').map((b) => b.textContent)).toEqual(['Beat 1 · 0:00.0', 'Beat 2 · 0:41.3']);
    expect(within(rows[1]).queryByTestId('stp-mark')).toBeNull();
    expect(within(rows[1]).getByTestId('stp-marks-waiting')).toBeTruthy();
  });
});

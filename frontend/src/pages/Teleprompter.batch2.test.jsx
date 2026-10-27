// Teleprompter batch 2 (Evoni, 2026-10-20): the beat's takes in Files with a
// ★ (one favourite per beat), and picking up a take from a line in the beat.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { fakeTakeUploads } from '../test/fakeTakeUploads';
import TeleprompterReader from '../components/Teleprompter/TeleprompterReader';
import TakesPanel from '../components/Teleprompter/TeleprompterTakes';
import { hasTakeFields, beatTakes, withFavorite } from '../lib/rawClipsApi';
import { takeName, lineChoice } from '../lib/teleprompterLines';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties."',
  '## BEAT: 8 · Transformation Loop',
  'JustAWoman: "This is the one."',
  'Lala: "Gorgeous."',
  '(She turns to the mirror.)',
  'JustAWoman: "Let us go again."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3 · The Gala' };

// With the migration: the server sends is_favorite and start_line.
const WITH_FIELDS = [
  { id: 'c1', performer: 'justawoman', beat_number: 8, label: 'Beat 8 · Transformation Loop · take 1', duration_seconds: 42, created_at: '2026-10-20T14:05:00Z', url_raw: 'https://bucket/c1.webm', is_favorite: true, start_line: 0 },
  { id: 'c2', performer: 'justawoman', beat_number: 8, label: 'Beat 8 · Transformation Loop · take 2', duration_seconds: 65, created_at: '2026-10-20T14:09:00Z', url_raw: 'https://bucket/c2.webm', is_favorite: false, start_line: 2 },
  { id: 'c3', performer: 'lala', beat_number: 1, label: 'Beat 1 · Opening Ritual · take 1', is_favorite: false, start_line: null },
];
// Before it: the same clips without the two fields.
const WITHOUT_FIELDS = WITH_FIELDS.map(({ is_favorite: f, start_line: l, ...rest }) => rest);

let tracks;
let recorders;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['f'], { type: 'video/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'video/webm';

let uploads;
function mockApi(rows, uploaded = { id: 'clip-new', beat_number: null, is_favorite: false, start_line: null, url_raw: 'https://bucket/new.webm' }) {
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episode-clips/ep-1' ? { data: { data: rows } } : { data: { data: [] } }));
  uploads = fakeTakeUploads(api, async (url, form) => ({ data: { data: { ...uploaded, label: form.get('label') } } }));
  vi.mocked(api.patch).mockImplementation(async (url, body) => ({ data: { data: { id: url.split('/').pop(), ...body } } }));
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  mockApi(WITH_FIELDS);
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch (err) { console.error(err); }
  tracks = [{ stop: vi.fn() }];
  recorders = [];
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) } });
  window.MediaRecorder = FakeRecorder;
  URL.createObjectURL = vi.fn(() => 'blob:take');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); delete window.MediaRecorder; });

const openTakes = async () => {
  await waitFor(() => expect(screen.getByTestId('stp-takes-toggle').textContent).toContain('2'));
  fireEvent.click(screen.getByTestId('stp-takes-toggle'));
  return screen.getByTestId('stp-takes');
};

describe('helpers', () => {
  test('hasTakeFields, beatTakes and withFavorite (one favourite per beat)', () => {
    expect(hasTakeFields(WITH_FIELDS[0])).toBe(true);
    expect(hasTakeFields(WITHOUT_FIELDS[0])).toBe(false);
    expect(beatTakes(WITH_FIELDS, 8).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(beatTakes(WITH_FIELDS, null)).toEqual([]);
    const starred = withFavorite(WITH_FIELDS, 'c2', true);
    expect(starred.map((c) => [c.id, c.is_favorite])).toEqual([['c1', false], ['c2', true], ['c3', false]]);
    expect(withFavorite(WITH_FIELDS, 'c1', false).map((c) => c.is_favorite)).toEqual([false, false, false]);
  });

  test('takeName notes the line a take starts from; lineChoice names a line', () => {
    expect(takeName({ number: 8, name: 'Transformation Loop' }, 3, 4)).toBe('Beat 8 · Transformation Loop · take 3 · from line 4');
    expect(takeName({ number: 8, name: 'Transformation Loop' }, 3, 1)).toBe('Beat 8 · Transformation Loop · take 3');
    expect(lineChoice({ speaker: 'Lala', text: 'Gorgeous.' }, 1)).toBe('2 · Lala: Gorgeous.');
    expect(lineChoice({ text: 'x'.repeat(80) }, 0, 10)).toBe(`1 · ${'x'.repeat(9)}…`);
    expect(lineChoice({ speaker: 'Prime', text: 'The gold gown. // It was *always* (breath) going.' }, 3)).toBe('4 · Prime: The gold gown. It was always going.');
    expect(lineChoice({ kind: 'breath', text: 'breath' }, 2)).toBe('3 · (breath)');
  });
});

describe('Takes for the beat', () => {
  test("lists the beat's takes with name, length and time; Play previews one", async () => {
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    const panel = await openTakes();
    const rows = within(panel).getAllByTestId('stp-take');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Beat 8 · Transformation Loop · take 1');
    expect(rows[0].textContent).toContain('0:42');
    expect(rows[1].textContent).toContain('1:05');
    fireEvent.click(within(rows[1]).getByTestId('stp-take-play'));
    expect(screen.getByTestId('stp-take-video').getAttribute('src')).toBe('https://bucket/c2.webm');
    fireEvent.click(within(rows[1]).getByTestId('stp-take-play'));
    expect(screen.queryByTestId('stp-take-video')).toBeNull();
  });

  test('another beat shows its own takes; none says so', async () => {
    render(<TeleprompterReader source={source} startBeat={1} countdownMs={1} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stp-takes-toggle').textContent).toContain('1'));
    fireEvent.click(screen.getByTestId('stp-takes-toggle'));
    expect(within(screen.getByTestId('stp-takes')).getAllByTestId('stp-take')).toHaveLength(1);
  });

  test('★ stars one take for the beat and un-stars the other', async () => {
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    const panel = await openTakes();
    const stars = within(panel).getAllByTestId('stp-take-star');
    expect(stars.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    fireEvent.click(stars[1]);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/c2', { is_favorite: true }));
    await waitFor(() => expect(within(panel).getAllByTestId('stp-take-star').map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']));
  });

  test('a refused star (database update not run) shows the server message', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(Object.assign(new Error('409'), { response: { status: 409, data: { error: 'Favourites and start lines are not switched on yet' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    const panel = await openTakes();
    fireEvent.click(within(panel).getAllByTestId('stp-take-star')[1]);
    expect((await within(panel).findByRole('alert')).textContent).toContain('not switched on yet');
    expect(within(panel).getAllByTestId('stp-take-star').map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  test('before the migration (no is_favorite from the server) there is no ★', async () => {
    mockApi(WITHOUT_FIELDS);
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    const panel = await openTakes();
    expect(within(panel).getAllByTestId('stp-take')).toHaveLength(2);
    expect(within(panel).queryByTestId('stp-take-star')).toBeNull();
  });

  test('pasted text has no Takes', () => {
    render(<TeleprompterReader source={{ kind: 'text', text: 'Hello' }} onClose={() => {}} />);
    expect(screen.queryByTestId('stp-takes-toggle')).toBeNull();
  });

  test('TakesPanel on its own: empty and loading', () => {
    const { rerender } = render(<TakesPanel takes={[]} beatNumber={4} onFavorite={() => {}} loading />);
    expect(screen.getByTestId('stp-takes-empty').textContent).toContain('Loading');
    rerender(<TakesPanel takes={[]} beatNumber={4} onFavorite={() => {}} />);
    expect(screen.getByTestId('stp-takes-empty').textContent).toContain('No takes for this beat yet');
  });
});

describe('Pick up from a line', () => {
  const recordFromLine = async (line) => {
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    const select = screen.getByTestId('stp-start-line');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      '1 · JustAWoman: This is the one. (the top)', '2 · Lala: Gorgeous.', '3 · She turns to the mirror.', '4 · JustAWoman: Let us go again.',
    ]);
    fireEvent.change(select, { target: { value: String(line) } });
    fireEvent.click(screen.getByTestId('stp-record'));
    // Mid-take (and its 3-2-1) Start from hides; it comes back once the take ends.
    expect(screen.queryByTestId('stp-start-line')).toBeNull();
    await screen.findByTestId('stp-recording');
  };

  test('the take starts with that line on the reading line; its name and start_line say so', async () => {
    await recordFromLine(3);
    expect(document.querySelector('[data-at="true"]').textContent).toContain('Let us go again.');
    fireEvent.click(screen.getByTestId('stp-stop'));
    const review = await screen.findByTestId('stp-review');
    // Two takes of beat 8 by her already, so this is take 3.
    expect(review.textContent).toContain('Beat 8 · Transformation Loop · take 3 · from line 4');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-new', { beat_number: 8, start_line: 3 }, { keepSession: true }));
    expect(uploads.form().get('label')).toBe('Beat 8 · Transformation Loop · take 3 · from line 4');
    await waitFor(() => expect(screen.queryByTestId('stp-review')).toBeNull());
    // The new take shows in the list without a reload.
    fireEvent.click(screen.getByTestId('stp-takes-toggle'));
    const rows = within(screen.getByTestId('stp-takes')).getAllByTestId('stp-take');
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain('take 3 · from line 4');
    expect(within(rows[2]).getByTestId('stp-take-star')).toBeTruthy();
  });

  test('from the top: no "from line" and start_line 0', async () => {
    await recordFromLine(0);
    fireEvent.click(screen.getByTestId('stp-stop'));
    const review = await screen.findByTestId('stp-review');
    expect(review.textContent).not.toContain('from line');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-new', { beat_number: 8, start_line: 0 }, { keepSession: true }));
  });

  test('before the migration the save links the beat only (no start_line), and still works', async () => {
    mockApi(WITHOUT_FIELDS, { id: 'clip-new', beat_number: null, url_raw: 'https://bucket/new.webm' });
    await recordFromLine(1);
    fireEvent.click(screen.getByTestId('stp-stop'));
    await screen.findByTestId('stp-review');
    fireEvent.click(screen.getByTestId('stp-save'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/clip-new', { beat_number: 8 }, { keepSession: true }));
    expect((await screen.findByTestId('stp-status')).textContent).toContain('from line 2');
  });

  test('changing beat goes back to the top', async () => {
    render(<TeleprompterReader source={source} startBeat={8} countdownMs={1} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-record-mode'));
    await waitFor(() => expect(screen.getByTestId('stp-record').disabled).toBe(false));
    fireEvent.change(screen.getByTestId('stp-start-line'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('stp-prev'));
    // Beat 1 has one line: no Start from.
    expect(screen.queryByTestId('stp-start-line')).toBeNull();
    fireEvent.click(screen.getByTestId('stp-next'));
    expect(screen.getByTestId('stp-start-line').value).toBe('0');
  });
});

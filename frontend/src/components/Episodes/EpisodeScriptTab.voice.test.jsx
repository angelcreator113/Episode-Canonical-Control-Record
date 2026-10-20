// Voice clips on the Script tab (Teleprompter batch 3; Evoni, 2026-10-20): a
// mic beside each spoken line of anyone but JustAWoman records it; "voice ✓"
// once saved, a warning when the line changed since; recording never makes
// the script unsaved; before the database update, the mics hide and a note
// says why.
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const EP = '11111111-1111-4111-8111-111111111111';
const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties."',
  '[UI: notify Mail]',
  'Me: "Here we go."',
  'Kelli: "Wait for me."',
].join('\n');

let voiceRows;
let voiceError;
class FakeRecorder {
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['v'], { type: 'audio/webm' }) }); this.onstop?.(); }
}
FakeRecorder.isTypeSupported = (t) => t === 'audio/webm';

const renderTab = () => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}`]}>
    <EpisodeScriptTab episode={{ id: EP, show_id: 'show-1', title: 'The Gala', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} />
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  voiceRows = [];
  voiceError = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/script-voice-clips/${EP}`) {
      if (voiceError) throw voiceError;
      return { data: { data: voiceRows } };
    }
    return { data: { data: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url, form) => ({ data: { data: { id: 'v-new', beat_number: Number(form.get('beat_number')), line_index: Number(form.get('line_index')), speaker: form.get('speaker'), line_text: form.get('line_text'), url: 'https://bucket/v.webm', duration_seconds: 2 } } }));
  Element.prototype.scrollIntoView = vi.fn();
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  URL.createObjectURL = vi.fn(() => 'blob:v');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { delete window.MediaRecorder; vi.restoreAllMocks(); });

test("a mic beside Lala's and Kelli's lines, none beside hers; record, review, save: voice ✓ and still saved", async () => {
  renderTab();
  await waitFor(() => expect(screen.getAllByTestId('script-voice-mic')).toHaveLength(2));
  const mics = screen.getAllByTestId('script-voice-mic');
  expect(mics[0].getAttribute('aria-label')).toContain('Lala');
  expect(mics[1].getAttribute('aria-label')).toContain('Kelli');
  fireEvent.click(mics[1]);
  const panel = screen.getByTestId('script-voice-panel');
  expect(panel.textContent).toContain('Kelli · beat 1, line 3'); // the [UI:] line is not a teleprompter line
  fireEvent.click(within(panel).getByTestId('vr-record'));
  await waitFor(() => expect(within(panel).getByTestId('vr-stop').disabled).toBe(false));
  fireEvent.click(within(panel).getByTestId('vr-stop'));
  await waitFor(() => expect(within(panel).getByTestId('vr-take-audio')).toBeTruthy());
  fireEvent.click(within(panel).getByTestId('vr-save'));
  await waitFor(() => expect(screen.getByTestId('vr-badge').textContent).toBe('voice ✓'));
  const form = vi.mocked(api.post).mock.calls[0][1];
  expect(vi.mocked(api.post).mock.calls[0][0]).toBe(`/api/v1/script-voice-clips/${EP}`);
  expect([form.get('beat_number'), form.get('line_index'), form.get('speaker'), form.get('line_text')]).toEqual(['1', '2', 'Kelli', 'Wait for me.']);
  expect(screen.queryByTestId('script-dirty')).toBeNull();
  expect(screen.getByTestId('script-saved')).toBeTruthy();
});

test('a clip whose line changed since says so', async () => {
  voiceRows = [{ id: 'v1', beat_number: 1, line_index: 0, speaker: 'Lala', line_text: 'Okay, besties, hi.', url: 'https://bucket/v1.webm', duration_seconds: 3 }];
  renderTab();
  await waitFor(() => expect(screen.getByTestId('vr-badge-stale').textContent).toContain('line changed since recorded'));
  fireEvent.click(screen.getAllByTestId('script-voice-mic')[0]);
  expect(screen.getByTestId('vr-stale').textContent).toContain('Okay, besties, hi.');
  expect(screen.getByTestId('vr-clip-audio').getAttribute('src')).toBe('https://bucket/v1.webm');
});

test('before the database update, no mics and a plain note', async () => {
  voiceError = Object.assign(new Error('409'), { response: { status: 409, data: { code: 'MIGRATION_PENDING' } } });
  renderTab();
  await waitFor(() => expect(screen.getByTestId('script-voice-off').textContent).toMatch(/database update/));
  expect(screen.queryByTestId('script-voice-mic')).toBeNull();
});

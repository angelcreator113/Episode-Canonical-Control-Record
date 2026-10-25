// [SFX: …] lines as reaction cues in the reader: the same 3-second heads-up
// as an on-screen moment, labelled "Sound", hidden with the on-screen toggle.
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import TeleprompterReader, { SETTINGS_KEY, cueSays } from '../components/Teleprompter/TeleprompterReader';
import { soundLine } from '../lib/teleprompterSound';

const SCRIPT = [
  '## BEAT: 4 · Interruption Pulse 1',
  'JustAWoman: "Okay so today."',
  '[SFX: notification_ping]',
  '[MUSIC: sting]',
  'JustAWoman: "Hold on, who is texting us?"',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: 'ep-1', title: 'Ep 3' };
const activeLine = () => document.querySelector('[data-at="true"]');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 1 }));
});
afterEach(() => { vi.restoreAllMocks(); });

test('a sound shows as a Sound cue; on the reading line it holds 3 seconds to react', () => {
  render(<TeleprompterReader source={source} startBeat={4} onClose={() => {}} />);
  const cue = screen.getByTestId('stp-screen');
  expect(cue.textContent).toBe('SoundNotification pingreact');
  expect(cue.querySelector('svg')).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/sting/);
  fireEvent.keyDown(screen.getByTestId('teleprompter'), { key: 'PageDown' });
  expect(activeLine()).toBe(cue);
  expect(screen.getByTestId('stp-quiet').textContent).toContain('Sound · react');
  expect(screen.getByTestId('stp-quiet').textContent).toContain('Notification ping');
  expect(screen.getByTestId('stp-quiet-n').textContent).toBe('3s');
  expect(cueSays(soundLine('[SFX: ping]'))).toBe('Sound · react · Ping');
  fireEvent.click(screen.getByTestId('stp-screen-toggle'));
  expect(screen.queryByTestId('stp-screen')).toBeNull();
});

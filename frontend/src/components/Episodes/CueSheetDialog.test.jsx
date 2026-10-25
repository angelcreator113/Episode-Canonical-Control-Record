// Script tab → Export → Cue sheet: the notes by beat, the cold open first, beat
// times from the whole-episode take, copy and download.
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn() } };
});

import { rawClipsApi } from '../../lib/rawClipsApi';
import ScriptReadActions from './ScriptReadActions';

const SCRIPT = '[SFX: door creak]\n## BEAT: 1 · Opening Ritual\n[MUSIC: theme up]\nMe: "Hi."\n## BEAT: 2 · Login Sequence\n[CAMERA: push in]';
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
beforeEach(() => {
  rawClipsApi.list.mockReset();
  rawClipsApi.list.mockResolvedValue([{ id: 'f1', label: 'Full episode · take 1', beat_marks: [{ beat: 1, t: 3 }, { beat: 2, t: 75.5 }] }]);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; });

test('Cue sheet sits beside Copy script and opens the editor\'s list with the take\'s beat times', async () => {
  render(<MemoryRouter><ScriptReadActions scriptText={SCRIPT} title="The Gala" episodeId="ep-1" episodeNumber={3} /></MemoryRouter>);
  const items = [...screen.getByTestId('script-export-menu').querySelectorAll('button')].map((b) => b.dataset.testid);
  expect(items.indexOf('script-export-cues')).toBe(items.indexOf('script-export-copy') + 1);
  fireEvent.click(screen.getByTestId('script-export-cues'));
  await waitFor(() => expect(screen.getByTestId('cue-sheet-text').textContent).toMatch(/starts at 1:15\.5/));
  const text = screen.getByTestId('cue-sheet-text').textContent;
  expect(text).toMatch(/^Cue sheet · The Gala\nBeat times from: Full episode · take 1\n\nCOLD OPEN SHOT LIST\n {2}\[ \] Sound: door creak/);
  expect(text).toMatch(/BEAT 1 · Opening Ritual · starts at 0:03\.0\n {2}\[ \] Music: theme up/);
  fireEvent.click(screen.getByTestId('cue-sheet-copy'));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text));
  fireEvent.change(screen.getByTestId('cue-sheet-take'), { target: { value: '' } });
  expect(screen.getByTestId('cue-sheet-text').textContent).not.toMatch(/starts at/);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getByTestId('cue-sheet-download'));
  expect(click).toHaveBeenCalled();
  expect(click.mock.instances[0].download).toBe('ep-3-the-gala-cue-sheet.txt');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByTestId('cue-sheet')).toBeNull();
});

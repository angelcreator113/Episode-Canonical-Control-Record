/**
 * After Generate (Evoni, 2026-10-15: "is it making sure everything is being
 * done within the script?"): the tab says which beats the writer rewrote to
 * cover the episode, and what is still not in the script.
 */
import { vi, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.';
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

test('names the rewritten beats and what is still missing, and can be dismissed', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, coverage: {
    fixed_beats: [8, 12],
    missing: [{ kind: 'deliverable', label: 'TikTok outfit reveal', target: 12 }, { kind: 'wear', label: 'Gold slip dress', target: 8 }],
  } } });
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Generate Script/ }));
  const note = await screen.findByTestId('script-coverage');
  expect(note.textContent).toContain('rewrote beats 8, 12');
  expect(note.textContent).toContain('Deliverable: TikTok outfit reveal (beat 12)');
  expect(note.textContent).toContain('Wear cue: Gold slip dress (beat 8)');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByTestId('script-coverage')).toBeNull();
});

test('nothing to say, nothing shown', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, coverage: { fixed_beats: [], missing: [] } } });
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Generate Script/ }));
  await screen.findByText(/Script generated/);
  expect(screen.queryByTestId('script-coverage')).toBeNull();
});

// The show's rules fixed after writing (Evoni, 2026-10-17).
test("says when the writer added Lala's voice clicks and put the invitation in beat 5", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, coverage: { fixed_beats: [], missing: [], voice_clicks: 3, reveal_fixed: true } } });
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Generate Script/ }));
  expect((await screen.findByTestId('script-coverage-voice')).textContent).toContain('added 3 voice clicks');
  expect(screen.getByTestId('script-coverage-reveal').textContent).toContain('Beat 5 now shows the invitation letter');
});

// Story layers (Evoni, 2026-10-17): what the show holds nothing for is named,
// so it can be set before the next Generate.
test('names the story layers with nothing to draw on', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, coverage: { fixed_beats: [], missing: [], story_gaps: [
    { layer: 'sender', label: 'No one at the event has an established tie to Lala to send the beat 7 message.' },
  ] } } });
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Generate Script/ }));
  const gaps = await screen.findByTestId('script-coverage-story');
  expect(gaps.textContent).toContain('invented no history');
  expect(gaps.textContent).toContain('No one at the event has an established tie to Lala');
});

// Lala's coins (Evoni, 2026-10-18): a piece's coin line added after writing.
test('says when the writer added coin lines for the pieces she buys', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { saved: true, script: SCRIPT, coverage: { fixed_beats: [], missing: [], coin_lines: 2 } } });
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: '' }} show={{ id: 'show-1' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Generate Script/ }));
  expect((await screen.findByTestId('script-coverage-coins')).textContent).toContain('added 2 coin lines');
});

/**
 * Read the finished script (Evoni, 2026-10-23): once every beat is
 * approved, the Script tab offers it; it opens the What changed card,
 * which reads the saved script when there is no record yet. Nothing reads
 * it on its own, and an unsaved script is saved first.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = ['## BEAT: 11 · Event Outcome', 'Marcus Hale: So you are the Lala everyone wants to know.', 'Lala: "And you are the one I came to meet."'].join('\n');
const RECORD_URL = '/api/v1/book-from-show/episodes/ep-1/record';
const RECORD = { id: 'r1', status: 'draft', what_happened: 'Lala met Truthville.', characters: [], secrets: [], relationships: [], follow_ups: [], goals: [], twists: [], applied: {},
  threads: [{ key: 'k-thread-1', thread_id: null, title: 'Who sent the second invitation?', note: '', action: 'new', keep: true }] };

const renderTab = (locked) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => (url === RECORD_URL ? { data: { record: null, cast: [], threads: [], goals: [] } } : { data: { data: [] } }));
  vi.mocked(api.post).mockImplementation(async (url) => (url === `${RECORD_URL}/draft` ? { data: { record: RECORD, cast: [], threads: [], goals: [] } } : { data: {} }));
});

test('every beat approved: the button opens What changed, which reads the script', async () => {
  renderTab([11]);
  const read = await screen.findByTestId('script-read-finished');
  expect(read.textContent).toContain('Read the finished script');
  // Nothing reads it on its own.
  expect(api.post).not.toHaveBeenCalledWith(`${RECORD_URL}/draft`, expect.anything(), expect.anything());
  fireEvent.click(read);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${RECORD_URL}/draft`, {}, { timeout: 180000 }));
  expect(await screen.findByTestId('wc-threads-0')).toBeTruthy();
  expect(screen.getByTestId('script-what-changed')).toBeTruthy();
  expect(screen.queryByTestId('script-read-finished')).toBeNull();
});

test('a record already there is shown, not read again', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => (url === RECORD_URL ? { data: { record: RECORD, cast: [], threads: [], goals: [] } } : { data: { data: [] } }));
  renderTab([11]);
  fireEvent.click(await screen.findByTestId('script-read-finished'));
  expect(await screen.findByTestId('wc-threads-0')).toBeTruthy();
  expect(api.post).not.toHaveBeenCalledWith(`${RECORD_URL}/draft`, expect.anything(), expect.anything());
});

test('not every beat approved: no button', async () => {
  renderTab([]);
  await screen.findByText(/1 beats/);
  expect(screen.queryByTestId('script-read-finished')).toBeNull();
});

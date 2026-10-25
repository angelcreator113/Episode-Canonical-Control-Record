// Edit & Assemble → Takes to use: the ★ take first and picked; Use favourites
// lines them up in beat order; a pick stays on this device.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn(), beats: vi.fn() } };
});

import { rawClipsApi } from '../../lib/rawClipsApi';
import AssembleTakesSheet from './AssembleTakesSheet';
import { PICKS_KEY } from '../../lib/assembleTakes';

const CLIPS = [
  { id: 'a', beat_number: 1, label: 'Beat 1 · take 1', is_favorite: false },
  { id: 'b', beat_number: 1, label: 'Beat 1 · take 2', is_favorite: true },
  { id: 'f', beat_number: null, label: 'Full episode · take 1', beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 40 }], duration_seconds: 90 },
];

beforeEach(() => {
  rawClipsApi.list.mockReset().mockResolvedValue(CLIPS);
  rawClipsApi.beats.mockReset().mockResolvedValue([{ beat_number: 1, beat_name: 'Opening Ritual' }]);
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

test('the favourite is first and picked; another pick is kept; Use favourites puts the ★ back and lines them up', async () => {
  const onClose = vi.fn();
  render(<AssembleTakesSheet episodeId="ep-1" onClose={onClose} />);
  const beat1 = await screen.findByTestId('assemble-beat-1');
  const radios = within(beat1).getAllByRole('radio');
  expect(radios[0].closest('label').textContent).toContain('Beat 1 · take 2');
  expect(radios[0].checked).toBe(true);
  expect(within(screen.getByTestId('assemble-beat-2')).getByText(/from 0:40\.0 to 1:30\.0/)).toBeTruthy();
  expect(screen.getByTestId('assemble-stat').textContent).toBe('2 of 14 beats have a take to use');
  fireEvent.click(radios[1]);
  expect(JSON.parse(window.localStorage.getItem(PICKS_KEY('ep-1')))).toEqual({ 1: 'a' });
  fireEvent.click(screen.getByTestId('assemble-use-favourites'));
  expect(within(screen.getByTestId('assemble-beat-1')).getAllByRole('radio')[0].checked).toBe(true);
  const lined = screen.getByTestId('assemble-lined');
  expect(lined.textContent).toMatch(/1\. Opening Ritual: Beat 1 · take 2 ★/);
  expect(lined.textContent.indexOf('1. Opening')).toBeLessThan(lined.textContent.indexOf('2. '));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('a failed load says so in plain words', async () => {
  rawClipsApi.list.mockRejectedValue(new Error('500'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<AssembleTakesSheet episodeId="ep-1" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not load the takes.'));
});

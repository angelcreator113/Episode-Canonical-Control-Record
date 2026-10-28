// Raw Footage: where each video starts and ends (Evoni, 2026-10-28). A
// full-episode take with markers says its beats and where it ended; two of
// her takes covering the same beats each say so; an uploaded clip linked to
// a beat gets an "Ends on" picker, and before the database update a choice
// says plainly that it can't be saved yet.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() } };
});

import { rawClipsApi } from '../../lib/rawClipsApi';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const EIGHT = [...Array.from({ length: 9 }, (_, i) => ({ beat: i + 1, t: 0 })), { beat: 10, t: 9.4 }, { beat: 11, t: 10.4 }, { beat: 12, t: 162.5 }, { beat: 13, t: 239.2 }, { beat: 14, t: 399.3 }];
const CLIPS = [
  { id: 'f22', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 1320, key_status: 'none', beat_number: null, end_beat_number: null,
    beat_marks: Array.from({ length: 11 }, (_, i) => ({ beat: i + 1, t: i * 110 })) },
  { id: 'f8', performer: 'justawoman', label: 'Full episode · take 2', duration_seconds: 480, key_status: 'none', beat_number: null, end_beat_number: null, beat_marks: EIGHT },
  { id: 'up', performer: 'lala', label: 'phone.mp4', duration_seconds: 900, key_status: 'none', beat_number: 1, end_beat_number: 11 },
  { id: 'one', performer: 'guest', label: 'toast.mp4', key_status: 'none', beat_number: 3, end_beat_number: null },
];
const card = (name) => screen.getByText(name).closest('[data-testid="erf-clip"]');

beforeEach(() => {
  Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
  rawClipsApi.list.mockResolvedValue(CLIPS);
  rawClipsApi.beats.mockResolvedValue([{ beat_number: 14, beat_name: 'Cliffhanger' }]);
});

test('a full take with markers says its beats and where it ended, with no Ends on picker; overlapping takes each say so', async () => {
  render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
  await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(4));
  const eight = card('Full episode · take 2');
  expect(within(eight).getByTestId('erf-range').textContent.trim()).toBe('Beats 10 → 14 · ended in beat 14 · Cliffhanger');
  expect(within(eight).getByTestId('erf-overlap').textContent.trim()).toBe('Overlaps Full episode · take 1 on beats 10–11');
  expect(within(eight).queryByTestId('erf-end-beat')).toBeNull();
  const long = card('Full episode · take 1');
  expect(within(long).getByTestId('erf-range').textContent.trim()).toBe('Beats 1 → 11 · ended in beat 11 · The Event');
  expect(within(long).getByTestId('erf-overlap').textContent.trim()).toBe('Overlaps Full episode · take 2 on beats 10–11');
});

test('an uploaded clip reads "Beat 1 → Beat 11"; Ends on saves end_beat_number; a one-beat clip offers the later beats', async () => {
  rawClipsApi.update.mockResolvedValue({ id: 'one', beat_number: 3, end_beat_number: 6 });
  render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
  await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(4));
  const up = card('phone.mp4');
  expect(within(up).getByTestId('erf-range').textContent.trim()).toBe('Beat 1 → Beat 11');
  expect(within(up).getByLabelText('Which beat this clip ends on').value).toBe('11');
  const one = card('toast.mp4');
  expect(within(one).queryByTestId('erf-range')).toBeNull();
  const picker = within(one).getByLabelText('Which beat this clip ends on');
  expect(picker.value).toBe('');
  const options = within(picker).getAllByRole('option').map((o) => o.textContent);
  expect(options[0]).toBe('Ends in the same beat');
  expect(options[1]).toBe('Ends on Beat 4');
  expect(options.at(-1)).toBe('Ends on 14. Cliffhanger');
  fireEvent.change(picker, { target: { value: '6' } });
  await waitFor(() => expect(rawClipsApi.update).toHaveBeenCalledWith('ep-1', 'one', { end_beat_number: 6 }));
  await waitFor(() => expect(within(card('toast.mp4')).getByTestId('erf-range').textContent.trim()).toBe('Beat 3 → Beat 6'));
});

test('a clip with no scene has no Ends on picker', async () => {
  rawClipsApi.list.mockResolvedValue([{ id: 'n', performer: 'lala', label: 'loose.mp4', key_status: 'none', beat_number: null }]);
  render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
  await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(1));
  expect(screen.queryByTestId('erf-end-beat')).toBeNull();
});

test('before the database update: choosing an end beat shows the server\'s plain message and the clip is unchanged', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const message = "The beat a clip ends on can't be saved yet: the database update that adds it (20261028120000) hasn't run yet. Everything else about the clip still works.";
  rawClipsApi.update.mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: { success: false, error: message } } }));
  rawClipsApi.list.mockResolvedValue([{ id: 'old', performer: 'lala', label: 'old.mp4', key_status: 'none', beat_number: 2 }]);
  render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
  await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Which beat this clip ends on'), { target: { value: '5' } });
  expect((await screen.findByRole('alert')).textContent).toContain(message);
  expect(screen.getByLabelText('Which beat this clip ends on').value).toBe('');
  expect(screen.queryByTestId('erf-range')).toBeNull();
});

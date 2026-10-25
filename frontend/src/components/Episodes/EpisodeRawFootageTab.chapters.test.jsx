// Raw Footage: a whole-episode take with beat markers offers YouTube chapters
// and a draft description, both copyable.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() } };
});

import { rawClipsApi } from '../../lib/rawClipsApi';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const CLIPS = [
  { id: 'f1', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 300, key_status: 'none', beat_number: null,
    beat_marks: [{ beat: 1, t: 1 }, { beat: 2, t: 60 }, { beat: 3, t: 64 }, { beat: 4, t: 150 }] },
  { id: 'b1', performer: 'justawoman', label: 'Beat 2 · take 1', key_status: 'none', beat_number: 2 },
];

beforeEach(() => {
  Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
  rawClipsApi.list.mockResolvedValue(CLIPS);
  rawClipsApi.beats.mockResolvedValue([{ beat_number: 1, beat_name: 'Opening Ritual' }, { beat_number: 2, beat_name: 'Login Sequence' }, { beat_number: 3, beat_name: 'Welcome' }, { beat_number: 4, beat_name: 'Interruption' }]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
});

test('only the marked take has YouTube chapters; the sheet shows chapters, the join note and the description', async () => {
  render(<EpisodeRawFootageTab episode={{ id: 'ep-1', title: 'The Gala', description: 'Lala is invited to the gala.' }} />);
  await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(2));
  expect(screen.getAllByTestId('erf-chapters-open')).toHaveLength(1);
  await waitFor(() => expect(rawClipsApi.beats).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId('erf-chapters-open'));
  const sheet = screen.getByTestId('erf-chapters');
  const list = within(screen.getByTestId('erf-chapters-list')).getByRole('textbox');
  expect(list.value).toBe('0:00 Opening Ritual\n1:00 Login Sequence & Welcome\n2:30 Interruption');
  expect(within(sheet).getByTestId('erf-chapter-notes').textContent).toMatch(/under 10 seconds/);
  const desc = within(screen.getByTestId('erf-chapters-description')).getByRole('textbox');
  expect(desc.value).toBe('The Gala\n\nLala is invited to the gala.\n\nChapters\n0:00 Opening Ritual\n1:00 Login Sequence & Welcome\n2:30 Interruption');
  fireEvent.click(screen.getByTestId('erf-chapters-list-copy'));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(list.value));
  expect(await within(sheet).findByText('Copied')).toBeTruthy();
});

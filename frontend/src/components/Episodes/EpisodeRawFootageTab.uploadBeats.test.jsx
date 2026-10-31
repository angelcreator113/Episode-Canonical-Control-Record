/**
 * The beats a clip covers, asked when it is uploaded (Evoni, 2026-10-30;
 * Voice plan V1): each lane's drop area has "Starts in" and "Ends in",
 * sent with every clip dropped there. Both can stay unset. An end beat the
 * server couldn't keep (its database update hasn't run) is said plainly;
 * the clip is saved either way.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return {
    ...actual,
    rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() },
  };
});

import { rawClipsApi, uploadBeats, uploadEndChoices, endBeatNotKept, sceneChoices, uploadFields } from '../../lib/rawClipsApi';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const lane = (key) => screen.getByTestId(`erf-lane-${key}`);
const startOf = (key) => screen.getByTestId(`erf-upload-start-${key}`);
const endOf = (key) => screen.getByTestId(`erf-upload-end-${key}`);
const drop = (key, name = 'take.mp4') => {
  const file = new File(['x'], name, { type: 'video/mp4' });
  fireEvent.change(screen.getByTestId(`erf-input-${key}`), { target: { files: [file] } });
  return file;
};

describe('upload beat helpers', () => {
  test('uploadBeats: nothing without a start; an end only when it is after the start', () => {
    expect(uploadBeats('', '')).toEqual({});
    expect(uploadBeats('', '5')).toEqual({});
    expect(uploadBeats('1', '')).toEqual({ beatNumber: 1 });
    expect(uploadBeats('1', '5')).toEqual({ beatNumber: 1, endBeatNumber: 5 });
    expect(uploadBeats('1', '14')).toEqual({ beatNumber: 1, endBeatNumber: 14 });
    expect(uploadBeats('5', '5')).toEqual({ beatNumber: 5 });
    expect(uploadBeats('5', '3')).toEqual({ beatNumber: 5 });
    expect(uploadBeats('0', '3')).toEqual({});
    expect(uploadBeats('15', '')).toEqual({});
  });

  test('the upload sends beat_number and end_beat_number to the server', () => {
    expect(uploadFields({ performer: 'lala', ...uploadBeats('1', '5') })).toMatchObject({ performer: 'lala', beat_number: 1, end_beat_number: 5 });
    expect(uploadFields({ performer: 'lala', ...uploadBeats('', '') })).not.toHaveProperty('beat_number');
    expect(uploadFields({ performer: 'lala', ...uploadBeats('', '') })).not.toHaveProperty('end_beat_number');
  });

  test('uploadEndChoices: the beats after the start, none before a start is chosen', () => {
    const scenes = sceneChoices([]);
    expect(uploadEndChoices(scenes, '')).toEqual([]);
    expect(uploadEndChoices(scenes, '12').map((s) => s.value)).toEqual([13, 14]);
    expect(uploadEndChoices(scenes, '14')).toEqual([]);
  });

  test('endBeatNotKept: only when an end was asked for and the saved clip lacks it', () => {
    expect(endBeatNotKept({ end_beat_number: 5 }, { endBeatNumber: 5 })).toBe(false);
    expect(endBeatNotKept({ id: 'c' }, { endBeatNumber: 5 })).toBe(true);
    expect(endBeatNotKept({ end_beat_number: null }, { endBeatNumber: 5 })).toBe(true);
    expect(endBeatNotKept({ id: 'c' }, {})).toBe(false);
    expect(endBeatNotKept(null, { endBeatNumber: 5 })).toBe(false);
  });
});

describe('Starts in / Ends in on each lane', () => {
  beforeEach(() => {
    Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
    rawClipsApi.list.mockResolvedValue([]);
    rawClipsApi.beats.mockResolvedValue([{ beat_number: 1, beat_name: 'Opening Ritual' }, { beat_number: 5, beat_name: 'The Invite' }]);
  });

  test('every lane asks; Ends in waits for a start and offers only later beats', async () => {
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(within(startOf('lala')).getByRole('option', { name: '1. Opening Ritual' })).toBeTruthy());
    for (const key of ['lala', 'justawoman', 'guest']) {
      expect(screen.getByTestId(`erf-upload-beats-${key}`)).toBeTruthy();
      expect(startOf(key).value).toBe('');
      expect(endOf(key).disabled).toBe(true);
    }
    fireEvent.change(startOf('lala'), { target: { value: '12' } });
    expect(endOf('lala').disabled).toBe(false);
    expect(within(endOf('lala')).getAllByRole('option').map((o) => o.textContent)).toEqual(['The same beat', 'Beat 13', 'Beat 14']);
    // The other lanes keep their own choice.
    expect(startOf('justawoman').value).toBe('');
  });

  test('a Lala clip uploaded as Beats 1 → 5 sends both beats, with green removal as before', async () => {
    rawClipsApi.upload.mockResolvedValue({ id: 'c9', performer: 'lala', label: 'take.mp4', key_status: 'queued', beat_number: 1, end_beat_number: 5 });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(within(startOf('lala')).getByRole('option', { name: '5. The Invite' })).toBeTruthy());
    fireEvent.change(startOf('lala'), { target: { value: '1' } });
    fireEvent.change(endOf('lala'), { target: { value: '5' } });
    const file = drop('lala');
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalledWith('ep-1', file,
      expect.objectContaining({ performer: 'lala', greenScreen: true, beatNumber: 1, endBeatNumber: 5 }), expect.any(Function), expect.anything()));
    await waitFor(() => expect(within(lane('lala')).getByText('take.mp4')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('nothing chosen: the upload sends no beats (set them on the card later, as before)', async () => {
    rawClipsApi.upload.mockResolvedValue({ id: 'c9', performer: 'justawoman', label: 'take.mp4', key_status: 'none' });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(startOf('justawoman')).toBeTruthy());
    drop('justawoman');
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalled());
    const opts = rawClipsApi.upload.mock.calls[0][2];
    expect(opts).not.toHaveProperty('beatNumber');
    expect(opts).not.toHaveProperty('endBeatNumber');
  });

  test('a start only: the clip covers that one beat', async () => {
    rawClipsApi.upload.mockResolvedValue({ id: 'c9', performer: 'guest', label: 'take.mp4', key_status: 'none', beat_number: 4 });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(startOf('guest')).toBeTruthy());
    fireEvent.change(startOf('guest'), { target: { value: '4' } });
    drop('guest');
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalled());
    expect(rawClipsApi.upload.mock.calls[0][2]).toMatchObject({ beatNumber: 4 });
    expect(rawClipsApi.upload.mock.calls[0][2]).not.toHaveProperty('endBeatNumber');
  });

  test('moving the start past the end clears the end; clearing the start clears both', async () => {
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(startOf('lala')).toBeTruthy());
    fireEvent.change(startOf('lala'), { target: { value: '1' } });
    fireEvent.change(endOf('lala'), { target: { value: '5' } });
    expect(endOf('lala').value).toBe('5');
    fireEvent.change(startOf('lala'), { target: { value: '3' } });
    expect(endOf('lala').value).toBe('5');
    fireEvent.change(startOf('lala'), { target: { value: '6' } });
    expect(endOf('lala').value).toBe('');
    fireEvent.change(endOf('lala'), { target: { value: '9' } });
    fireEvent.change(startOf('lala'), { target: { value: '' } });
    expect(endOf('lala').value).toBe('');
    expect(endOf('lala').disabled).toBe(true);
  });

  test('the server could not keep the end beat yet: the clip is saved and the lane says why', async () => {
    rawClipsApi.upload.mockResolvedValue({ id: 'c9', performer: 'lala', label: 'take.mp4', key_status: 'queued', beat_number: 1 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(startOf('lala')).toBeTruthy());
    fireEvent.change(startOf('lala'), { target: { value: '1' } });
    fireEvent.change(endOf('lala'), { target: { value: '5' } });
    drop('lala', '4481.mp4');
    expect((await screen.findByRole('alert')).textContent).toContain("4481.mp4 is saved, but the beat it ends on wasn't kept: the database update that adds it (20261028120000) hasn't run yet.");
    expect(within(lane('lala')).getByText('take.mp4')).toBeTruthy();
  });
});

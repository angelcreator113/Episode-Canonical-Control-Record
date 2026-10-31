/**
 * Assets → Files: raw clips in three lanes (Evoni, 2026-10-17). Clips land
 * in their performer's lane; Lala's lane asks for green removal by default;
 * a clip plays as the original or the cut-out; Remove green, Move and
 * Delete call the API.
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

import { rawClipsApi, clipLength, clipSize, anyKeying, sceneChoices } from '../../lib/rawClipsApi';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const CLIPS = [
  { id: 'c1', performer: 'lala', label: 'Closet take 1', duration_seconds: 65.4, file_size_bytes: 88 * 1024 * 1024, width: 1080, height: 1920, url_raw: 'https://x/c1.mp4', url_cutout: 'https://x/c1.webm', thumbnail_url: 'https://x/c1.jpg', key_status: 'done', key_strength: 'medium' },
  { id: 'c2', performer: 'justawoman', label: 'Intro', duration_seconds: 12, url_raw: 'https://x/c2.mp4', key_status: 'none' },
  { id: 'c3', performer: 'guest', guest_name: 'Sage', label: 'Toast', url_raw: 'https://x/c3.mp4', key_status: 'failed', key_error: 'ffmpeg is not installed on the server' },
];

const lane = (key) => screen.getByTestId(`erf-lane-${key}`);

describe('raw clip helpers', () => {
  test('length, size and whether anything is still keying', () => {
    expect(clipLength(65.4)).toBe('1:05');
    expect(clipLength(3725)).toBe('1:02:05');
    expect(clipLength(null)).toBeNull();
    expect(clipSize(88 * 1024 * 1024)).toBe('88 MB');
    expect(clipSize(1.5 * 1024 ** 3)).toBe('1.5 GB');
    expect(anyKeying([{ key_status: 'done' }, { key_status: 'processing' }])).toBe(true);
    expect(anyKeying([{ key_status: 'done' }])).toBe(false);
  });

  test('scene choices name the beats the plan has and number the rest', () => {
    const choices = sceneChoices([{ beat_number: 1, beat_name: 'Opening Ritual' }]);
    expect(choices).toHaveLength(14);
    expect(choices[0]).toEqual({ value: 1, label: '1. Opening Ritual' });
    expect(choices[1]).toEqual({ value: 2, label: 'Beat 2' });
  });
});

describe('EpisodeRawFootageTab', () => {
  beforeEach(() => {
    Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
    rawClipsApi.list.mockResolvedValue(CLIPS);
    rawClipsApi.beats.mockResolvedValue([{ beat_number: 4, beat_name: 'Meet the Host' }]);
  });

  test('a clip links to a scene by name', async () => {
    rawClipsApi.update.mockResolvedValue({ id: 'c2', beat_number: 4 });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    const picker = within(lane('justawoman')).getByLabelText('Which scene this clip is for');
    await waitFor(() => expect(within(picker).getByRole('option', { name: '4. Meet the Host' })).toBeTruthy());
    fireEvent.change(picker, { target: { value: '4' } });
    await waitFor(() => expect(rawClipsApi.update).toHaveBeenCalledWith('ep-1', 'c2', { beat_number: 4 }));
    await waitFor(() => expect(within(lane('justawoman')).getByLabelText('Which scene this clip is for').value).toBe('4'));
  });

  test('each clip sits in its performer lane with its status', async () => {
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    expect(within(lane('lala')).getByText('Closet take 1')).toBeTruthy();
    expect(within(lane('lala')).getByTestId('erf-status').textContent).toContain('Background removed');
    expect(within(lane('lala')).getByText('1:05 · 88 MB · 1080×1920')).toBeTruthy();
    expect(within(lane('justawoman')).getByTestId('erf-status').textContent).toContain('Original only');
    expect(within(lane('guest')).getByText('Sage')).toBeTruthy();
    expect(within(lane('guest')).getByText('ffmpeg is not installed on the server')).toBeTruthy();
    expect(within(lane('guest')).getByRole('button', { name: /Retry/ })).toBeTruthy();
  });

  test('Lala uploads ask for green removal by default; JustAWoman does not', async () => {
    rawClipsApi.upload.mockResolvedValue({ id: 'c9', performer: 'lala', label: 'new.mp4', key_status: 'queued' });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    const file = new File(['x'], 'new.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByTestId('erf-input-lala'), { target: { files: [file] } });
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalledWith('ep-1', file, expect.objectContaining({ performer: 'lala', greenScreen: true }), expect.any(Function), expect.objectContaining({ resume: null })));
    await waitFor(() => expect(within(lane('lala')).getByText('new.mp4')).toBeTruthy());
    expect(within(lane('lala')).getByText('Waiting to remove green')).toBeTruthy();

    fireEvent.change(screen.getByTestId('erf-input-justawoman'), { target: { files: [new File(['y'], 'jaw.mov', { type: 'video/quicktime' })] } });
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenLastCalledWith('ep-1', expect.any(File), expect.objectContaining({ performer: 'justawoman', greenScreen: false }), expect.any(Function), expect.anything()));
  });

  test('a non-video file is not uploaded', async () => {
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    fireEvent.change(screen.getByTestId('erf-input-guest'), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(rawClipsApi.upload).not.toHaveBeenCalled();
  });

  test('a refused upload shows its reason in the lane', async () => {
    rawClipsApi.upload.mockRejectedValue({ response: { status: 413, data: {} } });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    fireEvent.change(screen.getByTestId('erf-input-guest'), { target: { files: [new File(['x'], 'big.mp4', { type: 'video/mp4' })] } });
    expect(await within(lane('guest')).findByText('Too big to upload')).toBeTruthy();
  });

  test('Remove green asks at the chosen strength; the card shows it waiting', async () => {
    rawClipsApi.removeGreen.mockResolvedValue({ id: 'c2', key_status: 'queued', key_strength: 'high' });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    const card = within(lane('justawoman')).getByTestId('erf-clip');
    fireEvent.change(within(card).getByLabelText('How much green to remove'), { target: { value: 'high' } });
    fireEvent.click(within(card).getByRole('button', { name: /Remove green/ }));
    await waitFor(() => expect(rawClipsApi.removeGreen).toHaveBeenCalledWith('ep-1', 'c2', 'high'));
    expect(await within(lane('justawoman')).findByText('Waiting to remove green')).toBeTruthy();
  });

  test('Move puts the clip in the other lane', async () => {
    rawClipsApi.update.mockResolvedValue({ id: 'c2', performer: 'guest' });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    fireEvent.change(within(lane('justawoman')).getByLabelText('Who is in this clip'), { target: { value: 'guest' } });
    await waitFor(() => expect(rawClipsApi.update).toHaveBeenCalledWith('ep-1', 'c2', { performer: 'guest' }));
    await waitFor(() => expect(within(lane('guest')).getByText('Intro')).toBeTruthy());
  });

  test('Delete asks first and removes the card', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    rawClipsApi.remove.mockResolvedValue(true);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    fireEvent.click(screen.getByLabelText('Delete Intro'));
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(2));
    expect(rawClipsApi.remove).toHaveBeenCalledWith('ep-1', 'c2');
  });

  test('the player opens on the cut-out and switches to the original', async () => {
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    fireEvent.click(screen.getByLabelText('Play Closet take 1'));
    expect(screen.getByTestId('erf-video').getAttribute('src')).toBe('https://x/c1.webm');
    fireEvent.click(screen.getByRole('button', { name: 'Original' }));
    expect(screen.getByTestId('erf-video').getAttribute('src')).toBe('https://x/c1.mp4');
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByTestId('erf-video')).toBeNull();
  });
});

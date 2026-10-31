/**
 * Green removal's progress on the Files page (Evoni, 2026-10-30: "I have no
 * way of knowing how long the background removal will take"). A running
 * clip shows how far it has got and about how long is left, from the
 * server's report; without one, how long ago it started. Words always; a
 * bar only when there is a percentage.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return {
    ...actual,
    rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), stopGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() },
  };
});

import { rawClipsApi, keyingProgress, minutesText } from '../../lib/rawClipsApi';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

describe('keyingProgress and minutesText', () => {
  test('minutesText: short times in minutes, long ones in hours and minutes', () => {
    expect(minutesText(20)).toBe('under a minute');
    expect(minutesText(60)).toBe('1 min');
    expect(minutesText(14 * 60 + 10)).toBe('14 min');
    expect(minutesText(3600)).toBe('1 h');
    expect(minutesText(3900)).toBe('1 h 5 min');
    expect(minutesText(undefined)).toBe('under a minute');
  });

  test('with the server\'s report: the percentage, and the time left once it can be guessed', () => {
    const clip = { key_status: 'processing', key_progress: { percent: 42, elapsed_seconds: 660, eta_seconds: 900 } };
    expect(keyingProgress(clip)).toEqual({ percent: 42, text: '42% · about 15 min left' });
    const early = { key_status: 'processing', key_progress: { percent: 1, elapsed_seconds: 20, eta_seconds: null } };
    expect(keyingProgress(early)).toEqual({ percent: 1, text: '1% · under a minute so far' });
  });

  test('without a report (a restart, or no length yet): how long ago it started; nothing when that is unknown', () => {
    const now = Date.parse('2026-10-30T21:14:00Z');
    expect(keyingProgress({ key_status: 'processing', key_started_at: '2026-10-30T21:00:00Z' }, now)).toEqual({ percent: null, text: 'Started 14 min ago' });
    expect(keyingProgress({ key_status: 'processing', key_progress: { percent: null, elapsed_seconds: 5 }, key_started_at: '2026-10-30T21:13:50Z' }, now))
      .toEqual({ percent: null, text: 'Started under a minute ago' });
    expect(keyingProgress({ key_status: 'processing' }, now)).toBeNull();
  });

  test('only a running green removal has progress', () => {
    for (const key_status of ['none', 'queued', 'done', 'failed']) {
      expect(keyingProgress({ key_status, key_progress: { percent: 50 }, key_started_at: '2026-10-30T21:00:00Z' })).toBeNull();
    }
  });
});

describe('the card', () => {
  beforeEach(() => {
    Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
    rawClipsApi.beats.mockResolvedValue([]);
  });
  const cardOf = (label) => screen.getAllByTestId('erf-clip').find((c) => within(c).queryByText(label));

  test('a running clip with a report: a bar and "42% · about 15 min left"; other clips show none', async () => {
    rawClipsApi.list.mockResolvedValue([
      { id: 'a', performer: 'lala', label: '4481.mp4', url_raw: 'https://x/a.mp4', key_status: 'processing', key_progress: { percent: 42, elapsed_seconds: 660, eta_seconds: 900 } },
      { id: 'b', performer: 'lala', label: 'done.mp4', url_raw: 'https://x/b.mp4', key_status: 'done' },
    ]);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(within(cardOf('4481.mp4')).getByTestId('erf-progress').textContent).toContain('42% · about 15 min left'));
    const bar = within(cardOf('4481.mp4')).getByRole('progressbar', { name: 'Green removal progress' });
    expect(bar.getAttribute('value')).toBe('42');
    expect(within(cardOf('done.mp4')).queryByTestId('erf-progress')).toBeNull();
  });

  test('a running clip without a report: "Started … ago" in words, no bar', async () => {
    rawClipsApi.list.mockResolvedValue([
      { id: 'a', performer: 'lala', label: '4481.mp4', url_raw: 'https://x/a.mp4', key_status: 'processing', key_started_at: new Date(Date.now() - 14 * 60 * 1000).toISOString() },
    ]);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(screen.getByTestId('erf-progress').textContent).toBe('Started 14 min ago'));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('Stop (Evoni, 2026-10-31)', () => {
  beforeEach(() => {
    Object.values(rawClipsApi).forEach((fn) => fn?.mockReset?.());
    rawClipsApi.beats.mockResolvedValue([]);
  });
  const cardOf = (label) => screen.getAllByTestId('erf-clip').find((c) => within(c).queryByText(label));

  test('a running or waiting clip has Stop (and no Retry); asks first, then stops it', async () => {
    rawClipsApi.list.mockResolvedValue([
      { id: 'a', performer: 'lala', label: '4481.mp4', url_raw: 'https://x/a.mp4', key_status: 'processing' },
      { id: 'b', performer: 'lala', label: 'next.mp4', url_raw: 'https://x/b.mp4', key_status: 'queued' },
      { id: 'c', performer: 'lala', label: 'done.mp4', url_raw: 'https://x/c.mp4', key_status: 'done' },
    ]);
    rawClipsApi.stopGreen.mockResolvedValue({ id: 'a', key_status: 'processing' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    const stop = await waitFor(() => within(cardOf('4481.mp4')).getByTestId('erf-stop-green'));
    expect(within(cardOf('next.mp4')).getByTestId('erf-stop-green')).toBeTruthy();
    expect(within(cardOf('done.mp4')).queryByTestId('erf-stop-green')).toBeNull();
    expect(within(cardOf('4481.mp4')).queryByText('Retry')).toBeNull();
    fireEvent.click(stop);
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Stop removing the green from "4481\.mp4"\? The original stays as it is/));
    await waitFor(() => expect(rawClipsApi.stopGreen).toHaveBeenCalledWith('ep-1', 'a'));
    confirm.mockRestore();
  });

  test('saying no at the question stops nothing', async () => {
    rawClipsApi.list.mockResolvedValue([{ id: 'a', performer: 'lala', label: '4481.mp4', url_raw: 'https://x/a.mp4', key_status: 'processing' }]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    fireEvent.click(await screen.findByTestId('erf-stop-green'));
    expect(rawClipsApi.stopGreen).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

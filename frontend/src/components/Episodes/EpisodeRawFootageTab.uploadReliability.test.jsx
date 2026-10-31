/**
 * Uploads that survive a phone (Evoni, 2026-10-31, the upload audit): a
 * failed upload is kept with Resume and Cancel; an upload a reload cut off
 * carries on when the same file is chosen again; the same file twice asks
 * first; leaving the page mid-upload asks first; Cancel throws the upload
 * away on the server.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return {
    ...actual,
    abortUpload: vi.fn(async () => true),
    rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), stopGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() },
  };
});

import { rawClipsApi, abortUpload } from '../../lib/rawClipsApi';
import { keepUpload, fileSignature } from '../../lib/uploadResume';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const MB = 1024 * 1024;
const lane = (key) => screen.getByTestId(`erf-lane-${key}`);
// Wait for the lanes, not just the list request: the lane inputs render only
// after the list has loaded, which a slow CI runner can take a while to do.
const laneReady = (key = 'lala') => screen.findByTestId(`erf-input-${key}`);
const pick = (key, file) => fireEvent.change(screen.getByTestId(`erf-input-${key}`), { target: { files: [file] } });
const video = (name = '4481.mp4', bytes = 10) => new File([new Uint8Array(bytes)], name, { type: 'video/mp4', lastModified: 1700000000000 });
const dropped = (resume) => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', resume });

beforeEach(() => {
  window.localStorage.clear();
  Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
  abortUpload.mockClear();
  rawClipsApi.list.mockResolvedValue([]);
  rawClipsApi.beats.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('upload reliability', () => {
  test('a dropped upload is kept: Resume sends it again from where it stopped, then it saves', async () => {
    const st = { uploadId: 'u1', clipId: 'c1', partSize: 8 * MB, size: 100 * MB, done: [1, 2, 3, 4, 5, 6] };
    rawClipsApi.upload
      .mockImplementationOnce(async (_ep, _f, _o, _p, opts) => { opts.onState(st); throw dropped(st); })
      .mockResolvedValueOnce({ id: 'c1', performer: 'lala', label: '4481.mp4', key_status: 'queued' });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await laneReady();
    pick('lala', video());
    const resume = await waitFor(() => within(lane('lala')).getByTestId('erf-upload-resume'));
    expect(within(lane('lala')).getByTestId('erf-upload').textContent).toMatch(/48% is already sent\./);
    expect(abortUpload).not.toHaveBeenCalled();
    fireEvent.click(resume);
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalledTimes(2));
    expect(rawClipsApi.upload.mock.calls[1][4]).toMatchObject({ resume: st });
    await waitFor(() => expect(within(lane('lala')).getByText('4481.mp4')).toBeTruthy());
    expect(within(lane('lala')).queryByTestId('erf-upload')).toBeNull();
    expect(window.localStorage.getItem('rawClipUploads:ep-1')).toBeNull();
  });

  test('Cancel during an upload stops it and throws it away on the server', async () => {
    const st = { uploadId: 'u2', clipId: 'c2', partSize: 8 * MB, size: 100 * MB, done: [1] };
    let signal;
    rawClipsApi.upload.mockImplementation((_ep, _f, _o, _p, opts) => new Promise((_resolve, reject) => {
      signal = opts.signal;
      opts.onState(st);
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED', name: 'CanceledError' })));
    }));
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await laneReady();
    pick('lala', video());
    fireEvent.click(await waitFor(() => within(lane('lala')).getByTestId('erf-upload-cancel')));
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(abortUpload).toHaveBeenCalledWith('ep-1', 'u2'));
    expect(within(lane('lala')).queryByTestId('erf-upload')).toBeNull();
    expect(window.localStorage.getItem('rawClipUploads:ep-1')).toBeNull();
  });

  test('after a reload: the unfinished upload is named; choosing the same file carries on from it; Forget it throws it away', async () => {
    const file = video();
    const st = { uploadId: 'u3', clipId: 'c3', partSize: 8 * MB, size: 100 * MB, done: [1, 2, 3] };
    keepUpload('ep-1', fileSignature(file), { name: '4481.mp4', performer: 'lala', state: st });
    rawClipsApi.upload.mockResolvedValue({ id: 'c3', performer: 'lala', label: '4481.mp4', key_status: 'none' });
    const { unmount } = render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    const note = await screen.findByTestId('erf-unfinished');
    expect(note.textContent).toMatch(/4481\.mp4 didn.t finish uploading \(24% sent\)\. Choose the same file again/);
    await laneReady();
    pick('lala', file);
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalled());
    expect(rawClipsApi.upload.mock.calls[0][4]).toMatchObject({ resume: st });
    await waitFor(() => expect(screen.queryByTestId('erf-unfinished')).toBeNull());
    unmount();

    keepUpload('ep-1', 'other.mp4|5|1', { name: 'other.mp4', performer: 'lala', state: { ...st, uploadId: 'u4' } });
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    fireEvent.click(await screen.findByTestId('erf-unfinished-forget'));
    expect(abortUpload).toHaveBeenCalledWith('ep-1', 'u4');
    expect(screen.queryByTestId('erf-unfinished')).toBeNull();
  });

  test('the same file (name and size) already in the lane: asks first; No uploads nothing', async () => {
    rawClipsApi.list.mockResolvedValue([{ id: 'c9', performer: 'lala', label: '4481.mp4', original_filename: '4481.mp4', file_size_bytes: 10, key_status: 'done' }]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await waitFor(() => expect(within(lane('lala')).getAllByTestId('erf-clip')).toHaveLength(1));
    pick('lala', video('4481.mp4', 10));
    expect(confirm).toHaveBeenCalledWith('"4481.mp4" is already in this lane (same name and size). Upload it again?');
    expect(rawClipsApi.upload).not.toHaveBeenCalled();
    pick('lala', video('4481.mp4', 11));
    await waitFor(() => expect(rawClipsApi.upload).toHaveBeenCalledTimes(1));
  });

  test('while uploading, leaving the page asks first; afterwards it does not', async () => {
    let finish;
    rawClipsApi.upload.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    render(<EpisodeRawFootageTab episode={{ id: 'ep-1' }} />);
    await laneReady();
    pick('lala', video());
    await waitFor(() => expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true));
    const handler = add.mock.calls.find(([type]) => type === 'beforeunload')[1];
    const e = { preventDefault: vi.fn(), returnValue: undefined };
    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    finish({ id: 'c1', performer: 'lala', label: '4481.mp4', key_status: 'none' });
    await waitFor(() => expect(remove.mock.calls.some(([type, fn]) => type === 'beforeunload' && fn === handler)).toBe(true));
  });
});

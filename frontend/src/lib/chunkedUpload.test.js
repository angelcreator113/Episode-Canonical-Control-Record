// Sending a video in 8 MB parts (2026-10-27): the slices, a part tried
// again up to 3 times with longer waits, Retry skipping the parts already
// sent, the percent, and the API's resume / start-again rules.
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
// The browser's measure of an upload (lib/videoProbe), faked: nothing is decoded here.
vi.mock('./videoProbe', async () => {
  const actual = await vi.importActual('./videoProbe');
  return { ...actual, probeVideo: vi.fn(async () => ({ seconds: null, width: null, height: null, thumbnail: null, problems: [] })) };
});

import api from '../services/api';
import { PART_SIZE, slicePlan, withRetry, worthRetrying, uploadInParts, percentOf } from './chunkedUpload';
import { sendInParts, uploadFields, rawClipsApi } from './rawClipsApi';
import { probeVideo } from './videoProbe';

const MB = 1024 * 1024;
const blobOf = (bytes) => new Blob([new Uint8Array(bytes)], { type: 'video/webm' });
const noWait = vi.fn(async () => {});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  noWait.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('slicePlan', () => {
  test('8 MB slices, the last one shorter; a small file is one slice', () => {
    expect(PART_SIZE).toBe(8 * MB);
    expect(slicePlan(17 * MB)).toEqual([
      { partNumber: 1, start: 0, end: 8 * MB },
      { partNumber: 2, start: 8 * MB, end: 16 * MB },
      { partNumber: 3, start: 16 * MB, end: 17 * MB },
    ]);
    expect(slicePlan(16 * MB)).toHaveLength(2);
    expect(slicePlan(10)).toEqual([{ partNumber: 1, start: 0, end: 10 }]);
  });
});

describe('withRetry', () => {
  test('a part that keeps failing is tried 4 times in all (3 retries), waiting 1 s, 3 s, 8 s', async () => {
    const fn = vi.fn(async () => { throw Object.assign(new Error('503'), { response: { status: 503 } }); });
    await expect(withRetry(fn, { sleep: noWait })).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(4);
    expect(noWait.mock.calls.map(([ms]) => ms)).toEqual([1000, 3000, 8000]);
  });

  test('a dropped connection then success: done on the second try', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce('ok');
    await expect(withRetry(fn, { sleep: noWait })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('a refusal, an expired sign-in or a full disk is not tried again', () => {
    expect(worthRetrying({ response: { status: 400 } })).toBe(false);
    expect(worthRetrying({ response: { status: 401 }, sessionExpired: true })).toBe(false);
    expect(worthRetrying({ response: { status: 507 } })).toBe(false);
    expect(worthRetrying({ response: { status: 429 } })).toBe(true);
    expect(worthRetrying({ response: { status: 502 } })).toBe(true);
    expect(worthRetrying({ message: 'timeout of 300000ms exceeded' })).toBe(true);
  });
});

describe('uploadInParts', () => {
  test('sends the parts in order with the percent as it goes', async () => {
    const sent = [];
    const pct = [];
    const done = await uploadInParts({
      blob: blobOf(17 * MB), sleep: noWait, onProgress: (p) => pct.push(p),
      send: async (n, slice, onLoaded) => { sent.push([n, slice.size]); onLoaded(slice.size / 2); },
    });
    expect(done).toEqual([1, 2, 3]);
    expect(sent).toEqual([[1, 8 * MB], [2, 8 * MB], [3, 1 * MB]]);
    expect(pct[0]).toBe(0);
    expect(pct.at(-1)).toBe(100);
    expect(pct).toEqual([...pct].sort((a, b) => a - b)); // never goes back
    expect(percentOf(8 * MB, 17 * MB)).toBe(47);
  });

  test('resume: parts already sent are skipped, and the percent starts from them', async () => {
    const sent = [];
    const pct = [];
    const partsDone = [];
    await uploadInParts({
      blob: blobOf(17 * MB), done: [1, 2], sleep: noWait, onProgress: (p) => pct.push(p), onPartDone: (n) => partsDone.push(n),
      send: async (n) => { sent.push(n); },
    });
    expect(sent).toEqual([3]);
    expect(partsDone).toEqual([3]);
    expect(pct[0]).toBe(94);
  });

  test('a part that fails all its tries stops there; the parts before it count as done', async () => {
    const partsDone = [];
    const send = vi.fn(async (n) => { if (n === 2) throw Object.assign(new Error('500'), { response: { status: 500 } }); });
    await expect(uploadInParts({ blob: blobOf(17 * MB), sleep: noWait, send, onPartDone: (n) => partsDone.push(n) })).rejects.toThrow('500');
    expect(partsDone).toEqual([1]);
    expect(send.mock.calls.map(([n]) => n)).toEqual([1, 2, 2, 2, 2]);
  });
});

describe('sendInParts (the API)', () => {
  const answerComplete = { data: { success: true, data: { id: 'clip-1', label: 'Beat 2 · take 1' }, stored: ['start_line'], not_stored: [] } };

  test('starts with the take\'s fields, sends the parts, completes with the thumbnail; the state is kept then cleared', async () => {
    api.post.mockImplementation(async (url) => (url.endsWith('/uploads') ? { data: { uploadId: 'u/1', clipId: 'clip-1', partSize: 8 * MB } } : answerComplete));
    api.put.mockResolvedValue({ data: { success: true } });
    const states = [];
    const file = new File([new Uint8Array(9 * MB)], 'beat-2-take-1.webm', { type: 'video/webm' });
    const out = await sendInParts('ep-1', file, uploadFields({ performer: 'justawoman', label: 'Beat 2 · take 1', beatNumber: 2, startLine: 0, seconds: 41.234 }), {
      onState: (s) => states.push(s), thumbnail: async () => 'data:image/jpeg;base64,/9j/AA==', sleep: noWait,
    });
    expect(out.clip.id).toBe('clip-1');
    expect([...out.stored]).toEqual(['start_line']);
    expect(api.post.mock.calls[0]).toEqual(['/api/v1/episode-clips/ep-1/uploads', {
      performer: 'justawoman', green_screen: 'false', label: 'Beat 2 · take 1', beat_number: 2, start_line: 0, seconds: 41.23,
      filename: 'beat-2-take-1.webm', content_type: 'video/webm', size: 9 * MB,
    }, {}]);
    expect(api.put.mock.calls.map(([u]) => u)).toEqual(['/api/v1/episode-clips/ep-1/uploads/u%2F1/parts/1', '/api/v1/episode-clips/ep-1/uploads/u%2F1/parts/2']);
    expect(api.post.mock.calls[1][0]).toBe('/api/v1/episode-clips/ep-1/uploads/u%2F1/complete');
    // The size and the fields go with complete too (an upload begun while recording needs them; 2026-10-28).
    expect(api.post.mock.calls[1][1]).toEqual({ thumbnail: 'data:image/jpeg;base64,/9j/AA==', size: 9 * MB, fields: expect.objectContaining({ performer: 'justawoman' }) });
    expect(states.map((s) => s && s.done)).toEqual([[], [1], [1, 2], null]);
  });

  test('resume: no new start, only the parts not done', async () => {
    api.post.mockResolvedValue(answerComplete);
    api.put.mockResolvedValue({ data: {} });
    const blob = blobOf(17 * MB);
    await sendInParts('ep-1', blob, {}, { resume: { uploadId: 'u1', clipId: 'clip-1', partSize: 8 * MB, size: blob.size, done: [1, 2] }, sleep: noWait });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toMatch(/\/uploads\/u1\/complete$/);
    expect(api.put.mock.calls.map(([u]) => u.split('/').pop())).toEqual(['3']);
  });

  test('an upload the server forgot (404) starts again cleanly, once', async () => {
    api.post.mockImplementation(async (url) => (url.endsWith('/uploads') ? { data: { uploadId: 'u2', clipId: 'clip-2', partSize: 8 * MB } } : answerComplete));
    api.put.mockImplementation(async (url) => {
      if (url.includes('/u1/')) throw Object.assign(new Error('404'), { response: { status: 404, data: { error: 'This upload was too old to finish' } } });
      return { data: {} };
    });
    const blob = blobOf(9 * MB);
    const states = [];
    await sendInParts('ep-1', blob, { performer: 'lala' }, { resume: { uploadId: 'u1', partSize: 8 * MB, size: blob.size, done: [1] }, onState: (s) => states.push(s), sleep: noWait });
    expect(api.put.mock.calls.map(([u]) => u.replace('/api/v1/episode-clips/ep-1/uploads/', ''))).toEqual(['u1/parts/2', 'u2/parts/1', 'u2/parts/2']);
    expect(states[0]).toBeNull();
  });

  // Evoni, 2026-10-31: a dropped upload started again from zero. It is kept now, for Resume.
  test('Assets → Files uploads go in parts too; a failed one is kept (not thrown away), its state on the error for Resume', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockResolvedValue({ data: { uploadId: 'u9', clipId: 'clip-9', partSize: 8 * MB } });
    api.put.mockRejectedValue(Object.assign(new Error('400'), { response: { status: 400, data: { error: 'Part 1 arrived incomplete. Try again.' } } }));
    api.delete.mockResolvedValue({ data: { success: true } });
    const states = [];
    const file = new File([new Uint8Array(100)], 'lala.mov', { type: 'video/quicktime' });
    const err = await rawClipsApi.upload('ep-1', file, { performer: 'lala', greenScreen: true }, undefined, { onState: (s) => states.push(s) }).catch((e) => e);
    expect(err.message).toBe('400');
    expect(err.resume).toMatchObject({ uploadId: 'u9', clipId: 'clip-9', size: 100, done: [] });
    expect(states[0]).toMatchObject({ uploadId: 'u9' });
    expect(api.post.mock.calls[0][1]).toMatchObject({ performer: 'lala', green_screen: 'true', filename: 'lala.mov', content_type: 'video/quicktime', size: 100 });
    await new Promise((r) => setTimeout(r, 0));
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('Resume: the kept state goes back in, so only the parts not sent go up', async () => {
    api.post.mockResolvedValue(answerComplete);
    api.put.mockResolvedValue({ data: {} });
    const file = new File([new Uint8Array(17 * MB)], 'big.mp4', { type: 'video/mp4' });
    await rawClipsApi.upload('ep-1', file, { performer: 'lala' }, undefined, {
      measure: async () => ({ file, seconds: null }), resume: { uploadId: 'u1', clipId: 'clip-1', partSize: 8 * MB, size: file.size, done: [1, 2] },
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toMatch(/\/uploads\/u1\/complete$/);
    expect(api.put.mock.calls.map(([u]) => u.split('/').pop())).toEqual(['3']);
  });

  test('a lost answer to "complete" is asked again (the server gives the same clip); a refusal is not', async () => {
    let n = 0;
    api.post.mockImplementation(async (url) => {
      if (url.endsWith('/uploads')) return { data: { uploadId: 'u5', clipId: 'clip-5', partSize: 8 * MB } };
      n += 1;
      if (n === 1) throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
      return answerComplete;
    });
    api.put.mockResolvedValue({ data: {} });
    const out = await sendInParts('ep-1', blobOf(1 * MB), {}, { sleep: noWait });
    expect(out.clip.id).toBe('clip-1');
    expect(n).toBe(2);
  });

  test('Cancel (an aborted signal): the request is not tried again', async () => {
    const controller = new AbortController();
    api.post.mockResolvedValue({ data: { uploadId: 'u6', clipId: 'clip-6', partSize: 8 * MB } });
    api.put.mockImplementation(async (_u, _b, cfg) => {
      expect(cfg.signal).toBe(controller.signal);
      controller.abort();
      throw Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' });
    });
    await expect(sendInParts('ep-1', blobOf(1 * MB), {}, { sleep: noWait, signal: controller.signal })).rejects.toThrow('canceled');
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(worthRetrying({ code: 'ERR_CANCELED' })).toBe(false);
  });

  // Evoni, 2026-10-28: a 453 MB phone MP4 uploaded on Files showed only "453 MB".
  test('Assets → Files measures the video in the browser first: seconds, width and height start the upload, the thumbnail completes it', async () => {
    probeVideo.mockResolvedValueOnce({ seconds: 481.43, width: 1080, height: 1920, thumbnail: 'data:image/jpeg;base64,/9j/BB==', problems: [] });
    api.post.mockImplementation(async (url) => (url.endsWith('/uploads') ? { data: { uploadId: 'u7', clipId: 'clip-7', partSize: 8 * MB } } : { data: { success: true, data: { id: 'clip-7' }, stored: [] } }));
    api.put.mockResolvedValue({ data: { success: true } });
    // Not a real MP4: its header can't take a length, so it goes as it is.
    const file = new File([new Uint8Array(3 * MB)], 'IMG_4410.mp4', { type: 'video/mp4' });
    const clip = await rawClipsApi.upload('ep-1', file, { performer: 'justawoman', greenScreen: false });
    expect(clip).toEqual({ id: 'clip-7' });
    expect(probeVideo).toHaveBeenCalledWith(file, { knownSeconds: null });
    expect(api.post.mock.calls[0][1]).toEqual({
      performer: 'justawoman', green_screen: 'false', seconds: 481.43, width: 1080, height: 1920,
      filename: 'IMG_4410.mp4', content_type: 'video/mp4', size: 3 * MB,
    });
    expect(api.post.mock.calls[1][0]).toBe('/api/v1/episode-clips/ep-1/uploads/u7/complete');
    expect(api.post.mock.calls[1][1]).toMatchObject({ thumbnail: 'data:image/jpeg;base64,/9j/BB==', size: 3 * MB });
  });

  test('a video the browser could not measure still uploads, without the fields', async () => {
    api.post.mockImplementation(async (url) => (url.endsWith('/uploads') ? { data: { uploadId: 'u8', clipId: 'clip-8', partSize: 8 * MB } } : { data: { success: true, data: { id: 'clip-8' } } }));
    api.put.mockResolvedValue({ data: { success: true } });
    const file = new File([new Uint8Array(100)], 'odd.mkv', { type: 'video/x-matroska' });
    await rawClipsApi.upload('ep-1', file, { performer: 'lala' });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('seconds');
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('width');
    expect(api.post.mock.calls[1][0]).toMatch(/\/complete$/);
  });

  test('uploadFields: width and height only together and in range; an end beat only with its start beat, not before it', () => {
    expect(uploadFields({ performer: 'lala', width: 1080, height: 1920 })).toMatchObject({ width: 1080, height: 1920 });
    expect(uploadFields({ performer: 'lala', width: 1080 })).not.toHaveProperty('width');
    expect(uploadFields({ performer: 'lala', width: 0, height: 10 })).not.toHaveProperty('width');
    expect(uploadFields({ performer: 'lala', beatNumber: 1, endBeatNumber: 11 })).toMatchObject({ beat_number: 1, end_beat_number: 11 });
    expect(uploadFields({ performer: 'lala', endBeatNumber: 11 })).not.toHaveProperty('end_beat_number');
    expect(uploadFields({ performer: 'lala', beatNumber: 5, endBeatNumber: 3 })).not.toHaveProperty('end_beat_number');
  });
});


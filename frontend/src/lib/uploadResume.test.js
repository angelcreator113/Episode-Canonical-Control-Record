/**
 * Unfinished uploads kept on this device (Evoni, 2026-10-31): by the file's
 * name, size and date; dropped after 6 hours; forgotten on success or
 * Cancel; storage that fails never breaks an upload.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { fileSignature, keepUpload, unfinishedUploads, sentPercent, RESUME_MAX_AGE_MS } from './uploadResume';

const MB = 1024 * 1024;
const state = (done) => ({ uploadId: 'u1', clipId: 'c1', partSize: 8 * MB, size: 100 * MB, done });

beforeEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });

describe('uploadResume', () => {
  test('fileSignature: name, size and last-changed time', () => {
    expect(fileSignature({ name: '4481.mp4', size: 956, lastModified: 1700 })).toBe('4481.mp4|956|1700');
    expect(fileSignature({ name: 'x.mp4', size: 1 })).toBe('x.mp4|1|0');
  });

  test('kept per episode, listed back, forgotten with null', () => {
    keepUpload('ep-1', 'a|1|1', { name: 'a.mp4', performer: 'lala', state: state([1, 2]) }, 1000);
    keepUpload('ep-2', 'b|1|1', { name: 'b.mp4', performer: 'lala', state: state([1]) }, 1000);
    expect(unfinishedUploads('ep-1', 2000)).toEqual([{ signature: 'a|1|1', name: 'a.mp4', performer: 'lala', state: state([1, 2]), savedAt: 1000 }]);
    keepUpload('ep-1', 'a|1|1', null);
    expect(unfinishedUploads('ep-1', 2000)).toEqual([]);
    expect(window.localStorage.getItem('rawClipUploads:ep-1')).toBeNull();
    expect(unfinishedUploads('ep-2', 2000)).toHaveLength(1);
  });

  test('older than 6 hours (the server has forgotten it): dropped', () => {
    keepUpload('ep-1', 'a|1|1', { name: 'a.mp4', performer: 'lala', state: state([1]) }, 0);
    expect(unfinishedUploads('ep-1', RESUME_MAX_AGE_MS + 1)).toEqual([]);
    expect(window.localStorage.getItem('rawClipUploads:ep-1')).toBeNull();
  });

  test('storage that throws (private mode, full): nothing breaks, nothing is kept', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => keepUpload('ep-1', 'a|1|1', { name: 'a.mp4', state: state([1]) })).not.toThrow();
    expect(unfinishedUploads('ep-1')).toEqual([]);
  });

  test('sentPercent: from the parts sent; never 100 before it is saved', () => {
    expect(sentPercent(state([]))).toBe(0);
    expect(sentPercent(state([1, 2, 3, 4, 5, 6]))).toBe(48);
    expect(sentPercent(state(Array.from({ length: 13 }, (_, i) => i + 1)))).toBe(99);
    expect(sentPercent(null)).toBe(0);
  });
});

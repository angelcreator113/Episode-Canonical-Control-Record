import { describe, test, expect, vi } from 'vitest';
import { takeFileName, takeAsFile, canShareTake, shareTake } from './takeFile';
import { signInMessage } from './rawClipsApi';
import { RECORD_TYPES } from './teleprompterLines';
import { interruptNote, STOP_BYTES, UPLOAD_LIMIT_MB } from './fullEpisodeTake';

vi.mock('../services/api', () => ({ default: {} }));

describe('takeFile (Teleprompter audit 1 and 6)', () => {
  test('a take name as a file name', () => {
    expect(takeFileName('Beat 8 · Transformation Loop · take 2', 'mp4')).toBe('Beat 8 - Transformation Loop - take 2.mp4');
    expect(takeFileName('a/b:c', 'webm')).toBe('a-b-c.webm');
    expect(takeFileName('', 'webm')).toBe('Teleprompter take.webm');
  });
  test('share only where the browser can share files; a closed sheet is not a failure', async () => {
    const file = takeAsFile(new Blob(['x']), 't.mp4', 'video/mp4');
    expect(canShareTake(file, {})).toBe(false);
    expect(canShareTake(file, { share: () => {}, canShare: () => true })).toBe(true);
    expect(canShareTake(file, { share: () => {}, canShare: () => { throw new Error('no'); } })).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await shareTake(file, 't', { share: async () => {} })).toBe('shared');
    expect(await shareTake(file, 't', { share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } })).toBe('cancelled');
    expect(await shareTake(file, 't', { share: async () => { throw new Error('NotAllowed'); } })).toBe('failed');
    expect(err).toHaveBeenCalled();
    warn.mockRestore();
    err.mockRestore();
  });
});

describe('plain messages', () => {
  test('sign-in (audit 5)', () => {
    expect(signInMessage({ sessionExpired: true })).toMatch(/Sign in in another tab, then press Retry/);
    expect(signInMessage({ authRefreshed: true })).toMatch(/Press Retry/);
    expect(signInMessage(new Error('x'))).toBeNull();
  });
  test('a paused take (audit 3) and the limit (audit 1)', () => {
    expect(interruptNote('away')).toMatch(/away — Resume or Stop & review/);
    expect(interruptNote('ended')).toMatch(/Stop & review to keep/);
    expect(interruptNote(null)).toBeNull();
    expect(STOP_BYTES).toBeLessThan(UPLOAD_LIMIT_MB * 1024 * 1024);
  });
  test('H.264 MP4 first (audit 7)', () => {
    expect(RECORD_TYPES.slice(0, 4)).toEqual(['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4']);
  });
});

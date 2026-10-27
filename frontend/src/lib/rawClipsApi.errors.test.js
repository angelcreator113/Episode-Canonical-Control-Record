// A failed upload in plain words (2026-10-27): the server's own message
// when it is plain, never a raw code, and the take is said to be kept on
// the phone where that is true.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { uploadErrorMessage } from './rawClipsApi';

const NO_ROOM = 'The server ran out of room while saving this take. Your take is still safe on this phone — tap Retry later.';
const fail = (status, error) => ({ response: { status, data: error === undefined ? {} : { error } } });

describe('uploadErrorMessage', () => {
  test('the server\'s 507 message as it is (it already says the take is safe)', () => {
    expect(uploadErrorMessage(fail(507, NO_ROOM), { kept: 'phone' })).toBe(NO_ROOM);
    expect(uploadErrorMessage(fail(507), { kept: 'phone' })).toBe(NO_ROOM);
  });

  test('a raw code is never shown', () => {
    const msg = uploadErrorMessage(fail(500, 'ENOSPC: no space left on device, write'), { kept: 'phone' });
    expect(msg).not.toMatch(/ENOSPC/);
    expect(msg).toBe('The server had a problem saving it. Your take is still safe on this phone — tap Retry.');
    expect(uploadErrorMessage(fail(502, 'AccessDenied: User is not authorized'))).not.toMatch(/AccessDenied/);
    expect(uploadErrorMessage(fail(500, "Cannot read properties of undefined (reading 'id')"))).not.toMatch(/undefined/);
  });

  test('a dropped connection; kept on the phone, or only while the page is open', () => {
    expect(uploadErrorMessage(new Error('Network Error'), { kept: 'phone' })).toBe('The connection dropped while saving. Your take is still safe on this phone — tap Retry.');
    expect(uploadErrorMessage(new Error('Network Error'), { kept: 'page' })).toBe('The connection dropped while saving. Your take is still here — keep this page open and tap Retry.');
    expect(uploadErrorMessage(new Error('Network Error'))).toBe('The connection dropped while saving.');
  });

  test('a plain server message is kept; the sign-in messages come first', () => {
    expect(uploadErrorMessage(fail(400, 'Only video files can be uploaded here'))).toBe('Only video files can be uploaded here');
    expect(uploadErrorMessage({ ...fail(401), sessionExpired: true }, { kept: 'phone' })).toMatch(/^Your sign-in expired/);
    expect(uploadErrorMessage(fail(413), { kept: 'phone' })).toBe('The take is too big to upload.');
  });
});

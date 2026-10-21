/**
 * The editor's smaller copies (picturePreview; Evoni, 2026-10-21: make it
 * faster): fetched once each through the signed-in api, kept for the page;
 * a width rounded up to 400, 800 or 1600; a picture that is not ours, or a
 * copy that fails, gives the original.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import { previewUrl, previewWidth, forgetPreviews } from './picturePreview';

const S3 = 'https://b.s3.amazonaws.com/pose.png';

describe('picturePreview', () => {
  beforeEach(() => {
    forgetPreviews();
    api.get.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:copy');
  });

  test('twice the points shown, rounded up to 400, 800 or 1600', () => {
    expect(previewWidth(100)).toBe(400);
    expect(previewWidth(350)).toBe(800);
    expect(previewWidth(700)).toBe(1600);
    expect(previewWidth(5000)).toBe(1600);
  });

  test('fetched once per picture and width, through the signed-in api, as a blob', async () => {
    api.get.mockResolvedValue({ data: new Blob(['x']) });
    await expect(previewUrl(S3, 500)).resolves.toBe('blob:copy');
    await previewUrl(S3, 700);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/api/v1/youtube-thumbnails/preview', { params: { url: S3, w: 800 }, responseType: 'blob' });
    await previewUrl(S3, 1200);
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/youtube-thumbnails/preview', { params: { url: S3, w: 1600 }, responseType: 'blob' });
  });

  test('not one of ours, or no copy to be had: the original', async () => {
    await expect(previewUrl('blob:local-upload', 800)).resolves.toBe('blob:local-upload');
    await expect(previewUrl(null)).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.get.mockRejectedValueOnce(new Error('503'));
    await expect(previewUrl(S3, 800)).resolves.toBe(S3);
    // Not kept: asked again, it tries again.
    api.get.mockResolvedValueOnce({ data: new Blob(['x']) });
    await expect(previewUrl(S3, 800)).resolves.toBe('blob:copy');
  });
});

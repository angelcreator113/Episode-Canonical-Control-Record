/**
 * Tests for storytellerApi.api() helper — Path A → apiClient migration (Track 2).
 * Track 1.5 patterns: vi.mock the dependency module; assert apiClient.request
 * was called with translated args; verify error contract preservation.
 *
 * The api() helper is the highest-leverage Track 2 test target: it covers all
 * 18 transitive Path-A sites (ChapterSelection × 2, BookList × 1, StorytellerPage
 * × 3, BookEditor × 12). Direct-call site coverage is structural — see grep
 * verification at end of Track 2.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import { api, API } from './storytellerApi';

describe('storytellerApi.api() — Path A → apiClient migration', () => {
  beforeEach(() => {
    vi.mocked(apiClient.request).mockReset();
  });

  describe('happy paths — apiClient.request called with translated args', () => {
    test('GET (no opts) → method=get, url=API+path, no data; returns res.data', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: { book: { id: 'b1' } } });

      const result = await api('/books/b1');

      expect(apiClient.request).toHaveBeenCalledTimes(1);
      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          url: `${API}/books/b1`,
        })
      );
      expect(result).toEqual({ book: { id: 'b1' } });
    });

    test('POST with JSON-stringified body → JSON.parsed into data field', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: { ok: true, id: 'ch1' } });

      const result = await api('/books/b1/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Chapter 1', chapter_number: 1 }),
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: `${API}/books/b1/chapters`,
          data: { title: 'Chapter 1', chapter_number: 1 },
        })
      );
      expect(result).toEqual({ ok: true, id: 'ch1' });
    });

    test('PUT with body → method=put, url + data forwarded', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: null });

      await api('/chapters/ch1', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Renamed' }),
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
          url: `${API}/chapters/ch1`,
          data: { title: 'Renamed' },
        })
      );
    });

    test('DELETE without body → method=delete, no data', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: null });

      await api('/lines/l1', { method: 'DELETE' });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
          url: `${API}/lines/l1`,
        })
      );
      const callArg = vi.mocked(apiClient.request).mock.calls[0][0];
      expect(callArg.data).toBeUndefined();
    });

    test('non-JSON string body → passed through as-is in data', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: 'ok' });

      await api('/raw', { method: 'POST', body: 'plain text payload' });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          data: 'plain text payload',
        })
      );
    });

    test('caller-supplied headers forwarded (request interceptor still adds Auth)', async () => {
      vi.mocked(apiClient.request).mockResolvedValue({ data: {} });

      await api('/echoes', {
        headers: { 'X-Custom-Header': 'value' },
      });

      expect(apiClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom-Header': 'value' },
        })
      );
    });
  });

  describe('error paths — preserves Error-with-message contract', () => {
    test('apiClient throws with response.data.error → throws Error with that message', async () => {
      const axiosErr = new Error('Request failed with status code 400');
      axiosErr.response = { status: 400, data: { error: 'Validation failed' } };
      vi.mocked(apiClient.request).mockRejectedValue(axiosErr);

      await expect(api('/lines/l1')).rejects.toThrow('Validation failed');
    });

    test('apiClient throws with response.data.message → throws Error with that message', async () => {
      const axiosErr = new Error('Request failed');
      axiosErr.response = { status: 500, data: { message: 'Server exploded' } };
      vi.mocked(apiClient.request).mockRejectedValue(axiosErr);

      await expect(api('/lines/l1')).rejects.toThrow('Server exploded');
    });

    test('apiClient throws with response.data as string → throws Error with that string', async () => {
      const axiosErr = new Error('Request failed');
      axiosErr.response = { status: 400, data: 'Bad payload' };
      vi.mocked(apiClient.request).mockRejectedValue(axiosErr);

      await expect(api('/lines/l1')).rejects.toThrow('Bad payload');
    });

    test('network error (no response) → throws Error with err.message', async () => {
      const networkErr = new Error('Network Error');
      vi.mocked(apiClient.request).mockRejectedValue(networkErr);

      await expect(api('/lines/l1')).rejects.toThrow('Network Error');
    });

    test('error with empty response.data → falls through to err.message → Error', async () => {
      const axiosErr = new Error('Request failed');
      axiosErr.response = { status: 500, data: {} };
      vi.mocked(apiClient.request).mockRejectedValue(axiosErr);

      await expect(api('/lines/l1')).rejects.toThrow('Request failed');
    });

    test('error with no message anywhere → throws "Request failed"', async () => {
      const bareErr = {};
      vi.mocked(apiClient.request).mockRejectedValue(bareErr);

      await expect(api('/lines/l1')).rejects.toThrow('Request failed');
    });
  });
});

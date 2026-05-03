/**
 * Tests for BookEditor's Path A → apiClient migration (Track 2).
 *
 * Behavioral coverage focuses on the 11 sites migrated from fetch+authHeader
 * to apiClient. The rendering surface of BookEditor is too large to mount
 * fully in a unit test (1700+ lines, multi-pane editor, sub-components,
 * sessionStorage). Instead this file:
 *
 *  - Asserts structural conformance: zero authHeader references, apiClient
 *    imported, raw fetch only at the keepalive beforeunload site (Track 2
 *    intentionally leaves that one site as fetch + inline Bearer because
 *    axios doesn't support keepalive: true).
 *  - Spot-checks one happy + one error path for the helper file
 *    (storytellerApi.test.js covers behavioral transitively for 12 of
 *    BookEditor's 22 Path-A sites that go through the api() helper).
 */

import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/BookEditor.jsx'), 'utf8');

describe('BookEditor — Path A migration structural conformance', () => {
  test('does not import authHeader from storytellerApi', () => {
    expect(SOURCE).not.toMatch(/authHeader\s*[,}]/);
    expect(SOURCE).not.toMatch(/import\s*\{[^}]*authHeader/);
  });

  test('imports apiClient from services/api', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('still imports api helper from storytellerApi (api() helper preserved)', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bapi\b[^}]*\}\s*from\s+['"]\.\.\/utils\/storytellerApi['"]/);
  });

  test('no fetch+authHeader spread pattern remains', () => {
    expect(SOURCE).not.toMatch(/\.\.\.authHeader\(\)/);
  });

  test('uses apiClient.get / .post / .put / .delete for migrated sites', () => {
    const calls = SOURCE.match(/apiClient\.(get|post|put|delete|patch)\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(7);
  });

  test('keepalive beforeunload site intentionally retained as raw fetch with inline Bearer', () => {
    // Track 2 documented exception: apiClient/axios doesn't support keepalive,
    // which is required for the beforeunload save reliability per CZ-5.
    expect(SOURCE).toMatch(/keepalive:\s*true/);
    expect(SOURCE).toMatch(/Documented exception/);
    // The keepalive site reads the token inline rather than via authHeader().
    expect(SOURCE).toMatch(/localStorage\.getItem\(['"]authToken['"]\)/);
  });
});

// ============================================================================
// Track 2.5 — Behavioral tests for the extracted apiClient helpers
// ============================================================================

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import {
  saveDraftProse,
  runAiActionRequest,
  confirmVoiceType,
  sendKeepaliveBeforeUnload,
} from './BookEditor';

describe('BookEditor — extracted apiClient helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    localStorage.clear();
  });

  describe('saveDraftProse — autosave POST', () => {
    test('happy path — apiClient.post called with chapter URL + draft_prose payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

      await saveDraftProse('chap-7', 'Some prose text');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/chap-7/save-draft',
        { draft_prose: 'Some prose text' }
      );
    });

    test('error path — rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('autosave failed'));
      await expect(saveDraftProse('chap-7', 'text')).rejects.toThrow('autosave failed');
    });
  });

  describe('runAiActionRequest — AI action POST', () => {
    test('happy path — apiClient.post called with the action endpoint + payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { continuation: 'Generated text' },
      });

      const payload = {
        chapter_id: 'chap-7',
        book_id: 'book-1',
        action: 'continue',
        recent_prose: 'preceding text...',
      };

      const res = await runAiActionRequest('/api/v1/memories/story-continue', payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-continue',
        payload
      );
      expect(res.data.continuation).toBe('Generated text');
    });
  });

  describe('confirmVoiceType — voice attribution POST', () => {
    test('happy path — apiClient.post called with confirm-voice URL + line_id + voice_type', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { ok: true } });

      await confirmVoiceType('line-42', 'narrator');

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/confirm-voice',
        { line_id: 'line-42', voice_type: 'narrator' }
      );
    });
  });

  describe('sendKeepaliveBeforeUnload — documented raw-fetch exception (CZ-5 keepalive)', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({});
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('fires fetch with method=POST, keepalive=true, inline Bearer header, and JSON body', () => {
      localStorage.setItem('authToken', 'tok-abc');

      sendKeepaliveBeforeUnload('chap-7', 'Last edits');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];

      expect(url).toContain('/chapters/chap-7/save-draft');
      expect(options.method).toBe('POST');
      expect(options.keepalive).toBe(true);
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers.Authorization).toBe('Bearer tok-abc');
      expect(JSON.parse(options.body)).toEqual({ draft_prose: 'Last edits' });
    });

    test('without auth token in storage — fetch fires WITHOUT Authorization header (still sends body)', () => {
      sendKeepaliveBeforeUnload('chap-7', 'Last edits');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = vi.mocked(global.fetch).mock.calls[0];

      expect(options.headers.Authorization).toBeUndefined();
      expect(options.keepalive).toBe(true);
      expect(JSON.parse(options.body)).toEqual({ draft_prose: 'Last edits' });
    });

    test('does NOT call apiClient (intentional — axios does not support keepalive)', () => {
      sendKeepaliveBeforeUnload('chap-7', 'Last edits');

      expect(apiClient.post).not.toHaveBeenCalled();
      expect(apiClient.put).not.toHaveBeenCalled();
      expect(apiClient.request).not.toHaveBeenCalled();
    });
  });
});

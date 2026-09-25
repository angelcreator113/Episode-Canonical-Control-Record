/**
 * WriteModeAIWriter — Track 6 CP11 behavioral + structural tests
 * (file 16 of 17 — Pattern G site addition).
 *
 * 3 fetch sites total. 2 migrated via apiClient helpers
 * (rewrite-options, prose-critique). 1 LOCKED Pattern G (line 251
 * + 259 streaming pair) retained as raw fetch + getReader() with
 * 9-line comment block per BookEditor:55 / WriteMode:980/1145
 * precedent. Pattern G locked-site count: 3 → 5 after CP11.
 */

import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
import WriteModeAIWriter, {
  aiWriterRewriteOptionsApi,
  aiWriterProseCritiqueApi,
} from './WriteModeAIWriter';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/WriteModeAIWriter.jsx'),
  'utf8',
);

describe('WriteModeAIWriter — Track 6 CP11 non-streaming helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('aiWriterRewriteOptionsApi POST on /memories/rewrite-options', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { options: [{}, {}, {}] } });
    const out = await aiWriterRewriteOptionsApi({
      book_id: 'b-1', character_id: 'c-1', content: 'selected text',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/rewrite-options',
      { book_id: 'b-1', character_id: 'c-1', content: 'selected text' },
    );
    expect(out.options).toHaveLength(3);
  });

  test('aiWriterProseCritiqueApi POST on /memories/prose-critique', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { critique: 'tighter beats' } });
    await aiWriterProseCritiqueApi({
      book_id: 'b-1', chapter_id: 'c-1', character_id: 'ch-1', prose: 'a draft',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/prose-critique',
      { book_id: 'b-1', chapter_id: 'c-1', character_id: 'ch-1', prose: 'a draft' },
    );
  });

  describe('Error path propagation', () => {
    test('aiWriterRewriteOptionsApi rejection propagates (caller sets error)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(aiWriterRewriteOptionsApi({})).rejects.toThrow('not authorized');
    });

    test('aiWriterProseCritiqueApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(aiWriterProseCritiqueApi({})).rejects.toThrow('rate limited');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Structural assertions for the LOCKED Pattern G site (line 251 + 259).
// Pattern G locked-exception count: 3 → 5 after CP11.
// ──────────────────────────────────────────────────────────────────────────

describe('WriteModeAIWriter — Pattern G locked streaming site', () => {
  test('source still contains raw fetch on action.endpoint (streaming kickoff)', () => {
    expect(SOURCE).toMatch(/await fetch\(action\.endpoint/);
  });

  test('source still calls res.body.getReader() (SSE stream consumption)', () => {
    expect(SOURCE).toMatch(/res\.body\.getReader\(\)/);
  });

  test('source has Pattern G locked-exception comment block', () => {
    expect(SOURCE).toMatch(/PATTERN G LOCKED EXCEPTION/);
    expect(SOURCE).toMatch(/§9\.11/);
  });

  test('source imports apiClient (non-streaming sites migrated)', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('source no longer contains raw fetch on /memories/rewrite-options (CP11 migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\(['"]\/api\/v1\/memories\/rewrite-options/);
  });

  test('source no longer contains raw fetch on /memories/prose-critique (CP11 migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\(['"]\/api\/v1\/memories\/prose-critique/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Task #1894 — the AI Writer action POST sends Authorization, and a 401/403
// shows an auth error instead of "No content returned".
// ──────────────────────────────────────────────────────────────────────────

function sseResponse(chunks) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { done: false, value: enc.encode(chunks[i++]) }
          : { done: true, value: undefined }),
      }),
    },
  };
}

const CHARACTER = { id: 'ch-1', name: 'Lala', type: 'special' };

function renderWriter() {
  return render(
    <WriteModeAIWriter
      chapterId="c-1"
      bookId="b-1"
      selectedCharacter={CHARACTER}
      currentProse="She stood at the window."
      chapterContext=""
      onInsert={() => {}}
    />,
  );
}

describe('WriteModeAIWriter — action stream authenticates (Task #1894)', () => {
  let fetchMock;
  let errSpy;

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    localStorage.clear();
    localStorage.setItem('authToken', 'tok-1894');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    errSpy.mockRestore();
  });

  test('sends Authorization: Bearer <token>, token not in the URL; SSE text renders', async () => {
    fetchMock.mockResolvedValue(sseResponse([
      'data: {"type":"text","text":"The glass was cold "}\n',
      'data: {"type":"text","text":"against her palm."}\n',
    ]));
    renderWriter();
    fireEvent.click(screen.getByLabelText('Continue the moment'));

    const out = await screen.findByLabelText('Edit generated content before inserting into manuscript');
    await waitFor(() => expect(out.value).toBe('The glass was cold against her palm.'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/memories/ai-writer-action');
    expect(url).not.toContain('tok-1894');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-1894');
  });

  test('401 shows the auth error, not "No content returned"', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({ error: 'Unauthorized' }),
    });
    renderWriter();
    fireEvent.click(screen.getByLabelText('Continue the moment'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Your session has expired — sign in again.');
    expect(screen.queryByText(/No content returned/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

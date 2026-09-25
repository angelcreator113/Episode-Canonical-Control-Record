/**
 * AppAssistant — Track 6 CP11 behavioral + structural tests
 * (file 17 of 17 — Pattern G site addition).
 *
 * 3 fetch sites total. 2 migrated via apiClient helpers
 * (amberSpeakApi binary-blob via responseType:'blob' per v2.16
 * §9.11; assistantCommandApi non-streaming JSON fallback). 1 LOCKED
 * Pattern G (line 196 STREAM_API + 225 getReader pair) retained as
 * raw fetch + AbortController.signal + SSE reader with 9-line
 * comment block. Pattern G locked-site count after CP11: 3 → 5.
 */

import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
import AppAssistant, {
  amberSpeakApi,
  assistantCommandApi,
} from './AppAssistant';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/AppAssistant.jsx'),
  'utf8',
);

describe('AppAssistant — Track 6 CP11 non-streaming helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('amberSpeakApi POST on /amber/speak with responseType:blob (binary-response v2.16 §9.11)', async () => {
    const fakeBlob = new Blob(['mp3-bytes'], { type: 'audio/mpeg' });
    vi.mocked(apiClient.post).mockResolvedValue({ data: fakeBlob });
    const out = await amberSpeakApi('hello');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/amber/speak',
      { text: 'hello' },
      { responseType: 'blob' },
    );
    expect(out).toBe(fakeBlob);
  });

  test('assistantCommandApi POST on /memories/assistant-command with body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { reply: 'Done.' } });
    const body = { message: 'hi', history: [], context: {} };
    const out = await assistantCommandApi(body);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/assistant-command',
      body,
    );
    expect(out.reply).toBe('Done.');
  });

  describe('Error path propagation', () => {
    test('amberSpeakApi rejection propagates (caller logs, calls onDone)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('TTS failed'));
      await expect(amberSpeakApi('hi')).rejects.toThrow('TTS failed');
    });

    test('assistantCommandApi rejection propagates (caller catches → AbortError or generic)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(assistantCommandApi({})).rejects.toThrow('forbidden');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Structural assertions for the LOCKED Pattern G site (line ~196 STREAM_API
// + ~225 getReader). Pattern G locked-exception count: 3 → 5 after CP11.
// ──────────────────────────────────────────────────────────────────────────

describe('AppAssistant — Pattern G locked streaming site', () => {
  test('source still contains raw fetch on STREAM_API', () => {
    expect(SOURCE).toMatch(/await fetch\(STREAM_API/);
  });

  test('source still calls res.body.getReader() (SSE stream consumption)', () => {
    expect(SOURCE).toMatch(/res\.body\.getReader\(\)/);
  });

  test('source preserves AbortController.signal on streaming fetch', () => {
    expect(SOURCE).toMatch(/signal:\s*controller\.signal/);
  });

  test('source has Pattern G locked-exception comment block', () => {
    expect(SOURCE).toMatch(/PATTERN G LOCKED EXCEPTION/);
    expect(SOURCE).toMatch(/§9\.11/);
  });

  test('source imports apiClient (non-streaming sites migrated)', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('source no longer contains raw fetch on SPEAK_API (migrated to apiClient)', () => {
    expect(SOURCE).not.toMatch(/fetch\(SPEAK_API/);
  });

  test('source no longer contains raw fetch fallback to API (migrated to assistantCommandApi)', () => {
    // The streaming fetch references STREAM_API only; the fallback POST is now via apiClient.
    expect(SOURCE).not.toMatch(/await fetch\(API,/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Task #1894 — the stream POST sends Authorization, and a 401/403 is
// surfaced in the chat instead of silently falling back to a second AI call.
// ──────────────────────────────────────────────────────────────────────────

function sseBody(chunks) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: async () => (i < chunks.length
        ? { done: false, value: enc.encode(chunks[i++]) }
        : { done: true, value: undefined }),
    }),
  };
}

async function sendToAmber(text) {
  fireEvent.click(screen.getByLabelText('Talk to Amber'));
  const box = await screen.findByPlaceholderText('Tell me what to do...');
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByLabelText('Send'));
}

describe('AppAssistant — stream authenticates (Task #1894)', () => {
  let fetchMock;
  let errSpy;

  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem('authToken', 'tok-1894');
    localStorage.setItem('amber-voice-response', '0'); // no TTS POST
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
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        'data: {"type":"token","text":"Pulling up "}\n',
        'data: {"type":"token","text":"the feed."}\n',
        'data: {"type":"done"}\n',
      ]),
    });
    render(<AppAssistant />);
    await sendToAmber('open the feed');

    expect(await screen.findByText('Pulling up the feed.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/memories/assistant-command-stream');
    expect(url).not.toContain('tok-1894');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-1894');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('401: one fetch, no assistantCommandApi fallback, auth error shown', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      body: null,
      json: async () => ({ error: 'Unauthorized' }),
    });
    render(<AppAssistant />);
    await sendToAmber('open the feed');

    expect(await screen.findByText(/session has expired/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  test('non-auth failure (500) still falls back to assistantCommandApi', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, body: null });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { reply: 'Fallback reply.' } });
    render(<AppAssistant />);
    await sendToAmber('open the feed');

    expect(await screen.findByText('Fallback reply.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/assistant-command',
      expect.objectContaining({ message: 'open the feed' }),
    );
  });
});

/**
 * authedEventStream (Task #1887) — the fetch + Authorization + getReader
 * replacement for EventSource on requireAuth SSE routes.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { openAuthedEventStream, parseSSEFrames } from './authedEventStream';

const enc = new TextEncoder();

// A controllable streaming body: push() chunks, end() the stream; read()
// blocks until something arrives or the reader is cancelled.
function mockStream() {
  const queue = [];
  let waiter = null;
  let ended = false;
  const reader = {
    cancel: vi.fn(() => { ended = true; if (waiter) { waiter({ done: true }); waiter = null; } return Promise.resolve(); }),
    read: vi.fn(() => {
      if (queue.length) return Promise.resolve({ done: false, value: queue.shift() });
      if (ended) return Promise.resolve({ done: true });
      return new Promise((r) => { waiter = r; });
    }),
  };
  return {
    reader,
    push(text) {
      const value = enc.encode(text);
      if (waiter) { const w = waiter; waiter = null; w({ done: false, value }); } else queue.push(value);
    },
    end() { ended = true; if (waiter) { const w = waiter; waiter = null; w({ done: true }); } },
    response: { status: 200, ok: true, body: { getReader: () => reader } },
  };
}

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

describe('parseSSEFrames', () => {
  test('parses named events, skips keepalive comments, keeps a partial frame', () => {
    const { frames, rest } = parseSSEFrames(': keepalive\n\nevent: status\ndata: {"a":1}\n\nevent: do');
    expect(frames).toEqual([{ event: 'status', data: '{"a":1}' }]);
    expect(rest).toBe('event: do');
  });
  test('handles CRLF and multi-line data', () => {
    const { frames } = parseSSEFrames('event: x\r\ndata: one\r\ndata: two\r\n\r\n');
    expect(frames).toEqual([{ event: 'x', data: 'one\ntwo' }]);
  });
});

describe('openAuthedEventStream', () => {
  let errSpy;
  beforeEach(() => {
    localStorage.clear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    errSpy.mockRestore();
  });

  test('sends the Bearer token in a header (never the URL) and dispatches status then done', async () => {
    localStorage.setItem('authToken', 'tok-123');
    const s = mockStream();
    const fetchImpl = vi.fn().mockResolvedValue(s.response);
    const status = vi.fn();
    const done = vi.fn();
    const h = openAuthedEventStream('/api/v1/social-profiles/bulk/jobs/15/stream', { handlers: { status, done }, fetchImpl });
    await flush();
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/v1/social-profiles/bulk/jobs/15/stream');
    expect(url).not.toContain('tok-123');
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
    s.push('event: status\ndata: {"job":{"status":"processing","completed":1}}\n\n');
    await flush();
    expect(status).toHaveBeenCalledWith({ data: '{"job":{"status":"processing","completed":1}}' });
    s.push('event: done\ndata: {"completed":3}\n\n');
    await flush();
    expect(done).toHaveBeenCalledWith({ data: '{"completed":3}' });
    h.close();
  });

  test('a frame split across two chunks parses once, whole', async () => {
    const s = mockStream();
    const fetchImpl = vi.fn().mockResolvedValue(s.response);
    const profile_complete = vi.fn();
    const h = openAuthedEventStream('/x', { handlers: { profile_complete }, fetchImpl });
    await flush();
    s.push('event: profile_comp');
    await flush();
    expect(profile_complete).not.toHaveBeenCalled();
    s.push('lete\ndata: {"completed":2,"to');
    await flush();
    expect(profile_complete).not.toHaveBeenCalled();
    s.push('tal":5}\n\n');
    await flush();
    expect(profile_complete).toHaveBeenCalledTimes(1);
    expect(JSON.parse(profile_complete.mock.calls[0][0].data)).toEqual({ completed: 2, total: 5 });
    h.close();
  });

  test.each([401, 403])('a %i stops: no reconnect, no retry timer, logged once, surfaced', async (code) => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue({ status: code, ok: false, body: null });
    const onAuthError = vi.fn();
    const onError = vi.fn();
    const h = openAuthedEventStream('/x', { fetchImpl, onAuthError, onError });
    await flush();
    expect(onAuthError).toHaveBeenCalledWith(code);
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(h.closed).toBe(true);
  });

  test('a network error reconnects with bounded backoff, then gives up', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    openAuthedEventStream('/x', { fetchImpl, onError, maxRetries: 3, baseDelayMs: 1000 });
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenLastCalledWith(expect.any(TypeError), { willRetry: false, attempt: 3 });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a 500 is a non-auth error and retries', async () => {
    vi.useFakeTimers();
    const s = mockStream();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ status: 500, ok: false, body: null })
      .mockResolvedValueOnce(s.response);
    const h = openAuthedEventStream('/x', { fetchImpl, baseDelayMs: 1000 });
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    h.close();
  });

  test('close() aborts the fetch, cancels the reader, and clears a pending retry', async () => {
    const s = mockStream();
    let signal;
    const fetchImpl = vi.fn((url, opts) => { signal = opts.signal; return Promise.resolve(s.response); });
    const h = openAuthedEventStream('/x', { fetchImpl });
    await flush();
    h.close();
    expect(s.reader.cancel).toHaveBeenCalled();
    expect(signal.aborted).toBe(true);

    vi.useFakeTimers();
    const failing = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const h2 = openAuthedEventStream('/y', { fetchImpl: failing });
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    h2.close();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(failing).toHaveBeenCalledTimes(1);
  });
});

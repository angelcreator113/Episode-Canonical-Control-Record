/**
 * authedEventStream — an EventSource replacement that authenticates.
 *
 * Task #1887. `new EventSource(url)` cannot send headers, and every SSE route
 * that sits behind `requireAuth` accepts only `Authorization: Bearer …`
 * (no cookie, no query token). So an EventSource against those routes 401s on
 * every connection. This helper opens the stream with `fetch` + the
 * Authorization header and reads `res.body.getReader()` — the same streaming
 * exception pattern WriteMode's voice-to-story site and BookEditor's
 * keepalive save use (token read inline from localStorage, the source the
 * apiClient request interceptor uses). The token is never put in the URL.
 *
 * Behaviour:
 *  - Parses `event:` / `data:` frames across chunk boundaries (CRLF or LF),
 *    ignores `:` comment lines (server keepalives), joins multi-line data.
 *  - Dispatches each frame to `handlers[eventName]({ data })`, the same
 *    shape an EventSource MessageEvent handler reads (`e.data`).
 *  - 401 / 403: never reconnects. Logs once with console.error, calls
 *    `onAuthError(status)`, and stops. No timer is left behind.
 *  - Network drop, stream end, or a non-auth HTTP error: reconnects with
 *    bounded exponential backoff (`maxRetries` attempts); `onError` is told
 *    each time whether a retry is scheduled. When retries run out it stops.
 *  - `close()` aborts the fetch, cancels the reader, and clears any pending
 *    retry timer. Call it on job switch, tab change, and unmount.
 */

const AUTH_STATUSES = new Set([401, 403]);

export function readAuthToken() {
  try {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  } catch (err) {
    console.error('authedEventStream: could not read the auth token', err);
    return null;
  }
}

/**
 * Split a text buffer into complete SSE frames. Returns the parsed frames and
 * the unconsumed remainder (a partial frame waiting for its next chunk).
 */
export function parseSSEFrames(buffer) {
  const text = buffer.replace(/\r\n?/g, '\n');
  const blocks = text.split('\n\n');
  const rest = blocks.pop();
  const frames = [];
  for (const block of blocks) {
    let event = 'message';
    const data = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const idx = line.indexOf(':');
      const field = idx === -1 ? line : line.slice(0, idx);
      let value = idx === -1 ? '' : line.slice(idx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value || 'message';
      else if (field === 'data') data.push(value);
    }
    if (data.length) frames.push({ event, data: data.join('\n') });
  }
  return { frames, rest };
}

export function openAuthedEventStream(url, {
  handlers = {},
  onAuthError,
  onError,
  maxRetries = 5,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  fetchImpl,
} = {}) {
  let closed = false;
  let controller = null;
  let reader = null;
  let retryTimer = null;
  let attempts = 0;

  const dispatch = (event, data) => {
    const fn = handlers[event];
    if (typeof fn !== 'function') return;
    try { fn({ data }); } catch (err) { console.error(`authedEventStream: "${event}" handler threw`, err); }
  };

  const scheduleRetry = (err) => {
    if (closed) return;
    const willRetry = attempts < maxRetries;
    if (onError) {
      try { onError(err, { willRetry, attempt: attempts }); } catch (e) { console.error('authedEventStream: onError threw', e); }
    }
    if (closed) return; // onError may have closed the stream
    if (!willRetry) {
      console.error(`authedEventStream: giving up on ${url} after ${attempts} retries`, err);
      closed = true;
      return;
    }
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempts);
    attempts += 1;
    retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
  };

  const connect = async () => {
    if (closed) return;
    controller = new AbortController();
    const token = readAuthToken();
    let res;
    try {
      res = await (fetchImpl || fetch)(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (err) {
      if (closed || err?.name === 'AbortError') return;
      scheduleRetry(err);
      return;
    }
    if (closed) return;

    if (AUTH_STATUSES.has(res.status)) {
      closed = true;
      console.error(`authedEventStream: ${url} refused with ${res.status}; not reconnecting`);
      if (onAuthError) {
        try { onAuthError(res.status); } catch (e) { console.error('authedEventStream: onAuthError threw', e); }
      }
      return;
    }
    if (!res.ok || !res.body) {
      scheduleRetry(new Error(`stream ${url} returned HTTP ${res.status}`));
      return;
    }

    reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = parseSSEFrames(buffer);
        buffer = rest;
        if (frames.length) attempts = 0;
        for (const f of frames) {
          if (closed) break;
          dispatch(f.event, f.data);
        }
      }
    } catch (err) {
      if (closed || err?.name === 'AbortError') return;
      scheduleRetry(err);
      return;
    } finally {
      reader = null;
    }
    if (!closed) scheduleRetry(new Error(`stream ${url} ended`));
  };

  connect();

  return {
    close() {
      if (closed && !retryTimer && !reader && !controller) return;
      closed = true;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (reader) { reader.cancel().catch((err) => console.error('authedEventStream: reader.cancel failed', err)); }
      if (controller) { controller.abort(); controller = null; }
    },
    get closed() { return closed; },
  };
}

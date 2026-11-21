/**
 * Tests: a ledger of the requests a page makes (PR-01 of
 * docs/design/2026-11-studio-home-episode-command-center.md, §7).
 *
 * A test mocks services/api (the app's one HTTP client), attaches a ledger
 * to that mock, renders the real page, and reads back what was requested:
 * the method and the normalized URL of every call, in order, with totals and
 * duplicates. Calls to the global fetch are recorded too, so a request that
 * bypasses the client is counted and not missed.
 *
 * What is recorded is the method and the URL only. Headers, tokens and
 * request bodies are never read or kept.
 *
 * Not imported by the app: this folder holds test helpers only.
 */
import { act } from '@testing-library/react';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * One spelling per request: the path, then its query sorted by key. A
 * `params` object passed in the axios config joins the query. An absolute
 * URL loses its origin. Values are kept (the fixtures use fixed ids), so two
 * reads of different records stay two different URLs.
 */
export function normalizeUrl(url, params) {
  const raw = String(url ?? '');
  const withoutOrigin = raw.replace(/^[a-z]+:\/\/[^/]+/i, '');
  const hashless = withoutOrigin.split('#')[0];
  const cut = hashless.indexOf('?');
  const path = cut === -1 ? hashless : hashless.slice(0, cut);
  const query = new URLSearchParams(cut === -1 ? '' : hashless.slice(cut + 1));
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query.append(k, String(v));
    }
  }
  const pairs = [...query.entries()].sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  if (!pairs.length) return path;
  return `${path}?${pairs.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/** A macrotask turn, inside act so React's effects and state updates run. */
const turn = () => act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });

/**
 * `initialWhile()` says whether the page is still in its initial loading
 * state. Each request is filed under "initial" or "settled" by asking it at
 * the moment the request is made, so the split follows what is on screen
 * and not how soon a test happens to look.
 */
export function createRequestLedger({ initialWhile = () => true } = {}) {
  const entries = [];
  let pending = 0;
  let originalFetch;
  let fetchStubbed = false;

  const record = (method, url, params, via) => {
    const phase = initialWhile() ? 'initial' : 'settled';
    entries.push({ seq: entries.length + 1, method: String(method).toUpperCase(), url: normalizeUrl(url, params), via, phase });
  };

  /** Runs the answer and counts the request as pending until it settles. */
  const track = (fn) => {
    pending += 1;
    let promise;
    try {
      promise = Promise.resolve(fn());
    } catch (err) {
      promise = Promise.reject(err);
    }
    return promise.finally(() => { pending -= 1; });
  };

  return {
    /**
     * Makes every method of the mocked client record its call and answer
     * with `answer(url, { method })`. The client's methods must be vi.fn().
     */
    attach(client, answer) {
      for (const method of METHODS) {
        client[method]?.mockImplementation((url, a, b) => {
          // get/delete take (url, config); post/put/patch take (url, body, config).
          const config = method === 'get' || method === 'delete' ? a : b;
          record(method, url, config?.params, 'client');
          return track(() => answer(url, { method }));
        });
      }
      client.request?.mockImplementation((config = {}) => {
        const method = config.method || 'get';
        record(method, config.url, config.params, 'client');
        return track(() => answer(config.url, { method }));
      });
    },

    /** Records any use of the global fetch, and refuses it (no network in a test). */
    watchFetch() {
      originalFetch = globalThis.fetch;
      fetchStubbed = true;
      globalThis.fetch = (input, init = {}) => {
        const url = typeof input === 'string' ? input : input?.url;
        record(init.method || 'GET', url, null, 'fetch');
        return track(() => Promise.reject(new Error('requestLedger: fetch is not answered in this test')));
      };
    },

    /** Puts the global fetch back. */
    restore() {
      if (fetchStubbed) {
        globalThis.fetch = originalFetch;
        fetchStubbed = false;
      }
    },

    get pending() { return pending; },

    /**
     * Waits until the page has stopped asking: no request is pending and no
     * new one has been made across `quietTurns` consecutive macrotask turns
     * (each turn lets resolved answers reach React, and React's effects
     * run). The caller first waits for the page's own known states; this is
     * the bounded check that nothing follows them. Throws at `timeoutMs`
     * with what was still pending.
     */
    async settle({ quietTurns = 6, timeoutMs = 8000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      let quiet = 0;
      let seen = entries.length;
      while (quiet < quietTurns) {
        if (Date.now() > deadline) {
          throw new Error(`requestLedger: the page did not settle in ${timeoutMs} ms (${pending} pending, ${entries.length} requests so far)`);
        }
        await turn();
        if (pending === 0 && entries.length === seen) {
          quiet += 1;
        } else {
          quiet = 0;
          seen = entries.length;
        }
      }
    },

    /** The requests, in order; `inPhase` ("initial" or "settled") keeps one phase. */
    list(inPhase) {
      return entries.filter((e) => !inPhase || e.phase === inPhase).map((e) => ({ ...e }));
    },

    /** "GET /path?query" for each request, in order. */
    lines(inPhase) {
      return this.list(inPhase).map((e) => `${e.method} ${e.url}`);
    },

    /** How many requests were made (in one phase, when named). */
    total(inPhase) { return this.list(inPhase).length; },

    /** { "GET /path": n } over every request. */
    counts() {
      const out = {};
      for (const line of this.lines()) out[line] = (out[line] || 0) + 1;
      return out;
    },

    /** The requests made more than once: { "GET /path": n }, sorted by key. */
    duplicates() {
      const counts = this.counts();
      return Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b)));
    },

    /** The requests that did not go through the client (the global fetch). */
    viaFetch() { return this.list().filter((e) => e.via === 'fetch').map((e) => `${e.method} ${e.url}`); },

    /** A summary to print when measuring: counts only, no bodies or headers. */
    report() {
      return {
        initial: this.total('initial'),
        afterInitial: this.total('settled'),
        total: this.total(),
        distinct: Object.keys(this.counts()).length,
        duplicates: this.duplicates(),
        requests: this.lines(),
      };
    },
  };
}

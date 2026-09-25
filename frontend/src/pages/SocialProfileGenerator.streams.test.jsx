/**
 * SocialProfileGenerator — bulk-job and scheduler streams authenticate
 * (Task #1887).
 *
 * The page resumes a saved bulk job (localStorage `spg_active_job`) and opens
 * its progress stream; the Automation tab opens the scheduler stream. Both go
 * through fetch with the Authorization header (a global fetch mock here), not
 * EventSource.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

vi.mock('../components/FeedBulkImport', () => ({ default: () => null }));
vi.mock('./feed/ProfileCard', () => ({ default: () => null }));
vi.mock('./feed/ProfileDetailPanel', () => ({
  DetailPanel: () => null,
  FeedStatePicker: () => null,
}));
vi.mock('./feed/FeedEnhancements', () => ({
  ProfileComparison: () => null,
  LalaReactions: () => null,
  FeedTimeline: () => null,
  RelationshipWeb: () => null,
}));
vi.mock('./feed/FeedViews', () => ({ default: () => null }));

import apiClient from '../services/api';
import SocialProfileGenerator from './SocialProfileGenerator';

const enc = new TextEncoder();
const JOB_STREAM = '/api/v1/social-profiles/bulk/jobs/15/stream';
const SCHED_STREAM = '/api/v1/feed-scheduler/events';

function mockStream() {
  const queue = [];
  let waiter = null;
  let ended = false;
  const reader = {
    cancel: vi.fn(() => { ended = true; if (waiter) { const w = waiter; waiter = null; w({ done: true }); } return Promise.resolve(); }),
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
    response: { status: 200, ok: true, body: { getReader: () => reader } },
  };
}

const flush = () => act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
const streamCalls = (fetchMock, url) => fetchMock.mock.calls.filter(([u]) => u === url);

let jobState;
let fetchMock;
let errSpy;

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  jobState = { id: 15, status: 'processing', total: 3, completed: 0, failed: 0 };
  vi.mocked(apiClient.get).mockImplementation((url) => {
    if (url.endsWith('/bulk/jobs/15')) return Promise.resolve({ data: { job: { ...jobState } } });
    return Promise.resolve({ data: {} });
  });
  localStorage.clear();
  localStorage.setItem('authToken', 'tok-abc');
  localStorage.setItem('spg_active_job', '15');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  errSpy.mockRestore();
});

describe('SocialProfileGenerator — authenticated streams (Task #1887)', () => {
  test('the job stream sends the Bearer header; status then done drive the banner', async () => {
    const s = mockStream();
    fetchMock.mockResolvedValue(s.response);
    render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
    await flush();

    const calls = streamCalls(fetchMock, JOB_STREAM);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers.Authorization).toBe('Bearer tok-abc');
    expect(calls[0][0]).not.toContain('tok-abc');

    s.push('event: connected\ndata: {"job_id":15}\n\nevent: status\ndata: {"job":{"status":"processing","total":3,"completed":1,"failed":0}}\n\n');
    await flush();
    expect(screen.getByText(/1\/3 processed/)).toBeTruthy();

    s.push('event: done\ndata: {"completed":3,"total":3,"failed":0}\n\n');
    await flush();
    expect(screen.getByText(/Generation complete/)).toBeTruthy();
    expect(localStorage.getItem('spg_active_job')).toBeNull();
    expect(s.reader.cancel).toHaveBeenCalled();
  });

  test('a 401 on the job stream stops — no reconnect — and progress continues by REST poll', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    fetchMock.mockResolvedValue({ status: 401, ok: false, body: null });
    render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
    await flush();
    expect(streamCalls(fetchMock, JOB_STREAM)).toHaveLength(1);
    const logged401 = errSpy.mock.calls.filter((c) => String(c[0]).includes('401'));
    expect(logged401).toHaveLength(1);

    const jobGets = () => vi.mocked(apiClient.get).mock.calls.filter(([u]) => u.endsWith('/bulk/jobs/15')).length;
    const before = jobGets();
    jobState = { ...jobState, completed: 2 };
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    await flush();

    // Never reconnected the stream, and logged the 401 only once.
    expect(streamCalls(fetchMock, JOB_STREAM)).toHaveLength(1);
    expect(errSpy.mock.calls.filter((c) => String(c[0]).includes('401'))).toHaveLength(1);
    // The authorized REST poll carried progress.
    expect(jobGets()).toBeGreaterThan(before);
    expect(screen.getByText(/2\/3 processed/)).toBeTruthy();

    // Terminal state via the poll stops the polling too.
    jobState = { ...jobState, status: 'completed', completed: 3 };
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    await flush();
    expect(screen.getByText(/Generation complete/)).toBeTruthy();
    const after = jobGets();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(jobGets()).toBe(after);
  });

  test('unmount aborts the job stream and cancels its reader', async () => {
    const s = mockStream();
    let signal;
    fetchMock.mockImplementation((url, opts) => { if (url === JOB_STREAM) signal = opts.signal; return Promise.resolve(s.response); });
    const { unmount } = render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
    await flush();
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    expect(s.reader.cancel).toHaveBeenCalled();
  });

  test('the Automation tab opens the scheduler stream with the header; leaving the tab closes it', async () => {
    localStorage.removeItem('spg_active_job');
    const s = mockStream();
    let signal;
    fetchMock.mockImplementation((url, opts) => { if (url === SCHED_STREAM) signal = opts.signal; return Promise.resolve(s.response); });
    render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
    await flush();
    expect(streamCalls(fetchMock, SCHED_STREAM)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Automation' }));
    await flush();
    const calls = streamCalls(fetchMock, SCHED_STREAM);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers.Authorization).toBe('Bearer tok-abc');

    s.push('event: cycle_error\ndata: {"error":"boom"}\n\n');
    await flush();
    expect(screen.getByText('Cycle error: boom')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    await flush();
    expect(signal.aborted).toBe(true);
    expect(s.reader.cancel).toHaveBeenCalled();
  });

  test('a 403 on the scheduler stream is surfaced once and never retried', async () => {
    localStorage.removeItem('spg_active_job');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    fetchMock.mockResolvedValue({ status: 403, ok: false, body: null });
    render(<MemoryRouter><SocialProfileGenerator /></MemoryRouter>);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Automation' }));
    await flush();
    expect(screen.getByText(/Scheduler live updates unavailable \(HTTP 403\)/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(streamCalls(fetchMock, SCHED_STREAM)).toHaveLength(1);
    expect(errSpy.mock.calls.filter((c) => String(c[0]).includes('403'))).toHaveLength(1);
  });
});

// Saving a take while it records (Evoni, 2026-10-28): parts go up as the
// recorder makes them, the last ones at Stop, and Save only completes it.
// The length in the head: part 1 waits for Stop and the parts after it are
// cut where the finished file (withDuration) puts them, so the parts joined
// are byte for byte the file Save would have sent.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import { createLiveUpload, headGrowth, restoredUpload, sentPercent, readBlob, HOLD_LIMIT } from './liveUpload';
import { withDuration } from './takeDuration';
import { sendInParts, uploadFields } from './rawClipsApi';

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const P = 512; // a small part size for the tests (the real one is 8 MB); the MP4 head here is under 400 bytes
const noWait = async () => {};
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => { out.set(p, at); at += p.length; });
  return out;
};
const be32 = (v) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
const str = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const box = (type, ...payload) => { const body = cat(...payload); return cat(be32(body.length + 8), str(type), body); };
const full = (type, version, flags, ...payload) => box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payload);
const zeros = (n) => new Uint8Array(n);

// A fragmented MP4 head as Chrome's recorder writes it (no length, no mehd), then frames.
function mp4Head({ mehd = false } = {}) {
  const mvhd = full('mvhd', 0, 0, be32(0), be32(0), be32(1000), be32(0), zeros(80));
  const tkhd = full('tkhd', 0, 3, be32(0), be32(0), be32(1), be32(0), be32(0), zeros(60));
  const mdhd = full('mdhd', 0, 0, be32(0), be32(0), be32(90000), be32(0), zeros(4));
  const mvex = box('mvex', ...(mehd ? [full('mehd', 0, 0, be32(0))] : []), full('trex', 0, 0, be32(1), be32(1), zeros(12)));
  const moov = box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd)), mvex);
  const moof = box('moof', full('mfhd', 0, 0, be32(1)), box('traf', full('tfhd', 0, 0x020000, be32(1)), full('trun', 0, 1, be32(1), be32(8))));
  return cat(box('ftyp', str('isom'), be32(512), str('isomiso2')), moov, moof);
}
const frames = (n, seed = 7) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 251);
const bytesOf = (blob) => readBlob(blob);
// The recording in pieces of `size` bytes, as the recorder hands them over.
const pieces = (bytes, size) => {
  const out = [];
  for (let at = 0; at < bytes.length; at += size) out.push(new Blob([bytes.subarray(at, at + size)]));
  return out;
};
const settle = () => new Promise((r) => { setTimeout(r, 0); });
const flush = async (n = 30) => { for (let i = 0; i < n; i += 1) await settle(); }; // eslint-disable-line no-await-in-loop

// A transport that keeps every part by number (a re-sent part replaces the old one).
function fakeTransport({ failPart = null, partSize = P } = {}) {
  const t = {
    starts: [], sends: [], parts: new Map(), aborts: [],
    start: vi.fn(async (ep, body) => { t.starts.push(body); return { uploadId: 'up-1', clipId: 'clip-1', partSize }; }),
    part: vi.fn(async (ep, id, n, blob) => {
      if (failPart && failPart(n)) throw Object.assign(new Error('400'), { response: { status: 400, data: { error: 'Part arrived incomplete.' } } });
      t.sends.push(n);
      t.parts.set(n, await bytesOf(blob));
    }),
    abort: vi.fn(async (ep, id) => { t.aborts.push(id); return true; }),
    joined: () => cat(...[...t.parts.keys()].sort((a, b) => a - b).map((n) => t.parts.get(n))),
  };
  return t;
}
const make = (transport, extra = {}) => createLiveUpload({
  episodeId: 'ep-1', filename: 'beat-2-take-1.mp4', contentType: 'video/mp4', fields: { performer: 'justawoman', label: 'Beat 2 · take 1' },
  transport, partSize: P, headBytes: 512, sleep: noWait, retries: 0, ...extra,
});

describe('headGrowth: how much writing the length adds, known from the head alone', () => {
  test('an MP4 with no mehd grows by 16; with mehd, by nothing; not a video: null', () => {
    expect(headGrowth(cat(mp4Head(), box('mdat', frames(8))))).toMatchObject({ delta: 16 });
    expect(headGrowth(cat(mp4Head({ mehd: true }), box('mdat', frames(8))))).toMatchObject({ delta: 0 });
    expect(headGrowth(frames(200))).toBeNull();
  });
  test('the same growth whatever length is later written (part 1 is always exactly a part)', async () => {
    const rec = cat(mp4Head(), box('mdat', frames(500)));
    const { delta } = headGrowth(rec);
    for (const secs of [1, 61.5, 1320.25, 36000]) {
      // eslint-disable-next-line no-await-in-loop
      const out = await withDuration(new Blob([rec]), secs);
      expect(out.size).toBe(rec.length + delta);
    }
  });
});

describe('parts while recording, the rest at Stop', () => {
  test('an MP4: parts 2… go up while recording, cut where the finished file puts them; part 1 waits for Stop; joined = the finished file', async () => {
    const rec = cat(mp4Head(), box('mdat', frames(3000)));
    const t = fakeTransport();
    const states = [];
    const up = make(t, { onState: (s) => states.push(s) });
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    // Started without a size; part 1 not sent; parts 2.. full while recording.
    expect(t.starts[0]).toMatchObject({ size_unknown: true, filename: 'beat-2-take-1.mp4', content_type: 'video/mp4', performer: 'justawoman' });
    expect(t.starts[0]).not.toHaveProperty('size');
    const whileRecording = [...t.sends];
    expect(whileRecording[0]).toBe(2);
    expect(whileRecording).not.toContain(1);
    expect(up.state).toMatchObject({ uploadId: 'up-1', size: null, delta: 16 });
    // Stop: the finished file (the length in its head).
    const recording = new Blob([rec]);
    const finished = await withDuration(recording, 12.5);
    expect(finished.size).toBe(rec.length + 16);
    const st = await up.finish(recording, finished);
    expect(st.size).toBe(finished.size);
    const all = Math.ceil(finished.size / P);
    expect([...st.done].sort((a, b) => a - b)).toEqual(Array.from({ length: all }, (_, i) => i + 1));
    expect(up.status).toBe('ready');
    // Every part but the last is exactly a part; together they are the finished file.
    [...t.parts.entries()].forEach(([n, b]) => { if (n < all) expect(b.length).toBe(P); });
    expect(t.joined()).toEqual(await bytesOf(finished));
    expect(t.sends.filter((n) => n === 1)).toHaveLength(1);
    expect(sentPercent(st)).toBe(100);
    expect(states.at(-1)).toMatchObject({ size: finished.size });
  });

  test('a head longer than a part (only in tests: real heads are KB, parts 8 MB): every part touching it waits for Stop', async () => {
    const rec = cat(mp4Head(), box('mdat', frames(2000)));
    const t = fakeTransport({ partSize: 64 });
    const up = make(t, { partSize: 64 });
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    expect(Math.min(...t.sends)).toBeGreaterThan(Math.ceil((headGrowth(rec).consumed + 16) / 64));
    const finished = await withDuration(new Blob([rec]), 3);
    await up.finish(new Blob([rec]), finished);
    expect(t.joined()).toEqual(await bytesOf(finished));
  });

  test('a file whose head can\'t be patched: part 1 goes up as recorded; a length written in place re-sends only part 1', async () => {
    const rec = frames(5 * P - 20);
    const t = fakeTransport();
    const up = make(t, { headBytes: P });
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    expect(t.sends.slice(0, 3)).toEqual([1, 2, 3]);
    // Same size, other bytes (a length field already there, filled in).
    const patched = cat(rec);
    patched[3] = 99;
    await up.finish(new Blob([rec]), new Blob([patched]));
    expect(t.sends.filter((n) => n === 1)).toHaveLength(2);
    expect(t.joined()).toEqual(patched);
  });

  test('a take shorter than a part never starts an upload: Save sends it whole, as before', async () => {
    const t = fakeTransport();
    const up = make(t);
    up.push(new Blob([frames(P - 10)]));
    up.stop();
    await flush();
    expect(await up.finish(new Blob([frames(P - 10)]), new Blob([frames(P - 10)]))).toBeNull();
    expect(t.start).not.toHaveBeenCalled();
    expect(up.status).toBe('off');
  });

  test('the take stopping just as its first part fills starts nothing (its last piece came with Stop)', async () => {
    const t = fakeTransport();
    const up = make(t, { headBytes: P });
    up.push(new Blob([frames(3 * P)]));
    up.stop();
    await flush();
    expect(t.start).not.toHaveBeenCalled();
  });

  test('a finished file that does not line up (the patch failed at Stop): thrown away, Save uploads it whole', async () => {
    const rec = cat(mp4Head(), box('mdat', frames(2000)));
    const t = fakeTransport();
    const up = make(t);
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    const recording = new Blob([rec]);
    expect(await up.finish(recording, recording)).toBeNull(); // no length written: 16 bytes short
    expect(t.aborts).toEqual(['up-1']);
    expect(up.state).toBeNull();
  });
});

describe('failures, Discard, and never twice', () => {
  test('a part that fails stops sending; Stop keeps what went; sendInParts (Retry) sends the rest and completes, no part twice', async () => {
    const rec = cat(mp4Head(), box('mdat', frames(3000)));
    const t = fakeTransport({ failPart: (n) => n === 4 && t.sends.filter((k) => k === 4).length === 0 && !t.retried });
    const up = make(t);
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    expect(up.status).toBe('failed');
    expect(t.sends).toEqual([2, 3]);
    const recording = new Blob([rec]);
    const finished = await withDuration(recording, 9);
    const st = await up.finish(recording, finished);
    expect(st).toMatchObject({ uploadId: 'up-1', size: finished.size, done: [2, 3] });
    // Retry: the page's own sendInParts, resumed from that state.
    t.retried = true;
    api.put.mockImplementation(async (url, blob) => { await t.part('ep-1', 'up-1', Number(url.split('/').pop()), blob); return { data: { success: true } }; });
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'clip-1' }, stored: [] } });
    const file = new File([finished], 'beat-2-take-1.mp4', { type: 'video/mp4' });
    await sendInParts('ep-1', file, uploadFields({ performer: 'justawoman', label: 'Beat 2 · take 1', seconds: 9 }), { resume: st, sleep: noWait, thumbnail: null });
    expect(api.post).toHaveBeenCalledTimes(1); // complete only: no second start
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/episode-clips/ep-1/uploads/up-1/complete');
    expect(api.post.mock.calls[0][1]).toMatchObject({ size: finished.size, fields: expect.objectContaining({ seconds: 9 }) });
    const counts = t.sends.reduce((m, n) => ({ ...m, [n]: (m[n] || 0) + 1 }), {});
    Object.values(counts).forEach((c) => expect(c).toBe(1));
    expect(t.joined()).toEqual(await bytesOf(finished));
  });

  test('Discard while recording or after: the upload is thrown away on the server and nothing more is sent', async () => {
    const rec = frames(4 * P);
    const t = fakeTransport();
    const up = make(t, { headBytes: P });
    for (const p of pieces(rec, 100)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    await flush();
    const sent = t.sends.length;
    expect(sent).toBeGreaterThan(0);
    await up.abort();
    up.push(new Blob([frames(3 * P)]));
    await flush();
    expect(t.sends).toHaveLength(sent);
    expect(t.aborts).toEqual(['up-1']);
    expect(up.status).toBe('aborted');
    expect(await up.finish(new Blob([rec]), new Blob([rec]))).toBeNull();
  });

  test('a connection far behind the recording stops live sending (memory stays small); Stop sends the rest', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const t = fakeTransport();
    const slow = t.part;
    t.part = vi.fn(async (...a) => { await gate; return slow(...a); });
    const up = make(t, { holdLimit: 3 * P, headBytes: P });
    const rec = frames(10 * P);
    for (const p of pieces(rec, P / 2)) { up.push(p); await settle(); } // eslint-disable-line no-await-in-loop
    expect(up.status).toBe('behind');
    release();
    await flush();
    const st = await up.finish(new Blob([rec]), new Blob([rec]));
    expect(st.done.length).toBe(10);
    expect(t.joined()).toEqual(rec);
    expect(HOLD_LIMIT).toBe(6 * 8 * 1024 * 1024);
  });

  test('restoredUpload: after a reload mid-take, the size is the recording plus the head\'s growth and part 1 goes again', () => {
    expect(restoredUpload({ uploadId: 'up-1', partSize: P, size: null, done: [2, 3], delta: 16 }, 3000)).toEqual({ uploadId: 'up-1', partSize: P, size: 3016, done: [2, 3], delta: 16 });
    expect(restoredUpload({ uploadId: 'up-1', partSize: P, size: null, done: [1, 2], delta: null }, 3000)).toMatchObject({ size: 3000, done: [2] });
    const whole = { uploadId: 'up-1', size: 500, done: [1] };
    expect(restoredUpload(whole, 400)).toBe(whole);
    expect(restoredUpload(null, 1)).toBeNull();
  });

  test('sendInParts throws away an upload kept for a take it no longer fits, then starts afresh', async () => {
    api.post.mockImplementation(async (url) => (url.endsWith('/uploads') ? { data: { uploadId: 'up-2', clipId: 'c2', partSize: 8 * 1024 * 1024 } } : { data: { success: true, data: { id: 'c2' } } }));
    api.put.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
    await sendInParts('ep-1', new File([frames(10)], 'a.webm', { type: 'video/webm' }), uploadFields({ performer: 'lala' }), { resume: { uploadId: 'up-1', size: 999, done: [1] }, sleep: noWait });
    expect(api.delete).toHaveBeenCalledWith('/api/v1/episode-clips/ep-1/uploads/up-1');
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/episode-clips/ep-1/uploads');
  });
});

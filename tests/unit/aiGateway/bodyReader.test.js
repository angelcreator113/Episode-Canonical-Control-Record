'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBodyIntake } = require('../../../src/aiGateway/bodyReader');
const { createFsSpoolStore } = require('../../../src/aiGateway/fsStores');
const { withLimits, DEFAULT_LIMITS } = require('../../../src/aiGateway/constants');
const { sha256Hex } = require('../../../src/aiGateway/canonical');
const { sourceOf, createMemSpoolStore } = require('./_harness');

const json = (o) => Buffer.from(JSON.stringify(o));

describe('body intake: declared length', () => {
  const intake = createBodyIntake({ spoolStore: createMemSpoolStore() });
  test('a missing Content-Length is refused before reading', async () => {
    let pulled = false;
    const src = (async function* () { pulled = true; yield Buffer.from('{}'); })();
    await expect(intake.read(src, { kind: 'json', contentLength: undefined, expectedBytes: 2 })).rejects.toMatchObject({ code: 'BODY_LENGTH_REQUIRED' });
    expect(pulled).toBe(false);
  });
  test('a Content-Length different from the permit is refused before reading', async () => {
    let pulled = false;
    const src = (async function* () { pulled = true; yield Buffer.from('{}'); })();
    await expect(intake.read(src, { kind: 'json', contentLength: 3, expectedBytes: 2 })).rejects.toMatchObject({ code: 'BODY_LENGTH_MISMATCH' });
    expect(pulled).toBe(false);
  });
  test('more or fewer bytes than declared are refused', async () => {
    const b = json({ a: 1 });
    await expect(intake.read(sourceOf(Buffer.concat([b, Buffer.from(' ')])), { kind: 'json', contentLength: b.length, expectedBytes: b.length })).rejects.toMatchObject({ code: 'BODY_LENGTH_MISMATCH' });
    await expect(intake.read(sourceOf(b.subarray(0, 3)), { kind: 'json', contentLength: b.length, expectedBytes: b.length })).rejects.toMatchObject({ code: 'BODY_LENGTH_MISMATCH' });
  });
});

describe('body intake: JSON in memory, bounded', () => {
  test('JSON is hashed exactly and parsed', async () => {
    const intake = createBodyIntake({ spoolStore: createMemSpoolStore() });
    const b = json({ model: 'x', max_tokens: 5 });
    const r = await intake.read(sourceOf(b, 3), { kind: 'json', contentLength: b.length, expectedBytes: b.length });
    expect(r.sha256).toBe(sha256Hex(b));
    expect(r.json).toEqual({ model: 'x', max_tokens: 5 });
    expect(r.spool).toBeUndefined();
  });
  test('JSON over 1 MiB is refused before reading; invalid JSON is refused', async () => {
    const intake = createBodyIntake({ spoolStore: createMemSpoolStore() });
    const big = DEFAULT_LIMITS.jsonBodyMax + 1;
    await expect(intake.read(sourceOf(Buffer.alloc(0)), { kind: 'json', contentLength: big, expectedBytes: big })).rejects.toMatchObject({ code: 'BODY_TOO_LARGE' });
    const bad = Buffer.from('{not json');
    await expect(intake.read(sourceOf(bad), { kind: 'json', contentLength: bad.length, expectedBytes: bad.length })).rejects.toMatchObject({ code: 'BODY_NOT_JSON' });
  });
});

describe('body intake: multipart spooled to disk', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigw-spool-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('a 24 MiB upload is spooled to disk, hashed exactly, then removed on release', async () => {
    const store = createFsSpoolStore(dir);
    const intake = createBodyIntake({ spoolStore: store });
    const buf = Buffer.alloc(24 * 1024 * 1024, 7);
    const r = await intake.read(sourceOf(buf, 1024 * 1024), { kind: 'multipart', contentLength: buf.length, expectedBytes: buf.length });
    expect(r.sha256).toBe(sha256Hex(buf));
    expect(r.raw).toBeUndefined(); // never held in memory as a whole
    expect(fs.statSync(r.spool.file).size).toBe(buf.length);
    intake.release(r);
    expect(store.list()).toEqual([]);
    expect(intake.stats()).toEqual({ activeSpools: 0, spooledBytesReserved: 0 });
  });

  test('a 26 MiB upload is refused before reading', async () => {
    const intake = createBodyIntake({ spoolStore: createFsSpoolStore(dir) });
    const n = 26 * 1024 * 1024;
    await expect(intake.read(sourceOf(Buffer.alloc(0)), { kind: 'multipart', contentLength: n, expectedBytes: n })).rejects.toMatchObject({ code: 'BODY_TOO_LARGE' });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test('concurrency and total quota limits refuse with SPOOL_FULL and leave no file', async () => {
    const limits = withLimits({ spoolConcurrency: 2, spoolTotalMax: 1000 });
    const store = createFsSpoolStore(dir);
    const intake = createBodyIntake({ spoolStore: store, limits });
    const a = Buffer.alloc(400, 1);
    const r1 = await intake.read(sourceOf(a), { kind: 'multipart', contentLength: 400, expectedBytes: 400 });
    const r2 = await intake.read(sourceOf(a), { kind: 'multipart', contentLength: 400, expectedBytes: 400 });
    await expect(intake.read(sourceOf(a), { kind: 'multipart', contentLength: 400, expectedBytes: 400 })).rejects.toMatchObject({ code: 'SPOOL_FULL' });
    intake.release(r1);
    await expect(intake.read(sourceOf(Buffer.alloc(700)), { kind: 'multipart', contentLength: 700, expectedBytes: 700 })).rejects.toMatchObject({ code: 'SPOOL_FULL' }); // 400 + 700 > 1000
    intake.release(r2);
    expect(store.list()).toEqual([]);
  });

  test('the concurrency cap alone refuses a spool even when the quota has room', async () => {
    const limits = withLimits({ spoolConcurrency: 1, spoolTotalMax: 1_000_000 });
    const store = createFsSpoolStore(dir);
    const intake = createBodyIntake({ spoolStore: store, limits });
    const a = Buffer.alloc(10, 1);
    const r1 = await intake.read(sourceOf(a), { kind: 'multipart', contentLength: 10, expectedBytes: 10 });
    await expect(intake.read(sourceOf(a), { kind: 'multipart', contentLength: 10, expectedBytes: 10 })).rejects.toMatchObject({ code: 'SPOOL_FULL' });
    intake.release(r1);
    const r2 = await intake.read(sourceOf(a), { kind: 'multipart', contentLength: 10, expectedBytes: 10 });
    intake.release(r2);
    expect(store.list()).toEqual([]);
  });

  test('a slow body hits the read deadline, its spool file is removed and its slot freed', async () => {
    let fire;
    const timers = { setTimeout: (fn) => { fire = fn; return 1; }, clearTimeout: () => {} };
    const store = createFsSpoolStore(dir);
    const intake = createBodyIntake({ spoolStore: store, timers });
    let release;
    const stalled = (async function* () { yield Buffer.alloc(10); await new Promise((r) => { release = r; }); yield Buffer.alloc(10); })();
    const p = intake.read(stalled, { kind: 'multipart', contentLength: 20, expectedBytes: 20 });
    await new Promise((r) => setImmediate(r));
    fire();
    await expect(p).rejects.toMatchObject({ code: 'BODY_DEADLINE' });
    expect(store.list()).toEqual([]);
    expect(intake.stats().activeSpools).toBe(0);
    release();
  });

  test('nothing is returned (so nothing is forwardable) until the final byte has arrived and been hashed', async () => {
    const intake = createBodyIntake({ spoolStore: createFsSpoolStore(dir) });
    let release;
    let resolved = false;
    const src = (async function* () { yield Buffer.alloc(10, 1); await new Promise((r) => { release = r; }); yield Buffer.alloc(10, 2); })();
    const p = intake.read(src, { kind: 'multipart', contentLength: 20, expectedBytes: 20 }).then((r) => { resolved = true; return r; });
    await new Promise((r) => setImmediate(r));
    expect(resolved).toBe(false);
    release();
    const r = await p;
    expect(r.sha256).toBe(sha256Hex(Buffer.concat([Buffer.alloc(10, 1), Buffer.alloc(10, 2)])));
    intake.release(r);
  });

  test('boot sweep removes leftover spool files', () => {
    fs.writeFileSync(path.join(dir, 'left.spool'), 'x');
    fs.writeFileSync(path.join(dir, 'keep.txt'), 'x');
    createBodyIntake({ spoolStore: createFsSpoolStore(dir) }).sweep();
    expect(fs.readdirSync(dir)).toEqual(['keep.txt']);
  });
});

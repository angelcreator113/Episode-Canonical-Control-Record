import { describe, test, expect, vi } from 'vitest';
import { createTakeStore, takeKey, takeWhen } from './takeStore';
import { fakeIndexedDB } from './fakeIndexedDB.testutil';

const blob = (s) => new Blob([s], { type: 'video/webm' });

describe('takeStore (Teleprompter audit 2 and 4)', () => {
  test('a take and its pieces are kept, read back in order, listed as unsaved, and removed', async () => {
    const store = createTakeStore(fakeIndexedDB());
    expect(store.available).toBe(true);
    expect(await store.begin('t1', { key: takeKey('ep-1'), type: 'video/webm', meta: { scope: 'beat', beatNumber: 3 } })).toBe(true);
    expect(await store.addChunk('t1', 1, blob('bb'), 2)).toBe(true);
    expect(await store.addChunk('t1', 0, blob('a'), 1)).toBe(true);
    expect(await store.update('t1', { finished: true, seconds: 2.4, meta: { marks: [{ beat: 3, t: 0 }] } })).toBe(true);
    const parts = await store.chunks('t1');
    expect(parts.map((p) => p.seq)).toEqual([0, 1]);
    expect(new Blob(parts.map((p) => p.data)).size).toBe(3);
    expect(parts.map((p) => p.data.size)).toEqual([1, 2]);
    const list = await store.unsaved('episode:ep-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 't1', finished: true, seconds: 2.4, count: 2, lastT: 2, meta: { scope: 'beat', beatNumber: 3, marks: [{ beat: 3, t: 0 }] } });
    expect(await store.unsaved('episode:other')).toEqual([]);
    expect(await store.remove('t1')).toBe(true);
    expect(await store.unsaved('episode:ep-1')).toEqual([]);
    expect(await store.chunks('t1')).toEqual([]);
  });

  test('a take with no pieces is dropped when listed', async () => {
    const store = createTakeStore(fakeIndexedDB());
    await store.begin('t2', { key: 'text', type: 'video/mp4' });
    expect(await store.unsaved('text')).toEqual([]);
    await store.addChunk('t2', 0, blob('x'));
    expect(await store.unsaved('text')).toEqual([]);
  });

  test('no IndexedDB: everything answers "not kept", nothing throws', async () => {
    const store = createTakeStore(null);
    expect(store.available).toBe(false);
    expect(await store.begin('t', { key: 'text' })).toBe(false);
    expect(await store.addChunk('t', 0, blob('x'))).toBe(false);
    expect(await store.chunks('t')).toEqual([]);
    expect(await store.unsaved('text')).toEqual([]);
    expect(await store.remove('t')).toBe(false);
  });

  test('a failing open or a full disk is logged and answers false', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const closed = createTakeStore(fakeIndexedDB({ failOn: new Set(['open']) }));
    expect(await closed.begin('t', { key: 'text' })).toBe(false);
    expect(closed.available).toBe(false);
    const full = createTakeStore(fakeIndexedDB({ failOn: new Set(['put']) }));
    expect(await full.addChunk('t', 0, blob('x'))).toBe(false);
    expect(err).toHaveBeenCalledWith('[takeStore] chunk failed:', expect.any(Error));
    const throwing = createTakeStore({ open: () => { throw new Error('SecurityError'); } });
    expect(await throwing.unsaved('text')).toEqual([]);
    err.mockRestore();
  });

  test('takeKey and takeWhen', () => {
    expect(takeKey('ep-9')).toBe('episode:ep-9');
    expect(takeKey(null)).toBe('text');
    const now = new Date(2026, 9, 24, 15, 30).getTime();
    expect(takeWhen(new Date(2026, 9, 24, 15, 5).getTime(), now)).toMatch(/today$/);
    expect(takeWhen(new Date(2026, 9, 22, 9, 0).getTime(), now)).toMatch(/Oct 22/);
    expect(takeWhen(NaN, now)).toBe('earlier');
  });
});

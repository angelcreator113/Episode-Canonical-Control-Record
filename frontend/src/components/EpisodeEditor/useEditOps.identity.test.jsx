/**
 * Undo and redo across a put back (audit 2026-11-03, Part A1, A3). Putting a
 * deleted row back, or redoing a place, makes a new row with a new id; the
 * steps further down the stacks must reach that row, not the old id. A step
 * the server still refuses stays where it is until the producer skips it.
 *
 * The fake server below keeps scene clips the way the C1 service does: a
 * place makes a new id; a delete soft-deletes; a deleted id is NOT_FOUND; a
 * reorder renumbers the beat 0..n-1; a place with `index` inserts there.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../lib/episodeEditApi', () => ({ episodeEditApi: { write: vi.fn() } }));

import { episodeEditApi } from '../../lib/episodeEditApi';
import useEditOps, { pickRevision } from './useEditOps';
import * as ops from '../../lib/editOps';

const refuse = (status, code, error) => Object.assign(new Error(code), { response: { status, data: { code, error } } });

function fakeServer() {
  const s = { rev: 1, n: 0, clips: new Map(), log: [] };
  const live = (beat) => [...s.clips.values()].filter((c) => !c.deleted && c.beat_number === beat).sort((a, b) => a.position - b.position);
  const renumber = (beat, order) => order.forEach((c, i) => { c.position = i; });
  const get = (id) => {
    const c = s.clips.get(id);
    if (!c || c.deleted) throw refuse(404, 'NOT_FOUND', 'Scene clip not found');
    return c;
  };
  s.write = async (episodeId, { method, path, body = {} }, revision) => {
    s.log.push(`${method} ${path}`);
    if (String(revision) !== String(s.rev)) throw refuse(409, 'EDIT_CHANGED', 'stale');
    const [, , id, action] = path.split('/');
    let out = {};
    if (method === 'post' && path === '/scene-clips') {
      s.n += 1;
      const row = { id: `c${s.n}`, ...body, deleted: false };
      const order = live(body.beat_number);
      if (body.index != null) order.splice(Math.min(body.index, order.length), 0, row);
      else if (body.position != null) {
        if (order.some((c) => c.position === body.position)) throw refuse(409, 'POSITION_TAKEN', 'That place in the beat already has a clip');
        row.position = body.position;
      } else order.push(row);
      s.clips.set(row.id, row);
      if (body.position == null || body.index != null) renumber(body.beat_number, order);
      out = { scene_clip_id: row.id };
    } else if (method === 'delete') {
      get(id).deleted = true;
    } else if (method === 'patch') {
      Object.assign(get(id), body);
    } else if (action === 'reorder') {
      const c = get(id);
      const order = live(c.beat_number).filter((x) => x !== c);
      order.splice(body.index, 0, c);
      renumber(c.beat_number, order);
    }
    s.rev += 1;
    return { ...out, edit_revision: String(s.rev) };
  };
  s.row = (id) => ({ ...s.clips.get(id) });
  s.liveIds = (beat) => live(beat).map((c) => c.id);
  return s;
}

const still = (beat = 1) => ({ beat_number: beat, source_kind: 'angle_still', source_id: 'a1', duration_ms: 3000 });

describe('useEditOps: row identity across put backs', () => {
  let server;
  let hook;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server = fakeServer();
    vi.mocked(episodeEditApi.write).mockImplementation((...a) => server.write(...a));
    hook = renderHook(() => useEditOps({ episodeId: 'ep', getRevision: () => String(server.rev), reload: async () => {} }));
  });
  const ed = () => hook.result.current;
  const step = async (fn) => { let r; await act(async () => { r = await fn(); }); return r; };

  test('place, trim, undo, undo, redo, redo: the second redo trims the re-placed clip', async () => {
    await step(() => ed().run(ops.placeSceneClip(still())));
    await step(() => ed().run(ops.updateSceneClip({ ...server.row('c1') }, { duration_ms: 1000 })));
    expect(await step(() => ed().undo())).toBe(true);
    expect(await step(() => ed().undo())).toBe(true);
    expect(server.row('c1').deleted).toBe(true);
    expect(await step(() => ed().redo())).toBe(true); // places c2 for c1
    expect(await step(() => ed().redo())).toBe(true); // the trim reaches c2
    expect(server.row('c2')).toMatchObject({ deleted: false, duration_ms: 1000 });
    expect(server.log.at(-1)).toBe('patch /scene-clips/c2');
    expect(ed().notice).toBe(null);
  });

  test('trim, delete, undo (put back), undo: the trim is undone on the put-back clip', async () => {
    await step(() => ed().run(ops.placeSceneClip(still())));
    await step(() => ed().run(ops.updateSceneClip({ ...server.row('c1') }, { duration_ms: 2000 })));
    await step(() => ed().run(ops.removeSceneClip({ ...server.row('c1') })));
    expect(await step(() => ed().undo())).toBe(true); // c2 stands for c1
    expect(await step(() => ed().undo())).toBe(true);
    expect(server.row('c2')).toMatchObject({ deleted: false, duration_ms: 3000 });
    // And the whole chain again forwards.
    expect(await step(() => ed().redo())).toBe(true);
    expect(await step(() => ed().redo())).toBe(true);
    expect(server.row('c2').deleted).toBe(true);
  });

  test('undoing a delete after the beat was reordered puts the clip back at its place, never "taken"', async () => {
    for (let i = 0; i < 3; i += 1) await step(() => ed().run(ops.placeSceneClip(still())));
    expect(server.liveIds(1)).toEqual(['c1', 'c2', 'c3']);
    await step(() => ed().run(ops.removeSceneClip({ ...server.row('c2') })));
    await step(() => ed().run(ops.reorderSceneClip({ ...server.row('c3') }, 0, 1)));
    expect(server.liveIds(1)).toEqual(['c3', 'c1']);
    expect(await step(() => ed().undo())).toBe(true); // c1, c3
    expect(await step(() => ed().undo())).toBe(true); // c2 back between them
    expect(server.liveIds(1)).toEqual(['c1', 'c4', 'c3']);
    expect(ed().notice).toBe(null);
  });

  test('a step the server still refuses is kept and says so; "Skip this step" removes it only when chosen', async () => {
    await step(() => ed().run(ops.placeSceneClip(still())));
    await step(() => ed().run(ops.updateSceneClip({ ...server.row('c1') }, { duration_ms: 1000 })));
    server.clips.get('c1').deleted = true; // gone some other way the page never saw
    expect(await step(() => ed().undo())).toBe(false);
    expect(ed().canUndo).toBe(true);
    expect(ed().notice).toMatchObject({ kind: 'error', text: expect.stringMatching(/Scene clip not found.*kept/), action: { label: 'Skip this step' } });
    const before = ed().undoLabel;
    await step(() => ed().notice.action.run());
    expect(ed().undoLabel).not.toBe(before);
    expect(ed().notice).toMatchObject({ kind: 'info', text: expect.stringMatching(/^Skipped/) });
  });

  test('a stale refusal clears history and reports a reload that failed as failed', async () => {
    hook.unmount();
    hook = renderHook(() => useEditOps({ episodeId: 'ep', getRevision: () => '0', reload: async () => { throw new Error('offline'); } }));
    await step(() => ed().run(ops.placeSceneClip(still())));
    expect(ed().canUndo).toBe(false);
    expect(ed().notice.text).toMatch(/could not be read again/);
    expect(ed().notice.text).not.toMatch(/It has been reloaded/);
  });
});

describe('pickRevision', () => {
  test("the newer of the page's revision and the last write's", () => {
    expect(pickRevision('7', null)).toBe('7');
    expect(pickRevision('7', '8')).toBe('8');
    expect(pickRevision('9', '8')).toBe('9');
    expect(pickRevision(null, '8')).toBe('8');
  });
});

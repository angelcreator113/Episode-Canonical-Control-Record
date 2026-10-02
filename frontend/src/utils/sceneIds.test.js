/**
 * The Timeline adopts the ids of the scene rows its save created (Evoni's
 * answer L12a, 2026-10-02, §8(hh): the save updates rows in place).
 */
import { describe, test, expect } from 'vitest';
import { adoptSceneIds } from './sceneIds';

describe('adoptSceneIds (L12a)', () => {
  const scenes = [{ id: 'row-a', title: 'Arrival' }, { id: 'scene-1717', title: 'Cutaway' }];

  test('a scene added under a local id takes its new row id; the others are unchanged', () => {
    const next = adoptSceneIds(scenes, [{ client_id: 'row-a', id: 'row-a' }, { client_id: 'scene-1717', id: 'row-new' }]);
    expect(next).toEqual([{ id: 'row-a', title: 'Arrival' }, { id: 'row-new', title: 'Cutaway' }]);
    expect(next[0]).toBe(scenes[0]);
  });

  test('nothing to adopt returns the same array', () => {
    expect(adoptSceneIds(scenes, [{ client_id: 'row-a', id: 'row-a' }])).toBe(scenes);
    expect(adoptSceneIds(scenes, undefined)).toBe(scenes);
  });

  test('two editor scenes with the same local id take one row each, in order', () => {
    const twice = [{ id: 'row-a', title: 'Arrival' }, { id: 'row-a', title: 'Arrival again' }];
    // The save updated row-a for the first and created row-b for the second.
    const next = adoptSceneIds(twice, [{ client_id: 'row-a', id: 'row-a' }, { client_id: 'row-a', id: 'row-b' }]);
    expect(next.map((s) => s.id)).toEqual(['row-a', 'row-b']);
  });
});

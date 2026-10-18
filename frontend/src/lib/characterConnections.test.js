import { describe, test, expect } from 'vitest';
import {
  groupOf, closenessOf, isClose, typeLabel, noteOf, connectionStats, filterConnections,
  keyRelationships, connectionHistory, mapPoints,
} from './characterConnections';

const REL = [
  { id: 'r1', related_name: 'Lala', relationship_type: 'bestie', tension_state: 'healing', created_at: '2026-10-14T10:00:00Z', situation: 'Creative partner' },
  { id: 'r2', related_name: 'Stable', relationship_type: 'business_partner', tension_state: 'calm', created_at: '2026-10-12T10:00:00Z' },
  { id: 'r3', related_name: 'Margaux Delcroix', relationship_type: 'rival', tension_state: 'volatile', notes: 'Pushes her work', created_at: 'not a date' },
  { id: 'r4', related_name: 'Aunt Bea', relationship_type: 'aunt' },
  { id: 'r5', related_name: 'Jules', relationship_type: 'ex', tension_state: 'fractured', created_at: '2026-10-01T10:00:00Z' },
  { id: 'r6', related_name: 'Kai', role_tag: 'ally' },
  { id: 'r7', related_name: 'Isla', relationship_type: 'neighbour' },
];

describe('groups', () => {
  test('each relationship in one group, from its type, tag and flags', () => {
    expect(REL.map(groupOf)).toEqual(['friend', 'working', 'rival', 'family', 'romantic', 'friend', 'other']);
    expect(groupOf({ relationship_type: 'friend', family_role: 'sister' })).toBe('family');
    expect(groupOf({ relationship_type: 'friend', is_romantic: true })).toBe('romantic');
    expect(groupOf({ role_tag: 'detractor' })).toBe('rival');
    expect(groupOf({ role_tag: 'mentor' })).toBe('working');
    expect(groupOf(null)).toBe('other');
  });

  test('closeness, labels and the note', () => {
    expect(REL.map(closenessOf)).toEqual([70, 90, 25, null, 10, null, null]);
    expect(REL.filter(isClose).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(typeLabel(REL[1])).toBe('Business partner');
    expect(typeLabel(REL[5])).toBe('Ally');
    expect(typeLabel({})).toBe('Connected');
    expect(noteOf(REL[2])).toBe('Pushes her work');
    expect(noteOf({ situation: '  ' })).toBeNull();
  });

  test('counts', () => {
    expect(connectionStats(REL)).toEqual({ total: 7, close: 2, groups: { friend: 2, working: 1, rival: 1, family: 1, romantic: 1, other: 1 } });
    expect(connectionStats({}).total).toBe(0);
  });
});

describe('the list', () => {
  test('closest first, then by name; a filter, a search', () => {
    expect(filterConnections(REL).map((r) => r.id)).toEqual(['r2', 'r1', 'r3', 'r5', 'r4', 'r7', 'r6']);
    expect(filterConnections(REL, { filter: 'close' }).map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(filterConnections(REL, { filter: 'rival' }).map((r) => r.id)).toEqual(['r3']);
    expect(filterConnections(REL, { query: 'creative' }).map((r) => r.id)).toEqual(['r1']);
    expect(filterConnections(REL, { query: 'BUSINESS' }).map((r) => r.id)).toEqual(['r2']);
  });

  test('by name, type and newest', () => {
    expect(filterConnections(REL, { sort: 'name' }).map((r) => r.related_name)[0]).toBe('Aunt Bea');
    expect(filterConnections(REL, { sort: 'type' }).map((r) => typeLabel(r))[0]).toBe('Ally');
    expect(filterConnections(REL, { sort: 'newest' }).slice(0, 3).map((r) => r.id)).toEqual(['r1', 'r2', 'r5']);
  });
});

describe('key relationships, history and the map', () => {
  test('Lala first, then the closest', () => {
    expect(keyRelationships(REL).map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(keyRelationships(null)).toEqual([]);
  });

  test('history: the dated ones, newest first', () => {
    expect(connectionHistory(REL).map((r) => r.id)).toEqual(['r1', 'r2', 'r5']);
  });

  test('the map spaces up to six around the centre, the first at the top', () => {
    const pts = mapPoints(REL, 6, 300);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toMatchObject({ x: 150, y: 42 });
    expect(pts[0].r.id).toBe('r1');
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(6);
    expect(mapPoints([], 6)).toEqual([]);
  });
});

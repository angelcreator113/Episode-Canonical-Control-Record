// Edit & Assemble: the ★ take first and picked, whole-episode stretches, Use favourites.
import { describe, test, expect, beforeEach } from 'vitest';
import { beatOptions, assembly, favouritePicks, assemblyText, assemblyStat, readPicks, writePicks } from './assembleTakes';
import { markClock } from './fullEpisodeTake';

const CLIPS = [
  { id: 'a', beat_number: 1, label: 'Beat 1 · take 1', is_favorite: false, duration_seconds: 40 },
  { id: 'b', beat_number: 1, label: 'Beat 1 · take 2', is_favorite: true, duration_seconds: 38 },
  { id: 'c', beat_number: 1, label: 'Beat 1 · take 3', is_favorite: false },
  { id: 'd', beat_number: 2, label: 'Beat 2 · take 1', is_favorite: false },
  { id: 'f', beat_number: null, label: 'Full episode · take 1', beat_marks: [{ beat: 1, t: 0 }, { beat: 3, t: 70.5 }, { beat: 4, t: 130 }], duration_seconds: 200 },
];

describe('assembleTakes', () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch (err) { console.error(err); } });

  test('a beat\'s takes: the ★ first, then newest, then whole-episode stretches', () => {
    expect(beatOptions(CLIPS, 1).map((o) => o.key)).toEqual(['b', 'c', 'a', 'f@1']);
    expect(beatOptions(CLIPS, 1)[0].favorite).toBe(true);
    const s = beatOptions(CLIPS, 3);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ key: 'f@3', full: true, start: 70.5, end: 130 });
    expect(beatOptions(CLIPS, 4)[0]).toMatchObject({ start: 130, end: 200 });
    expect(beatOptions(CLIPS, 5)).toEqual([]);
  });

  test('in beat order, the ★ preselected; a pick wins while it is still one of the beat\'s takes', () => {
    const rows = assembly(CLIPS, [{ beat_number: 1, beat_name: 'Opening Ritual' }]);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({ number: 1, name: 'Opening Ritual' });
    expect(rows[0].pick.key).toBe('b');
    expect(assembly(CLIPS, [], { 1: 'a' })[0].pick.key).toBe('a');
    expect(assembly(CLIPS, [], { 1: 'gone' })[0].pick.key).toBe('b');
    expect(rows[4].pick).toBeNull();
    expect(assemblyStat(rows)).toBe('4 of 14 beats have a take to use');
  });

  test('Use favourites lines up each beat\'s ★ (or first) take', () => {
    expect(favouritePicks(CLIPS, [])).toEqual({ 1: 'b', 2: 'd', 3: 'f@3', 4: 'f@4' });
    const text = assemblyText(assembly(CLIPS, [{ beat_number: 1, beat_name: 'Opening Ritual' }]), markClock).split('\n');
    expect(text[0]).toBe('1. Opening Ritual: Beat 1 · take 2 ★');
    expect(text[2]).toMatch(/^3\. .*: Full episode · take 1 \(1:10\.5–2:10\.0\)$/);
    expect(text[4]).toMatch(/no take yet/);
  });

  test('picks are kept on this device', () => {
    expect(readPicks('ep1')).toEqual({});
    expect(writePicks('ep1', { 1: 'a' })).toBe(true);
    expect(readPicks('ep1')).toEqual({ 1: 'a' });
  });
});

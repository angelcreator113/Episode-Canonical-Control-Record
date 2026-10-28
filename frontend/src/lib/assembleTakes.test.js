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

// Where a video starts and ends (Evoni, 2026-10-28): her 22-minute take
// covers beats 1-11 and a second take beats 10-14 (beats 1-9 at 0:00 in it).
describe('overlapping full-episode takes', () => {
  const twentyTwo = { id: 'f22', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 1320,
    beat_marks: Array.from({ length: 11 }, (_, i) => ({ beat: i + 1, t: i * 110 })) };
  const second = { id: 'f8', performer: 'justawoman', label: 'Full episode · take 2', duration_seconds: 480,
    beat_marks: [...Array.from({ length: 9 }, (_, i) => ({ beat: i + 1, t: 0 })), { beat: 10, t: 9.4 }, { beat: 11, t: 10.4 }, { beat: 12, t: 162.5 }, { beat: 13, t: 239.2 }, { beat: 14, t: 399.3 }] };

  test('each beat both takes cover lists both stretches to choose from', () => {
    for (const beat of [10, 11]) {
      const opts = beatOptions([twentyTwo, second], beat);
      expect(opts.map((o) => o.key)).toEqual([`f8@${beat}`, `f22@${beat}`]);
    }
    expect(beatOptions([twentyTwo, second], 11).map((o) => [o.start, o.end])).toEqual([[10.4, 162.5], [1100, 1320]]);
    expect(beatOptions([twentyTwo, second], 10).find((o) => o.key === 'f8@10')).toMatchObject({ start: 9.4, end: 10.4 });
    // Picking the second take for beat 11 sticks; the rest stay where they were.
    const rows = assembly([twentyTwo, second], [], { 11: 'f8@11' });
    expect(rows[10].pick.key).toBe('f8@11');
    expect(rows[10].options).toHaveLength(2);
    expect(rows[13].pick.key).toBe('f8@14');
  });

  test('beats the second take was moved past at 0:00 are not stretches of it', () => {
    for (let beat = 1; beat <= 9; beat += 1) {
      expect(beatOptions([twentyTwo, second], beat).map((o) => o.key)).toEqual([`f22@${beat}`]);
    }
  });
});

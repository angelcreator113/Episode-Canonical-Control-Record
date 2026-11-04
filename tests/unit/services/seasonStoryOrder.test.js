/**
 * The season's story order (services/seasonStoryOrder; Lala's Phone phase 7
 * ruling G1, PR 0): the pure ordering and the carry-over set, without the
 * database.
 */
const { orderEntries, precedingEpisodes } = require('../../../src/services/seasonStoryOrder');

const ARC1 = { id: 'arc-1', arc_number: 1, season_number: 1 };
const ARC2 = { id: 'arc-2', arc_number: 2, season_number: 2 };
const slot = (id, n, ep, arc = 'arc-1', season = 1) => ({ id, arc_id: arc, season_number: season, slot_number: n, episode_id: ep });
const ep = (id, number, accepted = true) => ({ id, episode_number: number, evaluation_status: accepted ? 'accepted' : 'computed', title: id });
const ids = (order) => order.entries.map((e) => e.episode_id);

describe('orderEntries', () => {
  test('weekly slots in slot order, not episode_number order', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s2', 2, 'e-a'), slot('s1', 1, 'e-b'), slot('s3', 3, 'e-c')],
      episodes: [ep('e-a', 1), ep('e-b', 9), ep('e-c', 3)],
    });
    expect(ids(out)).toEqual(['e-b', 'e-a', 'e-c']);
    expect(out.entries.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(out.entries.every((e) => e.kind === 'weekly' && e.continuity === 'canonical')).toBe(true);
    expect(out.issues).toEqual([]);
  });

  test('a bonus sits right after the slot it follows, whatever its episode_number; it is canonical (N2)', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1'), slot('s2', 2, 'e2')],
      specials: [{ id: 'sp-b', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e-bonus' }],
      episodes: [ep('e1', 1), ep('e2', 2), ep('e-bonus', 40)],
    });
    expect(ids(out)).toEqual(['e1', 'e-bonus', 'e2']);
    const bonus = out.entries[1];
    expect(bonus).toMatchObject({ kind: 'bonus', after_slot_number: 1, continuity: 'canonical', order_ambiguous: false });
    expect(out.issues).toEqual([]);
  });

  test('a special after 0 comes before the first slot; its special_type passes through as information', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1')],
      specials: [{ id: 'sp-r', arc_id: 'arc-1', kind: 'special', special_type: 'recap', after_slot_number: 0, episode_id: 'e-recap' }],
      episodes: [ep('e1', 1), ep('e-recap', 2)],
    });
    expect(ids(out)).toEqual(['e-recap', 'e1']);
    expect(out.entries[0]).toMatchObject({ kind: 'special', special_type: 'recap', continuity: 'needs_review' });
  });

  test('two specials after one slot: release date and time, then creation; both marked ambiguous and reported (N1)', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1'), slot('s2', 2, 'e2')],
      specials: [
        { id: 'sp-late', arc_id: 'arc-1', kind: 'special', after_slot_number: 1, episode_id: 'e-late', release_date: '2026-11-12', release_time: '19:00' },
        { id: 'sp-early', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e-early', release_date: '2026-11-11', release_time: '19:00' },
      ],
      episodes: [ep('e1', 1), ep('e2', 2), ep('e-late', 3), ep('e-early', 4)],
    });
    expect(ids(out)).toEqual(['e1', 'e-early', 'e-late', 'e2']);
    expect(out.entries.filter((e) => e.order_ambiguous).map((e) => e.special_id).sort()).toEqual(['sp-early', 'sp-late']);
    expect(out.issues).toContainEqual({ code: 'same_slot', arc_id: 'arc-1', after_slot_number: 1, special_ids: expect.arrayContaining(['sp-early', 'sp-late']) });
  });

  test("a two-parter's halves stay in their own slots, canonical, marked part 1 and 2", () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s12', 12, 'e12'), slot('s13', 13, 'e13')],
      specials: [{ id: 'tp', arc_id: 'arc-1', kind: 'two_part', part_one_slot_id: 's12', part_two_slot_id: 's13' }],
      episodes: [ep('e12', 12), ep('e13', 13)],
    });
    expect(out.entries.map((e) => [e.episode_id, e.kind, e.part, e.continuity])).toEqual([
      ['e12', 'two_part', 1, 'canonical'],
      ['e13', 'two_part', 2, 'canonical'],
    ]);
  });

  test('across seasons by season, then arc; a slot whose arc is gone is ordered last in its season and reported', () => {
    const out = orderEntries({
      arcs: [ARC2, ARC1],
      slots: [slot('s2-1', 1, 'e-s2', 'arc-2', 2), slot('s1-1', 1, 'e-s1'), slot('lost', 5, 'e-lost', 'arc-gone', 1)],
      episodes: [ep('e-s2', 1), ep('e-s1', 2), ep('e-lost', 3)],
    });
    expect(ids(out)).toEqual(['e-s1', 'e-lost', 'e-s2']);
    expect(out.issues).toContainEqual({ code: 'arc_missing', slot_id: 'lost', arc_id: 'arc-gone' });
  });

  test('episodes no slot or special holds are listed apart, never placed by episode_number; a planned slot keeps its place', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1'), slot('s2', 2, null)],
      episodes: [ep('e1', 1), ep('e-free', 2, false)],
    });
    expect(ids(out)).toEqual(['e1', null]);
    expect(out.unslotted).toEqual([{ episode_id: 'e-free', episode_number: 2, title: 'e-free', accepted: false }]);
    expect(out.issues).toContainEqual({ code: 'unslotted', episode_ids: ['e-free'] });
  });

  test('an episode held in two places is reported', () => {
    const out = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1')],
      specials: [{ id: 'sp', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e1' }],
      episodes: [ep('e1', 1)],
    });
    expect(out.issues).toContainEqual({ code: 'episode_in_two_places', episode_id: 'e1', positions: [1, 2] });
  });
});

describe('precedingEpisodes', () => {
  const order = orderEntries({
    arcs: [ARC1],
    slots: [slot('s1', 1, 'e1'), slot('s2', 2, 'e2'), slot('s3', 3, 'e3'), slot('s4', 4, 'e4')],
    specials: [{ id: 'sp', arc_id: 'arc-1', kind: 'special', after_slot_number: 1, episode_id: 'e-sp' }],
    episodes: [ep('e1', 1), ep('e-sp', 2), ep('e2', 3, false), ep('e3', 4), ep('e4', 5)],
  });

  test('canonical and accepted only, in story order; the rest excluded with the reason', () => {
    const out = precedingEpisodes(order, 'e4');
    expect(out.found).toBe(true);
    expect(out.episodes.map((e) => [e.episode_id, e.simulated])).toEqual([['e1', false], ['e3', false]]);
    expect(out.excluded).toEqual([
      { episode_id: 'e-sp', position: 2, reason: 'needs_review' },
      { episode_id: 'e2', position: 3, reason: 'not_accepted' },
    ]);
  });

  test('Preview Draft Continuity adds the unaccepted ones, marked simulated; specials needing review stay out', () => {
    const out = precedingEpisodes(order, 'e4', { includeUnaccepted: true });
    expect(out.episodes.map((e) => [e.episode_id, e.simulated])).toEqual([['e1', false], ['e2', true], ['e3', false]]);
    expect(out.excluded).toEqual([{ episode_id: 'e-sp', position: 2, reason: 'needs_review' }]);
  });

  test('an accepted bonus carries like a weekly episode (N2); an unaccepted one is excluded as not accepted', () => {
    const withBonus = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1'), slot('s2', 2, 'e2'), slot('s3', 3, 'e3')],
      specials: [
        { id: 'b-ok', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e-b1' },
        { id: 'b-draft', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 2, episode_id: 'e-b2' },
      ],
      episodes: [ep('e1', 1), ep('e-b1', 40), ep('e2', 2), ep('e-b2', 41, false), ep('e3', 3)],
    });
    const out = precedingEpisodes(withBonus, 'e3');
    expect(out.episodes.map((e) => e.episode_id)).toEqual(['e1', 'e-b1', 'e2']);
    expect(out.excluded).toEqual([{ episode_id: 'e-b2', position: 4, reason: 'not_accepted' }]);
  });

  test('two bonuses after one slot are never carried while their order is ambiguous (N1)', () => {
    const tied = orderEntries({
      arcs: [ARC1],
      slots: [slot('s1', 1, 'e1'), slot('s2', 2, 'e2')],
      specials: [
        { id: 'b-1', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e-b1' },
        { id: 'b-2', arc_id: 'arc-1', kind: 'bonus', after_slot_number: 1, episode_id: 'e-b2' },
      ],
      episodes: [ep('e1', 1), ep('e-b1', 40), ep('e-b2', 41), ep('e2', 2)],
    });
    const out = precedingEpisodes(tied, 'e2');
    expect(out.episodes.map((e) => e.episode_id)).toEqual(['e1']);
    expect(out.excluded.map((x) => [x.episode_id, x.reason]).sort()).toEqual([['e-b1', 'order_ambiguous'], ['e-b2', 'order_ambiguous']]);
    expect(precedingEpisodes(tied, 'e2', { includeUnaccepted: true }).episodes.map((e) => e.episode_id)).toEqual(['e1']);
  });

  test('the first episode carries nothing; an episode not in the order is not found', () => {
    expect(precedingEpisodes(order, 'e1')).toEqual({ found: true, episodes: [], excluded: [] });
    expect(precedingEpisodes(order, 'nope')).toEqual({ found: false, episodes: [], excluded: [] });
  });
});

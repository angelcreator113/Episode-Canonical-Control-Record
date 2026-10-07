/**
 * Producer Mode → Assets → Scene Sets, to Evoni's mock (2026-10-07): the
 * header tiles, the category counts, the sections the cards sit in, a
 * card's angle line, and the one hint about a set an episode uses that is
 * short of angles. Pure: SceneSetsTab renders.
 *
 * An angle counts as made when its generation_status is 'complete' (an
 * uploaded angle is marked complete too). The total is the angles the sets
 * have; a set with none planned adds nothing to it.
 */

export const TYPE_ORDER = ['HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION', 'OTHER'];

export const SECTIONS = {
  HOME_BASE: { title: 'Home base', line: 'Where Lala lives' },
  CLOSET: { title: 'Closet', line: 'Where the looks come from' },
  EVENT_LOCATION: { title: 'Events', line: 'The look of each event venue' },
  TRANSITION: { title: 'Transitions', line: 'Between one place and the next' },
  OTHER: { title: 'Other', line: 'Everywhere else' },
};

const typeOf = (set) => (TYPE_ORDER.includes(set?.scene_type) ? set.scene_type : 'OTHER');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A set's angles made and planned. */
export function angleCounts(set) {
  const angles = set?.angles || [];
  return { made: angles.filter((a) => a.generation_status === 'complete').length, total: angles.length };
}

/** The card's angle line: "3 of 8 angles", "8 angles", or "No angles yet". */
export function angleLine(set) {
  const { made, total } = angleCounts(set);
  if (!total) return 'No angles yet';
  return made === total ? plural(total, 'angle') : `${made} of ${plural(total, 'angle')}`;
}

/** The header tiles: sets, angles made of planned, credits used. */
export function sceneSetTiles(sets) {
  const list = sets || [];
  let made = 0;
  let total = 0;
  let credits = 0;
  list.forEach((s) => {
    const c = angleCounts(s);
    made += c.made;
    total += c.total;
    credits += parseFloat(s.generation_cost || 0) || 0;
    (s.angles || []).forEach((a) => { credits += parseFloat(a.generation_cost || 0) || 0; });
  });
  return [
    { key: 'sets', value: String(list.length), label: list.length === 1 ? 'set' : 'sets' },
    { key: 'angles', value: `${made}/${total}`, label: 'angles made' },
    { key: 'credits', value: credits.toFixed(1), label: 'credits used' },
  ];
}

/** How many sets of each type, and all of them. */
export function typeCounts(sets) {
  const counts = { ALL: (sets || []).length };
  TYPE_ORDER.forEach((t) => { counts[t] = 0; });
  (sets || []).forEach((s) => { counts[typeOf(s)] += 1; });
  return counts;
}

/** The cards in sections, by type in TYPE_ORDER, keeping each section's order; empty sections dropped. */
export function sectionsOf(sets) {
  return TYPE_ORDER
    .map((type) => ({ type, ...SECTIONS[type], sets: (sets || []).filter((s) => typeOf(s) === type) }))
    .filter((sec) => sec.sets.length > 0);
}

/** "Episode 1", "Episodes 1 and 3", from the episodes a set is linked to. */
export function episodeChips(set) {
  return (set?.episodes || [])
    .map((e) => e.episode_number)
    .filter((n) => n != null)
    .sort((a, b) => a - b)
    .map((n) => `Episode ${n}`);
}

/**
 * The hint: the first set an episode uses whose planned angles are not all
 * made. Scenes there can cut between the main picture and its made angles,
 * so "only have one shot" when none are made.
 */
export function angleHint(sets) {
  const set = (sets || []).find((s) => {
    const { made, total } = angleCounts(s);
    return (s.episodes || []).length > 0 && total > 0 && made < total;
  });
  if (!set) return null;
  const { made, total } = angleCounts(set);
  const eps = episodeChips(set);
  const who = eps.length === 1 ? `${eps[0]} uses it` : `${eps.length} episodes use it`;
  const shots = (set.base_still_url ? 1 : 0) + made;
  const cut = shots === 0 ? 'no shot to cut to yet' : shots === 1 ? 'one shot to cut to' : `${shots} shots to cut between`;
  return {
    setId: set.id,
    lead: `${set.name} has ${made} of ${plural(total, 'angle')}.`,
    text: `${who}, so scenes there only have ${cut}.`,
  };
}

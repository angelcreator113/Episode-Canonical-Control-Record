'use strict';

/**
 * The season's story order: the one resolver for "which episodes come
 * before this one in the story" (Lala's Phone phase 7, ruling G1, Evoni
 * 2026-11-04; docs/reads/2026-11-04-phone-phase7-read.md §22-§24, PR 0).
 * Read only: it writes nothing and changes no other ordering. The story
 * clock (storyClock, episode_number × 10 + phase), the Career list and
 * the release schedule keep their own; where they disagree with this
 * order, that is reported separately (G1), not fixed here.
 *
 * The order, per show:
 *   1. seasons by number; within a season, its arcs by arc_number
 *      (show_arcs);
 *   2. within an arc, its weekly slots by slot_number (season_slots,
 *      unique per arc and slot number);
 *   3. a bonus or stand-alone special (season_specials) immediately after
 *      the slot it follows (after_slot_number; 0 is before the first);
 *   4. a two-parter's halves are their own weekly slots, marked part 1/2.
 *
 * Two specials after the same slot have no stored order between them
 * (blocker N1): they are put in release date and time, then creation
 * order, and each is marked `order_ambiguous` with a `same_slot` issue,
 * never silently treated as settled.
 *
 * Continuity (ruling G2): weekly slots and two-parters are canonical. A
 * bonus (blocker N2) or a special has no stored class yet (the
 * season_specials migration is a separate approval), so each is
 * `needs_review`: excluded from canonical carry-over and reported. A
 * special's special_type is passed through as information only (N3).
 *
 * Episodes no slot or special holds are `unslotted`, listed apart and
 * never placed by episode_number.
 *
 *   seasonStoryOrder(sequelize, showId)  → { entries, unslotted, issues }
 *   orderEntries({ arcs, slots, specials, episodes })  the same, pure
 *   precedingEpisodes(order, episodeId, { includeUnaccepted })
 *       the entries before an episode that carry state into it: canonical
 *       and accepted (evaluation_status 'accepted', the Complete flow's
 *       mark); with includeUnaccepted (Preview Draft Continuity, G4) the
 *       unaccepted ones too, each marked simulated. Never writes.
 */

const CANONICAL = 'canonical';
const NEEDS_REVIEW = 'needs_review';

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v) => (v == null ? '' : String(v));

function compareKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i]; const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return str(x) < str(y) ? -1 : 1;
  }
  return 0;
}

/**
 * The story order from rows already read. Pure.
 * @param {object} rows
 *   arcs      [{ id, arc_number, season_number }]
 *   slots     [{ id, arc_id, season_number, slot_number, episode_id }]
 *   specials  [{ id, arc_id, kind, after_slot_number, special_type, episode_id,
 *                release_date, release_time, part_one_slot_id, part_two_slot_id, created_at }]
 *   episodes  [{ id, episode_number, evaluation_status, title }]
 */
function orderEntries({ arcs = [], slots = [], specials = [], episodes = [] } = {}) {
  const issues = [];
  const arcById = new Map(arcs.map((a) => [str(a.id), a]));
  const episodeById = new Map(episodes.map((e) => [str(e.id), e]));
  const twoPartBySlot = new Map();
  for (const sp of specials) {
    if (sp.kind !== 'two_part') continue;
    if (sp.part_one_slot_id) twoPartBySlot.set(str(sp.part_one_slot_id), { special_id: sp.id, part: 1 });
    if (sp.part_two_slot_id) twoPartBySlot.set(str(sp.part_two_slot_id), { special_id: sp.id, part: 2 });
  }
  const arcPlace = (arcId, fallbackSeason) => {
    const arc = arcById.get(str(arcId));
    if (!arc) return { season: num(fallbackSeason, 1), arc: Number.MAX_SAFE_INTEGER, known: false };
    return { season: num(arc.season_number ?? fallbackSeason, 1), arc: num(arc.arc_number, 1), known: true };
  };
  const episodeView = (id) => {
    const ep = id ? episodeById.get(str(id)) : null;
    return {
      episode_id: id || null,
      episode_number: ep?.episode_number ?? null,
      title: ep?.title ?? null,
      accepted: ep?.evaluation_status === 'accepted',
    };
  };

  const rows = [];
  for (const s of slots) {
    const at = arcPlace(s.arc_id, s.season_number);
    if (!at.known) issues.push({ code: 'arc_missing', slot_id: s.id, arc_id: s.arc_id });
    const tp = twoPartBySlot.get(str(s.id));
    rows.push({
      key: [at.season, at.arc, num(s.slot_number), 0, '', '', '', ''],
      kind: tp ? 'two_part' : 'weekly',
      part: tp ? tp.part : null,
      special_id: tp ? tp.special_id : null,
      slot_id: s.id,
      arc_id: s.arc_id,
      season_number: at.season,
      slot_number: num(s.slot_number),
      after_slot_number: null,
      special_type: null,
      continuity: CANONICAL,
      order_ambiguous: false,
      ...episodeView(s.episode_id),
    });
  }

  const sameSlot = new Map();
  for (const sp of specials) {
    if (sp.kind !== 'bonus' && sp.kind !== 'special') continue;
    const at = arcPlace(sp.arc_id, null);
    if (!at.known) issues.push({ code: 'arc_missing', special_id: sp.id, arc_id: sp.arc_id });
    const after = num(sp.after_slot_number);
    const row = {
      key: [at.season, at.arc, after, 1, str(sp.release_date), str(sp.release_time), str(sp.created_at), str(sp.id)],
      kind: sp.kind,
      part: null,
      special_id: sp.id,
      slot_id: null,
      arc_id: sp.arc_id,
      season_number: at.season,
      slot_number: null,
      after_slot_number: after,
      special_type: sp.special_type || null,
      continuity: NEEDS_REVIEW,
      order_ambiguous: false,
      ...episodeView(sp.episode_id),
    };
    rows.push(row);
    const k = `${str(sp.arc_id)}:${after}`;
    sameSlot.set(k, [...(sameSlot.get(k) || []), row]);
  }
  for (const group of sameSlot.values()) {
    if (group.length < 2) continue;
    for (const row of group) row.order_ambiguous = true;
    issues.push({ code: 'same_slot', arc_id: group[0].arc_id, after_slot_number: group[0].after_slot_number, special_ids: group.map((r) => r.special_id) });
  }
  for (const row of rows) {
    if (row.continuity === NEEDS_REVIEW && row.episode_id) issues.push({ code: 'continuity_needs_review', special_id: row.special_id, kind: row.kind, episode_id: row.episode_id });
  }

  rows.sort((a, b) => compareKeys(a.key, b.key));
  const seen = new Map();
  const entries = rows.map(({ key: _key, ...row }, i) => {
    const entry = { position: i + 1, ...row };
    if (entry.episode_id) {
      const k = str(entry.episode_id);
      if (seen.has(k)) issues.push({ code: 'episode_in_two_places', episode_id: entry.episode_id, positions: [seen.get(k), entry.position] });
      else seen.set(k, entry.position);
    }
    return entry;
  });

  const unslotted = episodes
    .filter((e) => !seen.has(str(e.id)))
    .map((e) => ({ episode_id: e.id, episode_number: e.episode_number ?? null, title: e.title ?? null, accepted: e.evaluation_status === 'accepted' }));
  if (unslotted.length) issues.push({ code: 'unslotted', episode_ids: unslotted.map((u) => u.episode_id) });
  return { entries, unslotted, issues };
}

/** The show's story order, read from the database. Read only. */
async function seasonStoryOrder(sequelize, showId, { transaction } = {}) {
  const q = (sql) => sequelize.query(sql, { replacements: { showId }, type: sequelize.QueryTypes.SELECT, transaction });
  const arcs = await q('SELECT id, arc_number, season_number FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL');
  const slots = await q('SELECT id, arc_id, season_number, slot_number, episode_id FROM season_slots WHERE show_id = :showId AND deleted_at IS NULL');
  const episodes = await q('SELECT id, episode_number, evaluation_status, title FROM episodes WHERE show_id = :showId AND deleted_at IS NULL');
  const { specialsReady, TABLE } = require('./seasonSpecials');
  const specials = (await specialsReady(sequelize, { transaction }))
    ? await q(`SELECT id, arc_id, kind, after_slot_number, special_type, episode_id, release_date, release_time,
                      part_one_slot_id, part_two_slot_id, created_at
                 FROM ${TABLE} WHERE show_id = :showId AND deleted_at IS NULL`)
    : [];
  return orderEntries({ arcs, slots, specials, episodes });
}

/**
 * What carries state into an episode: the entries before it, canonical, and
 * accepted (or, with includeUnaccepted, also the unaccepted ones, marked
 * simulated). Pure; never writes.
 * @returns {{ found, episodes, excluded }}
 *   episodes  [{ ...entry, simulated }] in story order
 *   excluded  [{ episode_id, position, reason: 'needs_review' | 'not_accepted' }]
 */
function precedingEpisodes(order, episodeId, { includeUnaccepted = false } = {}) {
  const entries = order?.entries || [];
  const at = entries.find((e) => e.episode_id && str(e.episode_id) === str(episodeId));
  if (!at) return { found: false, episodes: [], excluded: [] };
  const carried = [];
  const excluded = [];
  for (const e of entries) {
    if (e.position >= at.position) break;
    if (!e.episode_id) continue;
    if (e.continuity !== CANONICAL) { excluded.push({ episode_id: e.episode_id, position: e.position, reason: e.continuity }); continue; }
    if (!e.accepted && !includeUnaccepted) { excluded.push({ episode_id: e.episode_id, position: e.position, reason: 'not_accepted' }); continue; }
    carried.push({ ...e, simulated: !e.accepted });
  }
  return { found: true, episodes: carried, excluded };
}

module.exports = { seasonStoryOrder, orderEntries, precedingEpisodes, CANONICAL, NEEDS_REVIEW };

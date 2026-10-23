'use strict';

/**
 * Season twists (Evoni, 2026-10-23: the approved plan "from a finished
 * script to the story to the next episode", PR 3; "Season twists as their
 * own list").
 *
 * A twist is planted in one season slot and paid off in a later one
 * (season_twists). The script writer for the plant slot's episode is told
 * to plant it, subtly and unexplained; the writer for the payoff slot's
 * episode is told to pay it off, with the episode it was planted in. The
 * reveal plan (services/seasonRevealPlan, season_reveals) is unchanged: it
 * plans the characters' kept secrets; twists are the season's own.
 * The list checks itself: a payoff before (or in) its plant episode, a
 * payoff with no plant, a slot no longer in the season, paid off but never
 * planted.
 *
 *   getTwists(sequelize, showId)                     { arc, slots, threads, characters, twists, warnings }
 *   setTwist(sequelize, showId, body, { by })        adds one, or changes it (body.id)
 *   deleteTwist(sequelize, showId, twistId)          soft delete
 *   restoreTwist(sequelize, showId, twistId)         undoes a delete
 *   twistsForEpisode(sequelize, episodeId)           { plant: [...], payoff: [...] } for the episode's slot
 *   twistBlock(sequelize, episodeId)                 the episode's twists, as prompt text for the script writer; ''
 *   checkTwists(twists)                              what is wrong with the list
 *
 * Raw SQL (season_twists, migration 20261023200000); no model.
 */

const { episodeLabel } = require('./seasonSlotService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['planned', 'planted', 'paid_off', 'dropped'];
const MAX_LINKS = 20;

class TwistError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'TwistError'; }
}

const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[seasonTwists] unreadable JSON:', err.message);
    return fallback;
  }
};
const ids = (v) => {
  const list = parse(v, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
};
const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

async function activeArc(sequelize, showId) {
  const [[arc]] = await sequelize.query(
    `SELECT id, title, tagline, season_number FROM show_arcs
      WHERE show_id = :showId AND deleted_at IS NULL ORDER BY (status = 'active') DESC, arc_number ASC LIMIT 1`,
    { replacements: { showId } });
  return arc || null;
}

async function showThreads(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT id, title, status FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL
      ORDER BY (status = 'closed') ASC, created_at DESC`, { replacements: { showId } });
  return rows;
}

/** Everyone in a registry of the show. */
async function showCharacters(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT rc.id, COALESCE(rc.selected_name, rc.display_name) AS name
       FROM registry_characters rc
       JOIN character_registries cr ON cr.id = rc.registry_id AND cr.deleted_at IS NULL
      WHERE cr.show_id = :showId AND rc.deleted_at IS NULL
      ORDER BY COALESCE(rc.selected_name, rc.display_name)`, { replacements: { showId } });
  return rows;
}

/**
 * What is wrong with the list. Each twist carries `plant` and `payoff`: its
 * slots as { slot_number, label, done }, or null when the slot is not in the
 * season (payoff null with payoff_slot_id null is simply undecided).
 */
function checkTwists(twists) {
  const warnings = [];
  for (const t of twists || []) {
    if (t.status === 'dropped') continue;
    const name = `"${t.title}"`;
    const add = (msg) => warnings.push({ twist_id: t.id, text: msg });
    if (!t.plant) {
      add(t.payoff ? `${name} is paid off in ${t.payoff.label} with no plant: its plant episode is no longer in the season.`
        : `${name}: the episode it is planted in is no longer in the season.`);
    }
    if (t.payoff_slot_id && !t.payoff) add(`${name}: the episode it is paid off in is no longer in the season.`);
    if (t.plant && t.payoff) {
      if (t.payoff.slot_number < t.plant.slot_number) add(`${name} is paid off in ${t.payoff.label}, before it is planted in ${t.plant.label}.`);
      else if (t.payoff.slot_number === t.plant.slot_number) add(`${name} is planted and paid off in the same episode, ${t.plant.label}. Pay it off later.`);
    }
    if (t.status === 'paid_off' && !t.planted_episode_id) add(`${name} is marked paid off but was never planted in an episode.`);
  }
  return warnings;
}

async function seasonSlots(sequelize, arc) {
  const [rows] = await sequelize.query(
    `SELECT s.id, s.slot_number, s.phase, s.story_purpose, s.accepted_at, ep.id AS episode_id, ep.title AS episode_title
       FROM season_slots s LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL ORDER BY s.slot_number`, { replacements: { arcId: arc.id } });
  return rows.map((s) => ({
    id: s.id, slot_number: s.slot_number, phase: s.phase, label: episodeLabel(arc.season_number, s.slot_number), story_purpose: s.story_purpose,
    episode: s.episode_id ? { id: s.episode_id, title: s.episode_title } : null, done: Boolean(s.accepted_at),
  }));
}

/** The season's slots, the show's threads and characters, the twists and what is wrong with them. */
async function getTwists(sequelize, showId) {
  if (!UUID_RE.test(String(showId || ''))) throw new TwistError('showId must be a UUID');
  const arc = await activeArc(sequelize, showId);
  if (!arc) return { arc: null, slots: [], threads: [], characters: [], twists: [], warnings: [] };
  const slots = await seasonSlots(sequelize, arc);
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const [rows] = await sequelize.query(
    `SELECT id, arc_id, title, description, plant_slot_id, payoff_slot_id, status, thread_ids, character_ids,
            planted_episode_id, paid_off_episode_id, note, created_at
       FROM season_twists
      WHERE show_id = :showId AND deleted_at IS NULL AND (arc_id = :arcId OR arc_id IS NULL)
      ORDER BY created_at`, { replacements: { showId, arcId: arc.id } });
  const slotOf = (id) => {
    const s = id && slotById.get(id);
    return s ? { id: s.id, slot_number: s.slot_number, label: s.label, episode: s.episode, done: s.done } : null;
  };
  const twists = rows.map((r) => ({
    id: r.id, title: r.title, description: r.description, status: r.status, note: r.note,
    plant_slot_id: r.plant_slot_id, payoff_slot_id: r.payoff_slot_id || null,
    plant: slotOf(r.plant_slot_id), payoff: slotOf(r.payoff_slot_id),
    thread_ids: ids(r.thread_ids), character_ids: ids(r.character_ids),
    planted_episode_id: r.planted_episode_id || null, paid_off_episode_id: r.paid_off_episode_id || null,
  })).sort((a, b) => (a.plant?.slot_number ?? Infinity) - (b.plant?.slot_number ?? Infinity));
  return {
    arc: { id: arc.id, title: arc.title, tagline: arc.tagline, season_number: arc.season_number || 1 },
    slots,
    threads: await showThreads(sequelize, showId),
    characters: await showCharacters(sequelize, showId),
    twists,
    warnings: checkTwists(twists),
  };
}

/** The links asked for, each one the show's; a TwistError naming what is not. */
function links(value, allowed, what) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TwistError(`${what} must be a list.`);
  const list = [...new Set(value.map(String))];
  if (list.length > MAX_LINKS) throw new TwistError(`Link at most ${MAX_LINKS} ${what.toLowerCase()}.`);
  const known = new Set(allowed.map((x) => String(x.id)));
  if (list.some((id) => !known.has(id))) throw new TwistError(`That ${what === 'Threads' ? 'thread' : 'character'} is not in this show.`, 404);
  return list;
}

/** Adds a twist, or changes one (body.id); a TwistError when it does not fit the show's season. */
async function setTwist(sequelize, showId, body = {}, { by = null } = {}) {
  if (!UUID_RE.test(String(showId || ''))) throw new TwistError('showId must be a UUID');
  let existing = null;
  if (body.id !== undefined && body.id !== null && body.id !== '') {
    if (!UUID_RE.test(String(body.id))) throw new TwistError('twistId must be a UUID');
    [[existing]] = await sequelize.query(
      `SELECT id, plant_slot_id, payoff_slot_id, status, planted_episode_id, paid_off_episode_id
         FROM season_twists WHERE id = :id AND show_id = :showId AND deleted_at IS NULL`, { replacements: { id: body.id, showId } });
    if (!existing) throw new TwistError('That twist is not in this show\'s season.', 404);
  }
  const title = text(body.title, 200);
  if (!title) throw new TwistError('Give the twist a title.');
  const description = text(body.description, 2000);
  const note = text(body.note, 500);
  const status = body.status || existing?.status || 'planned';
  if (!STATUSES.includes(status)) throw new TwistError('A twist is planned, planted, paid off or dropped.');
  if (!UUID_RE.test(String(body.plant_slot_id || ''))) throw new TwistError('Choose the episode that plants it.');
  const payoffId = body.payoff_slot_id ? String(body.payoff_slot_id) : null;
  if (payoffId && !UUID_RE.test(payoffId)) throw new TwistError('Choose the episode that pays it off, or leave it for later.');

  const [slotRows] = await sequelize.query(
    `SELECT id, arc_id, slot_number, episode_id, accepted_at FROM season_slots
      WHERE id IN (:ids) AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { ids: [body.plant_slot_id, payoffId].filter(Boolean), showId } });
  const plant = slotRows.find((s) => s.id === body.plant_slot_id);
  const payoff = payoffId ? slotRows.find((s) => s.id === payoffId) : null;
  if (!plant || (payoffId && !payoff)) throw new TwistError('That slot is not in this show\'s season.', 404);
  if (payoff && payoff.arc_id !== plant.arc_id) throw new TwistError('Plant it and pay it off in the same season.');
  if (payoff && Number(payoff.slot_number) <= Number(plant.slot_number)) throw new TwistError('The payoff comes after the plant: choose a later episode to pay it off.');
  const done = (slot, was) => slot && slot.accepted_at && slot.id !== was;
  if (done(plant, existing?.plant_slot_id) || done(payoff, existing?.payoff_slot_id)) {
    throw new TwistError('That episode is done; plant or pay off in an episode still to come.', 409);
  }
  if (status === 'paid_off' && !payoff) throw new TwistError('Choose the episode that pays it off before marking it paid off.');

  const threadIds = links(body.thread_ids, body.thread_ids?.length ? await showThreads(sequelize, showId) : [], 'Threads');
  const characterIds = links(body.character_ids, body.character_ids?.length ? await showCharacters(sequelize, showId) : [], 'Characters');

  // The episodes that did it: kept once known, read from the slots when the
  // status says so, cleared when the twist goes back to planned.
  const keep = status === 'dropped';
  const plantedEpisode = ['planted', 'paid_off'].includes(status) ? (existing?.planted_episode_id || plant.episode_id || null)
    : keep ? (existing?.planted_episode_id || null) : null;
  const paidOffEpisode = status === 'paid_off' ? (existing?.paid_off_episode_id || payoff.episode_id || null)
    : keep ? (existing?.paid_off_episode_id || null) : null;

  const replacements = {
    showId, arcId: plant.arc_id, title, description, note, status, plant: plant.id, payoff: payoff ? payoff.id : null,
    threads: JSON.stringify(threadIds), characters: JSON.stringify(characterIds), planted: plantedEpisode, paidOff: paidOffEpisode, by,
  };
  if (existing) {
    await sequelize.query(
      `UPDATE season_twists SET arc_id = :arcId, title = :title, description = :description, note = :note, status = :status,
              plant_slot_id = :plant, payoff_slot_id = :payoff, thread_ids = CAST(:threads AS jsonb), character_ids = CAST(:characters AS jsonb),
              planted_episode_id = :planted, paid_off_episode_id = :paidOff, updated_at = NOW()
        WHERE id = :id`, { replacements: { ...replacements, id: existing.id } });
  } else {
    await sequelize.query(
      `INSERT INTO season_twists (show_id, arc_id, title, description, note, status, plant_slot_id, payoff_slot_id, thread_ids, character_ids,
              planted_episode_id, paid_off_episode_id, created_by, created_at, updated_at)
       VALUES (:showId, :arcId, :title, :description, :note, :status, :plant, :payoff, CAST(:threads AS jsonb), CAST(:characters AS jsonb),
              :planted, :paidOff, :by, NOW(), NOW())`, { replacements });
  }
  return getTwists(sequelize, showId);
}

async function deleteTwist(sequelize, showId, twistId) {
  if (!UUID_RE.test(String(twistId || ''))) throw new TwistError('twistId must be a UUID');
  const [rows] = await sequelize.query(
    'UPDATE season_twists SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND show_id = :showId AND deleted_at IS NULL RETURNING id',
    { replacements: { id: twistId, showId } });
  if (!rows.length) throw new TwistError('That twist is not in this show\'s season.', 404);
  return getTwists(sequelize, showId);
}

/** Undo for a delete: the twist back as it was. */
async function restoreTwist(sequelize, showId, twistId) {
  if (!UUID_RE.test(String(twistId || ''))) throw new TwistError('twistId must be a UUID');
  const [rows] = await sequelize.query(
    'UPDATE season_twists SET deleted_at = NULL, updated_at = NOW() WHERE id = :id AND show_id = :showId AND deleted_at IS NOT NULL RETURNING id',
    { replacements: { id: twistId, showId } });
  if (!rows.length) throw new TwistError('There is no deleted twist to bring back.', 404);
  return getTwists(sequelize, showId);
}

/**
 * The slot's twists from rows that plant or pay off there: a payoff only
 * when its plant comes first (a payoff the plan has not planted is a
 * warning on the Season Plan, never an instruction to the writer).
 */
function twistsForSlot(rows, slot) {
  const live = (rows || []).filter((r) => r.status !== 'dropped');
  const plant = live.filter((r) => r.plant_slot_id === slot.id);
  const payoff = live.filter((r) => r.payoff_slot_id === slot.id && r.plant_number != null && Number(r.plant_number) < Number(slot.slot_number));
  return { plant, payoff };
}

/** What the episode's slot plants and pays off; empty with no slot, none, or no table yet. */
async function twistsForEpisode(sequelize, episodeId) {
  const none = { plant: [], payoff: [] };
  if (!UUID_RE.test(String(episodeId || ''))) return none;
  try {
    const [[slot]] = await sequelize.query(
      'SELECT id, arc_id, slot_number FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId } });
    if (!slot) return none;
    const [rows] = await sequelize.query(
      `SELECT t.id, t.title, t.description, t.status, t.note, t.plant_slot_id, t.payoff_slot_id, t.character_ids,
              p.slot_number AS plant_number, pe.title AS plant_episode_title
         FROM season_twists t
         LEFT JOIN season_slots p ON p.id = t.plant_slot_id AND p.deleted_at IS NULL AND p.arc_id = :arcId
         LEFT JOIN episodes pe ON pe.id = p.episode_id AND pe.deleted_at IS NULL
        WHERE t.deleted_at IS NULL AND (t.plant_slot_id = :slotId OR t.payoff_slot_id = :slotId)
        ORDER BY t.created_at`, { replacements: { slotId: slot.id, arcId: slot.arc_id } });
    const found = twistsForSlot(rows, slot);
    const wanted = [...new Set([...found.plant, ...found.payoff].flatMap((r) => ids(r.character_ids)))].filter((id) => UUID_RE.test(id));
    const names = new Map();
    if (wanted.length) {
      const [people] = await sequelize.query(
        'SELECT id, COALESCE(selected_name, display_name) AS name FROM registry_characters WHERE id IN (:wanted) AND deleted_at IS NULL',
        { replacements: { wanted } });
      for (const p of people) names.set(p.id, p.name);
    }
    const shape = (r) => ({
      id: r.id, title: r.title, description: r.description || null, note: r.note || null, status: r.status,
      characters: ids(r.character_ids).map((id) => names.get(id)).filter(Boolean),
      planted_in: r.plant_number != null ? { episode_number: Number(r.plant_number), title: r.plant_episode_title || null } : null,
    });
    return { plant: found.plant.map(shape), payoff: found.payoff.map(shape) };
  } catch (err) {
    // Before the migration has run the table is not there: the writers go without twists.
    console.error('[seasonTwists] the twists could not be read:', err.message);
    return none;
  }
}

/** The episode's twists as the script writer reads them; '' with none. */
function renderTwistBlock({ plant = [], payoff = [] } = {}) {
  if (!plant.length && !payoff.length) return '';
  const what = (t) => `${t.title}${t.description ? ` — ${t.description}` : ''}`;
  const who = (t) => (t.characters?.length ? ` (with ${t.characters.join(', ')})` : '');
  const how = (t) => (t.note ? ` Note: ${t.note}` : '');
  const lines = ['═══ SEASON TWISTS ═══'];
  for (const t of plant) lines.push(`PLANT (subtly; do not explain): ${what(t)}${who(t)}${how(t)}`);
  for (const t of payoff) lines.push(`PAY OFF: ${what(t)} (planted in episode ${t.planted_in.episode_number})${who(t)}${how(t)}`);
  const directive = [];
  if (plant.length) directive.push('a plant is a detail the audience can notice and nobody explains; never say what it means or what it leads to');
  if (payoff.length) directive.push('a payoff makes the earlier plant land on screen, so the audience connects it without being told');
  lines.push(`SCRIPT DIRECTIVE: ${directive.join('; ')}.`);
  return `${lines.join('\n')}\n`;
}

async function twistBlock(sequelize, episodeId) {
  return renderTwistBlock(await twistsForEpisode(sequelize, episodeId));
}

module.exports = {
  TwistError, STATUSES, getTwists, setTwist, deleteTwist, restoreTwist,
  twistsForEpisode, twistsForSlot, twistBlock, renderTwistBlock, checkTwists,
};

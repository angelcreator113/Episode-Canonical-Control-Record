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
 *   twistsAtSlot(sequelize, slot)                    the same for a slot { id, arc_id, slot_number }
 *   twistBlock(sequelize, episodeId)                 the episode's twists, as prompt text for the script writer; ''
 *   checkTwists(twists)                              what is wrong with the list
 *   markTwist(sequelize, episodeId, twistId, as, { undo })  the Script tab's "Mark planted" / "Mark paid off" (and Undo)
 *   suggestTwists(sequelize, showId)                 3-5 drafts from the AI; nothing saved
 *
 * Twists, 2nd round (Evoni, 2026-10-23): the Script tab lists the twists
 * due in its episode and marks them done there; "Suggest twists" drafts
 * some for her to keep, edit or drop; a slot whose episode is already
 * written (every beat of its script approved) and has not planted or paid
 * off its twist is a warning.
 *
 * Raw SQL (season_twists, migration 20261023200000); no model.
 */

const { episodeLabel } = require('./seasonSlotService');
const { loadSeason } = require('./seasonLoader');
const { seasonAiContext, askModel, isBudgetRefusal, bullets, threadLine } = require('./seasonAiContext');
const { fromArc, seasonLines } = require('./seasonLine');
const { splitScriptBeats, normalizeLockedBeats } = require('../utils/scriptBeatLocks');

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

async function showThreads(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT id, title, description, status FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL
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
    // Written is final until she reopens a beat: say so while there is still time to fix the script.
    if (t.plant?.written && !['planted', 'paid_off'].includes(t.status)) {
      add(`Episode ${t.plant.slot_number} is already written and doesn't plant ${name} yet.`);
    }
    if (t.payoff?.written && t.status !== 'paid_off' && t.plant && t.payoff.slot_number > t.plant.slot_number) {
      add(`Episode ${t.payoff.slot_number} is already written and doesn't pay off ${name} yet.`);
    }
  }
  return warnings;
}

/**
 * Written: the script has beats and every one is approved (locked), what
 * the Script tab calls Complete (utils/scriptBeatLocks numbers the beats
 * as the tab does).
 */
function scriptWritten(scriptContent, lockedBeats) {
  const { beats } = splitScriptBeats(String(scriptContent || ''));
  if (!beats.length) return false;
  const locked = new Set(normalizeLockedBeats(parse(lockedBeats, [])));
  return beats.every((b) => locked.has(b.number));
}

function seasonSlots({ arc, slots }) {
  return slots.map((s) => ({
    id: s.id, slot_number: s.slot_number, phase: s.phase, label: episodeLabel(arc.season_number, s.slot_number), story_purpose: s.story_purpose,
    episode: s.live_episode_id ? { id: s.live_episode_id, title: s.episode_title } : null, done: Boolean(s.accepted_at),
    written: Boolean(s.live_episode_id) && scriptWritten(s.script_content, s.script_locked_beats),
  }));
}

/** The season's slots, the show's threads and characters, the twists and what is wrong with them. */
async function getTwists(sequelize, showId) {
  if (!UUID_RE.test(String(showId || ''))) throw new TwistError('showId must be a UUID');
  // The active season, else the show's first (a finished season's twists still read).
  const season = await loadSeason(sequelize, showId, { anyStatus: true, scripts: true });
  if (!season) return { arc: null, slots: [], threads: [], characters: [], twists: [], warnings: [] };
  const { arc } = season;
  const slots = seasonSlots(season);
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const [rows] = await sequelize.query(
    `SELECT id, arc_id, title, description, plant_slot_id, payoff_slot_id, status, thread_ids, character_ids,
            planted_episode_id, paid_off_episode_id, note, created_at
       FROM season_twists
      WHERE show_id = :showId AND deleted_at IS NULL AND (arc_id = :arcId OR arc_id IS NULL)
      ORDER BY created_at`, { replacements: { showId, arcId: arc.id } });
  const slotOf = (id) => {
    const s = id && slotById.get(id);
    return s ? { id: s.id, slot_number: s.slot_number, label: s.label, episode: s.episode, done: s.done, written: s.written } : null;
  };
  const twists = rows.map((r) => ({
    id: r.id, title: r.title, description: r.description, status: r.status, note: r.note,
    plant_slot_id: r.plant_slot_id, payoff_slot_id: r.payoff_slot_id || null,
    plant: slotOf(r.plant_slot_id), payoff: slotOf(r.payoff_slot_id),
    thread_ids: ids(r.thread_ids), character_ids: ids(r.character_ids),
    planted_episode_id: r.planted_episode_id || null, paid_off_episode_id: r.paid_off_episode_id || null,
  })).sort((a, b) => (a.plant?.slot_number ?? Infinity) - (b.plant?.slot_number ?? Infinity));
  return {
    arc: { id: arc.id, title: arc.title, tagline: arc.tagline, logline: arc.logline || null, description: arc.description || null, season_number: arc.season_number || 1 },
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
    return await twistsAtSlot(sequelize, slot);
  } catch (err) {
    // Before the migration has run the table is not there: the writers go without twists.
    console.error('[seasonTwists] the twists could not be read:', err.message);
    return none;
  }
}

/**
 * What a slot ({ id, arc_id, slot_number }) plants and pays off, with the
 * people's names: the script writer's list, the slot drafter's and the
 * Season Plan's slot panel read the same one.
 */
async function twistsAtSlot(sequelize, slot) {
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

/**
 * The Script tab's "Mark planted" / "Mark paid off": the twist this
 * episode's slot plants (or pays off) is set planted (or paid off) by this
 * episode. Only on her click; nothing marks a twist on its own. Marking it
 * again does nothing; a paid-off twist is not set back to planted.
 */
async function markTwist(sequelize, episodeId, twistId, as, { undo = false } = {}) {
  if (!UUID_RE.test(String(episodeId || ''))) throw new TwistError('episodeId must be a UUID');
  if (!UUID_RE.test(String(twistId || ''))) throw new TwistError('twistId must be a UUID');
  if (!['planted', 'paid_off'].includes(as)) throw new TwistError('Mark a twist planted or paid off.');
  const [[slot]] = await sequelize.query(
    'SELECT id FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1', { replacements: { episodeId } });
  if (!slot) throw new TwistError('This episode is not in the season.', 404);
  const [[twist]] = await sequelize.query(
    `SELECT id, status, plant_slot_id, payoff_slot_id FROM season_twists
      WHERE id = :twistId AND deleted_at IS NULL AND (plant_slot_id = :slotId OR payoff_slot_id = :slotId)`,
    { replacements: { twistId, slotId: slot.id } });
  if (!twist) throw new TwistError('That twist is not due in this episode.', 404);
  if (twist.status === 'dropped') throw new TwistError('That twist is dropped; bring it back on the Season Plan first.', 409);
  if (undo) return unmarkTwist(sequelize, episodeId, twist, slot, as);
  if (as === 'planted') {
    if (twist.plant_slot_id !== slot.id) throw new TwistError('This episode pays that twist off; it is planted in an earlier one.', 409);
    if (twist.status === 'planned') {
      await sequelize.query(
        `UPDATE season_twists SET status = 'planted', planted_episode_id = :episodeId, updated_at = NOW() WHERE id = :twistId`,
        { replacements: { episodeId, twistId } });
    }
  } else {
    if (twist.payoff_slot_id !== slot.id) throw new TwistError('This episode plants that twist; it is paid off in a later one.', 409);
    if (twist.status !== 'paid_off') {
      await sequelize.query(
        `UPDATE season_twists SET status = 'paid_off', paid_off_episode_id = :episodeId, updated_at = NOW() WHERE id = :twistId`,
        { replacements: { episodeId, twistId } });
    }
  }
  return twistsForEpisode(sequelize, episodeId);
}

/**
 * Undo for Mark planted / Mark paid off (Script tab audit 6, 2026-10-24): a
 * mark made by mistake is taken back here. Planted goes back to planned (not
 * while it is paid off: undo the payoff first); paid off goes back to
 * planted when an episode planted it, else planned. Taking back a mark that
 * is not there does nothing.
 */
async function unmarkTwist(sequelize, episodeId, twist, slot, as) {
  if (as === 'planted') {
    if (twist.plant_slot_id !== slot.id) throw new TwistError('This episode pays that twist off; it is planted in an earlier one.', 409);
    if (twist.status === 'paid_off') throw new TwistError('That twist is paid off: undo the payoff first.', 409);
    if (twist.status === 'planted') {
      await sequelize.query(
        `UPDATE season_twists SET status = 'planned', planted_episode_id = NULL, updated_at = NOW() WHERE id = :twistId`,
        { replacements: { twistId: twist.id } });
    }
  } else {
    if (twist.payoff_slot_id !== slot.id) throw new TwistError('This episode plants that twist; it is paid off in a later one.', 409);
    if (twist.status === 'paid_off') {
      await sequelize.query(
        `UPDATE season_twists SET status = CASE WHEN planted_episode_id IS NULL THEN 'planned' ELSE 'planted' END,
                paid_off_episode_id = NULL, updated_at = NOW() WHERE id = :twistId`,
        { replacements: { twistId: twist.id } });
    }
  }
  return twistsForEpisode(sequelize, episodeId);
}

// ── Suggest twists (one AI call; drafts only, nothing saved) ──────────────

const MODELS = ['claude-sonnet-4-6'];
const MAX_DRAFTS = 5;
let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// The confirmed relationships the prompt reads: between the show's own
// characters (the ids it may use), each with its situation. Seeds, kept
// ideas and Later are not facts, so Suggest twists never builds on them
// (Evoni's review, 2026-10-24, item 7).
const RELATIONSHIP_CAP = 40;
const RELATIONSHIP_DETAIL = 200;

function suggestPrompt({ arc, slots, threads, characters, relationships, twists }) {
  const slotLines = slots.map((s) => `- E${s.slot_number}${s.phase ? ` (phase ${s.phase})` : ''}${s.done ? ' [DONE: do not use]' : ''}`
    + `${s.episode?.title ? `: "${s.episode.title}"` : ''}${s.story_purpose ? ` — ${String(s.story_purpose).slice(0, 200)}` : ''}`).join('\n');
  const threadLines = bullets(threads, (t) => threadLine(t, { description: 200 }), '(none)');
  const people = bullets(characters, (c) => `- [${c.id}] ${c.name}`, '(none)');
  const ties = relationships ? relationships.trim() : 'THEIR RELATIONSHIPS:\n(none recorded)';
  const planned = twists.length
    ? twists.map((t) => `- ${t.title}${t.plant ? ` (planted E${t.plant.slot_number}` : ' ('}${t.payoff ? `, paid off E${t.payoff.slot_number})` : ')'}`).join('\n') : '(none yet)';
  return `You help plan the season of "Styling Adventures with Lala". Suggest season twists: a twist is a detail planted, unexplained, in one episode and paid off in a later one, so the audience connects it.

SEASON ${arc.season_number}: "${arc.title || 'Untitled'}"${arc.tagline ? ` — ${arc.tagline}` : ''}
${seasonLines(fromArc(arc), { title: false, part: false }).map((l) => `${l}\n`).join('')}
THE SEASON'S EPISODES:
${slotLines}

THE SHOW'S OPEN THREADS:
${threadLines}

THE CHARACTERS:
${people}

${ties}

TWISTS ALREADY PLANNED (do not repeat these):
${planned}

Suggest 3 to 5 new twists that grow out of the threads and relationships above. Plant each in an episode not marked DONE and pay it off in a later one. Use only the ids above; invent no characters or threads.
Answer with JSON only:
{"twists": [{"title": "a short name", "description": "what is planted and how it pays off, in one or two sentences", "plant_episode": 3, "payoff_episode": 9, "thread_ids": ["a thread id above"], "character_ids": ["a character id above"]}]}`;
}

/**
 * The AI's answer as drafts: each id checked against the season, the
 * threads and the characters; an unknown one is dropped. A plant in a done
 * or unknown episode becomes unchosen; so does a payoff not after its plant.
 */
function cleanDrafts(parsed, { slots = [], threads = [], characters = [], twists = [] } = {}) {
  const list = Array.isArray(parsed?.twists) ? parsed.twists : Array.isArray(parsed) ? parsed : [];
  const open = slots.filter((s) => !s.done);
  const slotFor = (number, id) => open.find((s) => (id && s.id === id) || (number != null && Number(s.slot_number) === Number(number))) || null;
  const threadIds = new Set(threads.map((t) => String(t.id)));
  const characterIds = new Set(characters.map((c) => String(c.id)));
  const taken = new Set(twists.map((t) => String(t.title || '').trim().toLowerCase()));
  const keep = (value, known) => [...new Set((Array.isArray(value) ? value : []).map(String))].filter((id) => known.has(id)).slice(0, MAX_LINKS);
  const drafts = [];
  for (const d of list) {
    const title = text(d?.title, 200);
    if (!title || taken.has(title.toLowerCase())) continue;
    taken.add(title.toLowerCase());
    const plant = slotFor(d.plant_episode, d.plant_slot_id);
    let payoff = slotFor(d.payoff_episode, d.payoff_slot_id);
    if (payoff && (!plant || payoff.slot_number <= plant.slot_number)) payoff = null;
    drafts.push({
      title, description: text(d.description, 2000),
      plant_slot_id: plant ? plant.id : null, payoff_slot_id: payoff ? payoff.id : null,
      thread_ids: keep(d.thread_ids, threadIds), character_ids: keep(d.character_ids, characterIds),
    });
    if (drafts.length >= MAX_DRAFTS) break;
  }
  return drafts;
}

/** 3-5 drafted twists for the season; nothing is saved (Evoni keeps, edits or drops each). */
async function suggestTwists(sequelize, showId) {
  const season = await getTwists(sequelize, showId);
  if (!season.arc) throw new TwistError('This show has no season yet to plan twists in.', 409);
  if (season.slots.filter((s) => !s.done).length < 2) throw new TwistError('No two episodes are left to plant and pay off a twist in.', 409);
  const { threads, relationships } = await seasonAiContext(sequelize, showId, {
    threads: { limit: 40, order: 'desc' },
    relationships: { cap: RELATIONSHIP_CAP, characters: season.characters, detail: RELATIONSHIP_DETAIL },
  });
  const prompt = suggestPrompt({ ...season, threads, relationships });
  let message;
  try {
    message = await askModel({ api: getClient(), models: MODELS, maxTokens: 2000, prompt, label: 'seasonTwists suggest' });
  } catch (modelErr) {
    console.error('[seasonTwists] suggesting failed:', modelErr.message);
    if (isBudgetRefusal(modelErr)) throw new TwistError(`${modelErr.message} No twists were suggested.`, 429);
    throw new TwistError('The AI could not suggest twists right now. Try again.', 502);
  }
  let parsed;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[seasonTwists] the suggestions could not be read:', err.message);
    throw new TwistError('The suggestions came back in a form that could not be read. Try again.', 502);
  }
  const drafts = cleanDrafts(parsed, { slots: season.slots, threads, characters: season.characters, twists: season.twists });
  if (!drafts.length) throw new TwistError('The AI suggested no twists that fit this season. Try again.', 502);
  return { drafts };
}

module.exports = {
  TwistError, STATUSES, getTwists, setTwist, deleteTwist, restoreTwist,
  twistsForEpisode, twistsForSlot, twistsAtSlot, showCharacters, twistBlock, renderTwistBlock, checkTwists,
  markTwist, suggestTwists, cleanDrafts, scriptWritten, suggestPrompt,
};

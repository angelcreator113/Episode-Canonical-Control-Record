'use strict';

/**
 * My Little List ♡ — Lala's own list on her phone (Evoni, 2026-10-26,
 * Phase 1 of the redesign of the Shopping List / To-Do overlay). It is a
 * view of the episode's existing lists, never a second task engine:
 *
 *   one wardrobe item    episode_todo_lists.tasks; done from what she has
 *                        put on by that line (scriptWear.wornByBeat, the
 *                        same rule getTodoList uses), never by hand
 *   one deal item        the event's deliverables; "Look into that offer"
 *                        once she has it (deal_discovered), "Film my
 *                        video" once she said yes (deal_accepted): one
 *                        item whose wording and state change, never two;
 *                        done when the script's [DELIVER] lines have
 *                        delivered them (scriptTodo.deliveredAt); approval
 *                        and payment stay in Money
 *   a goal or idea       episode_todo_lists.social_tasks without a
 *                        deliverable; ticked by hand as before
 *   her reminders        episode_todo_lists.personal_list.reminders (the
 *                        one new column), outside social_tasks, so no
 *                        score, stat, deliverable or payout ever reads them
 *
 * What she sees (rulings 1, 2, 5, 7):
 *   - an item shows once Lala has learned what it is about
 *     (utils/lalaKnowledge, to the line); an item with no rule stays hidden;
 *   - its words are approved wording (personal_list.words), else fixed
 *     wording chosen from what kind of task it is, never the task's own
 *     label or description; a goal no fixed wording fits is hidden and
 *     flagged for review;
 *   - wording that names something she has not learned yet, or a
 *     paraphrase of it (utils/spoilerTerms), hides the item and flags it;
 *   - the counts are of the items she sees;
 *   - each item goes out as exactly { key, title, note, done, can_check,
 *     can_edit, can_remove }; `key` is an opaque hash of the episode and
 *     the item, matched on the server against what she sees.
 *
 * buildList is pure; loadListInput reads the database; the writes lock
 * the list row (FOR UPDATE) as the tick routes do.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { scriptBeats, wornByBeat } = require('../utils/scriptWear');
const { deliveredAt } = require('../utils/scriptTodo');
const { isDealEvent } = require('../utils/dealComponents');
const knowledge = require('../utils/lalaKnowledge');
const { privateTerms, leaks } = require('../utils/spoilerTerms');

const APP_NAME = 'My Little List ♡';
const TITLE_MAX = 80;
const NOTE_MAX = 200;
const REMINDER_MAX = 30;
const PUBLIC_FIELDS = Object.freeze(['key', 'title', 'note', 'done', 'can_check', 'can_edit', 'can_remove']);
const REVEALS = Object.freeze(['start', ...knowledge.FACTS]);
const KIND_ORDER = { wardrobe: 0, deal: 1, task: 2, reminder: 3 };

const CODES = Object.freeze({
  NOT_FOUND: 'LIST_ITEM_NOT_FOUND',
  FROM_GAMEPLAY: 'COMPLETION_FROM_GAMEPLAY',
  NOT_REMOVABLE: 'LIST_ITEM_NOT_REMOVABLE',
  INVALID: 'LIST_ITEM_INVALID',
  NO_LIST: 'NO_EPISODE_LIST',
  MIGRATION_PENDING: 'PERSONAL_LIST_MIGRATION_PENDING',
});

const fail = (status, code, error) => Object.assign(new Error(error), { status, code });

/** The opaque key of an item: a hash of the episode and the item. */
function itemKey(episodeId, ref) {
  return `mll_${crypto.createHash('sha256').update(`${episodeId}|${ref}`).digest('hex').slice(0, 24)}`;
}

// ─── Wording ────────────────────────────────────────────────────────────────
//
// Fixed wording only: none of it is built from a label, a name or a plot
// note, so it can say nothing Lala doesn't know. Plain, grown-up words
// (ruling 8: "Avoid making every task sound overly cute").

const GOAL_WORDING = [
  [/\b(network|meet|connect|introduc|mingl|contacts?|relationship|befriend|schmooz)/i, 'Meet some interesting people'],
  [/\b(post|share|upload|stor(y|ies))\b/i, 'Share something from the day'],
  [/\b(photo|footage|content|film|shoot|captur|vlog|behind.the.scenes|bts|record)/i, 'Get some good footage'],
  [/\b(coins?|budget|money|afford|spend|cost)/i, 'Check my coins'],
  [/\b(arriv|travel|on time|show up|get there|commut)/i, 'Get there on time'],
  [/\b(thank|follow.?up|check in with)/i, 'Follow up afterwards'],
  [/\b(learn|ask|advice|mentor|question)/i, 'Ask a few good questions'],
];

/** Fixed wording for a generated goal or idea, or null when none fits. */
function goalWording(task) {
  if (task?.follow_up_id) return 'Follow up from last time';
  const text = `${task?.label || ''} ${task?.description || ''}`;
  for (const [re, words] of GOAL_WORDING) if (re.test(text)) return words;
  return null;
}

const DELIVERABLE_WORDING = {
  pulse_video: { noun: 'video', commit: 'Film my video' },
  grwm_video: { noun: 'video', commit: 'Film my get-ready video' },
  try_on_haul: { noun: 'video', commit: 'Film my try-on' },
  ugc: { noun: 'video', commit: 'Film my video' },
  pulse_post: { noun: 'post', commit: 'Post my post' },
  carousel_post: { noun: 'post', commit: 'Put my carousel up' },
  pulse_stories: { noun: 'stories', commit: 'Post my stories' },
  go_live: { noun: 'live', commit: 'Go live' },
  link_in_bio: { noun: 'link', commit: 'Put the link in my bio' },
};

/** The deal item's fixed wording at its stage. */
function dealWording(deliverables, stage) {
  const kinds = [...new Set(deliverables.map((d) => d.deliverable_type))];
  const one = deliverables.length === 1 ? DELIVERABLE_WORDING[deliverables[0].deliverable_type] : null;
  const noun = kinds.length === 1 ? DELIVERABLE_WORDING[kinds[0]]?.noun : null;
  if (stage === 'considering') {
    if (!deliverables.length) return 'Think over that offer';
    return noun ? `Look into that ${noun} offer` : 'Look into that offer';
  }
  if (!deliverables.length) return 'Think over that offer';
  if (one) return one.commit;
  return 'Get my content for the deal done';
}

// ─── The list ───────────────────────────────────────────────────────────────

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** personal_list as stored, made safe to read. */
function readPersonal(raw) {
  let p = raw;
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p || '{}');
    } catch (err) {
      console.error('[MyLittleList] personal_list is not JSON, read as empty:', err.message);
      p = {};
    }
  }
  const reminders = Array.isArray(p?.reminders) ? p.reminders.filter((r) => r && r.id && clip(r.title, TITLE_MAX)) : [];
  const words = p?.words && typeof p.words === 'object' && !Array.isArray(p.words) ? p.words : {};
  return { reminders, words };
}

/** The beat index and line deliveredAt reads for a position. */
function scriptIndex(beats, at) {
  const i = beats.findIndex((b) => b.number === at.beat);
  if (i >= 0) return { index: i, line: at.line };
  return { index: beats.reduce((last, b, j) => (b.number < at.beat ? j : last), -1), line: Infinity };
}

/**
 * The list at a position, every item with why it shows or not.
 * @param {object} input  loadListInput's result (or a test's)
 * @param {{ beat, line }} at
 * @returns {{ items, timeline }} items: internal, hidden ones included
 */
function buildList(input, at) {
  const {
    episodeId, script = '', event = null, deliverables = [], opportunities = [],
    wardrobeTasks = [], look = [], socialTasks = [], personal: rawPersonal = {}, charges = null,
  } = input;
  const personal = readPersonal(rawPersonal);
  const beats = scriptBeats(script);
  const timeline = knowledge.knowledgeTimeline({
    beats,
    event: event && { is_deal: Boolean(event.is_deal), terms_locked: Boolean(event.terms_locked) },
    opportunities,
  });
  const knows = (fact, ref) => knowledge.knowsAt(timeline, fact, at, ref);

  // What she has not learned yet, by name.
  const unknownNames = [];
  if (event && !knows('invitation_received')) unknownNames.push(event.name, event.host, event.host_brand, event.venue_name);
  for (const o of opportunities) {
    if (!knows('opportunity_discovered', o.id)) unknownNames.push(o.name, o.brand_or_company, o.venue_name);
  }
  const secret = privateTerms(unknownNames.filter(Boolean));

  const items = [];
  const add = (item) => items.push({ order: items.length, ...item });

  // The wardrobe: one item for the outfit.
  if (wardrobeTasks.length) {
    const { listSlotsFilled, taskFilled } = require('./todoListService');
    // A beat the script doesn't have: what she had on by the end of the beat before it.
    const { index, line } = scriptIndex(beats, at);
    const { worn } = index >= 0 ? wornByBeat(script, look, beats[index].number, line) : { worn: [] };
    const filled = listSlotsFilled(worn.map((p) => p.clothing_category));
    const legacyAccessories = !wardrobeTasks.some((t) => t?.slot === 'purse');
    const state = wardrobeTasks.map((t) => ({ required: Boolean(t.required), done: taskFilled(t.slot, filled, { legacyAccessories }) }));
    const needed = state.some((s) => s.required) ? state.filter((s) => s.required) : state;
    const words = personal.words.wardrobe || {};
    // What the pieces she has on so far cost (the Shopping list's "spent so
    // far", Task #3189), by the charge Finalize books (episodeLookCharges).
    const spent = charges ? worn.reduce((sum, p) => sum + (Number(charges.get(String(p.id))) || 0), 0) : 0;
    const sorted = `${state.filter((s) => s.done).length} of ${state.length} pieces sorted`;
    add({
      ref: 'wardrobe', kind: 'wardrobe', reveal: { fact: 'invitation_received' },
      title: clip(words.title, TITLE_MAX) || 'Find something to wear',
      note: clip(words.note, NOTE_MAX) || (spent > 0 ? `${sorted} · ${spent.toLocaleString('en-US')} coins spent` : sorted),
      done: needed.every((s) => s.done),
      can_check: false, can_edit: true, can_remove: false,
      label: 'Wardrobe list',
    });
  }

  // The deal, or the host's requirements: one item.
  if (event && (event.is_deal || deliverables.length)) {
    const ref = `deal:${event.id}`;
    const accepted = event.is_deal ? knows('deal_accepted') : true;
    const stage = accepted ? 'committed' : 'considering';
    const { index, line } = scriptIndex(beats, at);
    const delivered = index >= 0 ? deliveredAt(beats, index, line, deliverables) : new Set();
    const owed = deliverables.some((d) => d.required !== false) ? deliverables.filter((d) => d.required !== false) : deliverables;
    const words = personal.words[ref] || {};
    const doneCount = deliverables.filter((d) => delivered.has(String(d.id))).length;
    add({
      ref, kind: 'deal', stage, reveal: { fact: event.is_deal ? 'deal_discovered' : 'invitation_received' },
      title: clip(stage === 'committed' ? words.title : words.title_considering, TITLE_MAX) || dealWording(deliverables, stage),
      note: clip(words.note, NOTE_MAX) || (stage === 'committed' && deliverables.length > 1 ? `${doneCount} of ${deliverables.length} done` : null),
      done: stage === 'committed' && (deliverables.length ? owed.every((d) => delivered.has(String(d.id))) : true),
      can_check: false, can_edit: true, can_remove: false,
      label: event.name,
    });
  }

  // Goals and ideas: social tasks with no deliverable behind them.
  for (const t of socialTasks) {
    if (!t || !t.slot || t.deliverable_id) continue;
    const ref = `task:${t.slot}`;
    const words = personal.words[ref] || {};
    add({
      ref, kind: 'task', reveal: { fact: t.follow_up_id ? 'start' : 'invitation_received' },
      title: clip(words.title, TITLE_MAX) || goalWording(t),
      note: clip(words.note, NOTE_MAX) || null,
      done: Boolean(t.completed) && !(Number.isInteger(t.completed_beat) && t.completed_beat > at.beat),
      can_check: true, can_edit: true, can_remove: false,
      label: t.label || t.slot,
    });
  }

  // Her own reminders.
  for (const r of personal.reminders) {
    add({
      ref: `reminder:${r.id}`, kind: 'reminder',
      reveal: { fact: REVEALS.includes(r.reveal?.when) ? r.reveal.when : null, ref: r.reveal?.ref || null },
      title: clip(r.title, TITLE_MAX), note: clip(r.note, NOTE_MAX) || null, done: Boolean(r.done),
      can_check: true, can_edit: true, can_remove: true,
      label: clip(r.title, TITLE_MAX),
    });
  }

  // Why each shows or not.
  const seenTitles = new Set();
  for (const item of items) {
    item.key = itemKey(episodeId, item.ref);
    item.revealed_at = item.reveal.fact ? knowledge.learnedAt(timeline, item.reveal.fact, item.reveal.ref) : null;
    if (!item.reveal.fact) item.hidden = 'no_reveal_rule';
    else if (!knows(item.reveal.fact, item.reveal.ref)) item.hidden = 'not_known_yet';
    else if (!item.title) item.hidden = 'needs_wording';
    else {
      const leaked = [...leaks(item.title, secret), ...leaks(item.note, secret)];
      if (leaked.length) { item.hidden = 'spoiler'; item.leaked = [...new Set(leaked)]; }
      else if (seenTitles.has(item.title.toLowerCase())) item.hidden = 'duplicate_wording';
      else seenTitles.add(item.title.toLowerCase());
    }
  }
  items.sort((a, b) => {
    const pa = a.revealed_at || { beat: Infinity, line: Infinity };
    const pb = b.revealed_at || { beat: Infinity, line: Infinity };
    return knowledge.comparePositions(pa, pb) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.order - b.order;
  });
  return { items, timeline };
}

/** One item as Lala's phone gets it: the public fields, nothing else. */
function toPublic(item) {
  const out = {};
  for (const f of PUBLIC_FIELDS) out[f] = f === 'note' ? (item.note || null) : item[f];
  return out;
}

/** The list as the phone gets it. */
function publicList(built) {
  const visible = built.items.filter((i) => !i.hidden).map(toPublic);
  return { app: APP_NAME, items: visible, progress: { done: visible.filter((i) => i.done).length, total: visible.length } };
}

// Hidden for a reason the producer can fix; "not known yet" is the rule working.
const REVIEW_REASONS = new Set(['needs_wording', 'spoiler', 'duplicate_wording', 'no_reveal_rule']);

/**
 * What the producer should look at: hidden items she might want shown.
 * With { all: true } (Phase 2's wording panel), every item, shown or not,
 * with its wording, when it shows and why not yet, so she can word an item
 * before Lala learns of it. Producer view, never the phone's.
 */
function reviewList(built, { all = false } = {}) {
  const items = all ? built.items : built.items.filter((i) => REVIEW_REASONS.has(i.hidden));
  return items.map((i) => ({
    key: i.key, kind: i.kind, reason: i.hidden || null, label: i.label, ...(i.leaked ? { leaked: i.leaked } : {}),
    ...(all ? {
      title: i.title || null, note: i.note || null,
      // When she learns of it; line null is "at the end of that beat".
      shows_at: i.revealed_at ? { beat: i.revealed_at.beat, line: Number.isFinite(i.revealed_at.line) ? i.revealed_at.line : null } : null,
      ...(i.kind === 'deal' ? { stage: i.stage } : {}),
    } : {}),
  }));
}

// ─── Reading the episode ────────────────────────────────────────────────────

let personalListReady = false;
/** Whether episode_todo_lists.personal_list exists (its migration has run). Cached once true. */
async function hasPersonalList(sequelize) {
  if (personalListReady) return true;
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'episode_todo_lists' AND column_name = 'personal_list'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  personalListReady = rows.length > 0;
  return personalListReady;
}
const resetColumnCache = () => { personalListReady = false; };

const parseJson = (raw, fallback) => {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[MyLittleList] a stored list is not JSON, read as empty:', err.message);
    return fallback;
  }
};

/** Everything buildList reads, for an episode; null when there is no episode. */
async function loadListInput(models, episodeId) {
  const { sequelize } = models;
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  const [episode] = await select(
    'SELECT id, show_id, episode_number, script_content FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { episodeId }
  );
  if (!episode) return null;

  const withPersonal = await hasPersonalList(sequelize);
  const [todo] = await select(
    `SELECT id, tasks, social_tasks${withPersonal ? ', personal_list' : ''} FROM episode_todo_lists
      WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { episodeId }
  );
  const look = await select(
    `SELECT w.id, w.name, w.clothing_category
       FROM episode_wardrobe ew JOIN wardrobe w ON w.id = ew.wardrobe_id
      WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL AND ew.approval_status = 'approved'
        AND w.deleted_at IS NULL AND w.parent_item_id IS NULL
      ORDER BY ew.created_at ASC`,
    { episodeId }
  );

  const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
  const [row] = await select(
    `SELECT id, name, host, host_brand, venue_name, deal_type, deal_components FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`,
    { episodeId }
  );
  let event = null;
  let deliverables = [];
  if (row) {
    const { findTermsLockEpisode } = require('../utils/eventTermsLock');
    const lock = await findTermsLockEpisode(sequelize, row.id);
    event = {
      id: row.id, name: row.name, host: row.host, host_brand: row.host_brand, venue_name: row.venue_name,
      is_deal: isDealEvent(row), terms_locked: Boolean(lock && String(lock.id) === String(episodeId)),
    };
    deliverables = await select(
      `SELECT id, description, deliverable_type, quantity, required FROM event_deliverables
        WHERE event_id = :eventId AND deleted_at IS NULL ORDER BY created_at ASC`,
      { eventId: row.id }
    );
  }

  const opps = await select(
    `SELECT o.id, o.name, o.brand_or_company, o.venue_name, o.status, e.episode_number AS offered_episode_number
       FROM opportunities o LEFT JOIN episodes e ON e.id = o.offered_in_episode_id AND e.deleted_at IS NULL
      WHERE o.show_id = :showId AND o.deleted_at IS NULL`,
    { showId: episode.show_id }
  );
  const opportunities = opps.map((o) => ({
    id: o.id, name: o.name, brand_or_company: o.brand_or_company, venue_name: o.venue_name,
    ...knowledge.opportunityBefore({ status: o.status, offered_episode_number: o.offered_episode_number }, episode.episode_number),
  }));

  // The look's charges, for "coins spent" on her outfit item. A failed read
  // leaves the note without it (logged), never the list.
  let charges = null;
  if (look.length) {
    try {
      const { episodeLook, chargeMap } = require('./episodeLookCharges');
      charges = chargeMap(await episodeLook(sequelize, { episodeId, event: null, showId: episode.show_id }));
    } catch (err) {
      console.error('[MyLittleList] look charges read failed, coins spent left out:', err.message);
    }
  }

  return {
    episodeId,
    showId: episode.show_id,
    charges,
    hasList: Boolean(todo),
    script: episode.script_content || '',
    event,
    deliverables,
    opportunities,
    wardrobeTasks: parseJson(todo?.tasks, []) || [],
    look,
    socialTasks: parseJson(todo?.social_tasks, []) || [],
    personal: todo?.personal_list || {},
  };
}

/** A position from a request: { beat 1-14, line ≥ 0 }; the start of the episode by default. */
function positionOf({ beat = null, line = null } = {}) {
  const b = beat === null || beat === undefined || beat === '' ? 1 : Number(beat);
  const l = line === null || line === undefined || line === '' ? 0 : Number(line);
  if (!Number.isInteger(b) || b < 1 || b > 14) throw fail(400, CODES.INVALID, 'beat must be a whole number from 1 to 14');
  if (!Number.isInteger(l) || l < 0) throw fail(400, CODES.INVALID, 'line must be a whole number, 0 or more');
  return { beat: b, line: l };
}

/** Lala's list at a position, as her phone gets it; null when there is no episode. */
async function getMyLittleList(models, episodeId, at) {
  const input = await loadListInput(models, episodeId);
  if (!input) return null;
  return publicList(buildList(input, at));
}

/** The producer's review of what is hidden and why; null when there is no episode. */
async function getReview(models, episodeId, at, { all = false } = {}) {
  const input = await loadListInput(models, episodeId);
  if (!input) return null;
  const built = buildList(input, at);
  return { items: reviewList(built, { all }), issues: built.timeline.issues };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

function validReveal(reveal, opportunityIds) {
  if (reveal === undefined || reveal === null) return { when: 'start', ref: null };
  const when = reveal?.when;
  if (!REVEALS.includes(when)) throw fail(400, CODES.INVALID, `reveal.when must be one of ${REVEALS.join(', ')}`);
  if (knowledge.REF_FACTS.has(when)) {
    if (!reveal.ref || !opportunityIds.has(String(reveal.ref))) throw fail(400, CODES.INVALID, 'reveal.ref must be one of the show\'s opportunities');
    return { when, ref: String(reveal.ref) };
  }
  if (reveal.ref) throw fail(400, CODES.INVALID, `reveal.ref is only for ${[...knowledge.REF_FACTS].join(' and ')}`);
  return { when, ref: null };
}

const titleOf = (v) => {
  const t = clip(v, TITLE_MAX + 1);
  if (!t) throw fail(400, CODES.INVALID, 'title is required');
  if (t.length > TITLE_MAX) throw fail(400, CODES.INVALID, `title is at most ${TITLE_MAX} characters`);
  return t;
};
const noteOf = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw fail(400, CODES.INVALID, 'note must be text');
  if (v.trim().length > NOTE_MAX) throw fail(400, CODES.INVALID, `note is at most ${NOTE_MAX} characters`);
  return v.trim() || null;
};

/** Runs fn on the episode's list row, locked, and writes what it returns. */
async function withLockedList(models, episodeId, fn) {
  const { sequelize } = models;
  if (!(await hasPersonalList(sequelize))) {
    throw fail(503, CODES.MIGRATION_PENDING, 'My Little List needs its migration (episode_todo_lists.personal_list) before it can save.');
  }
  return sequelize.transaction(async (transaction) => {
    const [row] = await sequelize.query(
      'SELECT id, social_tasks, personal_list FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    if (!row) throw fail(404, CODES.NO_LIST, 'This episode has no list yet.');
    const state = { personal: readPersonal(row.personal_list), socialTasks: parseJson(row.social_tasks, []) || [] };
    const out = await fn(state);
    await sequelize.query(
      `UPDATE episode_todo_lists SET personal_list = CAST(:personal AS jsonb)${out.socialChanged ? ', social_tasks = CAST(:social AS jsonb)' : ''}, updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: row.id, personal: JSON.stringify(state.personal), social: JSON.stringify(state.socialTasks) }, transaction }
    );
    return out.result;
  });
}

/** The visible item a key names at a position, or a 404 that never says whether a hidden one exists. */
async function visibleItem(models, episodeId, key, at) {
  const input = await loadListInput(models, episodeId);
  if (!input) throw fail(404, CODES.NOT_FOUND, 'No such item on her list.');
  const built = buildList(input, at);
  const item = built.items.find((i) => i.key === key && !i.hidden);
  if (!item) throw fail(404, CODES.NOT_FOUND, 'No such item on her list.');
  return { item, input };
}

/** Adds one of her reminders. Returns { key }. */
async function addReminder(models, episodeId, body = {}) {
  const title = titleOf(body.title);
  const note = noteOf(body.note);
  const input = await loadListInput(models, episodeId);
  if (!input) throw fail(404, CODES.NO_LIST, 'No such episode.');
  const reveal = validReveal(body.reveal, new Set(input.opportunities.map((o) => String(o.id))));
  const id = uuidv4();
  await withLockedList(models, episodeId, async (state) => {
    if (state.personal.reminders.length >= REMINDER_MAX) throw fail(400, CODES.INVALID, `A list holds at most ${REMINDER_MAX} of her reminders.`);
    state.personal.reminders.push({ id, title, note, reveal, done: false, created_at: new Date().toISOString() });
    return {};
  });
  return { key: itemKey(episodeId, `reminder:${id}`) };
}

/**
 * Changes a visible item: its words (any item; a task's words are saved as
 * its wording, never over its label), or done (her reminders, goals and
 * ideas only; the wardrobe and the deal tick from gameplay).
 */
async function updateItem(models, episodeId, key, body = {}, at) {
  const { item } = await visibleItem(models, episodeId, key, at);
  const changes = {};
  if (body.title !== undefined) changes.title = titleOf(body.title);
  if (body.note !== undefined) changes.note = noteOf(body.note);
  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') throw fail(400, CODES.INVALID, 'done must be true or false');
    if (!item.can_check) throw fail(403, CODES.FROM_GAMEPLAY, item.kind === 'wardrobe'
      ? 'The outfit is done when she has put it on.'
      : 'The deal is done when its content is delivered; approval and payment stay in Money.');
    changes.done = body.done;
  }
  if (!Object.keys(changes).length) throw fail(400, CODES.INVALID, 'Nothing to change: send title, note or done.');

  await withLockedList(models, episodeId, async (state) => {
    let socialChanged = false;
    if (item.kind === 'reminder') {
      const id = item.ref.slice('reminder:'.length);
      const r = state.personal.reminders.find((x) => String(x.id) === id);
      if (!r) throw fail(404, CODES.NOT_FOUND, 'No such item on her list.');
      Object.assign(r, changes);
    } else {
      if (changes.title !== undefined || changes.note !== undefined) {
        const words = { ...(state.personal.words[item.ref] || {}) };
        // The deal's words are its stage's: considering, or committed.
        if (changes.title !== undefined) words[item.stage === 'considering' ? 'title_considering' : 'title'] = changes.title;
        if (changes.note !== undefined) words.note = changes.note;
        state.personal.words[item.ref] = words;
      }
      if (changes.done !== undefined) {
        const slot = item.ref.slice('task:'.length);
        const i = state.socialTasks.findIndex((x) => x && x.slot === slot && !x.deliverable_id);
        if (i < 0) throw fail(404, CODES.NOT_FOUND, 'No such item on her list.');
        // As the Run Sheet's tick: done or not; a Script tab tick's beat is dropped.
        const { completed_source: _source, completed_beat: _beat, ...rest } = state.socialTasks[i];
        state.socialTasks[i] = { ...rest, completed: changes.done };
        socialChanged = true;
      }
    }
    return { socialChanged };
  });
  if (changes.done !== undefined && item.kind === 'task') {
    // A follow-up carried from an earlier episode is settled as on the Run Sheet.
    const input = await loadListInput(models, episodeId);
    const slot = item.ref.slice('task:'.length);
    await require('./storyCarryForward').settleFollowUps(models.sequelize, input.socialTasks.filter((t) => t.slot === slot), { episodeId });
  }
  return { key };
}

// Every item of the episode, whatever Lala knows: the list at the last line.
const EVERYTHING = { beat: 14, line: Number.MAX_SAFE_INTEGER };

/**
 * The producer's wording for any item of the episode, shown yet or not
 * (Phase 2's wording panel): a reminder's own title and note, else the
 * item's words (personal_list.words). A deal item's words go to the stage
 * asked for ('considering' or 'committed'). Never touches a label.
 */
async function setWords(models, episodeId, key, body = {}) {
  const input = await loadListInput(models, episodeId);
  if (!input) throw fail(404, CODES.NOT_FOUND, 'No such item.');
  const item = buildList(input, EVERYTHING).items.find((i) => i.key === key);
  if (!item) throw fail(404, CODES.NOT_FOUND, 'No such item.');
  const changes = {};
  if (body.title !== undefined) changes.title = body.title === null || body.title === '' ? null : titleOf(body.title);
  if (body.note !== undefined) changes.note = noteOf(body.note);
  if (!Object.keys(changes).length) throw fail(400, CODES.INVALID, 'Nothing to change: send title or note.');
  if (item.kind === 'reminder' && changes.title === null) throw fail(400, CODES.INVALID, 'A reminder needs a title.');
  const stage = body.stage === undefined ? item.stage : body.stage;
  if (item.kind === 'deal' && !['considering', 'committed'].includes(stage)) throw fail(400, CODES.INVALID, 'stage must be considering or committed');

  await withLockedList(models, episodeId, async (state) => {
    if (item.kind === 'reminder') {
      const id = item.ref.slice('reminder:'.length);
      const r = state.personal.reminders.find((x) => String(x.id) === id);
      if (!r) throw fail(404, CODES.NOT_FOUND, 'No such item.');
      Object.assign(r, changes);
      return {};
    }
    const words = { ...(state.personal.words[item.ref] || {}) };
    const field = item.kind === 'deal' && stage === 'considering' ? 'title_considering' : 'title';
    // An empty title clears the wording: the item goes back to its fixed wording.
    if (changes.title !== undefined) { if (changes.title === null) delete words[field]; else words[field] = changes.title; }
    if (changes.note !== undefined) { if (changes.note === null) delete words.note; else words.note = changes.note; }
    state.personal.words[item.ref] = words;
    return {};
  });
  return { key };
}

/** Removes one of her reminders; a task is never removed here. */
async function removeItem(models, episodeId, key, at) {
  const { item } = await visibleItem(models, episodeId, key, at);
  if (!item.can_remove) throw fail(403, CODES.NOT_REMOVABLE, 'Only her own reminders can be removed from her list.');
  await withLockedList(models, episodeId, async (state) => {
    const id = item.ref.slice('reminder:'.length);
    state.personal.reminders = state.personal.reminders.filter((r) => String(r.id) !== id);
    return {};
  });
  return { key };
}

module.exports = {
  APP_NAME,
  PUBLIC_FIELDS,
  REVEALS,
  CODES,
  TITLE_MAX,
  NOTE_MAX,
  itemKey,
  goalWording,
  dealWording,
  readPersonal,
  buildList,
  toPublic,
  publicList,
  reviewList,
  hasPersonalList,
  resetColumnCache,
  loadListInput,
  positionOf,
  getMyLittleList,
  getReview,
  addReminder,
  updateItem,
  setWords,
  removeItem,
};

'use strict';

/**
 * Season slot intentions (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 5 of
 * docs/SEASON_ARC_DESIGN_NOTE.md):
 *
 *   A3. "Each future slot can carry an intention: story purpose, career
 *   focus, desired pressure, the story thread it continues, and the outcome
 *   range hoped for. Intentions are auto-drafted from the phase and the
 *   season so far, labelled, and editable."
 *   Q7. "Pressure is Low · Medium · High · Peak. Desired is set in the
 *   slot's intention [...]"
 *   Q10 (accepted). "a tier range (e.g. "pass to slay") that also sets the
 *   brief's designed_intent and allowed_outcomes at Start Episode, so
 *   there's one source."
 *   Q12 (accepted). "draft only the next open slot, on acceptance and on
 *   demand, not all 24 at once."
 *
 * The story thread (A3) is chosen from the show's threads that are not
 * closed (storyThreadService, build PR 7); a draft never changes it.
 *
 *   A9. "A started slot's intention stays editable while its episode is a
 *   draft; saving updates the episode's season snapshot (and the brief's
 *   intent/allowed outcomes per Q10). It locks for good when the episode is
 *   accepted."
 *   A10. "A slot can hold up to three story purposes, one marked primary,
 *   each optionally tied to a story thread. Desired pressure and the outcome
 *   range stay single per slot. [...]"
 *
 * story_purposes holds the purposes, primary first; story_purpose and
 * story_thread_id stay as the primary's mirror, so every reader of the
 * primary keeps working.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { PRESSURE_LEVELS } = require('./seasonSlotService');
const { loadSeason } = require('./seasonLoader');
const { fromArc, seasonLines } = require('./seasonLine');
const {
  seasonAiContext, askModel, isBudgetRefusal, bullets, phaseLine, threadLine, goalLine, debtLines,
} = require('./seasonAiContext');

// Lowest to highest.
const OUTCOME_TIERS = ['fail', 'safe', 'pass', 'slay'];
const MAX_PURPOSES = 3;
// A started slot's draft reads its episode's script up to this many characters.
const SCRIPT_EXCERPT = 4000;
const MODELS = ['claude-haiku-4-5-20251001'];
const SOURCES = Object.freeze({ DRAFTED: 'auto-drafted', EDITED: 'edited' });

class SeasonIntentionError extends Error {
  constructor(message, status = 409, code = 'SEASON_INTENTION_CONFLICT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function text(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Normalises an intention. Throws a 400 SeasonIntentionError on a pressure
 * outside Low · Medium · High · Peak or a malformed outcome range.
 */
function normaliseIntention(body = {}) {
  const pressure = body.desired_pressure == null || body.desired_pressure === '' ? null : String(body.desired_pressure);
  if (pressure && !PRESSURE_LEVELS.includes(pressure)) {
    throw new SeasonIntentionError(`desired_pressure must be one of ${PRESSURE_LEVELS.join(', ')}`, 400, 'SEASON_INTENTION_INVALID');
  }
  let range = null;
  if (body.outcome_range && (body.outcome_range.min || body.outcome_range.max)) {
    const min = body.outcome_range.min || body.outcome_range.max;
    const max = body.outcome_range.max || body.outcome_range.min;
    if (!OUTCOME_TIERS.includes(min) || !OUTCOME_TIERS.includes(max)) {
      throw new SeasonIntentionError(`outcome_range tiers must be ${OUTCOME_TIERS.join(', ')}`, 400, 'SEASON_INTENTION_INVALID');
    }
    if (OUTCOME_TIERS.indexOf(min) > OUTCOME_TIERS.indexOf(max)) {
      throw new SeasonIntentionError('outcome_range min must not be above max', 400, 'SEASON_INTENTION_INVALID');
    }
    range = { min, max };
  }
  const out = {
    story_purpose: text(body.story_purpose, 1000),
    career_focus: text(body.career_focus, 300),
    desired_pressure: pressure,
    outcome_range: range,
  };
  // Only when given: a draft (and an edit that leaves it out) keeps the thread.
  if (body.story_thread_id !== undefined) out.story_thread_id = body.story_thread_id || null;
  // A10: the purposes, when given, replace the single purpose and thread.
  if (Array.isArray(body.story_purposes)) {
    const purposes = normalisePurposes(body.story_purposes);
    out.story_purposes = purposes;
    out.story_purpose = purposes[0]?.text || null;
    out.story_thread_id = purposes[0]?.story_thread_id || null;
  }
  return out;
}

/**
 * A10: up to three purposes, one primary, each with an optional thread.
 * Empty ones are dropped; with none marked, the first is primary. Returned
 * primary first. Throws a 400 on more than three or more than one primary.
 */
function normalisePurposes(list) {
  const purposes = list
    .map((p) => ({
      text: text(p?.text, 1000) || '',
      primary: p?.primary === true,
      story_thread_id: p?.story_thread_id || null,
    }))
    .filter((p) => p.text || p.story_thread_id);
  if (purposes.length > MAX_PURPOSES) {
    throw new SeasonIntentionError(`A slot holds up to ${MAX_PURPOSES} story purposes`, 400, 'SEASON_INTENTION_INVALID');
  }
  const primaries = purposes.filter((p) => p.primary).length;
  if (primaries > 1) {
    throw new SeasonIntentionError('Only one story purpose can be primary', 400, 'SEASON_INTENTION_INVALID');
  }
  if (purposes.length && primaries === 0) purposes[0].primary = true;
  return [...purposes.filter((p) => p.primary), ...purposes.filter((p) => !p.primary)];
}

function parsePurposes(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch (err) {
    console.error('[seasonIntention] story_purposes parse failed:', err.message);
    return [];
  }
}

/**
 * A slot's purposes as stored, primary first; a slot written before A10 has
 * only story_purpose and story_thread_id. Each carries its source (Edited or
 * Auto-drafted); one stored without it takes the slot's.
 */
function purposesOf(slot) {
  const fallback = slot?.intention_source === SOURCES.EDITED ? SOURCES.EDITED : SOURCES.DRAFTED;
  const withSource = (p) => ({ ...p, source: p.source === SOURCES.EDITED || p.source === SOURCES.DRAFTED ? p.source : fallback });
  const stored = parsePurposes(slot?.story_purposes);
  if (stored.length) return [...stored.filter((p) => p.primary), ...stored.filter((p) => !p.primary)].map(withSource);
  return slot?.story_purpose ? [withSource({ text: slot.story_purpose, primary: true, story_thread_id: slot.story_thread_id || null })] : [];
}

/**
 * The sources of purposes Evoni saves: one she left as it was drafted (same
 * text and thread) stays Auto-drafted; any other is Edited.
 */
function markSaved(purposes, current) {
  const drafted = current.filter((p) => p.source === SOURCES.DRAFTED);
  return purposes.map((p) => ({
    ...p,
    source: drafted.some((d) => d.text === p.text && (d.story_thread_id || null) === (p.story_thread_id || null))
      ? SOURCES.DRAFTED : SOURCES.EDITED,
  }));
}

/** Q10: the brief fields an outcome range sets. Null when there is no range. */
function outcomeRangeToBrief(range) {
  if (!range || !OUTCOME_TIERS.includes(range.min) || !OUTCOME_TIERS.includes(range.max)) return null;
  const lo = OUTCOME_TIERS.indexOf(range.min);
  const hi = OUTCOME_TIERS.indexOf(range.max);
  return { designed_intent: range.max, allowed_outcomes: OUTCOME_TIERS.slice(lo, hi + 1) };
}

/**
 * A9: the slot whose intention Evoni edits: a future slot, or a started one
 * whose episode is still a draft. It locks for good once the episode is
 * accepted.
 */
async function loadEditableSlot(sequelize, showId, slotId, transaction) {
  const [[slot]] = await sequelize.query(
    `SELECT s.id, s.arc_id, s.slot_number, s.phase, s.season_number, s.episode_id, s.event_id, s.locked_at, s.accepted_at,
            s.intention_source, s.story_purpose, s.story_purposes, s.story_thread_id,
            s.career_focus, s.desired_pressure, s.outcome_range,
            ep.id AS live_episode_id, ep.evaluation_status
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
      WHERE s.id = :slotId AND s.show_id = :showId AND s.deleted_at IS NULL`,
    { replacements: { slotId, showId }, transaction });
  if (!slot) throw new SeasonIntentionError('Slot not found', 404, 'SEASON_SLOT_NOT_FOUND');
  if (slot.accepted_at || slot.evaluation_status === 'accepted') {
    throw new SeasonIntentionError(`E${slot.slot_number}'s episode is accepted: its intention is locked for good`, 409, 'SEASON_SLOT_ACCEPTED');
  }
  if (!slot.episode_id && slot.locked_at) {
    throw new SeasonIntentionError(`E${slot.slot_number} has started: its intention is locked with it`, 409, 'SEASON_SLOT_LOCKED');
  }
  slot.started = Boolean(slot.live_episode_id);
  return slot;
}

/**
 * The purposes to store. Given purposes (A10) replace them all. A single
 * story_purpose (a draft, or an older client) replaces the primary's text,
 * and its thread when one is given, keeping the other purposes.
 */
async function purposesToWrite(sequelize, slotId, intention, source, transaction) {
  const [[slot]] = await sequelize.query(
    'SELECT story_purpose, story_purposes, story_thread_id, intention_source FROM season_slots WHERE id = :slotId',
    { replacements: { slotId }, transaction });
  const current = purposesOf(slot);
  if (intention.story_purposes !== undefined) {
    return source === SOURCES.EDITED
      ? markSaved(intention.story_purposes, current)
      : intention.story_purposes.map((p) => ({ ...p, source }));
  }
  const others = current.filter((p) => !p.primary);
  if (!intention.story_purpose) {
    return others.map((p, i) => ({ ...p, primary: i === 0 }));
  }
  const primary = current.find((p) => p.primary);
  const thread = intention.story_thread_id !== undefined ? intention.story_thread_id : (primary?.story_thread_id || null);
  return [{ text: intention.story_purpose, primary: true, story_thread_id: thread || null, source }, ...others];
}

async function writeIntention(sequelize, slotId, intention, source, transaction) {
  const purposes = await purposesToWrite(sequelize, slotId, intention, source, transaction);
  const primary = purposes[0] || null;
  await sequelize.query(
    `UPDATE season_slots SET story_purpose = :story_purpose, story_purposes = CAST(:story_purposes AS jsonb),
            story_thread_id = :story_thread_id, career_focus = :career_focus,
            desired_pressure = :desired_pressure, outcome_range = CAST(:outcome_range AS jsonb),
            intention_source = :source, updated_at = NOW()
      WHERE id = :slotId`,
    { replacements: {
      story_purpose: primary?.text || null,
      story_purposes: purposes.length ? JSON.stringify(purposes) : null,
      story_thread_id: primary?.story_thread_id || null,
      career_focus: intention.career_focus,
      desired_pressure: intention.desired_pressure,
      outcome_range: intention.outcome_range ? JSON.stringify(intention.outcome_range) : null,
      source, slotId,
    }, transaction });
  return purposes;
}

/**
 * Evoni's edit of a slot's intention (A3): labelled Edited. A future slot,
 * or (A9) a started one whose episode is still a draft: then the episode's
 * season snapshot, and the brief's intent and allowed outcomes (Q10), are
 * updated from it. Locked for good once the episode is accepted.
 */
async function saveIntention(sequelize, showId, slotId, body) {
  const intention = normaliseIntention(body);
  const slot = await loadEditableSlot(sequelize, showId, slotId);
  const threadIds = new Set([
    ...(intention.story_purposes || []).map((p) => p.story_thread_id),
    intention.story_thread_id,
  ].filter(Boolean));
  if (threadIds.size) {
    const { assertThreadChoosable } = require('./storyThreadService');
    for (const id of threadIds) await assertThreadChoosable(sequelize, showId, id);
  }
  const purposes = await writeIntention(sequelize, slotId, intention, SOURCES.EDITED);
  let seasonContext = null;
  if (slot.started) {
    const { snapshotEpisode } = require('./seasonSlotService');
    seasonContext = await snapshotEpisode(sequelize, { slotId, episodeId: slot.live_episode_id });
  }
  return {
    slot_number: slot.slot_number,
    started: slot.started,
    season_context: seasonContext,
    intention: {
      ...intention,
      story_purposes: purposes,
      story_purpose: purposes[0]?.text || null,
      story_thread_id: purposes[0]?.story_thread_id || null,
      source: SOURCES.EDITED,
    },
  };
}

/** What the draft is made from: the phase and the season so far (A3). */
async function draftingContext(sequelize, showId, slot) {
  // The slot's own arc and its slots (services/seasonLoader).
  const season = await loadSeason(sequelize, showId, { arcId: slot.arc_id });
  const arc = season?.arc || null;
  const slots = season?.slots || [];
  const phase = (arc?.phases || []).find((p) => Number(p.phase) === Number(slot.phase)) || {};
  // The eight slots before this one with a purpose or a result, oldest first.
  const earlier = slots
    .filter((s) => s.slot_number < slot.slot_number && (s.story_purpose != null || s.actual_outcome != null))
    .slice(-8)
    .map((s) => ({
      slot_number: s.slot_number, story_purpose: s.story_purpose, actual_outcome: s.actual_outcome,
      actual_pressure: s.actual_pressure, title: s.episode_title || null,
    }));
  let debt = arc?.narrative_debt ?? [];
  if (typeof debt === 'string') {
    try { debt = JSON.parse(debt); } catch (err) { console.error('[seasonIntention] JSON parse failed:', err.message); debt = []; }
  }
  // The last approved story record before this slot, and what Lala still
  // owes people (services/storyCarryForward; Evoni, 2026-10-23).
  const before = slots.filter((s) => s.slot_number < slot.slot_number && s.live_episode_id && s.episode_number != null);
  const last = before.length ? Math.max(...before.map((s) => Number(s.episode_number))) : null;
  const { goals, threads, carried } = await seasonAiContext(sequelize, showId, {
    goals: { limit: 8 }, threads: { limit: 8, order: 'desc' }, carried: { before: last != null ? last + 1 : null },
  });
  const planned = await plannedAround(sequelize, showId, slot, slots);
  return { arc, phase, earlier, goals, debt: Array.isArray(debt) ? debt : [], threads, carried, ...planned };
}

// What the draft reads of the plan around the slot, each part capped.
const AROUND = { later: 6, twists: 6, reveals: 6, chars: 200 };
const clipText = (v, n = AROUND.chars) => {
  const t = String(v || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * The plan around a slot (Evoni's review, 2026-10-24, items 16 and D): its
 * pencilled event, the twists it plants or pays off, the secrets it hints
 * at or reveals, the purposes of the slots already planned after it, and
 * the confirmed relationships between the season's people. Each part is
 * empty when there is none or it cannot be read.
 */
async function plannedAround(sequelize, showId, slot, slots = []) {
  const safe = async (what, empty, read) => {
    try { return await read(); } catch (err) {
      console.error(`[seasonIntention] ${what} could not be read (the draft goes without it):`, err.message);
      return empty;
    }
  };
  const event = slot.event_id ? await safe('the pencilled event', null, async () => {
    const [[ev]] = await sequelize.query(
      `SELECT name, event_type, host, venue_name, dress_code, description FROM world_events
        WHERE id = :id AND deleted_at IS NULL`, { replacements: { id: slot.event_id } });
    return ev || null;
  }) : null;
  const twists = await safe('the twists', { plant: [], payoff: [] },
    () => require('./seasonTwists').twistsAtSlot(sequelize, slot));
  const reveals = await safe('the reveals', [], () => require('./seasonRevealPlan').revealsAtSlot(sequelize, slot.id));
  const later = slots
    .filter((s) => s.slot_number > slot.slot_number && s.story_purpose != null)
    .slice(0, AROUND.later)
    .map((s) => ({ slot_number: s.slot_number, story_purpose: s.story_purpose }));
  const { relationships } = await seasonAiContext(sequelize, showId, { relationships: true });
  return { event, twists, reveals, later, relationships };
}

/** The plan around the slot as prompt text; '' with none of it. */
function aroundBlock(ctx) {
  const out = [];
  const ev = ctx.event;
  if (ev) {
    out.push(`The event pencilled into this slot: ${ev.name}${ev.event_type ? ` (${ev.event_type})` : ''}${ev.host ? `, hosted by ${ev.host}` : ''}${ev.venue_name ? ` at ${ev.venue_name}` : ''}${ev.dress_code ? `; dress code: ${ev.dress_code}` : ''}${ev.description ? `. ${clipText(ev.description)}` : ''}`);
  }
  const who = (t) => (t.characters?.length ? ` (with ${t.characters.join(', ')})` : '');
  const twists = [
    ...(ctx.twists?.plant || []).map((t) => `- PLANT: ${t.title}${t.description ? ` — ${clipText(t.description)}` : ''}${who(t)}`),
    ...(ctx.twists?.payoff || []).map((t) => `- PAY OFF: ${t.title}${t.description ? ` — ${clipText(t.description)}` : ''}${t.planted_in ? ` (planted in E${t.planted_in.episode_number})` : ''}${who(t)}`),
  ].slice(0, AROUND.twists);
  if (twists.length) out.push(`Season twists due in this slot:\n${twists.join('\n')}`);
  const reveals = (ctx.reveals || []).slice(0, AROUND.reveals)
    .map((r) => `- ${r.intent === 'reveal' ? 'Reveal' : 'Hint at'} ${r.character_name}'s secret: ${clipText(r.text)}${r.note ? ` (${clipText(r.note, 120)})` : ''}`);
  if (reveals.length) out.push(`Secrets this slot hints at or reveals:\n${reveals.join('\n')}`);
  const later = (ctx.later || []).map((l) => `- E${l.slot_number}: ${clipText(l.story_purpose)}`);
  if (later.length) out.push(`Already planned after this slot (lead toward these; do not do them early):\n${later.join('\n')}`);
  if (ctx.relationships) out.push(ctx.relationships.trim());
  return out.length ? `\n${out.join('\n\n')}\n` : '';
}

function buildDraftPrompt(slot, ctx) {
  const label = `S${slot.season_number || 1} · E${slot.slot_number}`;
  const earlier = ctx.earlier.length
    ? ctx.earlier.map((e) => `- E${e.slot_number}${e.title ? ` "${e.title}"` : ''}: ${e.actual_outcome ? `result ${e.actual_outcome}, pressure ${e.actual_pressure || '?'}` : 'not yet made'}${e.story_purpose ? `; purpose: ${e.story_purpose}` : ''}`).join('\n')
    : '- Nothing yet: this is the start of the season.';
  const goals = bullets(ctx.goals, (g) => goalLine(g), '- None active.');
  const debt = debtLines(ctx.debt);
  const threads = bullets(ctx.threads || [], (t) => threadLine(t, { id: false }), '- None.');
  return `You plan the season of "Styling Adventures with Lala", a luxury life-simulator show about Lala's fashion career.

Draft the intention for episode slot ${label} of the season "${ctx.arc?.title || 'Season 1'}".
Its phase: ${phase(ctx.phase)}

${seasonLines(fromArc(ctx.arc), { title: false, part: false }).map((l) => `${l}\n`).join('')}The season so far (most recent last):
${earlier}

Lala's active career goals:
${goals}

Narrative debt she carries:
${debt}

Open story threads:
${threads}
${ctx.carried ? `\n${ctx.carried}` : ''}${aroundBlock(ctx)}
Return JSON only:
{
  "story_purpose": "One sentence: what this episode is for in Lala's story (max 200 chars).",
  "career_focus": "A few words: the career goal or stat this episode moves.",
  "desired_pressure": "One of Low, Medium, High, Peak.",
  "outcome_range": { "min": "fail|safe|pass|slay", "max": "fail|safe|pass|slay" }
}
Vary the pressure across the season; follow a hard episode with room to recover; do not repeat the previous purpose.`;

  function phase(p) {
    if (!p || !p.title) return 'unknown';
    return phaseLine(p);
  }
}

function parseDraft(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('draft had no JSON');
  return normaliseIntention(JSON.parse(match[0]));
}

/**
 * A9, as changed (Evoni, 2026-10-01): a started slot whose episode is a draft
 * is drafted from that episode: its event, and its script so far.
 */
async function startedEpisodeContext(sequelize, episodeId) {
  const [[episode]] = await sequelize.query(
    'SELECT title, script_content FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId } });
  const [[event]] = await sequelize.query(
    `SELECT name, event_type, host, venue_name, dress_code, description FROM world_events
      WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId } });
  const script = String(episode?.script_content || '').trim();
  return {
    title: episode?.title || null,
    event: event || null,
    script: script.length > SCRIPT_EXCERPT ? `${script.slice(0, SCRIPT_EXCERPT)}\n[…]` : script,
  };
}

function startedEpisodeBlock(started) {
  const ev = started.event;
  const eventLine = ev
    ? `${ev.name}${ev.event_type ? ` (${ev.event_type})` : ''}${ev.host ? `, hosted by ${ev.host}` : ''}${ev.venue_name ? ` at ${ev.venue_name}` : ''}${ev.dress_code ? `; dress code: ${ev.dress_code}` : ''}${ev.description ? `. ${ev.description}` : ''}`
    : 'None attached.';
  return `

This episode has already started. Draft the intention that fits what it is, from its event and its script:
Episode: ${started.title ? `"${started.title}"` : 'untitled'}
Event: ${eventLine}
Script so far:
${started.script || '(no script yet)'}`;
}

/**
 * A started slot's draft: purposes Evoni edited are never overwritten. The
 * drafted purpose takes the place of the first purpose that is not hers (its
 * thread kept), else is added when there is room, else is left out. Career
 * focus, pressure and range are filled from the draft unless Evoni edited the
 * intention and the field is already set.
 */
function mergeStartedDraft(slot, intention) {
  const purposes = purposesOf(slot).map((p) => ({ ...p }));
  let placed = null;
  if (intention.story_purpose) {
    const open = purposes.findIndex((p) => p.source !== SOURCES.EDITED);
    if (open >= 0) {
      purposes[open] = { ...purposes[open], text: intention.story_purpose, source: SOURCES.DRAFTED };
      placed = purposes[open].primary ? 'primary' : 'replaced';
    } else if (purposes.length < MAX_PURPOSES) {
      purposes.push({ text: intention.story_purpose, primary: purposes.length === 0, story_thread_id: null, source: SOURCES.DRAFTED });
      placed = 'added';
    }
  }
  const edited = slot.intention_source === SOURCES.EDITED;
  const keep = (field, value) => (edited && slot[field] != null && slot[field] !== '' ? slot[field] : value);
  return {
    purposes,
    placed,
    kept_edited: purposes.filter((p) => p.source === SOURCES.EDITED).length,
    career_focus: keep('career_focus', intention.career_focus),
    desired_pressure: keep('desired_pressure', intention.desired_pressure),
    outcome_range: keep('outcome_range', intention.outcome_range),
    source: edited || purposes.some((p) => p.source === SOURCES.EDITED) ? SOURCES.EDITED : SOURCES.DRAFTED,
  };
}

async function writeStartedDraft(sequelize, slot, intention) {
  const merged = mergeStartedDraft(slot, intention);
  const primary = merged.purposes[0] || null;
  const range = typeof merged.outcome_range === 'string' ? merged.outcome_range : (merged.outcome_range ? JSON.stringify(merged.outcome_range) : null);
  await sequelize.query(
    `UPDATE season_slots SET story_purpose = :story_purpose, story_purposes = CAST(:story_purposes AS jsonb),
            story_thread_id = :story_thread_id, career_focus = :career_focus,
            desired_pressure = :desired_pressure, outcome_range = CAST(:outcome_range AS jsonb),
            intention_source = :source, updated_at = NOW()
      WHERE id = :slotId`,
    { replacements: {
      story_purpose: primary?.text || null,
      story_purposes: merged.purposes.length ? JSON.stringify(merged.purposes) : null,
      story_thread_id: primary?.story_thread_id || null,
      career_focus: merged.career_focus || null,
      desired_pressure: merged.desired_pressure || null,
      outcome_range: range,
      source: merged.source,
      slotId: slot.id,
    } });
  return merged;
}

/**
 * Drafts a slot's intention (A3) with Haiku (logged and budget-gated by
 * aiCostTracker), labelled Auto-drafted. A future slot: an Edited intention
 * is replaced only with force (Evoni's confirm). A started slot whose episode
 * is a draft (A9, as changed 2026-10-01): drafted from its episode's event
 * and script, never overwriting purposes Evoni edited, and the episode's
 * season snapshot is updated. Refused once the episode is accepted.
 */
async function draftIntention(sequelize, showId, slotId, { force = false, anthropic = null } = {}) {
  const slot = await loadEditableSlot(sequelize, showId, slotId);
  if (!slot.started && slot.intention_source === SOURCES.EDITED && !force) {
    throw new SeasonIntentionError(`E${slot.slot_number}'s intention was edited; redrafting would replace it`, 409, 'SEASON_INTENTION_EDITED');
  }
  const ctx = await draftingContext(sequelize, showId, slot);
  let prompt = buildDraftPrompt(slot, ctx);
  if (slot.started) prompt += startedEpisodeBlock(await startedEpisodeContext(sequelize, slot.live_episode_id));
  let intention;
  try {
    intention = await askModel({
      api: anthropic || getClient(), models: MODELS, maxTokens: 400, prompt, label: 'seasonIntention draft',
      read: (response) => parseDraft(response?.content?.[0]?.text),
    });
  } catch (err) {
    console.error('[seasonIntention] drafting failed:', err.message);
    if (isBudgetRefusal(err)) throw new SeasonIntentionError(`${err.message} Nothing was drafted.`, 429, 'AI_BUDGET_EXCEEDED');
    throw new SeasonIntentionError(`Drafting failed: ${err.message || 'unknown error'}`, 502, 'SEASON_INTENTION_DRAFT_FAILED');
  }
  if (slot.started) {
    const merged = await writeStartedDraft(sequelize, slot, intention);
    const { snapshotEpisode } = require('./seasonSlotService');
    const seasonContext = await snapshotEpisode(sequelize, { slotId, episodeId: slot.live_episode_id });
    return {
      slot_number: slot.slot_number,
      started: true,
      placed: merged.placed,
      kept_edited: merged.kept_edited,
      season_context: seasonContext,
      intention: {
        story_purposes: merged.purposes,
        story_purpose: merged.purposes[0]?.text || null,
        career_focus: merged.career_focus || null,
        desired_pressure: merged.desired_pressure || null,
        outcome_range: merged.outcome_range || null,
        source: merged.source,
      },
    };
  }
  await writeIntention(sequelize, slotId, intention, SOURCES.DRAFTED);
  return { slot_number: slot.slot_number, intention: { ...intention, source: SOURCES.DRAFTED } };
}

/**
 * Q12: on acceptance, draft the next open slot only, and only when its
 * intention is empty or still Auto-drafted. Returns the slot number drafted,
 * or null.
 */
async function draftNextSlot(sequelize, showId, { anthropic = null } = {}) {
  const [[next]] = await sequelize.query(
    `SELECT s.id, s.intention_source FROM season_slots s
       JOIN show_arcs a ON a.id = s.arc_id AND a.status = 'active' AND a.deleted_at IS NULL
      WHERE s.show_id = :showId AND s.deleted_at IS NULL AND s.episode_id IS NULL AND s.locked_at IS NULL
      ORDER BY s.slot_number ASC LIMIT 1`,
    { replacements: { showId } });
  if (!next || next.intention_source === SOURCES.EDITED) return null;
  const result = await draftIntention(sequelize, showId, next.id, { anthropic });
  return result.slot_number;
}

/**
 * Accepting drafts from "Draft the season" (seasonSetupService.draftSeason;
 * Evoni, 2026-10-24): each accepted draft { slot_id, story_purpose,
 * desired_pressure, story_thread_id } is written through this service's own
 * path (normaliseIntention, the thread check, writeIntention), labelled
 * Auto-drafted: it is the AI's wording until she edits it. The slot's career
 * focus and outcome range are kept, and its thread unless the draft names
 * one. A slot she edited, or that started, since the draft is skipped, not
 * overwritten. All in one transaction. Returns { saved, skipped }.
 */
async function acceptDrafts(sequelize, showId, drafts) {
  if (!Array.isArray(drafts) || !drafts.length) {
    throw new SeasonIntentionError('There are no drafts to accept', 400, 'SEASON_INTENTION_INVALID');
  }
  const { assertThreadChoosable } = require('./storyThreadService');
  return sequelize.transaction(async (transaction) => {
    const saved = [];
    const skipped = [];
    for (const d of drafts) {
      if (!d?.slot_id) throw new SeasonIntentionError('Each draft names its slot', 400, 'SEASON_INTENTION_INVALID');
      let slot;
      try {
        slot = await loadEditableSlot(sequelize, showId, d.slot_id, transaction);
      } catch (err) {
        if (err.code !== 'SEASON_SLOT_LOCKED' && err.code !== 'SEASON_SLOT_ACCEPTED') throw err;
        console.error('[seasonIntention] accept draft skipped a started slot:', err.message);
        skipped.push({ slot_id: d.slot_id, reason: 'started' });
        continue;
      }
      if (slot.started || slot.locked_at) { skipped.push({ slot_id: d.slot_id, slot_number: slot.slot_number, reason: 'started' }); continue; }
      if (slot.intention_source === SOURCES.EDITED) { skipped.push({ slot_id: d.slot_id, slot_number: slot.slot_number, reason: 'edited' }); continue; }
      const body = {
        story_purpose: d.story_purpose,
        desired_pressure: d.desired_pressure || null,
        career_focus: slot.career_focus,
        outcome_range: typeof slot.outcome_range === 'string' ? JSON.parse(slot.outcome_range) : slot.outcome_range,
      };
      if (d.story_thread_id) body.story_thread_id = d.story_thread_id;
      const intention = normaliseIntention(body);
      if (!intention.story_purpose) throw new SeasonIntentionError(`E${slot.slot_number}'s draft has no story purpose`, 400, 'SEASON_INTENTION_INVALID');
      if (intention.story_thread_id) await assertThreadChoosable(sequelize, showId, intention.story_thread_id);
      await writeIntention(sequelize, slot.id, intention, SOURCES.DRAFTED, transaction);
      saved.push(slot.slot_number);
    }
    return { saved, skipped };
  });
}

module.exports = {
  OUTCOME_TIERS,
  MAX_PURPOSES,
  SOURCES,
  SeasonIntentionError,
  normaliseIntention,
  normalisePurposes,
  purposesOf,
  outcomeRangeToBrief,
  saveIntention,
  draftIntention,
  draftNextSlot,
  acceptDrafts,
  buildDraftPrompt,
  aroundBlock,
};

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

// Lowest to highest.
const OUTCOME_TIERS = ['fail', 'safe', 'pass', 'slay'];
const MAX_PURPOSES = 3;
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
 * only story_purpose and story_thread_id.
 */
function purposesOf(slot) {
  const stored = parsePurposes(slot?.story_purposes);
  if (stored.length) return [...stored.filter((p) => p.primary), ...stored.filter((p) => !p.primary)];
  return slot?.story_purpose ? [{ text: slot.story_purpose, primary: true, story_thread_id: slot.story_thread_id || null }] : [];
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
    `SELECT s.id, s.arc_id, s.slot_number, s.phase, s.season_number, s.episode_id, s.locked_at, s.accepted_at,
            s.intention_source, s.story_purpose, s.story_purposes, s.story_thread_id,
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

async function loadFutureSlot(sequelize, showId, slotId, transaction) {
  const [[slot]] = await sequelize.query(
    `SELECT id, arc_id, slot_number, phase, season_number, episode_id, locked_at, intention_source
       FROM season_slots WHERE id = :slotId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { slotId, showId }, transaction });
  if (!slot) throw new SeasonIntentionError('Slot not found', 404, 'SEASON_SLOT_NOT_FOUND');
  if (slot.episode_id || slot.locked_at) {
    throw new SeasonIntentionError(`E${slot.slot_number} has started: its intention is locked with it`, 409, 'SEASON_SLOT_LOCKED');
  }
  return slot;
}

/**
 * The purposes to store. Given purposes (A10) replace them all. A single
 * story_purpose (a draft, or an older client) replaces the primary's text,
 * and its thread when one is given, keeping the other purposes.
 */
async function purposesToWrite(sequelize, slotId, intention) {
  if (intention.story_purposes !== undefined) return intention.story_purposes;
  const [[slot]] = await sequelize.query(
    'SELECT story_purpose, story_purposes, story_thread_id FROM season_slots WHERE id = :slotId',
    { replacements: { slotId } });
  const current = purposesOf(slot);
  const others = current.filter((p) => !p.primary);
  if (!intention.story_purpose) {
    return others.map((p, i) => ({ ...p, primary: i === 0 }));
  }
  const primary = current.find((p) => p.primary);
  const thread = intention.story_thread_id !== undefined ? intention.story_thread_id : (primary?.story_thread_id || null);
  return [{ text: intention.story_purpose, primary: true, story_thread_id: thread || null }, ...others];
}

async function writeIntention(sequelize, slotId, intention, source) {
  const purposes = await purposesToWrite(sequelize, slotId, intention);
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
    } });
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
  const [[arc]] = await sequelize.query(
    'SELECT title, tagline, phases, narrative_debt FROM show_arcs WHERE id = :arcId',
    { replacements: { arcId: slot.arc_id } });
  const parse = (v, d) => {
    if (v == null) return d;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch (err) { console.error('[seasonIntention] JSON parse failed:', err.message); return d; }
  };
  const phases = parse(arc?.phases, []);
  const phase = (Array.isArray(phases) ? phases : []).find((p) => Number(p.phase) === Number(slot.phase)) || {};
  const [earlier] = await sequelize.query(
    `SELECT s.slot_number, s.story_purpose, s.actual_outcome, s.actual_pressure, ep.title
       FROM season_slots s LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.slot_number < :n AND s.deleted_at IS NULL
        AND (s.story_purpose IS NOT NULL OR s.actual_outcome IS NOT NULL)
      ORDER BY s.slot_number DESC LIMIT 8`,
    { replacements: { arcId: slot.arc_id, n: slot.slot_number } });
  const [goals] = await sequelize.query(
    `SELECT title, target_metric, current_value, target_value FROM career_goals
      WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL ORDER BY priority ASC LIMIT 8`,
    { replacements: { showId } }).catch((err) => { console.error('[seasonIntention] goals load failed:', err.message); return [[]]; });
  const debt = parse(arc?.narrative_debt, []);
  const [threads] = await sequelize.query(
    `SELECT title FROM show_story_threads WHERE show_id = :showId AND status <> 'closed' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 8`,
    { replacements: { showId } }).catch((err) => { console.error('[seasonIntention] threads load failed:', err.message); return [[]]; });
  return { arc, phase, earlier: earlier.reverse(), goals, debt: Array.isArray(debt) ? debt : [], threads };
}

function buildDraftPrompt(slot, ctx) {
  const label = `S${slot.season_number || 1} · E${slot.slot_number}`;
  const earlier = ctx.earlier.length
    ? ctx.earlier.map((e) => `- E${e.slot_number}${e.title ? ` "${e.title}"` : ''}: ${e.actual_outcome ? `result ${e.actual_outcome}, pressure ${e.actual_pressure || '?'}` : 'not yet made'}${e.story_purpose ? `; purpose: ${e.story_purpose}` : ''}`).join('\n')
    : '- Nothing yet: this is the start of the season.';
  const goals = ctx.goals.length
    ? ctx.goals.map((g) => `- ${g.title} (${g.target_metric} ${g.current_value}/${g.target_value})`).join('\n')
    : '- None active.';
  const debt = ctx.debt.length ? ctx.debt.map((d) => `- ${d.narrative_weight || d.goal_title}`).join('\n') : '- None.';
  const threads = (ctx.threads || []).length ? ctx.threads.map((t) => `- ${t.title}`).join('\n') : '- None.';
  return `You plan the season of "Styling Adventures with Lala", a luxury life-simulator show about Lala's fashion career.

Draft the intention for episode slot ${label} of the season "${ctx.arc?.title || 'Season 1'}".
Its phase: ${phase(ctx.phase)}

The season so far (most recent last):
${earlier}

Lala's active career goals:
${goals}

Narrative debt she carries:
${debt}

Open story threads:
${threads}

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
    return `Phase ${p.phase}: ${p.title}${p.tagline ? ` ("${p.tagline}")` : ''}${p.emotional_arc ? `; emotional arc: ${p.emotional_arc}` : ''}`;
  }
}

function parseDraft(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('draft had no JSON');
  return normaliseIntention(JSON.parse(match[0]));
}

/**
 * Drafts a future slot's intention (A3) with Haiku (logged and budget-gated
 * by aiCostTracker), labelled Auto-drafted. An Edited intention is replaced
 * only with force (Evoni's confirm).
 */
async function draftIntention(sequelize, showId, slotId, { force = false, anthropic = null } = {}) {
  const slot = await loadFutureSlot(sequelize, showId, slotId);
  if (slot.intention_source === SOURCES.EDITED && !force) {
    throw new SeasonIntentionError(`E${slot.slot_number}'s intention was edited; redrafting would replace it`, 409, 'SEASON_INTENTION_EDITED');
  }
  const ctx = await draftingContext(sequelize, showId, slot);
  const prompt = buildDraftPrompt(slot, ctx);
  const api = anthropic || getClient();
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await api.messages.create({
        model: MODELS[0],
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const intention = parseDraft(response?.content?.[0]?.text);
      await writeIntention(sequelize, slotId, intention, SOURCES.DRAFTED);
      return { slot_number: slot.slot_number, intention: { ...intention, source: SOURCES.DRAFTED } };
    } catch (err) {
      lastErr = err;
      console.error(`[seasonIntention] draft attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw new SeasonIntentionError(`Drafting failed: ${lastErr?.message || 'unknown error'}`, 502, 'SEASON_INTENTION_DRAFT_FAILED');
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
  buildDraftPrompt,
};

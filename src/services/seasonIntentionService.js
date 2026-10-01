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
 */

const Anthropic = require('@anthropic-ai/sdk');
const { PRESSURE_LEVELS } = require('./seasonSlotService');

// Lowest to highest.
const OUTCOME_TIERS = ['fail', 'safe', 'pass', 'slay'];
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
  return out;
}

/** Q10: the brief fields an outcome range sets. Null when there is no range. */
function outcomeRangeToBrief(range) {
  if (!range || !OUTCOME_TIERS.includes(range.min) || !OUTCOME_TIERS.includes(range.max)) return null;
  const lo = OUTCOME_TIERS.indexOf(range.min);
  const hi = OUTCOME_TIERS.indexOf(range.max);
  return { designed_intent: range.max, allowed_outcomes: OUTCOME_TIERS.slice(lo, hi + 1) };
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

async function writeIntention(sequelize, slotId, intention, source) {
  const setThread = intention.story_thread_id !== undefined;
  await sequelize.query(
    `UPDATE season_slots SET story_purpose = :story_purpose, career_focus = :career_focus,
            desired_pressure = :desired_pressure, outcome_range = CAST(:outcome_range AS jsonb),
            ${setThread ? 'story_thread_id = :story_thread_id,' : ''}
            intention_source = :source, updated_at = NOW()
      WHERE id = :slotId`,
    { replacements: {
      ...intention,
      story_thread_id: setThread ? intention.story_thread_id : null,
      outcome_range: intention.outcome_range ? JSON.stringify(intention.outcome_range) : null,
      source, slotId,
    } });
}

/** Evoni's edit of a future slot's intention (A3): labelled Edited. */
async function saveIntention(sequelize, showId, slotId, body) {
  const intention = normaliseIntention(body);
  const slot = await loadFutureSlot(sequelize, showId, slotId);
  if (intention.story_thread_id) {
    const { assertThreadChoosable } = require('./storyThreadService');
    await assertThreadChoosable(sequelize, showId, intention.story_thread_id);
  }
  await writeIntention(sequelize, slotId, intention, SOURCES.EDITED);
  return { slot_number: slot.slot_number, intention: { ...intention, source: SOURCES.EDITED } };
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
  SOURCES,
  SeasonIntentionError,
  normaliseIntention,
  outcomeRangeToBrief,
  saveIntention,
  draftIntention,
  draftNextSlot,
  buildDraftPrompt,
};

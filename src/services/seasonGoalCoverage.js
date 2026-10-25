'use strict';

/**
 * Goals line up with the events that move them (Evoni, 2026-10-25: "a, b
 * and c, with pinning, show me first"). For the show's active season:
 *
 *   - each active goal's movers: the events placed in the season's slots
 *     (pencilled, or an episode's own event) that move it — by
 *     seasonSuggestionService.goalMove (what goalFit reads), or because
 *     Evoni pinned the event to it (a pin always counts);
 *   - its projection: the current value plus the expected reward of each
 *     mover not yet done, against the target ("Coins: 600 + 2,400 = 3,000
 *     of 3,000"). A done slot's reward is already in the current value;
 *   - per part, the goals no event in that part moves (a goal whose
 *     episode range misses the part is not asked of it);
 *   - the slots' "Moves: <goal>" chips, and, for one event, what it moves
 *     and what it is pinned to.
 *
 * Pins are stored on the event, canon_consequences.pinned_goal_ids (no
 * migration; server-owned, so an Event Package save cannot overwrite them).
 * setPin adds or removes one id, leaving every other key as it was.
 *
 *   goalCoverage(sequelize, showId, { eventId })   GET .../season/goal-coverage
 *   goalEvents(sequelize, showId, goalId)          GET .../season/goals/:goalId/events ("Find events")
 *   setPin(sequelize, showId, eventId, goalId, on) PUT / DELETE .../season/events/:eventId/goals/:goalId/pin
 *   uncoveredByPhase(coverage)                     the gaps placement and the pencil ranking prefer
 *
 * No AI call.
 */

const { goalMove, expectedGain, pinnedGoalIds } = require('./seasonSuggestionService');
const { episodeEventIdSql } = require('../utils/episodeEventSql');

const METRIC_LABEL = {
  coins: 'Coins',
  reputation: 'Reputation',
  brand_trust: 'Brand Trust',
  influence: 'Influence',
  stress: 'Stress',
  followers: 'Followers',
  engagement_rate: 'Engagement Rate',
  portfolio_strength: 'Portfolio Strength',
  consistency_streak: 'Consistency Streak',
};
const metricLabel = (m) => METRIC_LABEL[m] || String(m || '').replace(/_/g, ' ');

// The event columns goalMove and expectedGain read.
const EVENT_COLUMNS = `ev.id, ev.name, ev.status, ev.prestige, ev.is_paid, ev.payment_amount, ev.rewards,
  ev.appearance_fee, ev.partnership_base_fee, ev.performance_fee, ev.used_in_episode_id,
  ev.canon_consequences -> 'pinned_goal_ids' AS pinned_goal_ids`;

class GoalCoverageError extends Error {
  constructor(message, status = 400, code = 'GOAL_COVERAGE_REFUSED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[seasonGoalCoverage] a JSON field could not be read:', err.message);
    return fallback;
  }
}

/** The goal's episode range as [first, last], or null when it has none. */
function rangeOf(goal) {
  const r = parseJson(goal.episode_range, null);
  if (!Array.isArray(r) || r.length < 1) return null;
  const a = Number(r[0]);
  const b = Number(r[1] ?? r[0]);
  return Number.isFinite(a) && Number.isFinite(b) ? [Math.min(a, b), Math.max(a, b)] : null;
}

/** Whether a part is asked to move the goal: no range, or a range that overlaps the part's episodes. */
function goalInPart(goal, part) {
  const r = rangeOf(goal);
  if (!r) return true;
  return r[0] <= Number(part.episode_end) && r[1] >= Number(part.episode_start);
}

const goalRef = (g) => ({ goal_id: g.id, title: g.title, icon: g.icon || null, target_metric: g.target_metric });

/**
 * The projection for one goal from its movers: null for a goal to reduce
 * stress (rewards do not lower it). Movers already done are left out: their
 * reward is in the current value.
 */
function projectionFor(goal, movers) {
  if (goal.target_metric === 'stress') return null;
  const current = Number(goal.current_value) || 0;
  const target = Number(goal.target_value) || 0;
  let gain = 0;
  let counted = 0;
  for (const m of movers) {
    if (m.done || !(m.gain > 0)) continue;
    gain += m.gain;
    counted += 1;
  }
  const projected = current + gain;
  return {
    metric: goal.target_metric,
    label: metricLabel(goal.target_metric),
    current,
    gain,
    projected,
    target,
    counted,
    on_track: projected >= target,
    short: Math.max(0, target - projected),
  };
}

/**
 * The coverage, computed from what was read (pure, so it is unit-tested):
 *   parts   [{ phase, title, episode_start, episode_end }]
 *   slots   [{ id, slot_number, phase, label, done, event: { …event row } | null }]
 *   goals   the active goals
 *   state   Lala's stats (goalMove reads her reputation)
 * Returns { goals, parts, slots } — see the file comment.
 */
function computeCoverage({ parts = [], slots = [], goals = [], state = {} }) {
  const slotMoves = slots.filter((s) => s.event).map((s) => ({
    slot: s,
    moves: goals.map((g) => ({ g, via: goalMove(s.event, g, state) })).filter((m) => m.via),
  }));

  const goalOut = goals.map((g) => {
    const movers = [];
    for (const { slot, moves } of slotMoves) {
      const m = moves.find((x) => x.g.id === g.id);
      if (!m) continue;
      movers.push({
        event_id: slot.event.id,
        name: slot.event.name,
        slot_id: slot.id,
        slot_number: slot.slot_number,
        code: `E${slot.slot_number}`,
        label: slot.label,
        phase: slot.phase,
        via: m.via,
        pinned: pinnedGoalIds(slot.event).includes(String(g.id)),
        gain: expectedGain(slot.event, g.target_metric),
        done: Boolean(slot.done),
      });
    }
    const gaps = parts.filter((p) => goalInPart(g, p) && !movers.some((m) => Number(m.phase) === Number(p.phase))).map((p) => p.phase);
    return {
      id: g.id,
      title: g.title,
      type: g.type || null,
      icon: g.icon || null,
      target_metric: g.target_metric,
      metric_label: metricLabel(g.target_metric),
      current_value: Number(g.current_value) || 0,
      target_value: Number(g.target_value) || 0,
      movers,
      projection: projectionFor(g, movers),
      gap_phases: gaps,
    };
  });

  const partsOut = parts.map((p) => ({
    phase: Number(p.phase),
    title: p.title || null,
    episode_start: Number(p.episode_start),
    episode_end: Number(p.episode_end),
    gaps: goalOut.filter((g) => g.gap_phases.includes(p.phase)).map((g) => ({ goal_id: g.id, title: g.title, icon: g.icon })),
  }));

  const slotsOut = slotMoves.map(({ slot, moves }) => ({
    slot_id: slot.id,
    slot_number: slot.slot_number,
    phase: slot.phase,
    event_id: slot.event.id,
    goals: moves.map((m) => ({ ...goalRef(m.g), via: m.via })),
  }));

  return { goals: goalOut, parts: partsOut, slots: slotsOut };
}

/**
 * The goals no event in each part moves, as { [phase]: [goal] } with each
 * goal's id, title and target_metric — what scoreForSeason's
 * inputs.uncovered takes.
 */
function uncoveredByPhase(coverage, goals) {
  const byId = new Map((goals || []).map((g) => [String(g.id), g]));
  const out = {};
  for (const p of coverage?.parts || []) {
    out[p.phase] = p.gaps.map((x) => byId.get(String(x.goal_id))).filter(Boolean);
  }
  return out;
}

async function activeGoalRows(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT id, title, type, icon, target_metric, target_value, current_value, starting_value, episode_range, status
       FROM career_goals
      WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
      ORDER BY CASE type WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END, priority ASC, created_at ASC`,
    { replacements: { showId } });
  return rows;
}

function lalaState(sequelize, showId) {
  // Required here, not at the top: seasonSetupService requires this file.
  return require('./seasonSetupService').lalaState(sequelize, showId);
}

/**
 * Everything computeCoverage reads, for the show's active season: its parts,
 * its slots each with its event (pencilled, else its episode's), the active
 * goals and Lala's stats. null when the show has no active season.
 */
async function loadCoverageInputs(sequelize, showId) {
  const { loadSeason } = require('./seasonLoader');
  const { arcPhases, episodeLabel } = require('./seasonSlotService');
  const season = await loadSeason(sequelize, showId);
  if (!season) return null;
  const { arc, slots: slotRows } = season;
  const [eventRows] = await sequelize.query(
    `SELECT s.id AS slot_id, ${EVENT_COLUMNS}
       FROM season_slots s
       JOIN world_events ev ON ev.id = COALESCE(s.event_id, ${episodeEventIdSql('s.episode_id')}) AND ev.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL`,
    { replacements: { arcId: arc.id } });
  const eventBySlot = new Map(eventRows.map(({ slot_id: slotId, ...ev }) => [String(slotId), ev]));
  const seasonNumber = arc.season_number || 1;
  const slots = slotRows.map((r) => ({
    id: r.id,
    slot_number: r.slot_number,
    phase: Number(r.phase),
    label: episodeLabel(seasonNumber, r.slot_number),
    done: r.episode_evaluation_status === 'accepted' || Boolean(r.accepted_at),
    event: eventBySlot.get(String(r.id)) || null,
  }));
  const parts = arcPhases(arc).map((p) => ({
    phase: Number(p.phase), title: p.title, episode_start: Number(p.episode_start), episode_end: Number(p.episode_end),
  }));
  const goals = await activeGoalRows(sequelize, showId);
  const state = await lalaState(sequelize, showId);
  return { arc, season_number: seasonNumber, parts, slots, goals, state };
}

async function eventRow(sequelize, showId, eventId) {
  const [[ev]] = await sequelize.query(
    `SELECT ${EVENT_COLUMNS} FROM world_events ev WHERE ev.id = :eventId AND ev.show_id = :showId AND ev.deleted_at IS NULL`,
    { replacements: { eventId, showId } });
  return ev || null;
}

/** What one event moves, and every active goal with whether it is pinned (the event page's chip and pin control). */
function eventGoals(ev, inputs) {
  const slot = inputs.slots.find((s) => s.event && String(s.event.id) === String(ev.id)) || null;
  const pins = pinnedGoalIds(ev);
  const goals = inputs.goals.map((g) => ({
    ...goalRef(g),
    via: goalMove(ev, g, inputs.state),
    pinned: pins.includes(String(g.id)),
  }));
  return {
    id: ev.id,
    name: ev.name,
    slot: slot ? { slot_id: slot.id, slot_number: slot.slot_number, code: `E${slot.slot_number}`, label: slot.label, phase: slot.phase } : null,
    pinned_goal_ids: pins,
    moves: goals.filter((g) => g.via),
    goals,
  };
}

/** GET .../season/goal-coverage: the coverage, and with eventId what that event moves. */
async function goalCoverage(sequelize, showId, { eventId = null } = {}) {
  const inputs = await loadCoverageInputs(sequelize, showId);
  if (!inputs) return { season: null, goals: [], parts: [], slots: [], event: null };
  const coverage = computeCoverage(inputs);
  let event = null;
  if (eventId) {
    const ev = await eventRow(sequelize, showId, eventId);
    if (ev) event = eventGoals(ev, inputs);
  }
  return {
    season: { arc_id: inputs.arc.id, season_number: inputs.season_number, title: inputs.arc.title || null },
    ...coverage,
    event,
  };
}

// How many events "Find events" lists.
const FIND_LIMIT = 12;

/** One line for why an event moves (or does not move) the goal. */
function moveReason(ev, goal, via, gain, state) {
  if (via === 'pinned') return 'Pinned to this goal';
  if (!via) return 'Nothing in it moves this goal; pin it if it does';
  if (goal.target_metric === 'coins') return `Pays ${gain.toLocaleString('en-US')} coins`;
  if (gain > 0) return `+${gain.toLocaleString('en-US')} ${metricLabel(goal.target_metric).toLowerCase()} reward`;
  return `Prestige ${Number(ev.prestige) || 0}, above her reputation ${Number(state.reputation) || 0}`;
}

/**
 * "Find events" for one goal: the events in this season's slots and the
 * events that can still be pencilled (draft or ready, unused), the ones that
 * move the goal first (pinned, then by expected reward, then prestige), each
 * with its slot when placed and why. At most FIND_LIMIT.
 */
async function goalEvents(sequelize, showId, goalId) {
  const [[goal]] = await sequelize.query(
    `SELECT id, title, type, icon, target_metric, target_value, current_value, episode_range, status
       FROM career_goals WHERE id = :goalId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { goalId, showId } });
  if (!goal) throw new GoalCoverageError('That goal is not in this show.', 404, 'GOAL_NOT_FOUND');
  const inputs = await loadCoverageInputs(sequelize, showId);
  const state = inputs ? inputs.state : await lalaState(sequelize, showId);
  const slotByEvent = new Map((inputs?.slots || []).filter((s) => s.event).map((s) => [String(s.event.id), s]));
  const [free] = await sequelize.query(
    `SELECT ${EVENT_COLUMNS} FROM world_events ev
      WHERE ev.show_id = :showId AND ev.deleted_at IS NULL AND ev.used_in_episode_id IS NULL
        AND COALESCE(ev.status, 'draft') IN ('draft', 'ready')
      ORDER BY ev.name ASC`,
    { replacements: { showId } });
  const seen = new Set();
  const all = [];
  for (const ev of [...(inputs?.slots || []).filter((s) => s.event).map((s) => s.event), ...free]) {
    if (seen.has(String(ev.id))) continue;
    seen.add(String(ev.id));
    all.push(ev);
  }
  const rank = { pinned: 0, fit: 1 };
  const ranked = all.map((ev, i) => {
    const via = goalMove(ev, goal, state);
    const gain = expectedGain(ev, goal.target_metric);
    const slot = slotByEvent.get(String(ev.id)) || null;
    return {
      id: ev.id,
      name: ev.name,
      status: ev.status || 'draft',
      via,
      pinned: pinnedGoalIds(ev).includes(String(goal.id)),
      gain,
      prestige: Number(ev.prestige) || 0,
      slot: slot ? { slot_id: slot.id, slot_number: slot.slot_number, code: `E${slot.slot_number}`, label: slot.label, phase: slot.phase, done: slot.done } : null,
      reason: moveReason(ev, goal, via, gain, state),
      order: i,
    };
  }).sort((a, b) => (rank[a.via] ?? 2) - (rank[b.via] ?? 2) || b.gain - a.gain || b.prestige - a.prestige || a.order - b.order)
    .slice(0, FIND_LIMIT)
    .map(({ order: _order, ...ev }) => ev);
  return { goal: { ...goalRef(goal), id: goal.id }, events: ranked };
}

/**
 * Pin (on) or unpin (off) one goal to an event. The goal and the event must
 * be the show's. Only canon_consequences.pinned_goal_ids changes; every
 * other key is kept (jsonb_set on the locked row). updated_at is left as
 * it is: it is the Event Package's save version, and a pin (which the save
 * never writes) must not make an open package's next save look stale. Returns
 * { event_id, goal_id, pinned, pinned_goal_ids }.
 */
async function setPin(sequelize, showId, eventId, goalId, on) {
  return sequelize.transaction(async (transaction) => {
    const [[goal]] = await sequelize.query(
      'SELECT id FROM career_goals WHERE id = :goalId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { goalId, showId }, transaction });
    if (!goal) throw new GoalCoverageError('That goal is not in this show.', 404, 'GOAL_NOT_FOUND');
    const [[ev]] = await sequelize.query(
      `SELECT id, canon_consequences -> 'pinned_goal_ids' AS pinned_goal_ids FROM world_events
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE`,
      { replacements: { eventId, showId }, transaction });
    if (!ev) throw new GoalCoverageError('That event is not in this show.', 404, 'EVENT_NOT_FOUND');
    const id = String(goal.id);
    const current = pinnedGoalIds(ev);
    const next = on ? (current.includes(id) ? current : [...current, id]) : current.filter((x) => x !== id);
    await sequelize.query(
      `UPDATE world_events
          SET canon_consequences = jsonb_set(
                CASE WHEN jsonb_typeof(canon_consequences) = 'object' THEN canon_consequences ELSE '{}'::jsonb END,
                '{pinned_goal_ids}', CAST(:ids AS jsonb))
        WHERE id = :eventId AND show_id = :showId`,
      { replacements: { ids: JSON.stringify(next), eventId, showId }, transaction });
    return { event_id: ev.id, goal_id: goal.id, pinned: Boolean(on), pinned_goal_ids: next };
  });
}

module.exports = {
  METRIC_LABEL,
  FIND_LIMIT,
  GoalCoverageError,
  metricLabel,
  rangeOf,
  goalInPart,
  projectionFor,
  computeCoverage,
  uncoveredByPhase,
  loadCoverageInputs,
  eventGoals,
  goalCoverage,
  goalEvents,
  setPin,
};

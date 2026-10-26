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
 * Goal ladders (utils/goalLadders; Evoni, 2026-10-25: "How should I attach
 * them to the right event at the right time?"): goals on one stat are rungs
 * of a ladder and only the lowest rung not reached is worked on. Each goal
 * also carries its kind, ladder and rung; only an active rung of a stat
 * events move (coins, reputation, brand trust) is asked of the parts, so the
 * part gaps, the pencil ranking's uncovered bonus and the tab badge count
 * those alone. A pin is "the event this goal is for": its main_events (the
 * rest of its movers are also_helps), and an event is the main event of at
 * most one such goal (setPin refuses a second unless asked to move it).
 * Each ladder carries one projection, so a stat's expected gain is counted
 * once, not once per rung. Every older field is kept.
 *
 *   goalCoverage(sequelize, showId, { eventId })   GET .../season/goal-coverage
 *   goalEvents(sequelize, showId, goalId)          GET .../season/goals/:goalId/events ("Find events")
 *   setPin(sequelize, showId, eventId, goalId, on, { move })  PUT / DELETE .../season/events/:eventId/goals/:goalId/pin
 *   uncoveredByPhase(coverage)                     the gaps placement and the pencil ranking prefer
 *   mainGoalForEvent(sequelize, { showId, eventId }) the episode's main goal: pinned, else the best suggested
 *
 * No AI call.
 */

const { goalMove, expectedGain, pinnedGoalIds } = require('./seasonSuggestionService');
const { buildLadders, kindOf, directionOf, offTrack } = require('../utils/goalLadders');
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
 * One projection for a ladder of a stat events move: its current value plus
 * the expected reward of every placed event that moves it (each counted
 * once), the rungs that clears and the next one with how far short. null
 * for a stat to keep under or one events do not move.
 */
function ladderProjection(ladder, goalsById, moversByGoal) {
  if (ladder.kind !== 'event' || ladder.direction !== 'up') return null;
  const rungs = ladder.goal_ids.map((id) => goalsById.get(id)).filter(Boolean);
  if (!rungs.length) return null;
  const seen = new Set();
  let gain = 0;
  let counted = 0;
  for (const id of ladder.goal_ids) {
    for (const m of moversByGoal.get(id) || []) {
      const key = String(m.slot_id);
      if (seen.has(key)) continue;
      seen.add(key);
      if (m.done || !(m.gain > 0)) continue;
      gain += m.gain;
      counted += 1;
    }
  }
  const current = Number(rungs[0].current_value) || 0;
  const projected = current + gain;
  const clears = rungs.filter((g) => Number(g.target_value) <= projected).map((g) => ({ goal_id: g.id, title: g.title, target_value: Number(g.target_value) || 0 }));
  const nextGoal = rungs.find((g) => Number(g.target_value) > projected) || null;
  return {
    metric: ladder.metric,
    label: metricLabel(ladder.metric),
    current,
    gain,
    projected,
    counted,
    clears,
    next: nextGoal ? { goal_id: nextGoal.id, title: nextGoal.title, target_value: Number(nextGoal.target_value) || 0, short: (Number(nextGoal.target_value) || 0) - projected } : null,
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

  const lad = buildLadders(goals.map((g) => ({ status: 'active', ...g })));
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
        code: slot.code || `E${slot.slot_number}`,
        label: slot.label,
        phase: slot.phase,
        via: m.via,
        pinned: pinnedGoalIds(slot.event).includes(String(g.id)),
        gain: expectedGain(slot.event, g.target_metric),
        done: Boolean(slot.done),
      });
    }
    const place = lad.byGoal.get(String(g.id)) || { ladder_id: null, rung: 'passive' };
    const kind = kindOf(g.target_metric);
    // Only an active rung of a stat events move is asked of the parts.
    const covered = kind === 'event' && place.rung === 'active';
    const gaps = covered
      ? parts.filter((p) => goalInPart(g, p) && !movers.some((m) => Number(m.phase) === Number(p.phase))).map((p) => p.phase)
      : [];
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
      kind,
      direction: directionOf(g.target_metric),
      ladder_id: place.ladder_id,
      rung: place.rung,
      is_primary: lad.primary_id === String(g.id),
      covered,
      off_track: offTrack(g),
      main_events: movers.filter((m) => m.pinned),
      also_helps: movers.filter((m) => !m.pinned),
    };
  });
  const goalsById = new Map(goals.map((g) => [String(g.id), g]));
  const moversByGoal = new Map(goalOut.map((g) => [String(g.id), g.movers]));
  const laddersOut = lad.ladders.map((l) => ({
    id: l.id,
    metric: l.metric,
    metric_label: metricLabel(l.metric),
    kind: l.kind,
    direction: l.direction,
    goal_ids: l.goal_ids,
    active_goal_id: l.active_goal_id,
    up_next_ids: l.up_next_ids,
    has_primary: l.has_primary,
    projection: ladderProjection(l, goalsById, moversByGoal),
  }));

  const partsOut = parts.map((p) => ({
    phase: Number(p.phase),
    title: p.title || null,
    episode_start: Number(p.episode_start),
    episode_end: Number(p.episode_end),
    gaps: goalOut.filter((g) => g.gap_phases.includes(p.phase)).map((g) => ({ goal_id: g.id, title: g.title, icon: g.icon })),
  }));

  // A slot's "Moves:" chips name the goals being worked on (not the rungs
  // waiting up next), its pinned main goal first.
  const slotsOut = slotMoves.map(({ slot, moves }) => ({
    slot_id: slot.id,
    slot_number: slot.slot_number,
    phase: slot.phase,
    event_id: slot.event.id,
    goals: moves.filter((m) => lad.byGoal.get(String(m.g.id))?.rung !== 'up_next')
      .sort((x, y) => Number(y.via === 'pinned') - Number(x.via === 'pinned'))
      .map((m) => ({ ...goalRef(m.g), via: m.via })),
  }));

  return { goals: goalOut, parts: partsOut, slots: slotsOut, ladders: laddersOut, primary_goal_id: lad.primary_id };
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
  // A two-parter's two slots hold one event: it is counted once, in Part 1.
  const counted = new Set();
  for (const sl of slots) {
    if (!sl.event) continue;
    if (counted.has(String(sl.event.id))) sl.event = null;
    else counted.add(String(sl.event.id));
  }
  slots.push(...await bonusSlots(sequelize, arc, slots, counted));
  const parts = arcPhases(arc).map((p) => ({
    phase: Number(p.phase), title: p.title, episode_start: Number(p.episode_start), episode_end: Number(p.episode_end),
  }));
  const goals = await activeGoalRows(sequelize, showId);
  const state = await lalaState(sequelize, showId);
  return { arc, season_number: seasonNumber, parts, slots, goals, state };
}

/**
 * The season's bonus episodes as coverage slots (seasonSpecials, 2026-10-26):
 * a bonus's event counts like any other, in the part of the weekly episode it
 * follows (slot_number is that episode's, for the goals' episode ranges).
 * Stand-alone specials count toward no part and no goal. [] before the
 * specials' migration.
 */
async function bonusSlots(sequelize, arc, slots, counted) {
  const specials = require('./seasonSpecials');
  if (!(await specials.specialsReady(sequelize))) return [];
  const [rows] = await sequelize.query(
    `SELECT sp.id AS special_id, sp.kind, sp.after_slot_number, sp.special_type, sp.accepted_at, ep.evaluation_status, ${EVENT_COLUMNS}
       FROM ${specials.TABLE} sp
       JOIN world_events ev ON ev.id = COALESCE(sp.event_id, ${episodeEventIdSql('sp.episode_id')}) AND ev.deleted_at IS NULL
       LEFT JOIN episodes ep ON ep.id = sp.episode_id AND ep.deleted_at IS NULL
      WHERE sp.arc_id = :arcId AND sp.kind = 'bonus' AND sp.deleted_at IS NULL
      ORDER BY sp.after_slot_number, sp.created_at`,
    { replacements: { arcId: arc.id } });
  return rows.filter((r) => !counted.has(String(r.id))).map(({ special_id: id, kind, after_slot_number: after, special_type: type, accepted_at: acceptedAt, evaluation_status: evaluation, ...ev }) => {
    const n = Math.max(1, Number(after) || 0);
    const near = slots.find((s) => Number(s.slot_number) === n);
    const label = specials.specialLabel({ kind, after_slot_number: after, special_type: type });
    return { id, slot_number: n, phase: Number(near?.phase) || 1, label, code: label, special: true, done: evaluation === 'accepted' || Boolean(acceptedAt), event: ev };
  });
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
  const lad = buildLadders(inputs.goals.map((g) => ({ status: 'active', ...g })));
  const goals = inputs.goals.map((g) => ({
    ...goalRef(g),
    via: goalMove(ev, g, inputs.state),
    pinned: pins.includes(String(g.id)),
    kind: kindOf(g.target_metric),
    rung: lad.byGoal.get(String(g.id))?.rung || null,
  }));
  return {
    id: ev.id,
    name: ev.name,
    slot: slot ? { slot_id: slot.id, slot_number: slot.slot_number, code: slot.code || `E${slot.slot_number}`, label: slot.label, phase: slot.phase } : null,
    pinned_goal_ids: pins,
    main_goal: mainGoalOf(ev, inputs.goals),
    moves: goals.filter((g) => g.via),
    goals,
  };
}

/** GET .../season/goal-coverage: the coverage, and with eventId what that event moves. */
async function goalCoverage(sequelize, showId, { eventId = null } = {}) {
  const inputs = await loadCoverageInputs(sequelize, showId);
  if (!inputs) return { season: null, goals: [], parts: [], slots: [], ladders: [], primary_goal_id: null, event: null };
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

// How many events "Pick its event" offers.
const PICK_LIMIT = 3;

/** Whether a slot's episode falls in the goal's episode range (no range: any). */
function slotInRange(goal, slot) {
  const r = rangeOf(goal);
  return !r || (Number(slot.slot_number) >= r[0] && Number(slot.slot_number) <= r[1]);
}

/**
 * The goal an event is already the main event for: the first goal of a
 * stat events move, other than `goal`, pinned to it. null when none.
 */
function mainGoalOf(ev, goals, goal = null) {
  const byId = new Map((goals || []).map((g) => [String(g.id), g]));
  for (const id of pinnedGoalIds(ev)) {
    if (goal && id === String(goal.id)) continue;
    const g = byId.get(id);
    if (g && kindOf(g.target_metric) === 'event') return { goal_id: g.id, title: g.title };
  }
  return null;
}

/**
 * "Find events" and "Pick its event" for one goal, from what was read
 * (pure): every event, the ones that move the goal first (pinned, then by
 * expected reward, then prestige), each with its slot when placed, why, and
 * the goal it is already the main event for. events is at most FIND_LIMIT;
 * pick is the best PICK_LIMIT that move it, placed in the goal's episode
 * range first (not done), then not placed yet.
 */
function rankGoalEvents(goal, allEvents, inputs = {}) {
  const state = inputs.state || {};
  const slotByEvent = new Map((inputs.slots || []).filter((s) => s.event).map((s) => [String(s.event.id), s]));
  const rank = { pinned: 0, fit: 1 };
  const ranked = (allEvents || []).map((ev, i) => {
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
      slot: slot ? { slot_id: slot.id, slot_number: slot.slot_number, code: slot.code || `E${slot.slot_number}`, label: slot.label, phase: slot.phase, done: slot.done } : null,
      reason: moveReason(ev, goal, via, gain, state),
      main_goal: mainGoalOf(ev, inputs.goals, goal),
      in_range: slot ? slotInRange(goal, slot) : null,
      order: i,
    };
  }).sort((a, b) => (rank[a.via] ?? 2) - (rank[b.via] ?? 2) || b.gain - a.gain || b.prestige - a.prestige || a.order - b.order)
    .map(({ order: _order, ...ev }) => ev);
  const movers = ranked.filter((e) => e.via && !(e.slot && e.slot.done));
  const placed = movers.filter((e) => e.slot && e.in_range);
  const pick = [...placed, ...movers.filter((e) => !e.slot)].slice(0, PICK_LIMIT);
  return { goal: { ...goalRef(goal), id: goal.id }, events: ranked.slice(0, FIND_LIMIT), pick };
}

/** Reads what rankGoalEvents needs for one goal: the season's slots, the events that can still be pencilled, the active goals. */
async function goalEvents(sequelize, showId, goalId) {
  const [[goal]] = await sequelize.query(
    `SELECT id, title, type, icon, target_metric, target_value, current_value, episode_range, status
       FROM career_goals WHERE id = :goalId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { goalId, showId } });
  if (!goal) throw new GoalCoverageError('That goal is not in this show.', 404, 'GOAL_NOT_FOUND');
  const inputs = await loadCoverageInputs(sequelize, showId);
  const state = inputs ? inputs.state : await lalaState(sequelize, showId);
  const goals = inputs ? inputs.goals : await activeGoalRows(sequelize, showId);
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
  return rankGoalEvents(goal, all, { slots: inputs?.slots || [], state, goals });
}

/**
 * The episode's MAIN career goal, from its event (pure): the active goal of
 * a stat events move pinned to it (source 'pinned'; one per event, setPin's
 * rule), else the goal being worked on (an active rung, utils/goalLadders)
 * that the event moves best — largest expected gain, then the primary's
 * ladder, then the goals' order (source 'suggested'), else nothing.
 * `goals` are the active goals; returns { goal, source }.
 */
function pickMainGoal(ev, goals, state = {}) {
  const active = (goals || []).map((g) => ({ status: 'active', ...g }));
  const byId = new Map(active.map((g) => [String(g.id), g]));
  for (const id of pinnedGoalIds(ev)) {
    const g = byId.get(id);
    if (g && kindOf(g.target_metric) === 'event') return { goal: g, source: 'pinned' };
  }
  const lad = buildLadders(active);
  const candidates = active
    .map((g, i) => ({ g, i, gain: expectedGain(ev, g.target_metric) }))
    .filter(({ g }) => kindOf(g.target_metric) === 'event' && lad.byGoal.get(String(g.id))?.rung === 'active' && goalMove(ev, g, state));
  if (!candidates.length) return { goal: null, source: null };
  const primaryLadder = lad.ladders.find((l) => l.has_primary)?.id || null;
  candidates.sort((a, b) => b.gain - a.gain
    || Number(lad.byGoal.get(String(b.g.id))?.ladder_id === primaryLadder) - Number(lad.byGoal.get(String(a.g.id))?.ladder_id === primaryLadder)
    || a.i - b.i);
  return { goal: candidates[0].g, source: 'suggested' };
}

/**
 * mainGoalForEvent(sequelize, { showId, eventId }) → { goal, source:
 * 'pinned' | 'suggested' | null }: the one place the episode's main goal is
 * worked out (the script writers read it too). goal is the career_goals row
 * (id, title, type, icon, target_metric, target_value, current_value,
 * episode_range, status) or null; an event not in the show is null too.
 */
async function mainGoalForEvent(sequelize, { showId, eventId }) {
  if (!showId || !eventId) return { goal: null, source: null };
  const ev = await eventRow(sequelize, showId, eventId);
  if (!ev) return { goal: null, source: null };
  const goals = await activeGoalRows(sequelize, showId);
  const state = await lalaState(sequelize, showId);
  return pickMainGoal(ev, goals, state || {});
}

/**
 * Pin (on) or unpin (off) one goal to an event. The goal and the event must
 * be the show's. Only canon_consequences.pinned_goal_ids changes; every
 * other key is kept (jsonb_set on the locked row). updated_at is left as
 * it is: it is the Event Package's save version, and a pin (which the save
 * never writes) must not make an open package's next save look stale. Returns
 * { event_id, goal_id, pinned, pinned_goal_ids }.
 */
async function setPin(sequelize, showId, eventId, goalId, on, { move = false } = {}) {
  return sequelize.transaction(async (transaction) => {
    const [[goal]] = await sequelize.query(
      'SELECT id, title, target_metric FROM career_goals WHERE id = :goalId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { goalId, showId }, transaction });
    if (!goal) throw new GoalCoverageError('That goal is not in this show.', 404, 'GOAL_NOT_FOUND');
    const [[ev]] = await sequelize.query(
      `SELECT id, name, canon_consequences -> 'pinned_goal_ids' AS pinned_goal_ids FROM world_events
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE`,
      { replacements: { eventId, showId }, transaction });
    if (!ev) throw new GoalCoverageError('That event is not in this show.', 404, 'EVENT_NOT_FOUND');
    const id = String(goal.id);
    let current = pinnedGoalIds(ev);
    // One main goal per event (and so per episode): pinning a goal of a stat
    // events move to an event already pinned to another such goal asks
    // first; with move the other goal's pin goes. Other pins are unlimited.
    let movedFrom = null;
    if (on && !current.includes(id) && kindOf(goal.target_metric) === 'event') {
      const others = current.filter((x) => x !== id);
      const [pinnedRows] = others.length ? await sequelize.query(
        `SELECT id, title, target_metric FROM career_goals
          WHERE show_id = :showId AND deleted_at IS NULL AND status = 'active' AND id::text IN (:ids)`,
        { replacements: { showId, ids: others }, transaction }) : [[]];
      const mains = pinnedRows.filter((g) => kindOf(g.target_metric) === 'event');
      if (mains.length && !move) {
        const err = new GoalCoverageError(
          `${ev.name || 'This event'} is already the event for ${mains[0].title}. Move it to ${goal.title}?`, 409, 'MAIN_GOAL_TAKEN');
        err.details = { main_goal: { goal_id: mains[0].id, title: mains[0].title } };
        throw err;
      }
      if (mains.length) {
        const drop = new Set(mains.map((g) => String(g.id)));
        current = current.filter((x) => !drop.has(x));
        movedFrom = mains.map((g) => ({ goal_id: g.id, title: g.title }));
      }
    }
    const next = on ? (current.includes(id) ? current : [...current, id]) : current.filter((x) => x !== id);
    await sequelize.query(
      `UPDATE world_events
          SET canon_consequences = jsonb_set(
                CASE WHEN jsonb_typeof(canon_consequences) = 'object' THEN canon_consequences ELSE '{}'::jsonb END,
                '{pinned_goal_ids}', CAST(:ids AS jsonb))
        WHERE id = :eventId AND show_id = :showId`,
      { replacements: { ids: JSON.stringify(next), eventId, showId }, transaction });
    return { event_id: ev.id, goal_id: goal.id, pinned: Boolean(on), pinned_goal_ids: next, moved_from: movedFrom };
  });
}

module.exports = {
  METRIC_LABEL,
  FIND_LIMIT,
  PICK_LIMIT,
  GoalCoverageError,
  metricLabel,
  rangeOf,
  goalInPart,
  projectionFor,
  ladderProjection,
  computeCoverage,
  rankGoalEvents,
  mainGoalOf,
  pickMainGoal,
  mainGoalForEvent,
  uncoveredByPhase,
  loadCoverageInputs,
  eventGoals,
  goalCoverage,
  goalEvents,
  setPin,
};

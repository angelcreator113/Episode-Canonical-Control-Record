'use strict';

/**
 * Goal ladders (Evoni, 2026-10-25: "This is very confusing I don't know
 * what I am to do"). Goals that track the same stat are rungs of one
 * ladder (Starter Fund 500 → Money Talk 2,000 → Closet Upgrade 5,000 …);
 * only the lowest rung not yet reached is worked on, the rest wait as "up
 * next". Nothing is stored: the ladder and its active rung are worked out
 * on every read from the active goals, so a rung completing (episode
 * completion, Sync from stats, an opportunity paid) makes the next one
 * active with no write, and reading twice gives the same answer.
 *
 * The same rules live in frontend/src/lib/goalLadders.js for the Goals tab;
 * keep the two in step (both are unit-tested against the same cases).
 *
 *   KIND               metric → 'event' | 'performance' | 'background'
 *   kindOf(metric)     event: placed events move it (Pick its event);
 *                      performance: Pulse posts, deliverables, episode results;
 *                      background: kept in range, only warned about
 *   directionOf(m)     'down' for a stat to keep under (stress), else 'up'
 *   buildLadders(gs)   { ladders, byGoal, primary_id }
 *   goalReached(g, v)  whether a measured value completes the goal (direction-aware)
 *   completesByReading(g)  false for passive and custom goals (measured, never completed)
 *   activatedAfter(goals, completedIds)  the rungs a completion makes active
 *
 * A passive goal is never a rung: it stands on its own (a floor like
 * "never drop below 100 coins", or a story moment). An explicit order wins
 * over the targets: a goal whose unlocks_on_complete names another goal of
 * the same ladder ({ type: 'goal', goal_id } or { type: 'goal', name }) comes
 * before it.
 */

const KIND = {
  coins: 'event',
  reputation: 'event',
  brand_trust: 'event',
  followers: 'performance',
  influence: 'performance',
  portfolio_strength: 'performance',
  engagement_rate: 'performance',
  consistency_streak: 'background',
  stress: 'background',
};
const DOWN = new Set(['stress']);

const kindOf = (metric) => KIND[metric] || 'background';
const directionOf = (metric) => (DOWN.has(metric) ? 'down' : 'up');
const num = (v) => Number(v) || 0;

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[goalLadders] a JSON field could not be read:', err.message);
    return fallback;
  }
}

/** The ladder a goal belongs to: its stat (each custom goal is its own). */
const ladderKey = (g) => (g.target_metric === 'custom' || !g.target_metric ? `custom:${g.id}` : g.target_metric);

const createdMs = (g) => {
  const t = Date.parse(g.created_at || '');
  return Number.isFinite(t) ? t : 0;
};

/** Lower rungs first: by target (highest first for a stat to keep under), then priority, then age. */
function compareRungs(a, b) {
  const dir = directionOf(a.target_metric) === 'down' ? -1 : 1;
  return dir * (num(a.target_value) - num(b.target_value))
    || num(a.priority ?? 3) - num(b.priority ?? 3)
    || createdMs(a) - createdMs(b)
    || String(a.id).localeCompare(String(b.id));
}

/** The goals a goal's unlocks_on_complete names, as ids (by goal_id, else by title). */
function unlockTargets(goal, all) {
  const list = parseJson(goal.unlocks_on_complete, []);
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const u of list) {
    if (!u || typeof u !== 'object' || (u.type && u.type !== 'goal')) continue;
    if (u.goal_id != null) out.push(String(u.goal_id));
    else if (u.type === 'goal' && u.name) {
      const hit = all.find((g) => String(g.title || '').trim().toLowerCase() === String(u.name).trim().toLowerCase());
      if (hit) out.push(String(hit.id));
    }
  }
  return out;
}

/** Orders one ladder's rungs: by target, then each explicitly unlocked rung moved after the rung that unlocks it. */
function orderRungs(rungs, all) {
  const order = rungs.slice().sort(compareRungs);
  const ids = new Set(order.map((g) => String(g.id)));
  // A few passes settle any chain; a loop (A unlocks B unlocks A) just stops.
  for (let pass = 0; pass < order.length; pass += 1) {
    let moved = false;
    for (const a of order.slice()) {
      for (const bId of unlockTargets(a, all).filter((id) => ids.has(id))) {
        const ai = order.findIndex((g) => String(g.id) === String(a.id));
        const bi = order.findIndex((g) => String(g.id) === bId);
        if (bi < ai) {
          const [b] = order.splice(bi, 1);
          order.splice(order.findIndex((g) => String(g.id) === String(a.id)) + 1, 0, b);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return order;
}

/** The season's one primary goal: the active primaries by priority, then the oldest. */
function pickPrimary(goals) {
  const primaries = (goals || []).filter((g) => g.status === 'active' && g.type === 'primary');
  primaries.sort((a, b) => num(a.priority ?? 3) - num(b.priority ?? 3) || createdMs(a) - createdMs(b) || String(a.id).localeCompare(String(b.id)));
  return primaries[0] || null;
}

/**
 * The ladders of the active goals. Returns
 *   ladders   [{ id, metric, kind, direction, goal_ids, active_goal_id, up_next_ids, has_primary }]
 *   byGoal    Map(id → { ladder_id, rung: 'active' | 'up_next' | 'passive', position })
 *   primary_id  the one primary (pickPrimary), or null
 * Goals not active are left out.
 */
function buildLadders(goals) {
  const all = (goals || []).filter((g) => g && g.status === 'active');
  const primary = pickPrimary(all);
  const byGoal = new Map();
  const groups = new Map();
  for (const g of all) {
    if (g.type === 'passive') {
      byGoal.set(String(g.id), { ladder_id: null, rung: 'passive', position: 0 });
      continue;
    }
    const key = ladderKey(g);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const ladders = [];
  for (const [key, rungs] of groups) {
    const order = orderRungs(rungs, all);
    const ids = order.map((g) => String(g.id));
    order.forEach((g, i) => byGoal.set(String(g.id), { ladder_id: key, rung: i === 0 ? 'active' : 'up_next', position: i }));
    const metric = order[0].target_metric;
    ladders.push({
      id: key,
      metric,
      kind: kindOf(metric),
      direction: directionOf(metric),
      goal_ids: ids,
      active_goal_id: ids[0],
      up_next_ids: ids.slice(1),
      has_primary: primary ? ids.includes(String(primary.id)) : false,
    });
  }
  return { ladders, byGoal, primary_id: primary ? String(primary.id) : null };
}

/**
 * Whether a measured value completes the goal, by its direction: a stat to
 * reduce (stress, "reduce to") completes at or below its target, never
 * because it rose; every other stat at or above it. The one rule for every
 * completion path (episode completion step 17, Sync from stats, an
 * opportunity paid), so they cannot disagree.
 */
function goalReached(goal, value) {
  const v = Number(value);
  const target = Number(goal?.target_value);
  if (!Number.isFinite(v) || !Number.isFinite(target)) return false;
  return directionOf(goal?.target_metric) === 'down' ? v <= target : v >= target;
}

/**
 * Whether a reading may complete this goal at all: a passive goal ("never
 * drop below", a story moment) and a custom one are measured, never
 * completed by a reading. Episode completion and Sync from stats both ask.
 */
const completesByReading = (goal) => goal?.type !== 'passive' && goal?.target_metric !== 'custom';

/** A background goal is off track when a stat to keep under is above its target. */
function offTrack(goal) {
  return directionOf(goal?.target_metric) === 'down' && num(goal.current_value) > num(goal.target_value);
}

/**
 * The rungs that become active because the goals in completedIds were
 * completed: active rungs afterwards that were waiting before. Pure and
 * idempotent (completing the same goals again activates nothing new).
 */
function activatedAfter(goals, completedIds) {
  const done = new Set((completedIds || []).map(String));
  const before = buildLadders(goals).byGoal;
  const after = buildLadders((goals || []).map((g) => (done.has(String(g.id)) ? { ...g, status: 'completed' } : g)));
  const out = [];
  for (const g of goals || []) {
    const id = String(g.id);
    if (done.has(id)) continue;
    if (after.byGoal.get(id)?.rung === 'active' && before.get(id)?.rung === 'up_next') out.push({ id: g.id, title: g.title, metric: g.target_metric });
  }
  return out;
}

module.exports = {
  KIND, kindOf, directionOf, compareRungs, unlockTargets, orderRungs, pickPrimary, buildLadders, goalReached, completesByReading, offTrack, activatedAfter,
};

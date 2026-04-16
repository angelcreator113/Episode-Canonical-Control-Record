/**
 * phoneRuntime — the single source of truth for phone gameplay logic.
 *
 * EVERYTHING goes through this module:
 *   - editor preview (in-memory state, instant UI feedback)
 *   - player runtime (DB-backed state via phonePlaythroughRoutes)
 *   - AI proposals (validate that generated zones actually resolve)
 *   - content zone filtering (same condition grammar applies to content items)
 *   - mission progress checking (mission objective = condition)
 *
 * This guarantees editor/preview/runtime never diverge.
 *
 * Design:
 *   - Pure functions where possible; `applyAction` takes an injected `writer`
 *     so the same function can mutate an in-memory object (preview) or call the
 *     DB (runtime) without knowing which.
 *   - Implicit defaults: no `conditions` → visible; no `actions` but has `target` →
 *     synthesize a single `navigate(target)` action. Keeps existing zones working.
 *   - Unknown/malformed conditions evaluate to FALSE (fail-closed), so a corrupt
 *     zone in production locks itself rather than crashing.
 *   - Unknown action types are no-ops + logged (should never happen thanks to the
 *     server-side allowlist, but belt-and-suspenders).
 */
const { ALLOWED_ACTION_TYPES } = require('./phoneConditionSchema');

// ── Condition evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate one condition against the runtime context.
 *   context.state        — object mapping state keys to values (flags)
 *   context.beatNumber   — optional: current beat number (for `beat_number` key)
 *   context.episodeBeat  — optional: alias of beatNumber
 *   context.visitedScreens — Set<string> of screen ids the user has landed on
 *
 * Unknown keys behave like `undefined`; `exists` checks for that.
 */
function evaluateOne(condition, context) {
  if (!condition || typeof condition !== 'object') return false;
  const { key, op, value } = condition;
  if (!key || !op) return false;

  const actual = resolveKey(key, context);

  switch (op) {
    case 'eq':          return actual === value;
    case 'neq':         return actual !== value;
    case 'gt':          return typeof actual === 'number' && actual > value;
    case 'gte':         return typeof actual === 'number' && actual >= value;
    case 'lt':          return typeof actual === 'number' && actual < value;
    case 'lte':         return typeof actual === 'number' && actual <= value;
    case 'exists':      return actual !== undefined && actual !== null;
    case 'not_exists':  return actual === undefined || actual === null;
    default:            return false;  // unknown op → fail closed
  }
}

/**
 * Resolve a key against the context. Supports a few well-known reserved keys in
 * addition to free-form state flags:
 *   - `beat_number`      → context.beatNumber
 *   - `visited:<id>`     → true/false whether the user has been on that screen
 *   - everything else    → context.state[key]
 */
function resolveKey(key, ctx) {
  if (key === 'beat_number') return ctx.beatNumber ?? ctx.episodeBeat;
  if (key.startsWith('visited:')) {
    const id = key.slice('visited:'.length);
    return ctx.visitedScreens instanceof Set
      ? ctx.visitedScreens.has(id)
      : Array.isArray(ctx.visitedScreens) && ctx.visitedScreens.includes(id);
  }
  return ctx.state?.[key];
}

/**
 * Evaluate a flat conditions array (ANDed). No conditions → true (implicit default:
 * zone/item visible when no rule specified).
 */
function evaluate(conditions, context) {
  if (!conditions || conditions.length === 0) return true;
  if (!Array.isArray(conditions)) return false;  // malformed → fail closed
  return conditions.every(c => evaluateOne(c, context || {}));
}

// ── Action application ───────────────────────────────────────────────────────

/**
 * Apply an actions array. Returns an effects object describing what the caller
 * (preview UI / runtime route) should do:
 *   { navigate: 'screen_id' | null, toasts: [{text,tone}], completeEpisode: bool }
 *
 * The `writer` argument mutates state:
 *   writer.setState(key, value)    — synchronous, in-memory or queued
 *   writer.markEpisodeComplete()   — optional; falls back to effects.completeEpisode
 *
 * Unknown action types are logged and skipped (allowlist should have rejected
 * them on write; this is the safety net).
 */
function applyActions(actions, context, writer) {
  const effects = { navigate: null, toasts: [], completeEpisode: false };
  if (!actions || !Array.isArray(actions) || actions.length === 0) return effects;

  for (const action of actions) {
    if (!action || !ALLOWED_ACTION_TYPES.includes(action.type)) continue;
    switch (action.type) {
      case 'navigate':
        effects.navigate = action.target;
        break;
      case 'set_state':
        if (writer?.setState) writer.setState(action.key, action.value);
        break;
      case 'show_toast':
        effects.toasts.push({ text: action.text, tone: action.tone || 'info' });
        break;
      case 'complete_episode':
        effects.completeEpisode = true;
        if (writer?.markEpisodeComplete) writer.markEpisodeComplete();
        break;
    }
  }

  return effects;
}

// ── Zone / content helpers ───────────────────────────────────────────────────

/**
 * Filter zones for a given context, returning `{ visible: Zone[], locked: Zone[] }`.
 * Editor "author view" shows both; player runtime shows only `visible`.
 */
function filterZones(zones, context) {
  const visible = [];
  const locked = [];
  for (const z of zones || []) {
    (evaluate(z.conditions, context) ? visible : locked).push(z);
  }
  return { visible, locked };
}

/**
 * Filter content items (feed posts, messages, wardrobe pieces) by their optional
 * `conditions`. Items without conditions always pass.
 */
function filterContentItems(items, context) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => evaluate(item.conditions, context));
}

/**
 * Apply implicit defaults to a zone so `navigate(target)` works without an explicit
 * actions array (matches pre-conditions behavior). Call on tap, not on save.
 */
function actionsForZone(zone) {
  if (Array.isArray(zone.actions) && zone.actions.length > 0) return zone.actions;
  if (zone.target) return [{ type: 'navigate', target: zone.target }];
  return [];
}

module.exports = {
  evaluate,
  evaluateOne,
  applyActions,
  actionsForZone,
  filterZones,
  filterContentItems,
  resolveKey,
  evaluateMission,
  evaluateMissions,
};

// ── Mission progress ────────────────────────────────────────────────────────
//
// Read-only observers: given a mission and a runtime context, compute
// per-objective completion and an overall "complete" flag. No side effects,
// no state writes — the editor preview and player runtime both call this to
// render progress UI.

/**
 * Evaluate one mission. Returns:
 *   {
 *     active:     true unless start_condition is set and currently false,
 *     objectives: [{ id, label, complete: bool }, ...],
 *     completed:  count of completed objectives,
 *     total:      total objectives,
 *     is_complete:all objectives complete (and mission is active),
 *   }
 */
function evaluateMission(mission, context) {
  if (!mission || typeof mission !== 'object') {
    return { active: false, objectives: [], completed: 0, total: 0, is_complete: false };
  }

  const active = mission.start_condition ? evaluate(mission.start_condition, context) : true;
  const objs = Array.isArray(mission.objectives) ? mission.objectives : [];
  const results = objs.map(o => ({
    id: o.id,
    label: o.label,
    complete: evaluate(o.condition, context),
  }));
  const completed = results.filter(r => r.complete).length;

  return {
    active,
    objectives: results,
    completed,
    total: results.length,
    is_complete: active && results.length > 0 && completed === results.length,
  };
}

/**
 * Convenience: run evaluateMission across an array and keep the mission
 * reference alongside its progress for easy rendering.
 */
function evaluateMissions(missions, context) {
  if (!Array.isArray(missions)) return [];
  return missions.map(m => ({
    mission: m,
    progress: evaluateMission(m, context),
  }));
}

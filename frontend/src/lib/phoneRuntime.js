/**
 * phoneRuntime (frontend twin) — mirrors src/services/phoneRuntime.js.
 *
 * The backend is the source of truth, but preview mode runs entirely client-side
 * for instant feedback. Keep this in lock-step with src/services/phoneRuntime.js —
 * if you change one, change the other, and add a matching Jest case.
 *
 * This is a literal JS port; it has no Node-only deps and can be imported in React.
 */

export const CONDITION_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'];

export const ALLOWED_ACTION_TYPES = ['navigate', 'set_state', 'show_toast', 'complete_episode'];

export function resolveKey(key, ctx) {
  if (key === 'beat_number') return ctx.beatNumber ?? ctx.episodeBeat;
  if (key.startsWith('visited:')) {
    const id = key.slice('visited:'.length);
    return ctx.visitedScreens instanceof Set
      ? ctx.visitedScreens.has(id)
      : Array.isArray(ctx.visitedScreens) && ctx.visitedScreens.includes(id);
  }
  return ctx.state?.[key];
}

export function evaluateOne(condition, context) {
  if (!condition || typeof condition !== 'object') return false;
  const { key, op, value } = condition;
  if (!key || !op) return false;
  const actual = resolveKey(key, context);
  switch (op) {
    case 'eq':         return actual === value;
    case 'neq':        return actual !== value;
    case 'gt':         return typeof actual === 'number' && actual > value;
    case 'gte':        return typeof actual === 'number' && actual >= value;
    case 'lt':         return typeof actual === 'number' && actual < value;
    case 'lte':        return typeof actual === 'number' && actual <= value;
    case 'exists':     return actual !== undefined && actual !== null;
    case 'not_exists': return actual === undefined || actual === null;
    default:           return false;
  }
}

export function evaluate(conditions, context) {
  if (!conditions || conditions.length === 0) return true;
  if (!Array.isArray(conditions)) return false;
  return conditions.every(c => evaluateOne(c, context || {}));
}

export function applyActions(actions, context, writer) {
  const effects = { navigate: null, toasts: [], completeEpisode: false };
  if (!actions || !Array.isArray(actions) || actions.length === 0) return effects;
  for (const action of actions) {
    if (!action || !ALLOWED_ACTION_TYPES.includes(action.type)) continue;
    switch (action.type) {
      case 'navigate':         effects.navigate = action.target; break;
      case 'set_state':        writer?.setState?.(action.key, action.value); break;
      case 'show_toast':       effects.toasts.push({ text: action.text, tone: action.tone || 'info' }); break;
      case 'complete_episode': effects.completeEpisode = true; writer?.markEpisodeComplete?.(); break;
    }
  }
  return effects;
}

export function actionsForZone(zone) {
  if (Array.isArray(zone.actions) && zone.actions.length > 0) return zone.actions;
  if (zone.target) return [{ type: 'navigate', target: zone.target }];
  return [];
}

export function filterZones(zones, context) {
  const visible = [];
  const locked = [];
  for (const z of zones || []) {
    (evaluate(z.conditions, context) ? visible : locked).push(z);
  }
  return { visible, locked };
}

/**
 * Human-readable summary of a conditions array for display in zone cards.
 * Returns something like "talked_to_ex = true • beat ≥ 3" or null if empty.
 */
export function summarizeConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) return null;
  return conditions.map(c => {
    const sym = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', exists: 'exists', not_exists: 'not set' }[c.op] || c.op;
    if (c.op === 'exists' || c.op === 'not_exists') return `${c.key} ${sym}`;
    return `${c.key} ${sym} ${JSON.stringify(c.value)}`;
  }).join(' • ');
}

/**
 * Human-readable summary of an actions array. Returns "set_state(x) → navigate(home)"
 * style text or null if empty.
 */
/**
 * Mission progress — read-only. Mirrors src/services/phoneRuntime.js so the
 * editor can render progress live as the author tests conditions.
 */
export function evaluateMission(mission, context) {
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

export function evaluateMissions(missions, context) {
  if (!Array.isArray(missions)) return [];
  return missions.map(m => ({ mission: m, progress: evaluateMission(m, context) }));
}

export function summarizeActions(actions, zone) {
  const list = (Array.isArray(actions) && actions.length > 0) ? actions : (zone?.target ? [{ type: 'navigate', target: zone.target }] : []);
  if (list.length === 0) return null;
  return list.map(a => {
    switch (a.type) {
      case 'navigate':         return `navigate(${a.target || '?'})`;
      case 'set_state':        return `set ${a.key} = ${JSON.stringify(a.value)}`;
      case 'show_toast':       return `toast "${(a.text || '').slice(0, 20)}"`;
      case 'complete_episode': return 'complete episode';
      default:                 return a.type;
    }
  }).join(' → ');
}

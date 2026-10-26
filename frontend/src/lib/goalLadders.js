/**
 * Goal ladders on the Goals tab (Evoni, 2026-10-25: "This is very confusing
 * I don't know what I am to do. How should I attach them to the right event
 * at the right time?"). The client copy of src/utils/goalLadders.js — keep
 * the two in step; both are unit-tested on her 21 goals.
 *
 *   kindOf(metric)       'event' (placed events move it: Pick its event),
 *                        'performance' (Pulse posts, deliverables, episode
 *                        results), 'background' (kept in range, warned about)
 *   directionOf(metric)  'down' for a stat to keep under (stress), else 'up'
 *   buildLadders(goals)  one ladder per stat; only its lowest rung not reached
 *                        is worked on, the rest wait "up next"
 *   goalView(goals)      the tab's sections: the primary's ladder, the other
 *                        ladders, and background and passive goals
 *   ladderProjectionText "8,044 coins expected by season end — clears …"
 *   tidySuggestions      the one-time "Tidy my goals" review
 *
 * Nothing here writes: the ladder and its active rung are worked out on every
 * read, so a rung completing makes the next one active by itself.
 */

export const KIND = {
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

export const kindOf = (metric) => KIND[metric] || 'background';
export const directionOf = (metric) => (DOWN.has(metric) ? 'down' : 'up');

export const METRIC_LABEL = {
  coins: 'Coins', reputation: 'Reputation', brand_trust: 'Brand Trust', influence: 'Influence', stress: 'Stress',
  followers: 'Followers', engagement_rate: 'Engagement Rate', portfolio_strength: 'Portfolio Strength', consistency_streak: 'Consistency Streak',
};
export const metricLabel = (m) => METRIC_LABEL[m] || String(m || '').replace(/_/g, ' ');

/** What moves a performance stat, and where that happens (the advice in place of Find events). */
export const PERFORMANCE_ADVICE = {
  followers: 'Moved by Pulse posts, deliverables and episode results',
  influence: 'Moved by Pulse posts, deliverables and episode results',
  portfolio_strength: 'Moved by deliverables (editorials, shoots) and episode results',
  engagement_rate: 'Moved by Pulse posts and episode results',
};

const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString('en-US');

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[goalLadders] a JSON field could not be read:', err);
    return fallback;
  }
}

const ladderKey = (g) => (g.target_metric === 'custom' || !g.target_metric ? `custom:${g.id}` : g.target_metric);
const createdMs = (g) => {
  const t = Date.parse(g.created_at || '');
  return Number.isFinite(t) ? t : 0;
};

export function compareRungs(a, b) {
  const dir = directionOf(a.target_metric) === 'down' ? -1 : 1;
  return dir * (num(a.target_value) - num(b.target_value))
    || num(a.priority ?? 3) - num(b.priority ?? 3)
    || createdMs(a) - createdMs(b)
    || String(a.id).localeCompare(String(b.id));
}

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

function orderRungs(rungs, all) {
  const order = rungs.slice().sort(compareRungs);
  const ids = new Set(order.map((g) => String(g.id)));
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
export function pickPrimary(goals) {
  const primaries = (goals || []).filter((g) => g.status === 'active' && g.type === 'primary');
  primaries.sort((a, b) => num(a.priority ?? 3) - num(b.priority ?? 3) || createdMs(a) - createdMs(b) || String(a.id).localeCompare(String(b.id)));
  return primaries[0] || null;
}

/** The ladders of the active goals (passive goals are never rungs): { ladders, byGoal, primary_id }. */
export function buildLadders(goals) {
  const all = (goals || []).filter((g) => g && g.status === 'active');
  const primary = pickPrimary(all);
  const byGoal = new Map();
  const groups = new Map();
  for (const g of all) {
    if (g.type === 'passive') { byGoal.set(String(g.id), { ladder_id: null, rung: 'passive', position: 0 }); continue; }
    const key = ladderKey(g);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const ladders = [];
  for (const [key, rungs] of groups) {
    const order = orderRungs(rungs, all);
    order.forEach((g, i) => byGoal.set(String(g.id), { ladder_id: key, rung: i === 0 ? 'active' : 'up_next', position: i }));
    const metric = order[0].target_metric;
    ladders.push({
      id: key, metric, kind: kindOf(metric), direction: directionOf(metric), rungs: order,
      active: order[0], upNext: order.slice(1), has_primary: primary ? order.some((g) => String(g.id) === String(primary.id)) : false,
    });
  }
  return { ladders, byGoal, primary_id: primary ? String(primary.id) : null };
}

/** A background goal is off track when a stat to keep under is above its target. */
export const offTrack = (g) => directionOf(g?.target_metric) === 'down' && num(g.current_value) > num(g.target_value);

const KIND_ORDER = { event: 0, performance: 1, background: 2 };

/**
 * The Goals tab's sections: primary (the ladder holding the one primary),
 * ladders (every other event or performance ladder, event ones first) and
 * background (ladders of a background stat, and every passive goal).
 */
export function goalView(goals) {
  const lad = buildLadders(goals);
  const primary = lad.ladders.find((l) => l.has_primary) || null;
  const rest = lad.ladders.filter((l) => l !== primary);
  const ladders = rest.filter((l) => l.kind !== 'background').sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const background = rest.filter((l) => l.kind === 'background');
  const passive = (goals || []).filter((g) => g.status === 'active' && g.type === 'passive');
  const activeCount = lad.ladders.length + passive.length;
  const upNextCount = lad.ladders.reduce((n, l) => n + l.upNext.length, 0);
  return { primary, ladders, background, passive, primary_id: lad.primary_id, activeCount, upNextCount, byGoal: lad.byGoal };
}

/** "A, B and C". */
export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const unitOf = (p) => (p.metric === 'coins' ? 'coins' : metricLabel(p.metric).toLowerCase());

/**
 * A ladder's one projection (coverage.ladders[].projection):
 * "8,044 coins expected by season end — clears Starter Fund, The Money Talk
 * and Closet Upgrade; Financial Independence next (1,956 short)".
 */
export function ladderProjectionText(p) {
  if (!p) return null;
  if (!p.counted) return `${metricLabel(p.metric)}: ${fmt(p.current)} now · no expected reward counted yet`;
  const head = `${fmt(p.projected)} ${unitOf(p)} expected by season end`;
  const clears = p.clears?.length ? `clears ${joinNames(p.clears.map((c) => c.title))}` : 'clears no rung yet';
  const next = p.next ? `; ${p.next.title} next (${fmt(p.next.short)} short)` : '; every rung cleared';
  return `${head} — ${clears}${next}`;
}

/** "Stress ≤ 4" or "Reputation 3": a rung's target in a few characters. */
export const targetText = (g) => (directionOf(g.target_metric) === 'down' ? `≤ ${fmt(g.target_value)}` : fmt(g.target_value));

// ── Tidy my goals ─────────────────────────────────────────────────────────

// A goal that waits on a story moment (a flop, a comeback) rather than a stat climb.
const STORY = /\b(surviv\w*|flop\w*|fail\w*|recover\w*|drama|controvers\w*|comeback|bounce back)\b/i;
export const isStoryConditional = (g) => STORY.test(`${g.title || ''} ${g.description || ''}`);

/**
 * The one-time review: each suggestion is { key, kind, title, detail,
 * accept, changes: [{ goal_id, body }] } where body is a PUT
 * .../goals/:goalId (archiving is status 'abandoned', never a delete).
 * Nothing changes until a suggestion is accepted.
 *   primary   extra primaries become secondary (one primary stays)
 *   merge     near-duplicates (same stat, same target; or two limits on a
 *             background stat): keep one, archive the other
 *   passive   a story-conditional goal leaves its ladder for passive
 */
export function tidySuggestions(goals) {
  const active = (goals || []).filter((g) => g.status === 'active');
  const out = [];
  const touched = new Set();
  const primary = pickPrimary(active);

  // Near-duplicates first: what gets archived is not offered anything else.
  const byMetric = new Map();
  for (const g of active) {
    if (!g.target_metric || g.target_metric === 'custom') continue;
    if (!byMetric.has(g.target_metric)) byMetric.set(g.target_metric, []);
    byMetric.get(g.target_metric).push(g);
  }
  for (const [metric, list] of byMetric) {
    const down = directionOf(metric) === 'down';
    if (kindOf(metric) === 'background') {
      if (list.length < 2) continue;
      // Keep the strictest (lowest limit to keep under, highest streak).
      const sorted = list.slice().sort((a, b) => (down ? num(a.target_value) - num(b.target_value) : num(b.target_value) - num(a.target_value)) || compareRungs(a, b));
      const [keep, ...drop] = sorted;
      for (const d of drop) {
        out.push({
          key: `merge:${d.id}:${keep.id}`, kind: 'merge',
          title: `Merge ${d.title} into ${keep.title}`,
          detail: `Both ${down ? 'keep' : 'track'} ${metricLabel(metric).toLowerCase()} (${targetText(d)} and ${targetText(keep)}). Keep ${keep.title}, the stricter one, and archive ${d.title}.`,
          accept: `Archive ${d.title}`,
          changes: [{ goal_id: d.id, body: { status: 'abandoned' } }],
        });
        touched.add(String(d.id));
      }
      continue;
    }
    const byTarget = new Map();
    for (const g of list.filter((x) => x.type !== 'passive' && !isStoryConditional(x))) {
      const k = num(g.target_value);
      if (!byTarget.has(k)) byTarget.set(k, []);
      byTarget.get(k).push(g);
    }
    for (const same of byTarget.values()) {
      if (same.length < 2) continue;
      const sorted = same.slice().sort((a, b) => Number(b.type === 'primary') - Number(a.type === 'primary') || compareRungs(a, b));
      const [keep, ...drop] = sorted;
      for (const d of drop) {
        out.push({
          key: `merge:${d.id}:${keep.id}`, kind: 'merge',
          title: `Merge ${d.title} into ${keep.title}`,
          detail: `Both ask for ${metricLabel(metric).toLowerCase()} ${targetText(keep)}. Keep ${keep.title} and archive ${d.title}.`,
          accept: `Archive ${d.title}`,
          changes: [{ goal_id: d.id, body: { status: 'abandoned' } }],
        });
        touched.add(String(d.id));
      }
    }
  }

  for (const g of active) {
    if (touched.has(String(g.id)) || g.type === 'passive' || !isStoryConditional(g)) continue;
    out.push({
      key: `passive:${g.id}`, kind: 'passive',
      title: `Move ${g.title} to passive`,
      detail: `It waits on a story moment, not a ${metricLabel(g.target_metric).toLowerCase()} climb, so it should not hold a rung of the ${metricLabel(g.target_metric).toLowerCase()} ladder.`,
      accept: 'Make it passive',
      changes: [{ goal_id: g.id, body: { type: 'passive' } }],
    });
    touched.add(String(g.id));
  }

  if (primary) {
    for (const g of active) {
      if (g.type !== 'primary' || String(g.id) === String(primary.id) || touched.has(String(g.id))) continue;
      out.push({
        key: `primary:${g.id}`, kind: 'primary',
        title: `Make ${g.title} secondary`,
        detail: `Only one goal can be the primary; ${primary.title} stays the primary. You can swap later with Make primary.`,
        accept: 'Make it secondary',
        changes: [{ goal_id: g.id, body: { type: 'secondary' } }],
      });
    }
  }
  return out;
}

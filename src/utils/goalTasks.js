'use strict';

/**
 * Lala's goal tasks, scaled to the event (T9, docs/EVENT_EPISODE_FLOW.md
 * §8(cc), continuing the T series of §8(bb); Task #2395). Evoni's ruling,
 * verbatim: "Lala's goal tasks scale with the event: 2–3 for small or
 * low-key events, 4–6 for major ones; no fixed template lists."
 *
 * Three pieces:
 *   goalTaskScale(event)      — how many goal tasks the event gets
 *   composeGoalTasks(...)     — goals written from the event's own fields
 *                               (name, description, format, theme, dress
 *                               code, venue, host, brand, guests, stakes);
 *                               there is no fixed list of tasks to copy
 *   enforceGoalTaskBounds(...) — the server-side bound on any generated
 *                               set: trimmed to the maximum, never padded
 *
 * The scale reads the event's prestige (1–10, NOT NULL, default 5 on
 * world_events). INFERRED (T9 names only two sizes): prestige 1–4 is small
 * or low-key (2–3), 7–10 is major (4–6), and 5–6, between the two, gets 3–4.
 *
 * A composed goal is always task_source 'goal' and never required (T1): only
 * an accepted deliverable is required, and deliverables are added by
 * withDeliverableTasks (src/utils/socialTaskSource.js), outside these bounds.
 */

const GOAL_TASK_BOUNDS = Object.freeze({
  small: Object.freeze({ min: 2, max: 3 }),
  standard: Object.freeze({ min: 3, max: 4 }),
  major: Object.freeze({ min: 4, max: 6 }),
});

// world_events.prestige defaults to 5 (src/models/WorldEvent.js).
const DEFAULT_PRESTIGE = 5;

function goalTaskScale(event = {}) {
  const raw = Number(event?.prestige);
  const prestige = Number.isFinite(raw) ? Math.min(10, Math.max(1, Math.round(raw))) : DEFAULT_PRESTIGE;
  const scale = prestige <= 4 ? 'small' : prestige >= 7 ? 'major' : 'standard';
  return { scale, prestige, ...GOAL_TASK_BOUNDS[scale] };
}

const TIMING_ORDER = { before: 0, during: 1, after: 2 };
const TEXT_MAX = 140;

function clip(text, max = TEXT_MAX) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function firstSentence(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^.+?[.!?](\s|$)/);
  return clip(m ? m[0] : s);
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('[goalTasks] Stored JSON could not be read (treated as empty):', err.message);
    return fallback;
  }
}

/**
 * The fields a goal can be written from. `context` (the callers' existing
 * buildSocialTasks context: event_name, host_name, host_handle, host_brand,
 * venue_name, dress_code, guest_names) wins over the event row; the event row
 * (context.event) fills the rest.
 */
function goalFields(event = {}, context = {}, hostProfile = null, outfitPieces = []) {
  const ev = event || {};
  const auto = parseJson(ev.canon_consequences, {})?.automation || {};
  const hostName = context.host_name || ev.host || hostProfile?.display_name || hostProfile?.name || null;
  const hostHandle = context.host_handle || hostProfile?.handle || null;
  const guests = Array.isArray(context.guest_names)
    ? context.guest_names
    : (Array.isArray(auto.guest_profiles) ? auto.guest_profiles.map((g) => g?.display_name || g?.handle) : []);
  const pieces = Array.isArray(outfitPieces) ? outfitPieces.filter(Boolean) : [];
  const mainPiece = pieces.find((p) => ['dress', 'top'].includes(p.category || p.clothing_category)) || pieces[0] || null;
  return {
    event_name: clip(context.event_name || ev.name || '', 120) || null,
    description: context.description || ev.description || auto.description || null,
    format: context.format || ev.format || null,
    theme: context.theme || ev.theme || null,
    dress_code: context.dress_code || ev.dress_code || null,
    venue_name: context.venue_name || ev.venue_name || auto.venue_name || null,
    host_name: hostName,
    host_ref: hostHandle ? `@${String(hostHandle).replace(/^@/, '')}` : hostName,
    host_brand: context.host_brand !== undefined ? context.host_brand : (ev.host_brand || auto.host_brand || null),
    guest_names: guests.filter(Boolean).slice(0, 3),
    narrative_stakes: context.narrative_stakes || ev.narrative_stakes || null,
    main_piece: mainPiece,
    platform: hostProfile?.platform && hostProfile.platform !== 'multi' ? hostProfile.platform : null,
  };
}

/** Goals only the event's own fields can write, most specific first. */
function specificGoals(f) {
  const name = f.event_name || 'the event';
  const out = [];
  if (f.main_piece?.name || f.dress_code) {
    const piece = f.main_piece?.name
      ? `the ${f.main_piece.name}${f.main_piece.brand ? ` by ${f.main_piece.brand}` : ''}`
      : null;
    out.push({
      slot: 'look',
      label: piece ? `Get ready in ${piece}` : `Get ready for the ${clip(f.dress_code, 60)} dress code`,
      description: piece && f.dress_code
        ? `Dress code: ${clip(f.dress_code, 60)}; film the look coming together for ${name}`
        : `Film the look coming together for ${name}`,
      timing: 'before',
    });
  }
  if (f.venue_name) {
    out.push({
      slot: 'arrival',
      label: `Capture the arrival at ${clip(f.venue_name, 80)}`,
      description: `Establish the place${f.host_ref ? ` and ${f.host_ref}'s invite` : ''} in the first shot`,
      timing: 'during',
    });
  }
  if (f.host_ref) {
    out.push({
      slot: 'host_moment',
      label: `Share a moment with ${f.host_ref}`,
      description: `Show the relationship${f.host_brand ? ` with ${f.host_brand}` : ''}, not just attendance`,
      timing: 'during',
    });
  }
  if (f.host_brand && f.host_brand !== f.host_name) {
    out.push({
      slot: 'brand_moment',
      label: `Show ${clip(f.host_brand, 60)} in her own words`,
      description: 'Her own idea, not an agreed deliverable',
      timing: 'during',
    });
  }
  if (f.guest_names.length > 0) {
    out.push({
      slot: 'network',
      label: `Connect with ${f.guest_names.slice(0, 2).join(' and ')}`,
      description: `One real conversation at ${name}`,
      timing: 'during',
    });
  }
  if (f.format || f.theme) {
    out.push({
      slot: 'signature_moment',
      label: f.format
        ? `Capture the ${String(f.format).replace(/_/g, ' ')} moment of ${name}`
        : `Capture the ${clip(f.theme, 60)} theme at ${name}`,
      description: f.format && f.theme ? `Theme: ${clip(f.theme, 80)}` : 'The shot only this event can give her',
      timing: 'during',
    });
  }
  if (f.description) {
    out.push({
      slot: 'story',
      label: `Tell the story of ${name}`,
      description: firstSentence(f.description),
      timing: 'after',
    });
  }
  if (f.narrative_stakes) {
    out.push({
      slot: 'stakes',
      label: `Make ${name} count`,
      description: firstSentence(f.narrative_stakes),
      timing: 'after',
    });
  }
  return out;
}

/** Written from the event's name alone; used only to reach the minimum. */
function nameGoals(f) {
  if (!f.event_name) return [];
  return [
    { slot: 'presence', label: `Post from ${f.event_name}`, description: 'Make her attendance visible to the right audience', timing: 'during' },
    { slot: 'recap', label: `Recap ${f.event_name}`, description: "A carousel or reel of the night's best moments", timing: 'after' },
  ];
}

/**
 * Trim a generated set to the event's maximum and report a set below its
 * minimum. Optional ideas are dropped before goals when trimming. Nothing is
 * ever added (T9: no fixed template lists to pad from).
 */
function enforceGoalTaskBounds(tasks, bounds, where = 'goalTasks') {
  const list = (Array.isArray(tasks) ? tasks : []).filter((t) => t && String(t.label || '').trim());
  while (list.length > bounds.max) {
    let drop = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].task_source === 'optional') { drop = i; break; }
    }
    list.splice(drop >= 0 ? drop : list.length - 1, 1);
  }
  if (list.length < bounds.min) {
    console.warn(`[${where}] ${list.length} goal task(s) for a ${bounds.scale || 'this'} event, below its minimum of ${bounds.min}; kept as generated, not padded (T9)`);
  }
  return list;
}

/**
 * Lala's goals for an event, written from its fields: the event-specific
 * goals up to `upTo` (default the maximum), then goals from its name only
 * while below the minimum, then bounded.
 */
function composeGoalTasks(fields, bounds, { upTo = bounds.max, where = 'goalTasks' } = {}) {
  const goals = specificGoals(fields).slice(0, Math.min(upTo, bounds.max));
  for (const g of nameGoals(fields)) {
    if (goals.length >= bounds.min) break;
    if (!goals.some((x) => x.slot === g.slot)) goals.push(g);
  }
  const platform = fields.platform;
  const tasks = goals
    .map((g) => ({
      ...g,
      platform: platform || (g.timing === 'before' ? 'tiktok' : 'instagram'),
      task_source: 'goal',
      required: false,
      completed: false,
    }))
    .sort((a, b) => TIMING_ORDER[a.timing] - TIMING_ORDER[b.timing]);
  return enforceGoalTaskBounds(tasks, bounds, where);
}

module.exports = {
  GOAL_TASK_BOUNDS,
  goalTaskScale,
  goalFields,
  composeGoalTasks,
  enforceGoalTaskBounds,
};

/**
 * The State tab's front page, to Evoni's mock (2026-10-06): the world after
 * each episode, the tensions that could become stories, and what changed.
 * Pure: StateSummary loads and renders.
 *
 * Where each part comes from:
 *   after each episode  the show's episodes (GET /episodes?show_id=) and the
 *                       character state ledger (GET /world/:showId/history).
 *                       Completing an episode (episodeCompletionService)
 *                       writes Lala's deltas as a 'computed' row for it and
 *                       sets evaluation_status 'accepted'; either says done.
 *                       Finalizing its money adds a 'computed' coins row.
 *                       Those rows are read on their own (?source=computed),
 *                       not from the newest 50 that "what changed" reads.
 *   snapshots           GET /world/state/snapshots, the world facts saved by
 *                       hand. The list also holds 'temperature_update' rows
 *                       carrying metadata.world_temperature, written only by
 *                       POST /world-temperature/:universeId/snapshot
 *                       (worldTemperatureRoutes → snapshotTemperature),
 *                       which nothing in the app calls yet (wiring map,
 *                       docs/reads/2026-10-06-lalaverse-wiring-map.md §4).
 *                       Those are not shown as snapshots, only the latest
 *                       temperature is.
 *                       Snapshots carry no show_id, so they are the world's.
 *   tensions            GET /world/tension-scanner: pairs whose relationship
 *                       is Simmering, Unresolved, High or Explosive. The
 *                       scanner reads the current state only, so a tension
 *                       has a level, never a direction (no "cooling").
 *   what changed        the same ledger, newest first.
 */

/** Hottest first; the level is the bar's length, the tone its color. */
export const TENSION_LEVELS = {
  explosive: { label: 'Explosive', level: 100, tone: 'peach' },
  high: { label: 'High', level: 80, tone: 'pink' },
  unresolved: { label: 'Unresolved', level: 60, tone: 'gold' },
  simmering: { label: 'Simmering', level: 40, tone: 'blue' },
};
const TENSION_ORDER = Object.keys(TENSION_LEVELS);

export const AUTO_SNAPSHOT_LABEL = 'temperature_update';

const STAT_LABEL = { reputation: 'Reputation', brand_trust: 'Brand trust', influence: 'Influence', stress: 'Stress', coins: 'Coins' };
const STAT_ORDER = Object.keys(STAT_LABEL);

const words = (s) => String(s || '').replace(/_/g, ' ').trim();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const time = (v) => { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; };
const json = (v) => {
  if (v && typeof v === 'object') return v;
  try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
};

/** "Reputation +3 · Stress −2 · Coins +120", or '' when nothing moved. */
export function deltaText(deltas) {
  const d = json(deltas);
  const keys = [...STAT_ORDER.filter((k) => k in d), ...Object.keys(d).filter((k) => !STAT_ORDER.includes(k)).sort()];
  return keys
    .filter((k) => typeof d[k] === 'number' && Number.isFinite(d[k]) && d[k] !== 0)
    .map((k) => `${STAT_LABEL[k] || capital(words(k))} ${d[k] > 0 ? '+' : '−'}${Math.abs(d[k]).toLocaleString()}`)
    .join(' · ');
}

/**
 * The tension pairs as bars, hottest first: { rows: [{ key, names, state,
 * label, level, tone, relationship, summary }], total }.
 */
export function tensionBars(pairs, limit = 5) {
  const rows = (pairs || [])
    .filter((p) => p?.char_a?.name && p?.char_b?.name)
    .map((p, i) => {
      const state = String(p.tension_state || '').toLowerCase();
      const known = TENSION_LEVELS[state];
      return {
        key: `${p.char_a.id || p.char_a.name}-${p.char_b.id || p.char_b.name}-${i}`,
        names: `${p.char_a.name} & ${p.char_b.name}`,
        state,
        label: known ? known.label : capital(words(p.tension_state)) || 'Tense',
        level: known ? known.level : 30,
        tone: known ? known.tone : 'blue',
        relationship: p.relationship_type && p.relationship_type !== 'unknown' ? words(p.relationship_type) : null,
        summary: p.conflict_summary || null,
      };
    });
  const rank = (r) => { const i = TENSION_ORDER.indexOf(r.state); return i === -1 ? TENSION_ORDER.length : i; };
  rows.sort((a, b) => rank(a) - rank(b) || a.names.localeCompare(b.names));
  return { rows: rows.slice(0, limit), total: rows.length };
}

/**
 * The snapshots split honestly: { baseline, saved, temperature, autoCount }.
 * baseline is the first snapshot saved by hand (the world before the
 * season's changes, by Evoni's own record); saved is every one by hand,
 * newest first; temperature is the latest reading or null.
 */
export function snapshotSummary(snapshots) {
  const list = (snapshots || []).filter((s) => s && s.snapshot_label);
  const auto = list.filter((s) => s.snapshot_label === AUTO_SNAPSHOT_LABEL);
  const saved = list.filter((s) => s.snapshot_label !== AUTO_SNAPSHOT_LABEL)
    .sort((a, b) => time(b.created_at) - time(a.created_at));
  const latestAuto = [...auto].sort((a, b) => time(b.created_at) - time(a.created_at))
    .find((s) => typeof json(s.metadata).world_temperature?.value === 'number');
  return {
    baseline: saved.length ? saved[saved.length - 1] : null,
    saved,
    temperature: latestAuto ? json(latestAuto.metadata).world_temperature.value : null,
    autoCount: auto.length,
  };
}

/** How many facts and threads a snapshot holds: "3 facts · 1 thread". */
export function snapshotLine(s) {
  const n = (v) => (Array.isArray(v) ? v.length : 0);
  const facts = n(s?.world_facts);
  const threads = n(s?.active_threads);
  const part = (c, one) => `${c} ${one}${c === 1 ? '' : 's'}`;
  return [facts && part(facts, 'fact'), threads && part(threads, 'thread')].filter(Boolean).join(' · ') || 'No facts written';
}

/**
 * The world after each episode, by episode number: [{ id, number, title,
 * done, changes }]. Only the latest `limit` are kept, so the row ends on
 * the next episode not done yet; `earlier` counts the ones left out.
 */
export function episodeStates(episodes, history, limit = 5) {
  // An episode can have several computed rows (the completion's stats, the
  // financial finalization's coins); its change is their sum.
  const computed = new Map();
  for (const h of history || []) {
    if (h?.source !== 'computed' || !h.episode_id) continue;
    const sum = computed.get(String(h.episode_id)) || {};
    for (const [k, v] of Object.entries(json(h.deltas_json))) {
      if (typeof v === 'number' && Number.isFinite(v)) sum[k] = (sum[k] || 0) + v;
    }
    computed.set(String(h.episode_id), sum);
  }
  const rows = (episodes || [])
    .filter((e) => e?.id)
    .sort((a, b) => (Number(a.episode_number) || 9999) - (Number(b.episode_number) || 9999))
    .map((e) => {
      const row = computed.get(String(e.id));
      return {
        id: e.id,
        number: e.episode_number ?? null,
        title: e.title || null,
        done: Boolean(row) || e.evaluation_status === 'accepted',
        changes: row ? deltaText(row) : '',
      };
    });
  const firstOpen = rows.findIndex((r) => !r.done);
  const end = firstOpen === -1 ? rows.length : firstOpen + 1;
  const start = Math.max(0, end - limit);
  return { rows: rows.slice(start, end), earlier: start, total: rows.length };
}

const SOURCE_LABEL = { manual: 'edited by hand', wardrobe_purchase: 'a wardrobe purchase', override: 'an override' };

/**
 * The ledger, newest first: [{ id, who, when, text }], rows that moved
 * something. An episode's computed rows (its stats, its money) are one
 * change, their sum, where the newest of them sits.
 */
export function whatChanged(history, limit = 5) {
  const out = [];
  const byEpisode = new Map();
  for (const h of [...(history || [])].sort((a, b) => time(b.created_at) - time(a.created_at))) {
    const deltas = json(h.deltas_json);
    const group = h.source === 'computed' && h.episode_id ? `${h.character_key}|${h.episode_id}` : null;
    if (group && byEpisode.has(group)) {
      const sum = byEpisode.get(group).deltas;
      for (const [k, v] of Object.entries(deltas)) if (typeof v === 'number' && Number.isFinite(v)) sum[k] = (sum[k] || 0) + v;
      continue;
    }
    const row = {
      id: h.id || `${h.character_key}-${h.created_at}`,
      who: h.character_key === 'lala' ? 'Lala' : capital(words(h.character_key)) || 'Someone',
      when: h.episode_number != null ? `after Episode ${h.episode_number}`
        : h.episode_title ? `after ${h.episode_title}`
        : SOURCE_LABEL[h.source] || words(h.source) || null,
      deltas: { ...deltas },
    };
    if (group) byEpisode.set(group, row);
    out.push(row);
  }
  return out
    .map(({ deltas, ...r }) => ({ ...r, text: deltaText(deltas) }))
    .filter((r) => r.text)
    .slice(0, limit);
}

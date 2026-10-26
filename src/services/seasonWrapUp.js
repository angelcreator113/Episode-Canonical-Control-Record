'use strict';

/**
 * The season wrap-up (Evoni, 2026-10-26: Season page round 3, "how can ai
 * help with these"): on the Results tab, once a season has finished
 * episodes (or is complete), a recap of the season shown.
 *
 * The plain recap is exact data, no AI:
 *   - goals: each of the season's goals with the events that moved it in an
 *     episode that is done (seasonGoalCoverage's movers: main_events are the
 *     pinned ones, also_helps the rest), and whether it was reached (career
 *     goals marked completed this season, from careerPipelineService);
 *   - best_episodes: the accepted episodes, highest evaluation score first,
 *     with their tier;
 *   - money: income and spend over the season's episodes, from the ledger
 *     (financialTransactionService.getFinancialLedger's episode summary, the
 *     rows Lala's balance counts; never cost_coins or episodes.total_*);
 *   - open_threads: the show's story threads not closed, going into the next
 *     season;
 *   - open_twists: this season's twists still planned or planted (not paid
 *     off, not dropped).
 *
 * The AI part: draftWrapUp makes one call (askModel, the house two-attempt
 * loop; aiCostTracker logs and budget-gates it) that reads the plain recap
 * above, never a script, and drafts a short recap for Evoni to edit.
 * Nothing is saved until she saves it: saveWrapUp writes it to
 * shows.metadata.season_wrapups[<arc id>] (no migration: shows.metadata is
 * the show's JSON column, as world_moments and pulse_engine use it).
 *
 *   seasonWrapUp(sequelize, showId, { arcId })                  GET  .../season/wrap-up
 *   draftWrapUp(sequelize, showId, { arcId, anthropic })        POST .../season/wrap-up/draft
 *   saveWrapUp(sequelize, showId, { arcId, text, savedBy })     PUT  .../season/wrap-up
 * arcId null means the season in progress, else the latest (as GET /arc).
 */

const Anthropic = require('@anthropic-ai/sdk');
const { askModel, isBudgetRefusal } = require('./seasonAiContext');

const MODELS = ['claude-sonnet-4-6'];
const MAX_TOKENS = 900;
// The longest wrap-up Evoni can save, in characters.
const TEXT_MAX = 8000;
// What the recap lists, at most (and so what the prompt reads).
const CAPS = { goals: 12, movers: 6, episodes: 5, threads: 15, twists: 15 };

class WrapUpError extends Error {
  constructor(message, status = 400, code = 'WRAP_UP_REFUSED') {
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

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[seasonWrapUp] a JSON field could not be read:', err.message);
    return fallback;
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** The season: the arc asked for, else the one in progress, else the latest. */
async function loadArc(sequelize, showId, arcId) {
  const { loadSeason } = require('./seasonLoader');
  const season = await loadSeason(sequelize, showId, arcId ? { arcId, slots: false } : { anyStatus: true, slots: false });
  if (!season || (arcId && String(season.arc.show_id) !== String(showId))) {
    throw new WrapUpError('This show has no season yet.', 404, 'SEASON_NOT_FOUND');
  }
  return season.arc;
}

/** When the season ran: from its start (or creation) to the next season's start, else now. */
async function seasonWindow(sequelize, arc) {
  const [[next]] = await sequelize.query(
    `SELECT created_at FROM show_arcs
      WHERE show_id = :showId AND deleted_at IS NULL AND arc_number > :arcNumber
      ORDER BY arc_number ASC LIMIT 1`,
    { replacements: { showId: arc.show_id, arcNumber: arc.arc_number } });
  return { from: arc.created_at, to: next?.created_at || null, latest: !next };
}

/**
 * The season's goals: those set for it (arc_id), and Lala's goals with no
 * season that were reached while it ran, or are still active while it is
 * the latest season.
 */
async function seasonGoals(sequelize, arc, window) {
  const [rows] = await sequelize.query(
    `SELECT id, title, type, icon, target_metric, target_value, current_value, starting_value, episode_range, status, completed_at
       FROM career_goals
      WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('active', 'completed', 'failed')
        AND (arc_id = :arcId
             OR (arc_id IS NULL AND status = 'completed' AND completed_at >= :from AND (CAST(:to AS timestamptz) IS NULL OR completed_at < :to))
             OR (arc_id IS NULL AND status IN ('active', 'failed') AND :latest))
      ORDER BY CASE type WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END, priority ASC, created_at ASC`,
    { replacements: { showId: arc.show_id, arcId: arc.id, from: window.from, to: window.to, latest: window.latest } });
  return rows;
}

/** Each goal with the events that moved it in a finished episode (main events first). */
async function goalsOf(sequelize, arc, goals) {
  if (!goals.length) return [];
  const { loadCoverageInputs, computeCoverage } = require('./seasonGoalCoverage');
  const inputs = await loadCoverageInputs(sequelize, arc.show_id, { arcId: arc.id, goals });
  const coverage = inputs ? computeCoverage(inputs) : { goals: [] };
  const byId = new Map(coverage.goals.map((g) => [String(g.id), g]));
  const mover = (m) => ({ event_id: m.event_id, name: m.name, code: m.code, label: m.label, phase: m.phase });
  return goals.slice(0, CAPS.goals).map((g) => {
    const c = byId.get(String(g.id)) || { movers: [], main_events: [], also_helps: [] };
    return {
      id: g.id,
      title: g.title,
      icon: g.icon || null,
      type: g.type || null,
      metric_label: c.metric_label || null,
      status: g.status,
      reached: g.status === 'completed',
      completed_at: g.completed_at || null,
      current_value: num(g.current_value),
      target_value: num(g.target_value),
      main_events: (c.main_events || []).filter((m) => m.done).slice(0, CAPS.movers).map(mover),
      also_helps: (c.also_helps || []).filter((m) => m.done).slice(0, CAPS.movers).map(mover),
      still_planned: (c.movers || []).filter((m) => !m.done).length,
    };
  });
}

/**
 * The season's live episodes, as the Results tab scopes them
 * (lib/seasonAttention episodeInSeason): in one of its slots, else its
 * season snapshot names this arc, else its season number is this season's.
 */
async function seasonEpisodes(sequelize, arc) {
  const [rows] = await sequelize.query(
    `SELECT e.id, e.title, e.episode_number, e.evaluation_status, e.evaluation_json, s.slot_number,
            CAST(e.season_context ->> 'slot_number' AS integer) AS context_slot
       FROM episodes e
       LEFT JOIN season_slots s ON s.episode_id = e.id AND s.arc_id = :arcId AND s.deleted_at IS NULL
      WHERE e.show_id = :showId AND e.deleted_at IS NULL
        AND (s.id IS NOT NULL
             OR e.season_context ->> 'arc_id' = CAST(:arcId AS text)
             OR (COALESCE(e.season_context ->> 'arc_id', '') = ''
                 AND COALESCE(CAST(e.season_context ->> 'season_number' AS integer), e.season_number, 1) = :seasonNumber))
      ORDER BY COALESCE(s.slot_number, CAST(e.season_context ->> 'slot_number' AS integer), e.episode_number) ASC`,
    { replacements: { showId: arc.show_id, arcId: arc.id, seasonNumber: Number(arc.season_number) || 1 } });
  const { episodeLabel } = require('./seasonSlotService');
  const season = Number(arc.season_number) || 1;
  return rows.map((r) => {
    const ej = parseJson(r.evaluation_json, null) || {};
    const slot = r.slot_number ?? r.context_slot ?? null;
    return {
      id: r.id,
      title: r.title || 'Untitled',
      episode_number: r.episode_number,
      label: slot ? episodeLabel(season, slot) : (r.episode_number ? `Episode ${r.episode_number}` : null),
      accepted: r.evaluation_status === 'accepted',
      tier: ej.tier_final ? String(ej.tier_final).toLowerCase() : null,
      score: num(ej.score),
      narrative_line: ej.narrative_line ? String(ej.narrative_line).slice(0, 240) : null,
    };
  });
}

/** Money in and out over the season's episodes, from the ledger. */
async function moneyOf(sequelize, showId, episodes) {
  const { getFinancialLedger } = require('./financialTransactionService');
  const ledger = await getFinancialLedger(showId, sequelize, { limit: 1 });
  const ids = new Set(episodes.map((e) => String(e.id)));
  const labelOf = new Map(episodes.map((e) => [String(e.id), e]));
  const rows = (ledger.episode_summary || []).filter((r) => ids.has(String(r.id))).map((r) => {
    const ep = labelOf.get(String(r.id));
    const income = Number(r.total_income) || 0;
    const spend = Number(r.total_expenses) || 0;
    return { episode_id: r.id, title: ep.title, label: ep.label, income, spend, net: income - spend };
  });
  const income = rows.reduce((a, r) => a + r.income, 0);
  const spend = rows.reduce((a, r) => a + r.spend, 0);
  const top = (key) => rows.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 3);
  return {
    income,
    spend,
    net: income - spend,
    episodes_with_money: rows.filter((r) => r.income > 0 || r.spend > 0).length,
    top_earners: top('income'),
    top_spenders: top('spend'),
    balance_now: num(ledger.balance),
  };
}

async function openThreads(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT id, title, description, status FROM show_story_threads
      WHERE show_id = :showId AND status <> 'closed' AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT :limit`,
    { replacements: { showId, limit: CAPS.threads } });
  return rows.map((t) => ({ id: t.id, title: t.title, status: t.status, description: t.description ? String(t.description).slice(0, 240) : null }));
}

async function openTwists(sequelize, arc) {
  const { episodeLabel } = require('./seasonSlotService');
  const [rows] = await sequelize.query(
    `SELECT t.id, t.title, t.status, ps.slot_number AS plant_slot, ys.slot_number AS payoff_slot
       FROM season_twists t
       LEFT JOIN season_slots ps ON ps.id = t.plant_slot_id
       LEFT JOIN season_slots ys ON ys.id = t.payoff_slot_id
      WHERE t.show_id = :showId AND t.deleted_at IS NULL AND t.status IN ('planned', 'planted')
        AND (t.arc_id = :arcId OR (t.arc_id IS NULL AND ps.arc_id = :arcId))
      ORDER BY ps.slot_number ASC NULLS LAST, t.created_at ASC LIMIT :limit`,
    { replacements: { showId: arc.show_id, arcId: arc.id, limit: CAPS.twists } });
  const season = Number(arc.season_number) || 1;
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    plant_label: t.plant_slot ? episodeLabel(season, t.plant_slot) : null,
    payoff_label: t.payoff_slot ? episodeLabel(season, t.payoff_slot) : null,
  }));
}

async function savedOf(sequelize, showId, arcId) {
  const [[row]] = await sequelize.query(
    `SELECT metadata::jsonb -> 'season_wrapups' -> CAST(:arcId AS text) AS saved FROM shows WHERE id = :showId`,
    { replacements: { showId, arcId } });
  const saved = parseJson(row?.saved, null);
  return saved && typeof saved.text === 'string' ? saved : null;
}

/** GET .../season/wrap-up: the plain recap of the season, and the wrap-up saved for it. */
async function seasonWrapUp(sequelize, showId, { arcId = null } = {}) {
  const arc = await loadArc(sequelize, showId, arcId);
  const window = await seasonWindow(sequelize, arc);
  const goals = await goalsOf(sequelize, arc, await seasonGoals(sequelize, arc, window));
  const episodes = await seasonEpisodes(sequelize, arc);
  const finished = episodes.filter((e) => e.accepted);
  const best = finished.filter((e) => e.score != null || e.tier)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, CAPS.episodes)
    .map(({ accepted, ...e }) => e);
  const complete = arc.status === 'completed';
  const seasonNumber = Number(arc.season_number) || 1;
  return {
    season: { arc_id: arc.id, season_number: seasonNumber, title: arc.title || null, status: arc.status, complete },
    next_season_number: seasonNumber + 1,
    // The wrap-up shows once an episode is finished, or the season is complete.
    ready: complete || finished.length > 0,
    episode_count: episodes.length,
    finished_count: finished.length,
    goals,
    goals_reached: goals.filter((g) => g.reached).map((g) => ({ id: g.id, title: g.title, icon: g.icon, completed_at: g.completed_at })),
    best_episodes: best,
    money: await moneyOf(sequelize, showId, episodes),
    open_threads: await openThreads(sequelize, showId),
    open_twists: await openTwists(sequelize, arc),
    saved: await savedOf(sequelize, showId, arc.id),
  };
}

const coins = (n) => `${Number(n || 0).toLocaleString('en-US')} coins`;

/** The plain recap as the lines the prompt reads. */
function recapLines(recap) {
  const s = recap.season;
  const lines = [];
  lines.push(`Season ${s.season_number}${s.title ? `: ${s.title}` : ''} (${s.complete ? 'complete' : 'in progress'}); ${recap.finished_count} of ${recap.episode_count} episodes finished.`);
  lines.push('', 'GOALS AND THE EVENTS THAT MOVED THEM:');
  if (!recap.goals.length) lines.push('- (no goals this season)');
  for (const g of recap.goals) {
    const value = g.target_value != null ? ` (${g.current_value ?? 0} of ${g.target_value}${g.metric_label ? ` ${g.metric_label}` : ''})` : '';
    const state = g.reached ? 'REACHED' : g.status === 'failed' ? 'missed' : 'not reached yet';
    const main = g.main_events.map((m) => `${m.name} (${m.label})`).join(', ');
    const also = g.also_helps.map((m) => `${m.name} (${m.label})`).join(', ');
    lines.push(`- ${g.title}${value}: ${state}.${main ? ` Main event: ${main}.` : ''}${also ? ` Also helped: ${also}.` : ''}${!main && !also ? ' No finished event moved it.' : ''}`);
  }
  lines.push('', 'BEST EPISODES (by evaluation score):');
  if (!recap.best_episodes.length) lines.push('- (none evaluated yet)');
  for (const e of recap.best_episodes) {
    lines.push(`- ${e.label ? `${e.label} ` : ''}"${e.title}": ${e.tier ? e.tier.toUpperCase() : 'no tier'}${e.score != null ? `, score ${e.score}` : ''}${e.narrative_line ? ` — "${e.narrative_line}"` : ''}`);
  }
  const m = recap.money;
  lines.push('', 'MONEY OVER THE SEASON\'S EPISODES (the ledger):');
  lines.push(`- In: ${coins(m.income)}; out: ${coins(m.spend)}; net: ${m.net >= 0 ? '+' : ''}${coins(m.net)}.`);
  if (m.top_earners.length) lines.push(`- Earned most: ${m.top_earners.map((r) => `"${r.title}" ${coins(r.income)}`).join('; ')}.`);
  if (m.top_spenders.length) lines.push(`- Cost most: ${m.top_spenders.map((r) => `"${r.title}" ${coins(r.spend)}`).join('; ')}.`);
  lines.push('', `STORY THREADS STILL OPEN GOING INTO SEASON ${recap.next_season_number}:`);
  if (!recap.open_threads.length) lines.push('- (none)');
  for (const t of recap.open_threads) lines.push(`- ${t.title} (${t.status})${t.description ? ` — ${t.description}` : ''}`);
  lines.push('', 'TWISTS STILL OPEN (planted or planned, not paid off):');
  if (!recap.open_twists.length) lines.push('- (none)');
  for (const t of recap.open_twists) {
    lines.push(`- ${t.title} (${t.status}${t.plant_label ? `; plant in ${t.plant_label}` : ''}${t.payoff_label ? `; payoff in ${t.payoff_label}` : ''})`);
  }
  return lines.join('\n');
}

function wrapUpPrompt(recap) {
  return `You write the season wrap-up for "Styling Adventures with Lala", a show about Lala, a fashion creator building her career.

Here is the exact recap of the season. Use only what it says: never invent an event, an episode, a number or a thread.

${recapLines(recap)}

Write a short wrap-up of the season for the show's producer, in plain prose (no headings, no bullet points, no markdown), 150 to 250 words, in four short paragraphs:
1. What Lala achieved: the goals she reached, and the ones she did not.
2. Which events mattered, and the best episodes (name them).
3. What the season cost and earned her, with the numbers above.
4. The threads and twists still open going into Season ${recap.next_season_number}.
If a part has nothing in the recap, say so in one plain sentence. Reply with the wrap-up only.`;
}

/** POST .../season/wrap-up/draft: one AI call drafts it from the plain recap; nothing saved. */
async function draftWrapUp(sequelize, showId, { arcId = null, anthropic = null } = {}) {
  const recap = await seasonWrapUp(sequelize, showId, { arcId });
  if (!recap.ready) {
    throw new WrapUpError('No episode of this season is finished yet; there is nothing to wrap up.', 409, 'WRAP_UP_NOT_READY');
  }
  const prompt = wrapUpPrompt(recap);
  let draft;
  try {
    draft = await askModel({
      api: anthropic || getClient(),
      models: MODELS,
      maxTokens: MAX_TOKENS,
      prompt,
      label: 'seasonWrapUp draft',
      read: (response) => {
        const text = (response?.content || []).filter((b) => b?.type === 'text' || typeof b?.text === 'string')
          .map((b) => b.text).join('').trim();
        if (!text) throw new Error('The answer was empty');
        return text.slice(0, TEXT_MAX);
      },
    });
  } catch (err) {
    console.error('[seasonWrapUp] the draft failed:', err.message);
    // A budget refusal is final: retrying would be refused the same way.
    if (isBudgetRefusal(err)) throw new WrapUpError(`${err.message} Nothing was drafted.`, 429, 'AI_BUDGET_EXCEEDED');
    throw new WrapUpError('The AI could not write the wrap-up right now. Try again.', 502, 'WRAP_UP_DRAFT_FAILED');
  }
  return { draft, season: recap.season };
}

/** PUT .../season/wrap-up: save Evoni's wrap-up for the season ({ text }); an empty text clears it. */
async function saveWrapUp(sequelize, showId, { arcId = null, text, savedBy = null } = {}) {
  if (text != null && typeof text !== 'string') throw new WrapUpError('text must be text.');
  const clean = String(text || '').trim();
  if (clean.length > TEXT_MAX) throw new WrapUpError(`The wrap-up is at most ${TEXT_MAX.toLocaleString('en-US')} characters.`);
  const arc = await loadArc(sequelize, showId, arcId);
  const saved = clean ? { text: clean, saved_at: new Date().toISOString(), saved_by: savedBy } : null;
  const [, meta] = await sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{season_wrapups}',
            CASE WHEN CAST(:saved AS jsonb) IS NULL
                 THEN COALESCE(metadata::jsonb -> 'season_wrapups', '{}'::jsonb) - CAST(:arcId AS text)
                 ELSE COALESCE(metadata::jsonb -> 'season_wrapups', '{}'::jsonb) || jsonb_build_object(CAST(:arcId AS text), CAST(:saved AS jsonb))
            END)::json,
            updated_at = NOW()
      WHERE id = :showId AND deleted_at IS NULL`,
    { replacements: { showId, arcId: arc.id, saved: saved ? JSON.stringify(saved) : null } });
  if (!(meta?.rowCount ?? meta)) throw new WrapUpError('Show not found.', 404, 'SHOW_NOT_FOUND');
  return { saved, season: { arc_id: arc.id, season_number: Number(arc.season_number) || 1 } };
}

module.exports = {
  MODELS,
  MAX_TOKENS,
  TEXT_MAX,
  CAPS,
  WrapUpError,
  recapLines,
  wrapUpPrompt,
  seasonWrapUp,
  draftWrapUp,
  saveWrapUp,
};

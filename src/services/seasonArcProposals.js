'use strict';

/**
 * Season arc proposals (Evoni, 2026-10-17: "take in all the information
 * even as it grows and automatically come up with a season arc ... as the
 * feed characters grow so does the story arc"; her ruling: proposals she
 * approves, nothing changed until she accepts).
 *
 * The season planners read only episodes, goals and threads; nothing read
 * The Pulse. This reads the feed's growth, asks for changes to the season
 * plan in one AI call, and keeps them as a proposal in
 * season_arc_proposals (migration 20261018030000):
 *
 *   loadFeedSignals(db, showId)   what moved on the feed: accepted follower
 *     changes by profile, profiles whose state changed, Pulse storylines
 *     (with the thread each follows), who has met Lala and in which
 *     episode, and Lala's stats
 *   propose(db, showId, { trigger, force })  one proposal: phase themes
 *     (tagline, emotional arc), threads to open or close, and purposes for
 *     open slots, each with why. Slots she edited, locked or started are
 *     never offered. An unchanged feed (same signals hash), or a proposal
 *     in the last 30 minutes, is not asked about again unless forced.
 *   proposeLater(db, showId, trigger)  the same, never awaited; a failure
 *     is logged (the triggers: an episode accepted, a storyline paid off,
 *     a follower change accepted)
 *   listProposals(db, showId)     the open proposal and the last decided
 *   accept(db, showId, id, { indexes, by })  applies the chosen changes
 *     through the season's own services (saveIntention, createThread,
 *     closeThread, the phase's tagline and emotional arc)
 *   dismiss(db, showId, id, { by })
 *
 * Its new threads (thread_open) also wait in the show's threads list
 * (services/threadInbox, 2026-10-26), checked there. One decided there is
 * marked `taken` in changes; accept skips it.
 */

const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { loadSeason } = require('./seasonLoader');
const {
  seasonAiContext, askModel, isBudgetRefusal, bullets, phaseLine, threadLine, goalLine, debtLines,
} = require('./seasonAiContext');
const { fromArc, seasonLines } = require('./seasonLine');

const MODELS = ['claude-sonnet-4-6'];
const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_CHANGES = 8;
const KINDS = ['phase_theme', 'thread_open', 'thread_close', 'slot_intention'];

class SeasonProposalError extends Error {
  constructor(message, status = 409, code = 'SEASON_PROPOSAL_CONFLICT') {
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

const text = (v, max) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const parse = (v, d) => {
  if (v == null) return d;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) { console.error('[seasonArcProposals] JSON parse failed:', err.message); return d; }
};

/** A query that may meet a table this database lacks: logged, and read as no rows. */
async function rows(sequelize, label, sql, replacements) {
  try {
    const [out] = await sequelize.query(sql, { replacements });
    return out || [];
  } catch (err) {
    console.error(`[seasonArcProposals] ${label} could not be read:`, err.message);
    return [];
  }
}

// ── What moved on the feed ─────────────────────────────────────────────────

async function loadFeedSignals(db, showId) {
  const { sequelize } = db;
  const followers = await rows(sequelize, 'follower changes',
    `SELECT sp.handle, sp.display_name, SUM(pf.change)::int AS change, MAX(pf.count_after)::int AS now
       FROM pulse_followers pf JOIN social_profiles sp ON sp.id = pf.social_profile_id
      WHERE pf.show_id = :showId AND pf.status = 'accepted' AND pf.deleted_at IS NULL AND pf.cause <> 'start'
      GROUP BY sp.handle, sp.display_name
     HAVING SUM(pf.change) <> 0
      ORDER BY ABS(SUM(pf.change)) DESC LIMIT 8`, { showId });
  const states = await rows(sequelize, 'profile states',
    `SELECT sp.handle, sp.previous_state AS "from", sp.current_state AS "to"
       FROM social_profiles sp
      WHERE sp.state_changed_at IS NOT NULL AND sp.current_state IS NOT NULL AND sp.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM pulse_followers pf WHERE pf.social_profile_id = sp.id AND pf.show_id = :showId AND pf.deleted_at IS NULL)
      ORDER BY sp.state_changed_at DESC LIMIT 8`, { showId });
  const storylines = await rows(sequelize, 'Pulse storylines',
    `SELECT ps.title, ps.status, t.title AS thread
       FROM pulse_storylines ps LEFT JOIN show_story_threads t ON t.id = ps.show_story_thread_id AND t.deleted_at IS NULL
      WHERE ps.show_id = :showId AND ps.deleted_at IS NULL AND ps.status IN ('planned', 'running', 'paid_off')
      ORDER BY ps.updated_at DESC LIMIT 10`, { showId });

  let met = [];
  try {
    const map = await require('./pulseReveals').metLala(db, showId);
    const latest = [...map.entries()].sort((a, b) => b[1].episode_number - a[1].episode_number).slice(0, 8);
    if (latest.length) {
      const handles = await rows(sequelize, 'met profiles', 'SELECT id, handle FROM social_profiles WHERE id IN (:ids)', { ids: latest.map(([id]) => id) });
      const byId = new Map(handles.map((h) => [String(h.id), h.handle]));
      met = latest.map(([id, m]) => ({ handle: byId.get(String(id)) || `profile ${id}`, episode_number: m.episode_number }));
    }
  } catch (err) {
    console.error('[seasonArcProposals] who met Lala could not be read:', err.message);
  }

  const [lala] = await rows(sequelize, 'Lala\'s stats',
    `SELECT coins, reputation, brand_trust, influence, stress FROM character_state
      WHERE show_id = :showId AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1`, { showId });

  return { followers, states, storylines, met, lala: lala || null };
}

const signalsHash = (signals) => crypto.createHash('sha256').update(JSON.stringify(signals)).digest('hex');

const isEmpty = (s) => !s.followers.length && !s.states.length && !s.storylines.length && !s.met.length && !s.lala;

// ── The season it would change ─────────────────────────────────────────────

async function seasonOf(db, showId) {
  const { sequelize } = db;
  let season = null;
  try {
    season = await loadSeason(sequelize, showId);
  } catch (err) {
    console.error('[seasonArcProposals] the season could not be read:', err.message);
  }
  if (!season) return null;
  const { arc } = season;
  // Offered only: no episode, not locked, not edited by Evoni.
  const openSlots = season.slots
    .filter((s) => !s.episode_id && !s.locked_at && s.intention_source !== 'edited')
    .map((s) => ({ slot_number: s.slot_number, phase: s.phase, story_purpose: s.story_purpose, intention_source: s.intention_source }));
  // The last approved story record and what Lala still owes people
  // (services/storyCarryForward; Evoni, 2026-10-23), and the confirmed
  // relationships between the season's people (never a seed).
  const { threads, goals, carried, relationships } = await seasonAiContext(sequelize, showId, {
    threads: { limit: 20, order: 'asc' }, goals: { limit: 8 }, carried: true, relationships: true,
  });
  return {
    arc,
    carried,
    relationships,
    phases: arc.phases,
    debt: parse(arc.narrative_debt, []) || [],
    openSlots,
    threads,
    goals,
  };
}

// The season's logline and description (seasonLine), a line each; '' with neither.
function aboutSeason(arc) {
  const lines = seasonLines(fromArc(arc), { title: false, part: false });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

function buildPrompt(season, signals) {
  const lines = (list, fn) => bullets(list || [], fn, '(none)');
  return `You plan the season of "Styling Adventures with Lala". The show's feed (The Pulse) has moved since the plan was written. Propose changes to the season plan so the story grows with the feed characters. Only what the signals justify; no change is a fine answer.

THE SEASON: ${season.arc.title}${season.arc.tagline ? ` ("${season.arc.tagline}")` : ''}; current phase ${season.arc.current_phase}.
${aboutSeason(season.arc)}PHASES:
${lines(season.phases, (p) => `- ${phaseLine(p, { status: true })}`)}
OPEN THREADS ([id] title):
${lines(season.threads, (t) => threadLine(t, { status: true }))}
OPEN SLOTS YOU MAY PROPOSE A PURPOSE FOR (slot: phase, current purpose):
${lines(season.openSlots.slice(0, 12), (s) => `- E${s.slot_number}: phase ${s.phase}, ${s.story_purpose || 'no purpose yet'}`)}
LALA'S GOALS:
${lines(season.goals, (g) => goalLine(g))}
NARRATIVE DEBT:
${season.debt && season.debt.length ? debtLines(season.debt) : '(none)'}
${season.carried ? `\n${season.carried}` : ''}${season.relationships ? `\n${season.relationships}` : ''}
WHAT MOVED ON THE FEED:
Followers (accepted changes): ${lines(signals.followers, (f) => `@${f.handle} ${f.change > 0 ? '+' : ''}${f.change} (now ${f.now ?? '?'})`)}
Profiles whose state changed: ${lines(signals.states, (s) => `@${s.handle}: ${s.from || '?'} → ${s.to}`)}
Pulse storylines: ${lines(signals.storylines, (s) => `${s.title} (${s.status})${s.thread ? `, follows thread "${s.thread}"` : ''}`)}
Who has met Lala (latest first): ${lines(signals.met, (m) => `@${m.handle} in E${m.episode_number}`)}
Lala's stats: ${signals.lala ? Object.entries(signals.lala).map(([k, v]) => `${k} ${v}`).join(', ') : '(none)'}

Return ONLY JSON:
{"summary": "one or two sentences: what the feed suggests for the season",
 "changes": [
  {"kind": "phase_theme", "phase": 2, "tagline": "...", "emotional_arc": "...", "why": "the feed signal behind it"},
  {"kind": "thread_open", "title": "...", "description": "...", "why": "..."},
  {"kind": "thread_close", "thread_id": "an id from OPEN THREADS", "why": "..."},
  {"kind": "slot_intention", "slot_number": 5, "story_purpose": "what this episode does for the story", "why": "..."}
 ]}
At most ${MAX_CHANGES} changes. Never a completed phase. Only slots listed above. Every change names the feed signal in "why".`;
}

/** The model's answer, kept to what the season allows. */
function parseProposal(raw, season) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  const json = match ? parse(match[0], null) : null;
  if (!json || typeof json !== 'object') throw new SeasonProposalError('The proposal came back unreadable', 502, 'SEASON_PROPOSAL_UNREADABLE');
  const phases = new Map(season.phases.map((p) => [Number(p.phase), p]));
  const threads = new Set(season.threads.map((t) => String(t.id)));
  const openTitles = new Set(season.threads.map((t) => String(t.title).toLowerCase()));
  const slots = new Set(season.openSlots.map((s) => Number(s.slot_number)));
  const seenSlots = new Set();
  const changes = [];
  for (const c of Array.isArray(json.changes) ? json.changes : []) {
    if (!c || !KINDS.includes(c.kind) || changes.length >= MAX_CHANGES) continue;
    const why = text(c.why, 300) || '';
    if (c.kind === 'phase_theme') {
      const phase = phases.get(Number(c.phase));
      const tagline = text(c.tagline, 160);
      const emotional = text(c.emotional_arc, 400);
      if (!phase || phase.status === 'completed' || (!tagline && !emotional)) continue;
      changes.push({ kind: 'phase_theme', phase: Number(c.phase), phase_title: phase.title, tagline, emotional_arc: emotional, why });
    } else if (c.kind === 'thread_open') {
      const title = text(c.title, 200);
      if (!title || openTitles.has(title.toLowerCase())) continue;
      openTitles.add(title.toLowerCase());
      changes.push({ kind: 'thread_open', title, description: text(c.description, 600), why });
    } else if (c.kind === 'thread_close') {
      if (!threads.has(String(c.thread_id))) continue;
      const thread = season.threads.find((t) => String(t.id) === String(c.thread_id));
      changes.push({ kind: 'thread_close', thread_id: thread.id, thread_title: thread.title, why });
    } else if (c.kind === 'slot_intention') {
      const n = Number(c.slot_number);
      const purpose = text(c.story_purpose, 600);
      if (!slots.has(n) || seenSlots.has(n) || !purpose) continue;
      seenSlots.add(n);
      changes.push({ kind: 'slot_intention', slot_number: n, story_purpose: purpose, why });
    }
  }
  return { summary: text(json.summary, 600), changes };
}

// ── Proposing ──────────────────────────────────────────────────────────────

async function propose(db, showId, { trigger = 'manual', force = false, anthropic = null } = {}) {
  const { sequelize } = db;
  const season = await seasonOf(db, showId);
  if (!season) return { skipped: 'no_season' };
  const signals = await loadFeedSignals(db, showId);
  if (isEmpty(signals) && !force) return { skipped: 'no_signals' };
  const hash = signalsHash(signals);

  const [last] = await rows(sequelize, 'the last proposal',
    `SELECT id, status, signals_hash, created_at FROM season_arc_proposals
      WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, { showId });
  if (!force && last) {
    if (last.signals_hash === hash) return { skipped: 'unchanged' };
    if (Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) return { skipped: 'recent' };
  }

  const prompt = buildPrompt(season, signals);
  let result;
  try {
    result = await askModel({
      api: anthropic || getClient(), models: MODELS, maxTokens: 1500, prompt, label: 'seasonArcProposals proposal',
      read: (response) => parseProposal(response?.content?.[0]?.text, season),
    });
  } catch (err) {
    console.error('[seasonArcProposals] the proposal failed:', err.message);
    if (isBudgetRefusal(err)) throw new SeasonProposalError(`${err.message} Nothing was proposed.`, 429, 'AI_BUDGET_EXCEEDED');
    throw new SeasonProposalError(`The proposal failed: ${err.message || 'unknown error'}`, 502, 'SEASON_PROPOSAL_FAILED');
  }

  // A newer proposal replaces any still open.
  await sequelize.query(
    `UPDATE season_arc_proposals SET status = 'superseded', updated_at = NOW()
      WHERE show_id = :showId AND status = 'proposed' AND deleted_at IS NULL`, { replacements: { showId } });
  const [[row]] = await sequelize.query(
    `INSERT INTO season_arc_proposals (id, show_id, arc_id, status, trigger, signals, signals_hash, summary, changes, created_at, updated_at)
     VALUES (gen_random_uuid(), :showId, :arcId, :status, :trigger, CAST(:signals AS jsonb), :hash, :summary, CAST(:changes AS jsonb), NOW(), NOW())
     RETURNING id, status, trigger, signals, summary, changes, created_at`,
    { replacements: {
      showId, arcId: season.arc.id, status: result.changes.length ? 'proposed' : 'no_change', trigger: String(trigger).slice(0, 30),
      signals: JSON.stringify(signals), hash, summary: result.summary, changes: JSON.stringify(result.changes),
    } });
  // Its new threads wait in the show's threads list too; the check reads them there (never awaited).
  if (result.changes.some((c) => c.kind === 'thread_open')) require('./threadInbox').checkWaitingLater(sequelize, showId);
  return { proposal: row };
}

/** propose(), never awaited: the triggers must not wait on, or fail for, an AI call. */
function proposeLater(db, showId, trigger) {
  if (!showId) return;
  Promise.resolve()
    .then(() => propose(db, showId, { trigger }))
    .catch((err) => console.error(`[seasonArcProposals] ${trigger} proposal failed (non-blocking):`, err.message));
}

// ── Deciding ───────────────────────────────────────────────────────────────

async function listProposals(db, showId) {
  const list = await rows(db.sequelize, 'proposals',
    `SELECT id, status, trigger, signals, summary, changes, applied, decided_by, decided_at, created_at
       FROM season_arc_proposals WHERE show_id = :showId AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 6`, { showId });
  return {
    open: list.find((p) => p.status === 'proposed') || null,
    recent: list.filter((p) => p.status !== 'proposed' && p.status !== 'superseded').slice(0, 3),
  };
}

/** Claims an open proposal for a decision; a second decision gets a 409. */
async function claim(db, showId, id, status, by) {
  const [claimed] = await db.sequelize.query(
    `UPDATE season_arc_proposals SET status = :status, decided_by = :by, decided_at = NOW(), updated_at = NOW()
      WHERE id = :id AND show_id = :showId AND status = 'proposed' AND deleted_at IS NULL
      RETURNING id, arc_id, changes`,
    { replacements: { id, showId, status, by: by || null } });
  if (!claimed?.length) throw new SeasonProposalError('This proposal is not open any more', 409, 'SEASON_PROPOSAL_DECIDED');
  return claimed[0];
}

async function applyChange(db, showId, arcId, change) {
  const { sequelize } = db;
  if (change.kind === 'thread_open') {
    const row = await require('./storyThreadService').createThread(sequelize, showId, { title: change.title, description: change.description });
    return { thread_id: row?.id };
  }
  if (change.kind === 'thread_close') {
    await require('./storyThreadService').closeThread(sequelize, showId, change.thread_id);
    return {};
  }
  if (change.kind === 'phase_theme') {
    const [[arc]] = await sequelize.query('SELECT phases FROM show_arcs WHERE id = :arcId AND deleted_at IS NULL', { replacements: { arcId } });
    const phases = parse(arc?.phases, []);
    const phase = Array.isArray(phases) ? phases.find((p) => Number(p.phase) === change.phase) : null;
    if (!phase) throw new SeasonProposalError(`Phase ${change.phase} is not in the season any more`, 409, 'SEASON_PROPOSAL_STALE');
    if (phase.status === 'completed') throw new SeasonProposalError(`Phase ${change.phase} is completed`, 409, 'SEASON_PROPOSAL_STALE');
    if (change.tagline) phase.tagline = change.tagline;
    if (change.emotional_arc) phase.emotional_arc = change.emotional_arc;
    await sequelize.query('UPDATE show_arcs SET phases = CAST(:phases AS jsonb), updated_at = NOW() WHERE id = :arcId',
      { replacements: { phases: JSON.stringify(phases), arcId } });
    return {};
  }
  // slot_intention: the slot's other choices are kept; an edit since the proposal wins.
  const [[slot]] = await sequelize.query(
    `SELECT id, intention_source, career_focus, desired_pressure, outcome_range FROM season_slots
      WHERE arc_id = :arcId AND slot_number = :n AND deleted_at IS NULL`, { replacements: { arcId, n: change.slot_number } });
  if (!slot) throw new SeasonProposalError(`E${change.slot_number} is not in the season any more`, 409, 'SEASON_PROPOSAL_STALE');
  if (slot.intention_source === 'edited') throw new SeasonProposalError(`E${change.slot_number} was edited since; your words were kept`, 409, 'SEASON_PROPOSAL_STALE');
  const { saveIntention } = require('./seasonIntentionService');
  await saveIntention(sequelize, showId, slot.id, {
    story_purpose: change.story_purpose,
    career_focus: slot.career_focus,
    desired_pressure: slot.desired_pressure,
    outcome_range: parse(slot.outcome_range, null),
  });
  return {};
}

async function accept(db, showId, id, { indexes = null, by = null } = {}) {
  const row = await claim(db, showId, id, 'accepted', by);
  const changes = parse(row.changes, []);
  const chosen = Array.isArray(indexes) ? new Set(indexes.map(Number)) : null;
  const applied = [];
  for (let i = 0; i < changes.length; i += 1) {
    if (chosen && !chosen.has(i)) { applied.push({ index: i, ok: false, skipped: true }); continue; }
    // Decided already in the threads list (services/threadInbox decideSuggestion): kept, merged or dropped there.
    if (changes[i]?.taken) { applied.push({ index: i, ok: true, skipped: true, taken: changes[i].taken.as }); continue; }
    try {
      applied.push({ index: i, ok: true, ...(await applyChange(db, showId, row.arc_id, changes[i])) });
    } catch (err) {
      if (!err.status) console.error('[seasonArcProposals] applying a change failed:', err.message);
      applied.push({ index: i, ok: false, error: err.message });
    }
  }
  await db.sequelize.query('UPDATE season_arc_proposals SET applied = CAST(:applied AS jsonb), updated_at = NOW() WHERE id = :id',
    { replacements: { applied: JSON.stringify(applied), id } });
  return { applied };
}

async function dismiss(db, showId, id, { by = null } = {}) {
  await claim(db, showId, id, 'dismissed', by);
  return { dismissed: true };
}

module.exports = {
  SeasonProposalError, MODELS, COOLDOWN_MS,
  loadFeedSignals, signalsHash, buildPrompt, parseProposal,
  propose, proposeLater, listProposals, accept, dismiss,
};

'use strict';

/**
 * What the season's AI calls share (planner PR 4, 2026-10-24): the
 * proposals (seasonArcProposals), Suggest twists (seasonTwists), a slot's
 * draft (seasonIntentionService) and Draft the season (seasonSetupService)
 * each rebuilt the same season context and ran their own retry loop. They
 * read it, and ask the model, here. Each prompt keeps its own wording, its
 * own parts and its own caps.
 *
 *   seasonAiContext(sequelize, showId, { threads, goals, carried, relationships })
 *       → { threads, goals, carried, relationships }; a part set to false is
 *       not read. threads { limit, order: 'asc'|'desc' }: the show's threads
 *       that are not closed; goals { limit, statuses }: Lala's career goals;
 *       carried { before }: the last approved story record and what Lala
 *       still owes people (storyCarryForward); relationships { cap,
 *       characters, detail }: the confirmed pairs between the season's
 *       people (seasonNeeds.seasonRelationshipBlock). A part that cannot be
 *       read is logged and left empty: the call goes without it.
 *   phaseLine / threadLine / goalLine / debtLines / bullets   the shared lines
 *   askModel({ api, models, maxTokens, prompt, label, read })
 *       the house two-attempt loop: up to two tries per model, a short pause
 *       before the second when the model is overloaded (529) or unavailable
 *       (503), and never a second try after a budget refusal
 *       (aiCostTracker's AI_BUDGET_EXCEEDED): it would be refused the same
 *       way. `read` turns the answer into the result inside the loop, so an
 *       unreadable answer is asked again once.
 */

const RETRY_PAUSE_MS = 2000;

const isBudgetRefusal = (err) => err?.code === 'AI_BUDGET_EXCEEDED';
const isOverloaded = (err) => {
  const status = Number(err?.status || err?.error?.status);
  return status === 529 || status === 503;
};

let pauseMs = RETRY_PAUSE_MS;
/** For the tests: the pause before a retry after a 529/503. */
function setRetryPause(ms) { pauseMs = ms; }

async function askModel({ api, models, maxTokens, prompt, label, read = (response) => response }) {
  let lastErr = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await api.messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
        return await read(response);
      } catch (err) {
        console.error(`[${label}] attempt ${attempt + 1} failed:`, err.message);
        if (isBudgetRefusal(err)) throw err;
        lastErr = err;
        if (attempt === 0 && isOverloaded(err) && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
  }
  throw lastErr || new Error('No answer from the AI');
}

// ── The shared lines ───────────────────────────────────────────────────────

const clip = (v, n) => {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  return Number.isFinite(n) && s.length > n ? s.slice(0, n) : s;
};

/** A list as "- …" lines, or the empty text. */
function bullets(list, fn, empty) {
  return list && list.length ? list.map(fn).join('\n') : empty;
}

/**
 * A phase (a "Part" in Draft the season): "Phase 2 (active): Ascension
 * ("Climb"), E9–E16; emotional arc: …". status and range are shown when asked.
 */
function phaseLine(p, { word = 'Phase', status = false, range = false } = {}) {
  return `${word} ${p.phase}${status ? ` (${p.status || 'upcoming'})` : ''}: ${p.title}${p.tagline ? ` ("${p.tagline}")` : ''}`
    + `${range ? `, E${p.episode_start}–E${p.episode_end}` : ''}${p.emotional_arc ? `; emotional arc: ${p.emotional_arc}` : ''}`;
}

/** A thread: "- [id] Title (status) — description", id, status and description when asked (description: a cap, or true for all of it). */
function threadLine(t, { id = true, status = false, description = false } = {}) {
  const desc = description && t.description ? clip(t.description, description === true ? Infinity : description) : '';
  return `- ${id ? `[${t.id}] ` : ''}${t.title}${status && t.status ? ` (${t.status})` : ''}${desc ? ` — ${desc}` : ''}`;
}

/** A goal: "- Title (metric 3/10, episodes 1–8, active)"; its range and status when asked and the goal has them. */
function goalLine(g, { status = false, range: withRange = false } = {}) {
  let range = withRange ? g.episode_range : null;
  if (typeof range === 'string') {
    try { range = JSON.parse(range); } catch (err) {
      console.error('[seasonAiContext] a goal\'s episode range could not be read:', err.message);
      range = null;
    }
  }
  return `- ${g.title} (${g.target_metric} ${g.current_value}/${g.target_value}`
    + `${Array.isArray(range) ? `, episodes ${range[0]}–${range[1]}` : ''}${status && g.status ? `, ${g.status}` : ''})`;
}

/** The narrative debt Lala carries, or "- None.". */
function debtLines(debt) {
  return bullets(Array.isArray(debt) ? debt : [], (d) => `- ${d.narrative_weight || d.goal_title || d.title}`, '- None.');
}

// ── The shared reads ───────────────────────────────────────────────────────

async function safely(label, empty, read) {
  try { return await read(); } catch (err) {
    console.error(`[seasonAiContext] ${label} could not be read (the call goes without it):`, err.message);
    return empty;
  }
}

function openThreads(sequelize, showId, { limit = 20, order = 'asc' } = {}) {
  return safely('the threads', [], async () => {
    const [rows] = await sequelize.query(
      `SELECT id, title, description, status FROM show_story_threads
        WHERE show_id = :showId AND status <> 'closed' AND deleted_at IS NULL
        ORDER BY created_at ${order === 'desc' ? 'DESC' : 'ASC'} LIMIT ${Number(limit) || 20}`,
      { replacements: { showId } });
    return rows;
  });
}

function careerGoals(sequelize, showId, { limit = 8, statuses = ['active'] } = {}) {
  return safely('the goals', [], async () => {
    const [rows] = await sequelize.query(
      `SELECT title, target_metric, current_value, target_value, episode_range, status FROM career_goals
        WHERE show_id = :showId AND status IN (:statuses) AND deleted_at IS NULL
        ORDER BY priority ASC, created_at ASC LIMIT ${Number(limit) || 8}`,
      { replacements: { showId, statuses } });
    return rows;
  });
}

function carriedForward(sequelize, showId, { before = null } = {}) {
  return safely('the story so far', '', () => require('./storyCarryForward').carryForShow(sequelize, showId, before != null ? { before } : undefined));
}

/** The season context the AI calls share; each part only when asked. */
async function seasonAiContext(sequelize, showId, { threads = false, goals = false, carried = false, relationships = false } = {}) {
  return {
    threads: threads ? await openThreads(sequelize, showId, threads) : [],
    goals: goals ? await careerGoals(sequelize, showId, goals) : [],
    carried: carried ? await carriedForward(sequelize, showId, carried === true ? {} : carried) : '',
    relationships: relationships
      ? await require('./seasonNeeds').seasonRelationshipBlock(sequelize, showId, relationships === true ? {} : relationships)
      : '',
  };
}

module.exports = {
  RETRY_PAUSE_MS, setRetryPause, isBudgetRefusal, askModel,
  bullets, phaseLine, threadLine, goalLine, debtLines,
  openThreads, careerGoals, carriedForward, seasonAiContext,
};

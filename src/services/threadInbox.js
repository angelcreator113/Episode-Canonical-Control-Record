'use strict';

/**
 * The one threads list, and threads that open by themselves (Evoni,
 * 2026-10-26: "How do we auto create threads that make sense with the
 * story" … "Let's let them open themselves on new threads and build the
 * threads list. I think that will help things move along").
 *
 * Four places suggest threads: a finished script's "What changed" card
 * (services/episodeStoryRecord), an event's seeds (episode_briefs.
 * narrative_chain.seeds_future_events, services/storyThreadService
 * seedDrafts), a short story's canon review (services/storyCanon) and the
 * season proposals from the feed (services/seasonArcProposals). They meet
 * here.
 *
 *   Which open by themselves. A finished script's new threads and an
 *   event's seeds open once they pass the check, each with Undo until
 *   Evoni has looked at it. A short story's threads and the feed's wait in
 *   the list for Keep, Merge into… or Drop: a short story is not canon
 *   until she accepts it, and the feed proposal has its own accept. Closing
 *   a thread stays hers alone (storyThreadService closeThread).
 *
 *   The check, before a thread opens or reaches the list: one small AI
 *   read per batch (askModel; budget-gated and logged by aiCostTracker).
 *     same storyline as an open thread  -> a note on that thread (a
 *                                          script's note also advances it)
 *     against the story so far, or a kept secret's episode permission
 *                                       -> left out, with the reason
 *     otherwise                          -> new, with a one-line "why it
 *                                          matters", its part of the
 *                                          season, and the slots to carry
 *                                          it on and pay it off
 *   When the budget refuses or the AI fails, the plain check: a title that
 *   is the same, or nearly (most words shared), is the same thread;
 *   anything else opens, with the slots from plain logic (the next open
 *   slot carries it on; the last open slot of that part pays it off).
 *
 *   hasMeta(sequelize)                         the story_meta column is there (migration 20261026120000)
 *   listInbox(sequelize, showId, { arcId })    the list: threads, waiting, left out, the season
 *   openFromRecord(sequelize, episode, record) a script's threads, at "Read the finished script"
 *   openSeeds / openSeedsLater(sequelize, showId)   the event seeds not read yet
 *   checkWaitingLater(sequelize, showId)       checks short-story and feed suggestions, never awaited
 *   decideSuggestion(sequelize, showId, body, { by })   Keep / Merge into… / Drop
 *   undoThread / restoreThread / undoNote / markSeen / setPlan
 *   recordThreadStates(sequelize, applied)     the card's view of what opened by itself
 *
 * Raw SQL (show_story_threads.story_meta, story_canon_proposals,
 * season_arc_proposals); no model.
 */

const crypto = require('crypto');
const { askModel, isBudgetRefusal, phaseLine } = require('./seasonAiContext');
const { loadSeason } = require('./seasonLoader');
const { episodeLabel } = require('./seasonSlotService');
const { splitScriptBeats } = require('../utils/scriptBeatLocks');

const MODELS = ['claude-sonnet-4-6'];
const MAX_TOKENS = 1200;
const MAX = { batch: 12, notes: 30, title: 200, note: 600, line: 240, threads: 30, past: 20, slots: 24 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['keep', 'merge', 'drop'];

class ThreadInboxError extends Error {
  constructor(message, status = 409, code = 'THREAD_INBOX_CONFLICT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const text = (v, max) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[threadInbox] unreadable JSON:', err.message);
    return fallback;
  }
};
const flat = (v) => String(v || '').toLowerCase().replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const wordSet = (v) => new Set(flat(v).split(' ').filter((w) => w.length >= 3));
/** The plain check: the same title, or nearly (most of their words shared). */
function sameTitle(x, y) {
  if (!flat(x) || !flat(y)) return false;
  if (flat(x) === flat(y)) return true;
  const a = wordSet(x);
  const b = wordSet(y);
  if (a.size < 2 || b.size < 2) return false;
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / (a.size + b.size - shared) >= 0.6;
}
const newKey = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const metaOf = (row) => parse(row?.story_meta, null) || {};

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
/** For the tests: the client the check asks. */
function setClient(c) { client = c; }

let metaReady = false;
/** Whether show_story_threads.story_meta exists (20261026120000); until it does nothing opens by itself. */
async function hasMeta(sequelize) {
  if (metaReady) return true;
  try {
    const [rows] = await sequelize.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'show_story_threads' AND column_name = 'story_meta'");
    metaReady = rows.length > 0;
  } catch (err) {
    console.error('[threadInbox] could not tell whether the story_meta column is there:', err.message);
    metaReady = false;
  }
  return metaReady;
}

// ── The season: its parts and slots ───────────────────────────────────────

/** The season's parts and slots, or null. arcId: that season (of this show), else the active one, else the latest. */
async function seasonFor(sequelize, showId, { arcId = null } = {}) {
  let season = null;
  try {
    season = await loadSeason(sequelize, showId, arcId ? { arcId } : { anyStatus: true });
  } catch (err) {
    console.error('[threadInbox] the season could not be read:', err.message);
    return null;
  }
  if (!season || (arcId && season.arc.show_id !== showId)) return null;
  const { arc, slots } = season;
  return {
    arc_id: arc.id, title: arc.title, season_number: arc.season_number || 1,
    phases: (arc.phases || []).map((p) => ({
      phase: Number(p.phase), title: p.title || `Part ${p.phase}`, tagline: p.tagline || null,
      episode_start: p.episode_start ?? null, episode_end: p.episode_end ?? null, status: p.status || null, emotional_arc: p.emotional_arc || null,
    })),
    slots: slots.map((s) => ({
      id: s.id, slot_number: Number(s.slot_number), phase: s.phase != null ? Number(s.phase) : null,
      label: episodeLabel(arc.season_number, s.slot_number), story_purpose: s.story_purpose || null,
      done: Boolean(s.accepted_at), episode_id: s.live_episode_id || null,
    })),
  };
}

/** Where the season is: the origin episode's slot, else the latest slot done. */
function fromSlot(season, episodeId) {
  if (!season) return 0;
  const own = episodeId && season.slots.find((s) => s.episode_id === episodeId);
  if (own) return own.slot_number;
  const done = season.slots.filter((s) => s.done).map((s) => s.slot_number);
  return done.length ? Math.max(...done) : 0;
}

/** The slots still to come after `from`. */
const openAfter = (season, from) => (season ? season.slots.filter((s) => !s.done && s.slot_number > from) : []);

/**
 * The plan from plain logic: the next open slot carries it on; the last
 * open slot of that part pays it off (else the next open one after it).
 */
function plainPlan(season, from) {
  const open = openAfter(season, from);
  const carry = open[0];
  if (!carry) return null;
  const later = open.filter((s) => s.slot_number > carry.slot_number);
  const samePart = later.filter((s) => s.phase === carry.phase);
  const payoff = samePart.length ? samePart[samePart.length - 1] : later[0] || null;
  return { carry_slot_id: carry.id, payoff_slot_id: payoff ? payoff.id : null, part: carry.phase, by: 'plain' };
}

/** The AI's slots, kept only when they are open, after `from`, and in order; else the plain plan. */
function planOf(season, from, item) {
  const plain = plainPlan(season, from);
  const open = openAfter(season, from);
  const at = (n) => open.find((s) => s.slot_number === Number(n)) || null;
  const carry = at(item?.carry_slot);
  if (!carry) return plain;
  const payoff = at(item?.payoff_slot);
  return {
    carry_slot_id: carry.id,
    payoff_slot_id: payoff && payoff.slot_number > carry.slot_number ? payoff.id : null,
    part: carry.phase, by: 'ai',
  };
}

// ── The check ─────────────────────────────────────────────────────────────

/** The show's open threads and the ones left out or undone before (titles only). */
async function threadsForCheck(sequelize, showId, transaction) {
  const [open] = await sequelize.query(
    `SELECT id, title, description FROM show_story_threads
      WHERE show_id = :showId AND deleted_at IS NULL AND status <> 'closed' ORDER BY created_at LIMIT ${MAX.threads}`,
    { replacements: { showId }, transaction });
  let past = [];
  if (await hasMeta(sequelize)) {
    [past] = await sequelize.query(
      `SELECT id, title, story_meta FROM show_story_threads
        WHERE show_id = :showId AND deleted_at IS NOT NULL AND (story_meta ? 'left_out' OR story_meta ? 'undone_at')
        ORDER BY deleted_at DESC LIMIT ${MAX.past}`,
      { replacements: { showId }, transaction });
  }
  return { open, past: past.map((p) => ({ id: p.id, title: p.title, undone: !!metaOf(p).undone_at, reason: metaOf(p).left_out?.reason || null })) };
}

/** The story so far and the kept secrets, for an episode (else the show's latest approved record). Each part logged and left out when it cannot be read. */
async function storyForCheck(sequelize, showId, episodeId) {
  let story = '';
  let secrets = [];
  if (episodeId) {
    try {
      story = await require('./episodeStoryRecord').recordBlock(sequelize, episodeId);
    } catch (err) {
      console.error('[threadInbox] the episode\'s record could not be read (the check goes without it):', err.message);
    }
    try {
      const { cast } = await require('./episodeStoryRecord').castOf(sequelize, episodeId);
      const linked = cast.filter((c) => c.linked && UUID_RE.test(c.id));
      const byPerson = await require('./characterSecrets').secretsFor(sequelize, linked.map((c) => c.id));
      secrets = linked.flatMap((c) => (byPerson.get(c.id) || []).map((s) => ({ name: c.name, text: s.text, state: s.state, may: s.permissions?.episode || 'hint' })));
    } catch (err) {
      console.error('[threadInbox] the kept secrets could not be read (the check goes without them):', err.message);
    }
  }
  if (!story) {
    try {
      story = await require('./storyCarryForward').carryForShow(sequelize, showId);
    } catch (err) {
      console.error('[threadInbox] the story so far could not be read (the check goes without it):', err.message);
    }
  }
  return { story: story || '', secrets };
}

function checkPrompt({ where, candidates, open, past, story, secrets, season, from }) {
  const lines = (list, fn, empty = '(none)') => (list.length ? list.map(fn).join('\n') : empty);
  const slots = openAfter(season, from).slice(0, MAX.slots);
  return `You keep the story threads for "Styling Adventures with Lala". A thread is a question the story leaves open across episodes. These new threads came ${where}. Before any of them opens, check each one against the show.

THE SHOW'S OPEN THREADS ([id] title: description):
${lines(open, (t) => `- [${t.id}] ${t.title}${t.description ? `: ${String(t.description).slice(0, 160)}` : ''}`)}

LEFT OUT OR UNDONE BEFORE (never open these again):
${lines(past, (t) => `- ${t.title}${t.reason ? ` (${t.reason})` : t.undone ? ' (the author undid it)' : ''}`)}

THE STORY SO FAR (approved; a thread must not go against it):
${story || '(nothing approved yet)'}

KEPT SECRETS, AND HOW FAR AN EPISODE MAY GO WITH EACH:
${lines(secrets, (s) => `- ${s.name}: ${s.text} (the audience: ${s.state}; an episode may: ${s.may})`)}

THE SEASON'S PARTS:
${lines(season?.phases || [], (p) => `- ${phaseLine(p, { word: 'Part', range: true })}`)}

THE EPISODES STILL TO COME (episode: part, purpose):
${lines(slots, (s) => `- E${s.slot_number}: part ${s.phase ?? '?'}${s.story_purpose ? `, ${String(s.story_purpose).slice(0, 120)}` : ''}`)}

THE NEW THREADS:
${candidates.map((c, i) => `${i + 1}. ${c.title}${c.note ? ` (${String(c.note).slice(0, 300)})` : ''}`).join('\n')}

Answer with JSON only:
{"items": [{"n": 1, "verdict": "same | contradicts | new", "thread_id": "for same: the open thread's id above", "reason": "for contradicts: what it goes against, in one sentence", "title": "for new: the thread as a short question", "why": "for new: one line on why it matters to the season", "part": 2, "carry_slot": 5, "payoff_slot": 9}]}
One item for each new thread. "same" when it is the storyline of an open thread, even in other words. "contradicts" only when it goes against the story so far, or needs a secret hinted or revealed further than its episode permission allows ("hidden": not even hinted; "hint": never revealed), or it is one left out or undone before. Otherwise "new". carry_slot is the episode still to come that carries it on, payoff_slot a later one that pays it off; both from the list above, or null.`;
}

/** The AI's items, kept to what the show has; null when unreadable. */
function readCheck(raw, { candidates, open, season }) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  const json = match ? parse(match[0], null) : null;
  if (!json || !Array.isArray(json.items)) return null;
  const openIds = new Set(open.map((t) => String(t.id)));
  const parts = new Set((season?.phases || []).map((p) => p.phase));
  const out = new Array(candidates.length).fill(null);
  for (const item of json.items) {
    const i = Number(item?.n) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= candidates.length || out[i]) continue;
    const verdict = ['same', 'contradicts', 'new'].includes(item.verdict) ? item.verdict : 'new';
    if (verdict === 'same' && openIds.has(String(item.thread_id))) {
      out[i] = { verdict: 'same', thread_id: String(item.thread_id) };
    } else if (verdict === 'contradicts' && text(item.reason, MAX.line)) {
      out[i] = { verdict: 'left_out', reason: text(item.reason, MAX.line) };
    } else {
      out[i] = {
        verdict: 'new', title: text(item.title, MAX.title), why: text(item.why, MAX.line),
        part: parts.has(Number(item.part)) ? Number(item.part) : null, carry_slot: item.carry_slot, payoff_slot: item.payoff_slot,
      };
    }
  }
  return out;
}

/**
 * The check for a batch: [{ verdict: new | same | left_out, thread_id,
 * reason, title, why, part, plan, by }], one per candidate. An exact title
 * needs no AI; the rest are one call. The plain check when the budget
 * refuses, the AI fails or there is nothing to ask about.
 */
async function checkCandidates(sequelize, showId, candidates, { episodeId = null, season = null, where = 'from the show', api = null } = {}) {
  const from = fromSlot(season, episodeId);
  const { open, past } = await threadsForCheck(sequelize, showId);
  const plain = (c) => {
    const same = open.find((t) => sameTitle(t.title, c.title));
    if (same) return { verdict: 'same', thread_id: same.id, by: 'plain' };
    const before = past.find((t) => sameTitle(t.title, c.title));
    if (before) return { verdict: 'left_out', reason: before.undone ? 'You undid this thread before.' : (before.reason || 'Left out before.'), by: 'plain' };
    const plan = plainPlan(season, from);
    return { verdict: 'new', why: null, part: plan?.part ?? null, plan, by: 'plain' };
  };
  // An exact title is decided without asking.
  const exact = candidates.map((c) => {
    const same = open.find((t) => flat(t.title) === flat(c.title));
    if (same) return { verdict: 'same', thread_id: same.id, by: 'plain' };
    const before = past.find((t) => flat(t.title) === flat(c.title));
    return before ? plain(c) : null;
  });
  const ask = candidates.map((c, i) => ({ c, i })).filter(({ i }) => !exact[i]);
  if (!ask.length) return exact;
  let read = null;
  try {
    const { story, secrets } = await storyForCheck(sequelize, showId, episodeId);
    const prompt = checkPrompt({ where, candidates: ask.map((a) => a.c), open, past, story, secrets, season, from });
    read = await askModel({
      api: api || getClient(), models: MODELS, maxTokens: MAX_TOKENS, prompt, label: 'threadInbox check',
      read: (response) => {
        const items = readCheck(response?.content?.[0]?.text, { candidates: ask.map((a) => a.c), open, season });
        if (!items) throw new Error('The check came back unreadable');
        return items;
      },
    });
  } catch (err) {
    console.error(`[threadInbox] the check ${isBudgetRefusal(err) ? 'was refused by the budget' : 'failed'}; the plain check is used:`, err.message);
    read = null;
  }
  const out = [...exact];
  ask.forEach(({ c, i }, j) => {
    const item = read?.[j];
    if (!item) { out[i] = plain(c); return; }
    if (item.verdict !== 'new') { out[i] = { ...item, by: 'ai' }; return; }
    const plan = planOf(season, from, item);
    out[i] = { verdict: 'new', title: item.title, why: item.why, part: item.part ?? plan?.part ?? null, plan, by: 'ai' };
  });
  return out;
}

// ── Writing: open, note, leave out ────────────────────────────────────────

async function lockShow(sequelize, showId, transaction) {
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('show_story_threads:' || :showId))", { replacements: { showId }, transaction });
}

async function insertThread(sequelize, { showId, title, description, source, seedText, episodeId, meta, deleted = false }, transaction) {
  const [[row]] = await sequelize.query(
    `INSERT INTO show_story_threads (id, show_id, title, description, status, source, seed_text, opened_episode_id, story_meta, created_at, updated_at, deleted_at)
     VALUES (gen_random_uuid(), :showId, :title, :description, 'open', :source, :seed, :episodeId, CAST(:meta AS jsonb), NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})
     RETURNING id`,
    { replacements: {
      showId, title: text(title, MAX.title), description: text(description, 2000), source, seed: seedText || null,
      episodeId: episodeId || null, meta: JSON.stringify(meta),
    }, transaction });
  return row.id;
}

/**
 * A note on a thread. advance: the note moves it on in that episode (a
 * closed thread is left closed); what it was is kept for Undo.
 */
async function appendNote(sequelize, threadId, note, { advance = false, episodeId = null, transaction }) {
  const [[row]] = await sequelize.query(
    `SELECT id, status, last_advanced_episode_id, last_advanced_at, story_meta FROM show_story_threads
      WHERE id = :threadId AND deleted_at IS NULL FOR UPDATE`, { replacements: { threadId }, transaction });
  if (!row) return null;
  const meta = metaOf(row);
  const moves = advance && episodeId && row.status !== 'closed';
  const entry = {
    key: newKey(), text: text(note.text, MAX.note) || '', at: new Date().toISOString(), episode_id: episodeId || null,
    label: note.label || null, auto: note.auto !== false, ...(note.seed_text ? { seed_text: note.seed_text } : {}),
    ...(moves ? { prev: { status: row.status, last_advanced_episode_id: row.last_advanced_episode_id, last_advanced_at: row.last_advanced_at } } : {}),
  };
  meta.notes = [...(Array.isArray(meta.notes) ? meta.notes : []), entry].slice(-MAX.notes);
  await sequelize.query(
    `UPDATE show_story_threads SET story_meta = CAST(:meta AS jsonb),
            ${moves ? "status = 'advanced', last_advanced_episode_id = :episodeId, last_advanced_at = NOW()," : ''} updated_at = NOW()
      WHERE id = :threadId`, { replacements: { threadId, meta: JSON.stringify(meta), episodeId }, transaction });
  return entry.key;
}

/**
 * Opens what passed the check, notes what is the same storyline, and keeps
 * what was left out (a soft-deleted row, so it is not offered again).
 * candidates [{ key, title, note, origin, seed_text, episode_id, thread_id
 * (an advance: no check), source }]; returns { [key]: outcome }.
 */
async function openCandidates(sequelize, showId, candidates, { season = null, episodeId = null, where, api = null } = {}) {
  const toCheck = candidates.filter((c) => !c.thread_id);
  const checked = toCheck.length ? await checkCandidates(sequelize, showId, toCheck, { episodeId, season, where, api }) : [];
  const verdicts = new Map(toCheck.map((c, i) => [c.key, checked[i]]));
  const outcomes = {};
  await sequelize.transaction(async (transaction) => {
    await lockShow(sequelize, showId, transaction);
    for (const c of candidates) {
      const ep = c.episode_id || episodeId || null;
      const label = c.origin?.label || null;
      // A seed read by another run in the meantime.
      if (c.seed_text) {
        const [[taken]] = await sequelize.query(
          `SELECT 1 FROM show_story_threads WHERE show_id = :showId AND (LOWER(seed_text) = LOWER(:seed)
              OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(story_meta->'notes', '[]'::jsonb)) n WHERE LOWER(n->>'seed_text') = LOWER(:seed))) LIMIT 1`,
          { replacements: { showId, seed: c.seed_text }, transaction });
        if (taken) { outcomes[c.key] = { state: 'exists' }; continue; }
      }
      const v = c.thread_id ? { verdict: 'same', thread_id: c.thread_id, by: 'record' } : verdicts.get(c.key);
      if (v.verdict === 'same') {
        const noteKey = await appendNote(sequelize, v.thread_id,
          { text: c.note || c.title, label, auto: true, seed_text: c.seed_text },
          { advance: c.advance === true, episodeId: ep, transaction });
        if (noteKey) { outcomes[c.key] = { state: 'noted', thread_id: v.thread_id, note_key: noteKey, by: v.by }; continue; }
      }
      const meta = { origin: c.origin || null, opened_by: 'itself', check: { by: v.by || 'plain' } };
      if (v.verdict === 'left_out') {
        const id = await insertThread(sequelize, {
          showId, title: c.title, description: c.note, source: c.source, seedText: c.seed_text, episodeId: ep,
          meta: { ...meta, left_out: { reason: v.reason, at: new Date().toISOString() } }, deleted: true,
        }, transaction);
        outcomes[c.key] = { state: 'left_out', thread_id: id, reason: v.reason, by: v.by };
        continue;
      }
      const title = (v.title && c.source === 'seed' ? v.title : null) || c.title;
      // The same title opened in the meantime: a note on it.
      const [[same]] = await sequelize.query(
        'SELECT id FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND LOWER(title) = LOWER(:title) LIMIT 1',
        { replacements: { showId, title }, transaction });
      if (same) {
        const noteKey = await appendNote(sequelize, same.id, { text: c.note || c.title, label, auto: true, seed_text: c.seed_text },
          { advance: c.advance === true, episodeId: ep, transaction });
        outcomes[c.key] = { state: 'noted', thread_id: same.id, note_key: noteKey, by: 'plain' };
        continue;
      }
      const id = await insertThread(sequelize, {
        showId, title, description: c.note, source: c.source, seedText: c.seed_text, episodeId: ep,
        meta: { ...meta, why: v.why || null, part: v.part ?? null, plan: v.plan || null, notes: [] },
      }, transaction);
      outcomes[c.key] = { state: 'opened', thread_id: id, why: v.why || null, by: v.by };
    }
  });
  return outcomes;
}

// ── Source 2: a finished script (episodeStoryRecord.draftRecord) ──────────

/** The beat a quote is in, or null. */
function beatOf(script, quote) {
  const q = flat(quote);
  if (!q || q.length < 8) return null;
  const hit = splitScriptBeats(String(script || '')).beats.find((b) => flat(b.text).includes(q));
  return hit ? hit.number : null;
}

/**
 * The script's new threads open by themselves once they pass the check,
 * and its advances become notes that move the thread on, each with Undo;
 * closes stay suggestions on the card. Re-reading never duplicates: what
 * was done is in the record's applied.threads (auto: true), which Save
 * then skips. Returns the record's applied, or null when nothing ran.
 */
async function openFromRecord(sequelize, episode, record, { api = null } = {}) {
  if (!episode?.show_id || !record || !(await hasMeta(sequelize))) return null;
  const done = record.applied?.threads || {};
  const pending = (record.threads || []).filter((t) => t && t.key && t.keep !== false && !done[t.key] && t.title && ['new', 'advance'].includes(t.action));
  if (!pending.length) return null;
  const season = await seasonFor(sequelize, episode.show_id);
  const ep = episode.episode_number != null ? `E${episode.episode_number}` : 'This episode';
  const candidates = pending.map((t) => {
    const beat = beatOf(episode.script_content, t.quote);
    const label = `From ${ep}'s script${beat ? `, beat ${beat}` : ''}`;
    return {
      key: t.key, title: t.title, note: t.note || null, source: 'record', episode_id: episode.id,
      thread_id: t.action === 'advance' ? t.thread_id : null, advance: true,
      origin: { kind: 'script', episode_id: episode.id, episode_number: episode.episode_number ?? null, beat, label },
    };
  });
  const outcomes = await openCandidates(sequelize, episode.show_id, candidates, { season, episodeId: episode.id, where: `from the finished script of ${ep}`, api });
  let applied = null;
  await sequelize.transaction(async (transaction) => {
    const [[row]] = await sequelize.query(
      'SELECT id, applied FROM episode_story_records WHERE episode_id = :episodeId AND deleted_at IS NULL FOR UPDATE',
      { replacements: { episodeId: episode.id }, transaction });
    if (!row) return;
    applied = { ...parse(row.applied, {}) };
    applied.threads = { ...(applied.threads || {}) };
    for (const [key, o] of Object.entries(outcomes)) {
      if (applied.threads[key]) continue;
      const action = { opened: 'new', noted: 'advance', left_out: 'left_out', exists: 'exists' }[o.state];
      applied.threads[key] = { thread_id: o.thread_id || null, action, auto: true, ...(o.note_key ? { note_key: o.note_key } : {}), ...(o.reason ? { reason: o.reason } : {}), ...(o.why ? { why: o.why } : {}) };
    }
    await sequelize.query('UPDATE episode_story_records SET applied = CAST(:applied AS jsonb), updated_at = NOW() WHERE id = :id',
      { replacements: { id: row.id, applied: JSON.stringify(applied) }, transaction });
  });
  return applied;
}

/**
 * The card's view of what opened by itself: { [item key]: { state:
 * opened | noted | left_out | undone, thread_id, thread_title, reason,
 * why, can_undo } } for the record's auto entries.
 */
async function recordThreadStates(sequelize, applied) {
  const entries = Object.entries(applied?.threads || {}).filter(([, a]) => a && a.auto && a.thread_id);
  if (!entries.length || !(await hasMeta(sequelize))) return {};
  try {
    const [rows] = await sequelize.query(
      'SELECT id, title, status, deleted_at, story_meta FROM show_story_threads WHERE id IN (:ids)',
      { replacements: { ids: [...new Set(entries.map(([, a]) => a.thread_id))] } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const out = {};
    for (const [key, a] of entries) {
      const r = byId.get(a.thread_id);
      if (!r) continue;
      const meta = metaOf(r);
      const base = { thread_id: r.id, thread_title: r.title, why: a.why || meta.why || null };
      if (a.action === 'advance') {
        const note = (meta.notes || []).find((n) => n.key === a.note_key);
        out[key] = { ...base, state: note?.undone_at ? 'undone' : 'noted', note_key: a.note_key || null, can_undo: !!note && !note.undone_at && !note.seen_at && !r.deleted_at };
      } else if (a.action === 'left_out') {
        out[key] = { ...base, state: r.deleted_at ? 'left_out' : 'opened', reason: a.reason || meta.left_out?.reason || null, can_undo: false };
      } else if (a.action === 'new') {
        out[key] = { ...base, state: meta.undone_at ? 'undone' : 'opened', can_undo: !r.deleted_at && meta.opened_by === 'itself' && !meta.seen_at };
      }
    }
    return out;
  } catch (err) {
    console.error('[threadInbox] the card\'s thread states could not be read:', err.message);
    return {};
  }
}

// ── Source 1: an event's seeds ────────────────────────────────────────────

/** The seeds of the show's live episodes' briefs that no thread, left-out row or note was made from. */
async function uncheckedSeeds(sequelize, showId) {
  const [briefs] = await sequelize.query(
    `SELECT b.episode_id, b.narrative_chain, ep.episode_number, ep.title AS episode_title, ev.name AS event_name
       FROM episode_briefs b
       JOIN episodes ep ON ep.id = b.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = b.event_id
      WHERE ep.show_id = :showId AND b.deleted_at IS NULL
      ORDER BY ep.created_at ASC`, { replacements: { showId } });
  const [taken] = await sequelize.query(
    `SELECT LOWER(seed_text) AS seed FROM show_story_threads WHERE show_id = :showId AND seed_text IS NOT NULL
     UNION
     SELECT LOWER(n->>'seed_text') FROM show_story_threads t, jsonb_array_elements(COALESCE(t.story_meta->'notes', '[]'::jsonb)) n
      WHERE t.show_id = :showId AND n ? 'seed_text'`, { replacements: { showId } });
  const used = new Set(taken.map((t) => t.seed));
  const { seedText } = require('./storyThreadService');
  const out = [];
  for (const b of briefs) {
    const chain = parse(b.narrative_chain, {}) || {};
    for (const seed of Array.isArray(chain.seeds_future_events) ? chain.seeds_future_events : []) {
      const t = seedText(seed);
      if (!t || used.has(t.toLowerCase())) continue;
      used.add(t.toLowerCase());
      out.push({ seed_text: t, episode_id: b.episode_id, episode_number: b.episode_number, event_name: b.event_name || null, episode_title: b.episode_title });
    }
  }
  return out;
}

/** Reads the event seeds not read yet, one check per episode's batch; { opened, noted, left_out }. */
async function openSeeds(sequelize, showId, { api = null } = {}) {
  if (!(await hasMeta(sequelize))) return { skipped: 'needs_migration' };
  const seeds = await uncheckedSeeds(sequelize, showId);
  const counts = { opened: 0, noted: 0, left_out: 0 };
  if (!seeds.length) return counts;
  const season = await seasonFor(sequelize, showId);
  const byEpisode = new Map();
  for (const s of seeds) byEpisode.set(s.episode_id, [...(byEpisode.get(s.episode_id) || []), s]);
  for (const [episodeId, list] of byEpisode) {
    const first = list[0];
    const where = first.event_name ? `the ${first.event_name}'s seeds` : `E${first.episode_number ?? '?'}'s event seeds`;
    const candidates = list.slice(0, MAX.batch).map((s) => ({
      key: newKey(), title: s.seed_text, note: null, source: 'seed', seed_text: s.seed_text, episode_id: episodeId,
      origin: { kind: 'seed', episode_id: episodeId, episode_number: s.episode_number ?? null, event_name: s.event_name, label: `From ${where}` },
    }));
    const outcomes = await openCandidates(sequelize, showId, candidates, { season, episodeId, where: `from ${where}`, api });
    for (const o of Object.values(outcomes)) {
      if (o.state === 'opened') counts.opened += 1;
      else if (o.state === 'noted') counts.noted += 1;
      else if (o.state === 'left_out') counts.left_out += 1;
    }
  }
  return counts;
}

/** openSeeds, never awaited: Start Episode and completion must not wait on, or fail for, an AI call. */
function openSeedsLater(sequelize, showId) {
  if (!showId) return;
  Promise.resolve()
    .then(() => openSeeds(sequelize, showId))
    .catch((err) => console.error('[threadInbox] reading the event seeds failed (non-blocking):', err.message));
}

// ── Sources 3 and 4: waiting in the list ──────────────────────────────────

/** The short story's thread proposals still pending, and the open feed proposal's new threads not yet decided. */
async function waitingRows(sequelize, showId) {
  let canon = [];
  let feed = null;
  try {
    [canon] = await sequelize.query(
      `SELECT p.id, p.story_id, p.episode_id, p.payload, p.created_at, s.title AS story_title, e.episode_number
         FROM story_canon_proposals p
         LEFT JOIN stories s ON s.id = p.story_id
         LEFT JOIN episodes e ON e.id = p.episode_id
        WHERE p.show_id = :showId AND p.kind = 'thread' AND p.status = 'pending' AND p.deleted_at IS NULL
        ORDER BY p.created_at`, { replacements: { showId } });
  } catch (err) {
    console.error('[threadInbox] the short stories\' thread proposals could not be read:', err.message);
  }
  try {
    const [[row]] = await sequelize.query(
      `SELECT id, changes, created_at FROM season_arc_proposals
        WHERE show_id = :showId AND status = 'proposed' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, { replacements: { showId } });
    feed = row || null;
  } catch (err) {
    console.error('[threadInbox] the feed proposal could not be read:', err.message);
  }
  const items = [];
  for (const p of canon) {
    const payload = parse(p.payload, {}) || {};
    items.push({
      source: 'short_story', id: p.id, index: null, title: payload.title, note: payload.note || null, thread_id: payload.thread_id || null,
      label: `From a short story${p.story_title ? `: ${p.story_title}` : ''}${p.episode_number != null ? ` (E${p.episode_number})` : ''}`,
      episode_id: p.episode_id, created_at: p.created_at, check: payload.check || null,
    });
  }
  if (feed) {
    parse(feed.changes, []).forEach((c, index) => {
      if (!c || c.kind !== 'thread_open' || c.taken) return;
      items.push({
        source: 'feed', id: feed.id, index, title: c.title, note: c.description || null, why_feed: c.why || null, thread_id: null,
        label: 'From the feed', episode_id: null, created_at: feed.created_at, check: c.check || null,
      });
    });
  }
  return items;
}

/** Checks the waiting suggestions not checked yet (one call) and keeps the verdict with each; never throws. */
async function checkWaiting(sequelize, showId, { api = null } = {}) {
  const items = (await waitingRows(sequelize, showId)).filter((w) => !w.check && !w.thread_id);
  if (!items.length) return 0;
  const season = await seasonFor(sequelize, showId);
  const verdicts = await checkCandidates(sequelize, showId, items.map((w) => ({ title: w.title, note: w.note })),
    { season, episodeId: items.find((w) => w.episode_id)?.episode_id || null, where: 'from a short story and the feed (waiting for the author)', api });
  const checkOf = (v) => ({ verdict: v.verdict, thread_id: v.thread_id || null, reason: v.reason || null, why: v.why || null, part: v.part ?? null, plan: v.plan || null, by: v.by });
  for (let i = 0; i < items.length; i += 1) {
    const w = items[i];
    const check = JSON.stringify(checkOf(verdicts[i]));
    if (w.source === 'short_story') {
      await sequelize.query(
        `UPDATE story_canon_proposals SET payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{check}', CAST(:check AS jsonb)), updated_at = NOW()
          WHERE id = :id AND status = 'pending'`, { replacements: { id: w.id, check } });
    } else {
      await sequelize.query(
        `UPDATE season_arc_proposals SET changes = jsonb_set(changes, ARRAY[CAST(:index AS text), 'check'], CAST(:check AS jsonb)), updated_at = NOW()
          WHERE id = :id AND status = 'proposed'`, { replacements: { id: w.id, index: String(w.index), check } });
    }
  }
  return items.length;
}

/** checkWaiting, never awaited (after a short story's review and a feed proposal). */
function checkWaitingLater(sequelize, showId) {
  if (!showId) return;
  Promise.resolve()
    .then(() => checkWaiting(sequelize, showId))
    .catch((err) => console.error('[threadInbox] checking the waiting suggestions failed (non-blocking):', err.message));
}

// ── The list ──────────────────────────────────────────────────────────────

function originOf(row, meta) {
  if (meta.origin?.label) return { kind: meta.origin.kind || row.source, label: meta.origin.label };
  const ep = row.opened_episode_number != null ? `E${row.opened_episode_number}` : null;
  if (row.source === 'record') return { kind: 'script', label: ep ? `From ${ep}'s script` : 'From a finished script' };
  if (row.source === 'seed') return { kind: 'seed', label: ep ? `From ${ep}'s event seeds` : 'From an event\'s seeds' };
  return { kind: 'evoni', label: 'Added by you' };
}

/**
 * The show's threads list: { needs_migration, season, threads, waiting,
 * left_out, unchecked_seeds }. Threads are open and advanced first, newest
 * first, then closed. Each says where it came from, when it opened, its
 * latest notes, the slots that continue it, its plan and its twists.
 */
async function listInbox(sequelize, showId, { arcId = null } = {}) {
  const meta = await hasMeta(sequelize);
  const season = await seasonFor(sequelize, showId, { arcId });
  // A season picked (?season=N): the threads it touched, as storyThreadService listThreads reads them
  // (a slot of it continues the thread, or one of its episodes opened or moved it on), and the
  // threads no season has touched yet (one that just opened by itself); its slot numbers alone.
  const inArc = arcId ? 'AND s.arc_id = :arcId' : '';
  const touched = arcId ? `AND (
            EXISTS (SELECT 1 FROM season_slots s WHERE s.deleted_at IS NULL AND s.arc_id = :arcId AND (s.story_thread_id = t.id OR t.id::text IN (
                      SELECT p->>'story_thread_id' FROM jsonb_array_elements(COALESCE(s.story_purposes, '[]'::jsonb)) p)))
         OR EXISTS (SELECT 1 FROM season_slots s WHERE s.deleted_at IS NULL AND s.arc_id = :arcId AND s.episode_id IS NOT NULL
                      AND s.episode_id IN (t.opened_episode_id, t.last_advanced_episode_id))
         OR NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.deleted_at IS NULL AND (s.story_thread_id = t.id
                      OR (s.episode_id IS NOT NULL AND s.episode_id IN (t.opened_episode_id, t.last_advanced_episode_id)))))` : '';
  const [rows] = await sequelize.query(
    `SELECT t.id, t.title, t.description, t.status, t.source, t.seed_text, t.created_at, t.closed_at, t.reopened_at,
            t.last_advanced_at, oe.episode_number AS opened_episode_number, ae.episode_number AS advanced_episode_number,
            ${meta ? 't.story_meta,' : ''}
            COALESCE((SELECT array_agg(s.slot_number ORDER BY s.slot_number) FROM season_slots s
                       WHERE s.deleted_at IS NULL ${inArc} AND (s.story_thread_id = t.id OR t.id::text IN (
                         SELECT p->>'story_thread_id' FROM jsonb_array_elements(COALESCE(s.story_purposes, '[]'::jsonb)) p))
                     ), '{}') AS slot_numbers
       FROM show_story_threads t
       LEFT JOIN episodes oe ON oe.id = t.opened_episode_id
       LEFT JOIN episodes ae ON ae.id = t.last_advanced_episode_id
      WHERE t.show_id = :showId AND t.deleted_at IS NULL ${touched}
      ORDER BY (t.status = 'closed') ASC, t.created_at DESC`, { replacements: { showId, arcId } });
  let twists = [];
  try {
    [twists] = await sequelize.query(
      'SELECT id, title, status, thread_ids FROM season_twists WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at',
      { replacements: { showId } });
  } catch (err) {
    console.error('[threadInbox] the season twists could not be read:', err.message);
  }
  const slotById = new Map((season?.slots || []).map((s) => [s.id, s]));
  const slotView = (id) => {
    const s = id && slotById.get(id);
    return s ? { id: s.id, slot_number: s.slot_number, label: s.label, phase: s.phase, done: s.done } : null;
  };
  const partView = (n) => {
    const p = (season?.phases || []).find((x) => x.phase === Number(n));
    return p ? { phase: p.phase, title: p.title } : null;
  };
  const from = fromSlot(season, null);
  const threads = rows.map((r) => {
    const m = metaOf(r);
    const itself = m.opened_by === 'itself';
    const notes = (Array.isArray(m.notes) ? m.notes : []).filter((n) => !n.undone_at);
    const plan = r.status === 'closed' ? null : (m.plan || plainPlan(season, from));
    const continued = (r.slot_numbers || []).map(Number);
    return {
      id: r.id, title: r.title, description: r.description, status: r.status, source: r.source,
      origin: originOf(r, m), opened_at: r.created_at, closed_at: r.closed_at, reopened_at: r.reopened_at,
      last_advanced_at: r.last_advanced_at, advanced_episode_number: r.advanced_episode_number ?? null,
      opened_by_itself: itself, seen: !itself || !!m.seen_at,
      can_undo: itself && !m.seen_at && !continued.length,
      why: m.why || null, part: partView(m.part ?? plan?.part),
      notes: notes.slice(-3).reverse().map((n) => ({ key: n.key, text: n.text, at: n.at, label: n.label || null, can_undo: !!n.auto && !n.seen_at })),
      notes_count: notes.length,
      slots: continued.map((n) => {
        const s = season?.slots.find((x) => x.slot_number === n);
        return { slot_number: n, label: s ? s.label : `E${n}` };
      }),
      plan: plan ? { carry: slotView(plan.carry_slot_id), payoff: slotView(plan.payoff_slot_id), by: plan.by || 'plain' } : null,
      twists: twists.filter((t) => (parse(t.thread_ids, []) || []).map(String).includes(r.id)).map((t) => ({ id: t.id, title: t.title, status: t.status })),
    };
  });

  const leftOut = [];
  if (meta) {
    const [gone] = await sequelize.query(
      `SELECT id, title, description, story_meta, deleted_at FROM show_story_threads
        WHERE show_id = :showId AND deleted_at IS NOT NULL AND (story_meta ? 'left_out' OR story_meta ? 'undone_at')
        ORDER BY deleted_at DESC LIMIT ${MAX.past}`, { replacements: { showId } });
    for (const g of gone) {
      const m = metaOf(g);
      leftOut.push({
        kind: 'thread', id: g.id, title: g.title, note: g.description || null, label: originOf(g, m).label,
        reason: m.undone_at ? 'You undid it.' : (m.left_out?.reason || 'Left out by the check.'), undone: !!m.undone_at, at: m.undone_at || m.left_out?.at || g.deleted_at,
      });
    }
  }

  // Waiting: the check's verdict when it ran, else the plain check now.
  const open = threads.filter((t) => t.status !== 'closed');
  const waiting = [];
  for (const w of await waitingRows(sequelize, showId)) {
    let check = w.check;
    if (!check) {
      const same = w.thread_id ? open.find((t) => t.id === w.thread_id) : open.find((t) => sameTitle(t.title, w.title));
      check = same ? { verdict: 'same', thread_id: same.id, by: 'plain' } : { verdict: 'new', by: 'plain' };
    }
    const item = {
      source: w.source, id: w.id, index: w.index, title: w.title, note: w.note, label: w.label, created_at: w.created_at,
      why: check.why || w.why_feed || null, part: partView(check.part), reason: check.reason || null,
      suggest_into: check.verdict === 'same' && open.some((t) => t.id === check.thread_id) ? check.thread_id : null, by: check.by || 'plain',
    };
    if (check.verdict === 'left_out') leftOut.push({ ...item, kind: 'suggestion' });
    else waiting.push(item);
  }

  return {
    needs_migration: !meta,
    season: season ? { arc_id: season.arc_id, title: season.title, season_number: season.season_number, phases: season.phases.map((p) => ({ phase: p.phase, title: p.title })), slots: season.slots.map((s) => ({ id: s.id, slot_number: s.slot_number, label: s.label, phase: s.phase, done: s.done })) } : null,
    threads,
    waiting,
    left_out: leftOut,
    unchecked_seeds: meta ? (await uncheckedSeeds(sequelize, showId)).length : 0,
  };
}

// ── Evoni's actions ───────────────────────────────────────────────────────

const assertId = (v, what) => {
  if (!UUID_RE.test(String(v || ''))) throw new ThreadInboxError(`${what} must be a UUID`, 400, 'THREAD_INBOX_INVALID');
};
async function needMeta(sequelize) {
  if (!(await hasMeta(sequelize))) throw new ThreadInboxError('The threads list needs its migration (20261026120000) first.', 409, 'THREAD_INBOX_NEEDS_MIGRATION');
}

async function rowFor(sequelize, showId, threadId, { deleted = false, transaction } = {}) {
  const [[row]] = await sequelize.query(
    `SELECT id, title, status, last_advanced_episode_id, story_meta, deleted_at FROM show_story_threads
      WHERE id = :threadId AND show_id = :showId AND deleted_at IS ${deleted ? 'NOT NULL' : 'NULL'} FOR UPDATE`,
    { replacements: { threadId, showId }, transaction });
  if (!row) throw new ThreadInboxError('Story thread not found', 404, 'STORY_THREAD_NOT_FOUND');
  return row;
}
const writeMeta = (sequelize, id, meta, transaction, extra = '') => sequelize.query(
  `UPDATE show_story_threads SET story_meta = CAST(:meta AS jsonb), ${extra} updated_at = NOW() WHERE id = :id`,
  { replacements: { id, meta: JSON.stringify(meta) }, transaction });

/** Undo a thread that opened by itself, before Evoni has looked at it: a soft delete; nothing else changes. */
async function undoThread(sequelize, showId, threadId) {
  assertId(threadId, 'threadId');
  await needMeta(sequelize);
  await sequelize.transaction(async (transaction) => {
    const row = await rowFor(sequelize, showId, threadId, { transaction });
    const meta = metaOf(row);
    if (meta.opened_by !== 'itself') throw new ThreadInboxError('Only a thread that opened by itself can be undone. Close it instead.', 409, 'THREAD_NOT_SELF_OPENED');
    if (meta.seen_at) throw new ThreadInboxError('You have already kept this thread. Close it instead.', 409, 'THREAD_SEEN');
    const [[slot]] = await sequelize.query(
      `SELECT slot_number FROM season_slots WHERE deleted_at IS NULL AND (story_thread_id = :threadId OR :threadId IN (
          SELECT p->>'story_thread_id' FROM jsonb_array_elements(COALESCE(story_purposes, '[]'::jsonb)) p)) LIMIT 1`,
      { replacements: { threadId }, transaction });
    if (slot) throw new ThreadInboxError(`E${slot.slot_number} continues this thread. Take it off the slot first, or close it.`, 409, 'THREAD_IN_USE');
    await writeMeta(sequelize, threadId, { ...meta, undone_at: new Date().toISOString() }, transaction, 'deleted_at = NOW(),');
  });
}

/** Keep a left-out or undone thread after all: it opens, as Evoni's. */
async function restoreThread(sequelize, showId, threadId) {
  assertId(threadId, 'threadId');
  await needMeta(sequelize);
  await sequelize.transaction(async (transaction) => {
    const row = await rowFor(sequelize, showId, threadId, { deleted: true, transaction });
    const meta = metaOf(row);
    if (!meta.left_out && !meta.undone_at) throw new ThreadInboxError('Story thread not found', 404, 'STORY_THREAD_NOT_FOUND');
    const [[same]] = await sequelize.query(
      'SELECT id FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND LOWER(title) = LOWER(:title) LIMIT 1',
      { replacements: { showId, title: row.title }, transaction });
    if (same) throw new ThreadInboxError('A thread of that title is already open.', 409, 'THREAD_EXISTS');
    const { left_out: leftOut, undone_at: _undoneAt, ...rest } = meta;
    await writeMeta(sequelize, threadId, { ...rest, opened_by: 'evoni', seen_at: new Date().toISOString(), kept_after: leftOut ? 'left_out' : 'undone' },
      transaction, 'deleted_at = NULL,');
  });
}

/** Undo a note that was added by itself; a note that moved the thread on puts it back as it was (when no later episode moved it). */
async function undoNote(sequelize, showId, threadId, noteKey) {
  assertId(threadId, 'threadId');
  await needMeta(sequelize);
  await sequelize.transaction(async (transaction) => {
    const row = await rowFor(sequelize, showId, threadId, { transaction });
    const meta = metaOf(row);
    const notes = Array.isArray(meta.notes) ? meta.notes : [];
    const note = notes.find((n) => n.key === noteKey);
    if (!note || note.undone_at) throw new ThreadInboxError('Note not found', 404, 'THREAD_NOTE_NOT_FOUND');
    if (!note.auto || note.seen_at) throw new ThreadInboxError('Only a note added by itself, not yet looked at, can be undone.', 409, 'THREAD_NOTE_KEPT');
    note.undone_at = new Date().toISOString();
    const back = note.prev && row.last_advanced_episode_id === note.episode_id && row.status !== 'closed';
    await writeMeta(sequelize, threadId, meta, transaction);
    if (back) {
      await sequelize.query(
        'UPDATE show_story_threads SET status = :status, last_advanced_episode_id = :lastEp, last_advanced_at = :lastAt WHERE id = :id',
        { replacements: { id: threadId, status: note.prev.status || 'open', lastEp: note.prev.last_advanced_episode_id || null, lastAt: note.prev.last_advanced_at || null }, transaction });
    }
  });
}

/** Evoni has looked at these threads: "New · opened by itself" and its Undo end, for the thread and its notes. */
async function markSeen(sequelize, showId, threadIds) {
  await needMeta(sequelize);
  const list = [...new Set((Array.isArray(threadIds) ? threadIds : []).map(String))].filter((id) => UUID_RE.test(id)).slice(0, 100);
  if (!list.length) return 0;
  const at = new Date().toISOString();
  let n = 0;
  await sequelize.transaction(async (transaction) => {
    const [rows] = await sequelize.query(
      'SELECT id, story_meta FROM show_story_threads WHERE id IN (:ids) AND show_id = :showId AND deleted_at IS NULL FOR UPDATE',
      { replacements: { ids: list, showId }, transaction });
    for (const r of rows) {
      const meta = metaOf(r);
      meta.seen_at = meta.seen_at || at;
      meta.notes = (Array.isArray(meta.notes) ? meta.notes : []).map((x) => (x.seen_at ? x : { ...x, seen_at: at }));
      await writeMeta(sequelize, r.id, meta, transaction);
      n += 1;
    }
  });
  return n;
}

/** Evoni's plan for a thread: the slot that carries it on and the one that pays it off (either may be null). */
async function setPlan(sequelize, showId, threadId, body = {}) {
  assertId(threadId, 'threadId');
  await needMeta(sequelize);
  const ids = ['carry_slot_id', 'payoff_slot_id'].map((k) => (body[k] ? String(body[k]) : null));
  ids.forEach((id) => { if (id) assertId(id, 'slot id'); });
  const [slots] = ids.some(Boolean) ? await sequelize.query(
    'SELECT id, arc_id, slot_number FROM season_slots WHERE id IN (:ids) AND show_id = :showId AND deleted_at IS NULL',
    { replacements: { ids: ids.filter(Boolean), showId } }) : [[]];
  const [carry, payoff] = ids.map((id) => (id ? slots.find((s) => s.id === id) : null));
  if ((ids[0] && !carry) || (ids[1] && !payoff)) throw new ThreadInboxError('That slot is not in this show\'s season.', 404, 'SLOT_NOT_FOUND');
  if (carry && payoff && (carry.arc_id !== payoff.arc_id || Number(payoff.slot_number) <= Number(carry.slot_number))) {
    throw new ThreadInboxError('The payoff comes after the episode that carries it on.', 400, 'THREAD_PLAN_ORDER');
  }
  await sequelize.transaction(async (transaction) => {
    const row = await rowFor(sequelize, showId, threadId, { transaction });
    const meta = metaOf(row);
    await writeMeta(sequelize, threadId, { ...meta, plan: { carry_slot_id: ids[0], payoff_slot_id: ids[1], by: 'evoni' } }, transaction);
  });
}

/**
 * A waiting suggestion: keep (it opens), merge into an open thread (a note
 * on it; a short story's also advances it, as its accept does) or drop.
 * A short story's goes through its own accept and dismiss
 * (services/storyCanon); the feed's is marked taken in its proposal, so
 * the proposal's own accept skips it.
 */
async function decideSuggestion(sequelize, showId, body = {}, { by = null } = {}) {
  const { source, id, action } = body;
  if (!['short_story', 'feed'].includes(source)) throw new ThreadInboxError('source is short_story or feed', 400, 'THREAD_INBOX_INVALID');
  if (!ACTIONS.includes(action)) throw new ThreadInboxError('action is keep, merge or drop', 400, 'THREAD_INBOX_INVALID');
  assertId(id, 'id');
  let into = null;
  if (action === 'merge') {
    assertId(body.into, 'into');
    into = await rowFor(sequelize, showId, body.into);
    if (into.status === 'closed') throw new ThreadInboxError('That thread is closed. Reopen it first.', 409, 'STORY_THREAD_CLOSED');
  }
  const meta = await hasMeta(sequelize);
  if (source === 'short_story') {
    const canon = require('./storyCanon');
    const [[p]] = await sequelize.query(
      `SELECT p.id, p.payload, p.episode_id, s.title AS story_title FROM story_canon_proposals p LEFT JOIN stories s ON s.id = p.story_id
        WHERE p.id = :id AND p.show_id = :showId AND p.kind = 'thread' AND p.status = 'pending' AND p.deleted_at IS NULL`,
      { replacements: { id, showId } });
    if (!p) throw new ThreadInboxError('That suggestion is not waiting any more.', 409, 'SUGGESTION_DECIDED');
    const payload = parse(p.payload, {}) || {};
    const label = `From a short story${p.story_title ? `: ${p.story_title}` : ''}`;
    if (action === 'drop') { await canon.dismissProposal(sequelize, id, { by }); return { decided: 'dropped' }; }
    if (action === 'merge') {
      await sequelize.query(
        `UPDATE story_canon_proposals SET payload = jsonb_set(payload, '{thread_id}', to_jsonb(CAST(:into AS text))), updated_at = NOW() WHERE id = :id`,
        { replacements: { id, into: into.id } });
      await canon.acceptProposal(sequelize, id, { by });
      if (meta) {
        await sequelize.transaction((transaction) => appendNote(sequelize, into.id, { text: payload.note || payload.title, label, auto: false }, { transaction }));
      }
      return { decided: 'merged', thread_id: into.id };
    }
    await canon.acceptProposal(sequelize, id, { by });
    if (meta) {
      // The thread its accept opened: where it came from.
      await sequelize.query(
        `UPDATE show_story_threads SET story_meta = CAST(:meta AS jsonb)
          WHERE id = (SELECT id FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND title = :title AND story_meta IS NULL
                       ORDER BY created_at DESC LIMIT 1)`,
        { replacements: { showId, title: payload.title, meta: JSON.stringify({
          origin: { kind: 'short_story', episode_id: p.episode_id, label }, opened_by: 'evoni', seen_at: new Date().toISOString(),
          why: payload.check?.why || null, part: payload.check?.part ?? null, plan: payload.check?.plan || null, notes: [],
        }) } });
    }
    return { decided: 'kept' };
  }

  // The feed: its open proposal's thread_open change at `index`.
  const index = Number(body.index);
  let out = null;
  await sequelize.transaction(async (transaction) => {
    const [[row]] = await sequelize.query(
      `SELECT id, changes FROM season_arc_proposals WHERE id = :id AND show_id = :showId AND status = 'proposed' AND deleted_at IS NULL FOR UPDATE`,
      { replacements: { id, showId }, transaction });
    const changes = row ? parse(row.changes, []) : [];
    const change = Number.isInteger(index) ? changes[index] : null;
    if (!change || change.kind !== 'thread_open' || change.taken) throw new ThreadInboxError('That suggestion is not waiting any more.', 409, 'SUGGESTION_DECIDED');
    const at = new Date().toISOString();
    if (action === 'keep') {
      const [[same]] = await sequelize.query(
        'SELECT id FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND LOWER(title) = LOWER(:title) LIMIT 1',
        { replacements: { showId, title: change.title }, transaction });
      if (same) throw new ThreadInboxError('A thread of that title is already open: merge into it instead.', 409, 'THREAD_EXISTS');
      let threadId;
      if (meta) {
        threadId = await insertThread(sequelize, {
          showId, title: change.title, description: change.description, source: 'evoni', episodeId: null,
          meta: { origin: { kind: 'feed', label: 'From the feed' }, opened_by: 'evoni', seen_at: at, why: change.check?.why || change.why || null, part: change.check?.part ?? null, plan: change.check?.plan || null, notes: [] },
        }, transaction);
      } else {
        threadId = (await require('./storyThreadService').createThread(sequelize, showId, { title: change.title, description: change.description }, { transaction })).id;
      }
      change.taken = { as: 'kept', thread_id: threadId, at, by };
      out = { decided: 'kept', thread_id: threadId };
    } else if (action === 'merge') {
      if (meta) await appendNote(sequelize, into.id, { text: change.description || change.title, label: 'From the feed', auto: false }, { transaction });
      change.taken = { as: 'merged', thread_id: into.id, at, by };
      out = { decided: 'merged', thread_id: into.id };
    } else {
      change.taken = { as: 'dropped', at, by };
      out = { decided: 'dropped' };
    }
    await sequelize.query('UPDATE season_arc_proposals SET changes = CAST(:changes AS jsonb), updated_at = NOW() WHERE id = :id',
      { replacements: { id, changes: JSON.stringify(changes) }, transaction });
  });
  return out;
}

module.exports = {
  ThreadInboxError, MODELS, sameTitle, plainPlan, planOf, readCheck, checkPrompt, beatOf, setClient,
  hasMeta, seasonFor, checkCandidates, openCandidates, openFromRecord, recordThreadStates,
  uncheckedSeeds, openSeeds, openSeedsLater, waitingRows, checkWaiting, checkWaitingLater,
  listInbox, undoThread, restoreThread, undoNote, markSeen, setPlan, decideSuggestion,
};

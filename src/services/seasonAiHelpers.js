'use strict';

/**
 * The Season page's round 3 AI buttons (Evoni, 2026-10-25: "I want them all
 * and show me first and how can ai help with these"; 2026-10-26: "Start the
 * Season page round 3, show me first" — "Yes"). Five buttons, each in the
 * empty spot round 3 left for it. Each one is pressed by Evoni (nothing here
 * runs on its own), makes one call through seasonAiContext.askModel (the
 * house two-attempt loop; aiCostTracker logs every call and refuses one over
 * the daily budget), and saves nothing: what it suggests is applied only
 * when she accepts it, and only through the services that already write
 * those things.
 *
 *   nextStep(sequelize, showId, { items })            "What should I do next?" (the health line). Haiku.
 *       items: the Needs attention rows the page already shows
 *       (lib/seasonAttention attentionItems: { kind, title, detail }), plus
 *       the best-fitting events for the first slot that has none
 *       (seasonSetupService.rankEventsForSlot). → { sentences: [2–3] }
 *   focusToday({ seasons })                           "Focus for today" (the daily update). Haiku.
 *       seasons: [{ show, season_number, title, items }] → { line }
 *   arcSuggestions(sequelize, showId, { arcId })      "Arc suggestions" (the Cast tab).
 *       From services/seasonCast, the slots and the twists. Each suggestion
 *       is { kind: purpose | twist | note, text, why, ... }; a purpose or
 *       twist the season cannot take (a done or started slot, a full slot,
 *       a payoff before its plant) is turned into a note.
 *   applyArcSuggestion(sequelize, showId, body, { by }) Accept on one: a purpose through
 *       seasonIntentionService.saveIntention (added beside the slot's own,
 *       which are kept), a twist through seasonTwists.setTwist. A note is
 *       never written.
 *   carriedForward(sequelize, showId, { arcId })      "What's carried into Season N+1?" (a past
 *       season's Story tab): the season's threads not closed
 *       (storyThreadService.listThreads), its twists still planned or
 *       planted (seasonTwists.getTwists) and the secrets still kept
 *       (seasonRevealPlan.getPlan), each with continue | resolve | drop and
 *       a reason, and the next season's slot it fits.
 *   applyCarried(sequelize, showId, { arcId, decisions }, { by })  Only the rows Evoni ticked.
 *       continue/resolve: a thread stays open and is linked to the next
 *       season's slot (a story purpose, saveIntention); a twist is carried
 *       as a new planned twist in that slot (setTwist; the old one is left
 *       as it was); a secret is hinted (continue) or revealed (resolve)
 *       there (seasonRevealPlan.setReveal). drop: a thread is closed
 *       (storyThreadService.closeThread, the close path), a twist is marked
 *       dropped (setTwist status), a secret is left as it is (nothing
 *       deletes; there is no close path for a secret). Nothing is deleted.
 *   draftPitch(sequelize, showId, { arcId })          The one-pager's two-line pitch, from the
 *       logline and the parts. → { pitch }
 *   getPitch / savePitch(sequelize, showId, { arcId, text, savedBy })
 *       shows.metadata.season_pitches[<arc id>] (no migration: shows.metadata
 *       is the show's JSON column; one UPDATE that leaves its other keys
 *       alone, as the season wrap-up stores season_wrapups).
 *
 * arcId null means the season in progress, else the latest (as the twists
 * and the cast read). Errors are SeasonAiError { status, code }; a budget
 * refusal is a 429 AI_BUDGET_EXCEEDED in plain words.
 */

const { askModel, isBudgetRefusal, bullets, phaseLine, threadLine } = require('./seasonAiContext');
const { loadSeason } = require('./seasonLoader');
const { arcPhases } = require('./seasonSlotService');
const { purposesOf } = require('./seasonIntentionService');

// Small side calls (a few sentences from a list she already sees): Haiku.
const SIDE_MODELS = ['claude-haiku-4-5-20251001'];
// The calls that judge the story: the house model.
const MODELS = ['claude-sonnet-4-6'];

const CAP = { items: 12, itemText: 300, shows: 6, showItems: 8, sentence: 300, line: 240, why: 300, text: 600, pitch: 600, title: 200 };
const PITCH_MAX = 1200;
const MAX_SUGGESTIONS = 6;
const MAX_CARRIED = 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = ['continue', 'resolve', 'drop'];

class SeasonAiError extends Error {
  constructor(message, status = 400, code = 'SEASON_AI_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'SeasonAiError';
  }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const clip = (v, n) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s;
};

const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[seasonAiHelpers] a JSON field could not be read:', err.message);
    return fallback;
  }
};

/** The answer's JSON object; throws (so askModel asks once more) when there is none. */
function readJson(response) {
  const raw = (response?.content || []).filter((c) => c?.type === 'text' || typeof c?.text === 'string').map((c) => c.text).join('').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The answer was not JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

/** One call, with the budget refusal and a failure in plain words. */
async function ask({ models, maxTokens, prompt, label, read, anthropic = null, what }) {
  try {
    return await askModel({ api: anthropic || getClient(), models, maxTokens, prompt, label, read });
  } catch (err) {
    console.error(`[seasonAiHelpers] ${label} failed:`, err.message);
    if (isBudgetRefusal(err)) {
      throw new SeasonAiError(`Today's AI budget is used up, so nothing was asked and nothing changed. Try again tomorrow. (${err.message})`, 429, 'AI_BUDGET_EXCEEDED');
    }
    throw new SeasonAiError(`The AI could not ${what} right now. Try again.`, 502, 'SEASON_AI_FAILED');
  }
}

/** The season (arcId's, else the one in progress, else the latest), or a 404. */
async function seasonOf(sequelize, showId, arcId = null) {
  if (!UUID_RE.test(String(showId || ''))) throw new SeasonAiError('showId must be a UUID');
  const season = await loadSeason(sequelize, showId, arcId ? { arcId } : { anyStatus: true });
  if (!season) throw new SeasonAiError('This show has no season yet.', 404, 'SEASON_NOT_FOUND');
  return season;
}

const seasonNumberOf = (arc) => Number(arc?.season_number) || 1;
const seasonName = (arc) => `Season ${seasonNumberOf(arc)}${arc?.title ? `: ${arc.title}` : ''}`;

/**
 * Whether a slot's purposes can still change (seasonIntentionService's
 * loadEditableSlot rule): not accepted, and not started without its
 * episode.
 */
function slotEditable(s) {
  if (s.accepted_at || s.episode_evaluation_status === 'accepted') return false;
  if (!s.episode_id && s.locked_at) return false;
  return true;
}

const purposeCount = (s) => purposesOf(s).length;

function slotLine(s) {
  const purposes = purposesOf(s).map((p) => p.text).filter(Boolean);
  const state = s.accepted_at ? 'done' : s.live_episode_id ? 'in production' : 'open';
  return `- E${s.slot_number} (Part ${s.phase}, ${state})${s.event_name ? `, event: ${clip(s.event_name, 80)}` : ''}`
    + `${purposes.length ? `; purposes: ${purposes.map((p) => clip(p, 120)).join(' | ')}` : ''}`;
}

const cleanItems = (items, cap) => (Array.isArray(items) ? items : [])
  .filter((i) => i && (i.title || i.detail))
  .slice(0, cap)
  .map((i) => ({ kind: clip(i.kind, 20) || null, title: clip(i.title, CAP.itemText), detail: i.detail ? clip(i.detail, CAP.itemText) : null }));

const itemLine = (i) => `- ${i.title}${i.detail ? ` (${i.detail})` : ''}`;

// ── 1. "What should I do next?" ────────────────────────────────────────────

/** The best-fitting events for the season's first slot with no event, or null (read only; a failure is logged). */
async function firstOpenSlotFit(sequelize, showId) {
  try {
    const season = await loadSeason(sequelize, showId, {});
    const slot = (season?.slots || []).find((s) => !s.event_id && !s.episode_id && !s.locked_at);
    if (!slot) return null;
    const { rankEventsForSlot } = require('./seasonSetupService');
    const ranked = await rankEventsForSlot(sequelize, showId, slot.id);
    const events = (ranked?.events || []).slice(0, 2).map((e) => ({ name: clip(e.name, 80), reason: clip(e.reason, 160) }));
    return events.length ? { slot_number: slot.slot_number, events } : null;
  } catch (err) {
    console.error('[seasonAiHelpers] the event fit could not be read (the call goes without it):', err.message);
    return null;
  }
}

function nextStepPrompt({ season, items, fit }) {
  return `You help Evoni, who runs the show alone, decide what to do next on her season plan for ${season}.
This is what the Season page lists under "Needs attention", most urgent first:
${bullets(items, itemLine, '- Nothing is waiting.')}
${fit ? `\nThe first episode slot with no event is E${fit.slot_number}. The events that fit it best:\n${fit.events.map((e) => `- ${e.name}: ${e.reason}`).join('\n')}\n` : ''}
Write two or three short, plain sentences telling her what to do next, most urgent first. Use only the items above; name the
episode (E3) or the event when you can, and say "today" only for something due within three days. No lists, no headings,
no invented facts.
Answer with JSON only: {"sentences": ["...", "..."]}`;
}

async function nextStep(sequelize, showId, { items = [], anthropic = null } = {}) {
  const list = cleanItems(items, CAP.items);
  if (!list.length) throw new SeasonAiError('Nothing needs attention, so there is no next step to suggest.', 400, 'SEASON_AI_NOTHING');
  const season = await seasonOf(sequelize, showId);
  const needsEvent = list.some((i) => i.kind === 'slots');
  const fit = needsEvent ? await firstOpenSlotFit(sequelize, showId) : null;
  const sentences = await ask({
    models: SIDE_MODELS, maxTokens: 300, prompt: nextStepPrompt({ season: seasonName(season.arc), items: list, fit }),
    label: 'season next step', anthropic, what: 'suggest a next step',
    read: (response) => {
      const out = (readJson(response).sentences || []).map((s) => clip(s, CAP.sentence)).filter(Boolean).slice(0, 3);
      if (!out.length) throw new Error('No sentences in the answer');
      return out;
    },
  });
  return { sentences, fit };
}

// ── 5. "Focus for today" ───────────────────────────────────────────────────

function focusPrompt(seasons) {
  return `You help Evoni, who runs her shows alone, pick one thing to focus on today. These are the "Needs attention" lists
of each show's season in progress, most urgent first:
${seasons.map((s) => `${s.name}:\n${bullets(s.items, itemLine, '- Nothing is waiting.')}`).join('\n\n')}

Write ONE short plain sentence (at most 25 words) naming the single most useful thing to do today, with the show and episode
(E3) when you can. Use only the items above.
Answer with JSON only: {"line": "..."}`;
}

async function focusToday({ seasons = [], anthropic = null } = {}) {
  const list = (Array.isArray(seasons) ? seasons : []).slice(0, CAP.shows).map((s) => ({
    name: `${s?.show ? `${clip(s.show, 80)} · ` : ''}Season ${Number(s?.season_number) || 1}${s?.title ? `: ${clip(s.title, 80)}` : ''}`,
    items: cleanItems(s?.items, CAP.showItems),
  })).filter((s) => s.items.length);
  if (!list.length) throw new SeasonAiError('Nothing needs attention today, so there is nothing to focus on.', 400, 'SEASON_AI_NOTHING');
  const line = await ask({
    models: SIDE_MODELS, maxTokens: 120, prompt: focusPrompt(list), label: 'daily focus', anthropic, what: 'pick a focus',
    read: (response) => {
      const out = clip(readJson(response).line, CAP.line);
      if (!out) throw new Error('No line in the answer');
      return out;
    },
  });
  return { line };
}

// ── 2. Arc suggestions (the Cast tab) ──────────────────────────────────────

function castPrompt({ arc, cast, slots, twists, threads }) {
  const people = cast.people.slice(0, 20);
  const changes = cast.parts.flatMap((p) => p.changes.map((c) => ({ ...c, phase: p.phase }))).slice(0, 30);
  return `You help Evoni plan who appears where in ${seasonName(arc)} of her show. Lala is the lead.
Parts:
${arcPhases(arc).map((p) => phaseLine(p, { word: 'Part', range: true })).join('\n')}

Who appears in which episode (E numbers are the season's slots):
${bullets(people, (p) => `- ${clip(p.name, 60)}${p.is_lala ? ' (lead)' : ''}: ${p.slots.map((n) => `E${n}`).join(', ')}`, '- Nobody is placed yet.')}

Relationship changes saved:
${bullets(changes, (c) => `- E${c.slot_number}: ${clip(c.a.name, 40)} and ${clip(c.b.name, 40)}${c.type ? ` (${c.type})` : ''}${c.stage_before || c.stage_after ? `: ${c.stage_before || '?'} to ${c.stage_after || '?'}` : ''}`, '- None yet.')}

The episode slots:
${bullets(slots, slotLine, '- None.')}

Twists already planned:
${bullets(twists, (t) => `- ${clip(t.title, 80)} (${t.status}${t.plant ? `, planted E${t.plant.slot_number}` : ''}${t.payoff ? `, paid off E${t.payoff.slot_number}` : ''})`, '- None.')}

Open story threads:
${bullets(threads, (t) => threadLine(t), '- None.')}

Suggest up to ${MAX_SUGGESTIONS} changes that would make the people's arcs read better: someone absent too long, a relationship
that changes with no beat between, an arc that stops. Example: "Truthville appears in E2 and E11 but nothing between: add a beat in Part 2?"
Each suggestion is one of:
- {"kind": "purpose", "slot": <an open slot's number>, "text": "<a one-sentence story purpose for that episode>", "why": "<the reason, plain>", "thread_id": "<an open thread's id, or null>"}
- {"kind": "twist", "slot": <plant slot>, "payoff_slot": <a later slot, or null>, "title": "<short>", "text": "<one sentence>", "why": "..."}
- {"kind": "note", "text": "<anything else, as advice>", "why": "..."}
Only use open slots for purposes and twists. Use only the people, slots and threads above.
Answer with JSON only: {"suggestions": [...]}`;
}

/** The suggestions the season can take; a purpose or twist that cannot be applied is a note. */
function cleanSuggestions(raw, { slots, threads }) {
  const byNumber = new Map(slots.map((s) => [Number(s.slot_number), s]));
  const threadIds = new Set(threads.map((t) => String(t.id)));
  const open = (n) => {
    const s = byNumber.get(Number(n));
    return s && slotEditable(s) ? s : null;
  };
  const out = [];
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, MAX_SUGGESTIONS)) {
    const text = clip(r?.text, CAP.text);
    if (!text) continue;
    const why = r?.why ? clip(r.why, CAP.why) : null;
    const note = (reason = null) => ({ kind: 'note', text, why, cannot_apply: reason });
    if (r.kind === 'purpose') {
      const slot = open(r.slot);
      if (!slot) { out.push(note(`E${Number(r.slot) || '?'} is done or started, so this is a note.`)); continue; }
      if (purposeCount(slot) >= 3) { out.push(note(`E${slot.slot_number} already has three story purposes, so this is a note.`)); continue; }
      const threadId = r.thread_id && threadIds.has(String(r.thread_id)) ? String(r.thread_id) : null;
      out.push({ kind: 'purpose', text, why, slot_id: slot.id, slot_number: slot.slot_number, thread_id: threadId });
    } else if (r.kind === 'twist') {
      const plant = open(r.slot);
      const payoff = r.payoff_slot != null ? open(r.payoff_slot) : null;
      if (!plant || (r.payoff_slot != null && (!payoff || payoff.slot_number <= plant.slot_number))) {
        out.push(note('Its episodes are done, started or out of order, so this is a note.'));
        continue;
      }
      out.push({
        kind: 'twist', text, why, title: clip(r.title || text, CAP.title),
        slot_id: plant.id, slot_number: plant.slot_number,
        payoff_slot_id: payoff ? payoff.id : null, payoff_slot_number: payoff ? payoff.slot_number : null,
      });
    } else {
      out.push(note());
    }
  }
  return out;
}

async function arcSuggestions(sequelize, showId, { arcId = null, anthropic = null } = {}) {
  const season = await seasonOf(sequelize, showId, arcId);
  const { seasonCast } = require('./seasonCast');
  const { getTwists } = require('./seasonTwists');
  const { openThreads } = require('./seasonAiContext');
  const cast = await seasonCast(sequelize, showId, { arcId: season.arc.id });
  if (!cast.people.length) throw new SeasonAiError('Nobody is placed in this season yet, so there is no arc to suggest for.', 400, 'SEASON_AI_NOTHING');
  const twists = (await getTwists(sequelize, showId, { arcId: season.arc.id })).twists.filter((t) => t.status !== 'dropped');
  const threads = await openThreads(sequelize, showId, { limit: 15 });
  const suggestions = await ask({
    models: MODELS, maxTokens: 1500, label: 'season arc suggestions', anthropic, what: 'suggest arc changes',
    prompt: castPrompt({ arc: season.arc, cast, slots: season.slots, twists, threads }),
    read: (response) => {
      const parsed = readJson(response);
      if (!Array.isArray(parsed.suggestions)) throw new Error('No suggestions in the answer');
      return cleanSuggestions(parsed.suggestions, { slots: season.slots, threads });
    },
  });
  return { season: { arc_id: season.arc.id, season_number: seasonNumberOf(season.arc) }, suggestions };
}

/**
 * Adds a story purpose to a slot beside the ones it has, through
 * saveIntention (its own checks: the slot is editable, the thread is open,
 * three purposes at most), keeping the slot's focus, pressure and range.
 */
async function addPurpose(sequelize, showId, slotId, { text, threadId = null }) {
  if (!UUID_RE.test(String(slotId || ''))) throw new SeasonAiError('Choose the episode slot.');
  const clean = clip(text, 1000);
  if (!clean) throw new SeasonAiError('The story purpose is empty.');
  const [[slot]] = await sequelize.query(
    `SELECT id, slot_number, story_purpose, story_purposes, story_thread_id, intention_source, career_focus, desired_pressure, outcome_range
       FROM season_slots WHERE id = :slotId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { slotId, showId } });
  if (!slot) throw new SeasonAiError('That slot is not in this show\'s season.', 404, 'SEASON_SLOT_NOT_FOUND');
  const { saveIntention, MAX_PURPOSES } = require('./seasonIntentionService');
  const current = purposesOf(slot);
  if (threadId && current.some((p) => p.story_thread_id === threadId)) {
    return { slot_number: slot.slot_number, already: true };
  }
  if (current.length >= MAX_PURPOSES) {
    throw new SeasonAiError(`E${slot.slot_number} already has ${MAX_PURPOSES} story purposes. Remove one on the Roadmap first.`, 409, 'SEASON_SLOT_FULL');
  }
  const range = parseJson(slot.outcome_range, null);
  const result = await saveIntention(sequelize, showId, slotId, {
    story_purposes: [
      ...current.map((p) => ({ text: p.text, primary: p.primary, story_thread_id: p.story_thread_id || null })),
      { text: clean, primary: current.length === 0, story_thread_id: threadId || null },
    ],
    career_focus: slot.career_focus,
    desired_pressure: slot.desired_pressure,
    outcome_range: range && (range.min || range.max) ? range : null,
  });
  return { slot_number: result.slot_number, already: false };
}

/** Accept on one arc suggestion: a purpose or a twist, through the services that write them. */
async function applyArcSuggestion(sequelize, showId, body = {}, { by = null } = {}) {
  if (!UUID_RE.test(String(showId || ''))) throw new SeasonAiError('showId must be a UUID');
  if (body.kind === 'purpose') {
    const r = await addPurpose(sequelize, showId, body.slot_id, { text: body.text, threadId: body.thread_id && UUID_RE.test(String(body.thread_id)) ? String(body.thread_id) : null });
    return { applied: r.already ? `E${r.slot_number} already continues that thread.` : `Added a story purpose to E${r.slot_number}.` };
  }
  if (body.kind === 'twist') {
    const { setTwist } = require('./seasonTwists');
    await setTwist(sequelize, showId, {
      title: body.title || body.text, description: body.text, plant_slot_id: body.slot_id,
      payoff_slot_id: body.payoff_slot_id || null, status: 'planned', note: 'From Arc suggestions',
    }, { by });
    return { applied: `Added the twist "${clip(body.title || body.text, 80)}".` };
  }
  throw new SeasonAiError('Only a story purpose or a twist can be applied; a note is for you to copy.');
}

// ── 3. "What's carried into Season N+1?" ───────────────────────────────────

async function nextSeasonOf(sequelize, showId, arc) {
  const [[row]] = await sequelize.query(
    `SELECT id FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL AND COALESCE(season_number, 1) = :n
      ORDER BY (status = 'active') DESC, arc_number DESC LIMIT 1`,
    { replacements: { showId, n: seasonNumberOf(arc) + 1 } });
  return row ? loadSeason(sequelize, showId, { arcId: row.id }) : null;
}

/** What a past season leaves open: its threads not closed, its open twists, the secrets still kept. */
async function carriedItems(sequelize, showId, arc) {
  const { listThreads } = require('./storyThreadService');
  const { getTwists } = require('./seasonTwists');
  const { getPlan } = require('./seasonRevealPlan');
  const threads = (await listThreads(sequelize, showId, { arcId: arc.id })).filter((t) => t.status !== 'closed');
  const twists = (await getTwists(sequelize, showId, { arcId: arc.id })).twists.filter((t) => t.status === 'planned' || t.status === 'planted');
  const plan = await getPlan(sequelize, showId, { arcId: arc.id });
  const revealed = new Set(plan.reveals.filter((r) => r.intent === 'reveal').map((r) => r.secret_id));
  const hinted = new Set(plan.reveals.filter((r) => r.intent === 'hint').map((r) => r.secret_id));
  const secrets = plan.secrets.filter((s) => s.state !== 'revealed' && !revealed.has(s.id))
    .sort((a, b) => Number(hinted.has(b.id)) - Number(hinted.has(a.id)));
  const items = [
    ...threads.map((t, i) => ({ ref: `T${i + 1}`, type: 'thread', id: t.id, title: t.title, detail: t.description || null, status: t.status })),
    ...twists.map((t, i) => ({ ref: `W${i + 1}`, type: 'twist', id: t.id, title: t.title, detail: t.description || null, status: t.status, twist: t })),
    ...secrets.map((s, i) => ({ ref: `S${i + 1}`, type: 'secret', id: s.id, title: `${s.character_name}: ${s.text}`, detail: null, status: hinted.has(s.id) ? 'hinted this season' : 'kept' })),
  ];
  return items.slice(0, MAX_CARRIED);
}

function carriedPrompt({ arc, items, next }) {
  const n = seasonNumberOf(arc);
  const open = next ? next.slots.filter(slotEditable) : [];
  return `You help Evoni close out ${seasonName(arc)} of her show and plan what Season ${n + 1} carries.
Parts of Season ${n}:
${arcPhases(arc).map((p) => phaseLine(p, { word: 'Part', range: true })).join('\n')}

What Season ${n} leaves open (ref, what, status):
${items.map((i) => `- ${i.ref} ${i.type}: ${clip(i.title, 160)} (${i.status})${i.detail ? ` — ${clip(i.detail, 200)}` : ''}`).join('\n')}

${next ? `Season ${n + 1}${next.arc.title ? `: ${next.arc.title}` : ''}, its parts:\n${arcPhases(next.arc).map((p) => phaseLine(p, { word: 'Part', range: true })).join('\n')}\nIts open slots:\n${bullets(open.slice(0, 24), slotLine, '- None.')}` : `Season ${n + 1} is not set up yet.`}

For each ref, decide: "continue" (keep it going next season), "resolve" (pay it off or answer it next season) or "drop"
(let it go), with one plain reason. ${next ? `For continue or resolve, pick the Season ${n + 1} open slot number it fits first.` : ''}
Answer with JSON only: {"items": [{"ref": "T1", "decision": "continue", "reason": "...", "slot": ${next ? '<number or null>' : 'null'}}]}`;
}

async function carriedForward(sequelize, showId, { arcId = null, anthropic = null } = {}) {
  const season = await seasonOf(sequelize, showId, arcId);
  const items = await carriedItems(sequelize, showId, season.arc);
  const next = await nextSeasonOf(sequelize, showId, season.arc);
  const nextInfo = next ? { arc_id: next.arc.id, season_number: seasonNumberOf(next.arc) } : { arc_id: null, season_number: seasonNumberOf(season.arc) + 1 };
  const out = { season: { arc_id: season.arc.id, season_number: seasonNumberOf(season.arc) }, next_season: nextInfo, items: [] };
  if (!items.length) return out;
  const openSlots = new Map((next ? next.slots.filter(slotEditable) : []).map((s) => [Number(s.slot_number), s]));
  const firstOpen = [...openSlots.values()][0] || null;
  const decided = await ask({
    models: MODELS, maxTokens: 1800, label: 'season carried forward', anthropic, what: 'read what the season carries',
    prompt: carriedPrompt({ arc: season.arc, items, next }),
    read: (response) => {
      const parsed = readJson(response);
      if (!Array.isArray(parsed.items)) throw new Error('No items in the answer');
      return new Map(parsed.items.filter((r) => r && r.ref).map((r) => [String(r.ref), r]));
    },
  });
  out.items = items.map((i) => {
    const r = decided.get(i.ref) || {};
    const decision = DECISIONS.includes(r.decision) ? r.decision : 'continue';
    const slot = openSlots.get(Number(r.slot)) || firstOpen;
    return {
      ref: i.ref, type: i.type, id: i.id, title: i.title, status: i.status,
      decision, reason: r.reason ? clip(r.reason, CAP.why) : null,
      slot_id: decision !== 'drop' && slot ? slot.id : null,
      slot_number: decision !== 'drop' && slot ? slot.slot_number : null,
    };
  });
  return out;
}

/** One ticked row, through the service that writes it; a plain sentence of what was done. */
async function applyOneCarried(sequelize, showId, { season, next, d, twistById, threadById, by }) {
  const n = seasonNumberOf(season.arc);
  const nextSlot = d.slot_id && next ? next.slots.find((s) => s.id === d.slot_id && slotEditable(s)) : null;
  const where = nextSlot ? `S${n + 1} · E${nextSlot.slot_number}` : null;
  if (d.type === 'thread') {
    const { closeThread } = require('./storyThreadService');
    const thread = threadById.get(d.id);
    if (!thread) throw new SeasonAiError('That thread is not in this season.', 404);
    if (d.decision === 'drop') {
      await closeThread(sequelize, showId, d.id);
      return `Closed the thread "${clip(thread.title, 80)}".`;
    }
    if (!nextSlot) return `"${clip(thread.title, 80)}" stays open${next ? '' : `; set up Season ${n + 1} to link it to an episode`}.`;
    const verb = d.decision === 'resolve' ? 'Resolve' : 'Continue';
    const r = await addPurpose(sequelize, showId, nextSlot.id, { text: `${verb}: ${clip(thread.title, 180)}`, threadId: d.id });
    return r.already ? `"${clip(thread.title, 80)}" is already linked to ${where}.` : `"${clip(thread.title, 80)}" stays open and is linked to ${where}.`;
  }
  if (d.type === 'twist') {
    const { setTwist } = require('./seasonTwists');
    const t = twistById.get(d.id);
    if (!t) throw new SeasonAiError('That twist is not open in this season.', 404);
    if (d.decision === 'drop') {
      await setTwist(sequelize, showId, {
        id: t.id, title: t.title, description: t.description, note: t.note, status: 'dropped', kind: t.kind,
        plant_slot_id: t.plant_slot_id, payoff_slot_id: t.payoff_slot_id, thread_ids: t.thread_ids, character_ids: t.character_ids,
      }, { by });
      return `Marked the twist "${clip(t.title, 80)}" dropped (it is kept, not deleted).`;
    }
    if (!nextSlot) return `"${clip(t.title, 80)}" was not carried: set up Season ${n + 1} with an open episode first.`;
    await setTwist(sequelize, showId, {
      title: t.title, description: t.description, kind: t.kind, plant_slot_id: nextSlot.id, status: 'planned',
      thread_ids: t.thread_ids, character_ids: t.character_ids,
      note: `Carried from Season ${n}${d.decision === 'resolve' ? ': pay it off' : ''}`,
    }, { by });
    return `Carried the twist "${clip(t.title, 80)}" into ${where}.`;
  }
  if (d.type === 'secret') {
    if (d.decision === 'drop') return 'The secret is left as it is: a kept secret is never deleted, and nothing was changed.';
    if (!nextSlot) return `The secret was not planned: set up Season ${n + 1} with an open episode first.`;
    const { setReveal } = require('./seasonRevealPlan');
    const intent = d.decision === 'resolve' ? 'reveal' : 'hint';
    await setReveal(sequelize, showId, { slot_id: nextSlot.id, secret_id: d.id, intent, note: `Carried from Season ${n}` }, { by });
    return `Planned a ${intent} of the secret in ${where}.`;
  }
  throw new SeasonAiError('Unknown kind of carried item.');
}

/**
 * Apply only the rows Evoni ticked ({ decisions: [{ type, id, decision,
 * slot_id }] }). Each row goes alone: one that cannot be applied says why
 * and the others still go.
 */
async function applyCarried(sequelize, showId, { arcId = null, decisions = [] } = {}, { by = null } = {}) {
  const list = (Array.isArray(decisions) ? decisions : []).slice(0, MAX_CARRIED)
    .filter((d) => d && ['thread', 'twist', 'secret'].includes(d.type) && UUID_RE.test(String(d.id || '')) && DECISIONS.includes(d.decision));
  if (!list.length) throw new SeasonAiError('Tick at least one row to apply.');
  const season = await seasonOf(sequelize, showId, arcId);
  const next = await nextSeasonOf(sequelize, showId, season.arc);
  const { getTwists } = require('./seasonTwists');
  const { listThreads } = require('./storyThreadService');
  const twistById = new Map((await getTwists(sequelize, showId, { arcId: season.arc.id })).twists.map((t) => [t.id, t]));
  const threadById = new Map((await listThreads(sequelize, showId, { arcId: season.arc.id })).map((t) => [t.id, t]));
  const results = [];
  for (const d of list) {
    try {
      results.push({ id: d.id, ok: true, text: await applyOneCarried(sequelize, showId, { season, next, d, twistById, threadById, by }) });
    } catch (err) {
      console.error('[seasonAiHelpers] a carried row could not be applied:', err.message);
      results.push({ id: d.id, ok: false, text: err.message || 'It could not be applied.' });
    }
  }
  return { results };
}

// ── 4. The season pitch (the one-pager) ────────────────────────────────────

function pitchPrompt({ arc, slots }) {
  const events = slots.filter((s) => s.event_name).slice(0, 10).map((s) => `E${s.slot_number}: ${clip(s.event_name, 80)}`);
  return `Write the two-line pitch for ${seasonName(arc)} of "Styling Adventures with Lala", for the top of a one-page season plan.
${arc.tagline ? `Tagline: ${clip(arc.tagline, 200)}\n` : ''}${arc.logline ? `Logline: ${clip(arc.logline, 600)}\n` : ''}${arc.description ? `Description: ${clip(arc.description, 800)}\n` : ''}Parts:
${arcPhases(arc).map((p) => phaseLine(p, { word: 'Part', range: true })).join('\n')}
${events.length ? `Some of its events: ${events.join('; ')}\n` : ''}
Two sentences, one per line, at most 30 words each: what the season is, then what is at stake for Lala. Plain and vivid; use
only what is given.
Answer with JSON only: {"pitch": "line one\\nline two"}`;
}

async function draftPitch(sequelize, showId, { arcId = null, anthropic = null } = {}) {
  const season = await seasonOf(sequelize, showId, arcId);
  const pitch = await ask({
    models: MODELS, maxTokens: 300, prompt: pitchPrompt(season), label: 'season pitch', anthropic, what: 'draft a pitch',
    read: (response) => {
      const lines = String(readJson(response).pitch || '').split(/\n+/).map((l) => clip(l, CAP.pitch)).filter(Boolean).slice(0, 2);
      if (!lines.length) throw new Error('No pitch in the answer');
      return lines.join('\n');
    },
  });
  return { pitch, season: { arc_id: season.arc.id, season_number: seasonNumberOf(season.arc) } };
}

async function getPitch(sequelize, showId, { arcId = null } = {}) {
  const season = await seasonOf(sequelize, showId, arcId);
  const [[row]] = await sequelize.query(
    `SELECT metadata::jsonb -> 'season_pitches' -> CAST(:arcId AS text) AS saved FROM shows WHERE id = :showId AND deleted_at IS NULL`,
    { replacements: { showId, arcId: season.arc.id } });
  const saved = parseJson(row?.saved, null);
  return { saved: saved && typeof saved.text === 'string' ? saved : null, season: { arc_id: season.arc.id, season_number: seasonNumberOf(season.arc) } };
}

/** Save Evoni's pitch for the season ({ text }); an empty text clears it. Other metadata keys are left alone. */
async function savePitch(sequelize, showId, { arcId = null, text, savedBy = null } = {}) {
  if (text != null && typeof text !== 'string') throw new SeasonAiError('text must be text.');
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (clean.length > PITCH_MAX) throw new SeasonAiError(`The pitch is at most ${PITCH_MAX} characters.`);
  const season = await seasonOf(sequelize, showId, arcId);
  const saved = clean ? { text: clean, saved_at: new Date().toISOString(), saved_by: savedBy } : null;
  const [, meta] = await sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{season_pitches}',
            CASE WHEN CAST(:saved AS jsonb) IS NULL
                 THEN COALESCE(metadata::jsonb -> 'season_pitches', '{}'::jsonb) - CAST(:arcId AS text)
                 ELSE COALESCE(metadata::jsonb -> 'season_pitches', '{}'::jsonb) || jsonb_build_object(CAST(:arcId AS text), CAST(:saved AS jsonb))
            END)::json,
            updated_at = NOW()
      WHERE id = :showId AND deleted_at IS NULL`,
    { replacements: { showId, arcId: season.arc.id, saved: saved ? JSON.stringify(saved) : null } });
  if (!(meta?.rowCount ?? meta)) throw new SeasonAiError('Show not found.', 404, 'SHOW_NOT_FOUND');
  return { saved, season: { arc_id: season.arc.id, season_number: seasonNumberOf(season.arc) } };
}

module.exports = {
  SeasonAiError, SIDE_MODELS, MODELS,
  nextStep, focusToday, arcSuggestions, applyArcSuggestion, carriedForward, applyCarried,
  draftPitch, getPitch, savePitch,
  // for the tests
  readJson, cleanItems, cleanSuggestions, slotEditable, nextStepPrompt, focusPrompt, castPrompt, carriedPrompt, pitchPrompt, addPurpose,
};

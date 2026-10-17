'use strict';

/**
 * Storylines on The Pulse (Task #2989; The Pulse spec §4 "Storylines —
 * long-running threads the system plants and pays off across posts
 * (planner)"; docs/reads/2026-10-12-pulse-world-depth-read.md §7).
 *
 * A storyline is a plan of posts across story moments. It may follow one of
 * the show's threads (show_story_threads), never copying its title or status.
 * Its beats (plant, build, payoff) each name a story order, a poster (a Feed
 * profile with a Voice Profile) and what the post should do.
 *
 *   queueDueBeats(db, showId, now?)
 *     every planned beat whose story order has come (at or before the
 *     present) is queued once as a `storyline` job (pulseQueue, under the
 *     daily draft cap), no more than the automated requests left today; the
 *     rest wait, planned, for midnight UTC (Task #3050). Never calls AI.
 *   handleStoryline(db, job)
 *     pulseDrafter.draftAndRoute at the beat's story order, with the premise
 *     and the brief as what happened; the gate decides as for any post, and
 *     a payoff always goes to Review (it reveals story; spec §7). The beat
 *     keeps its post; the storyline runs, and is paid off with its payoff.
 *   suggestBeats(db, storylineId)
 *     one Sonnet call proposing plant, build and payoff beats from the
 *     premise and the show's posting characters; nothing is saved, Evoni
 *     keeps or bins each.
 *   tick / startScheduler / stopScheduler   the hourly due-beat check
 *     (app.js, with the worker)
 */

const MODELS = ['claude-sonnet-4-6'];
const KINDS = ['plant', 'build', 'payoff'];
const STATUSES = ['planned', 'running', 'paid_off', 'dropped'];
const TICK_MS = 60 * 60 * 1000;
const MAX_SUGGESTIONS = 6;

class StorylineError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'StorylineError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** The registry character behind a Feed profile's Voice Profile, or a StorylineError. */
async function posterCharacter(db, profileId) {
  const voice = await db.PulseVoice.findOne({ where: { social_profile_id: profileId } });
  if (!voice) throw new StorylineError(400, `Profile ${profileId} has no Voice Profile yet. Build it in Admin › The Pulse › Voices.`);
  // Posting is for Active characters and on (Evoni, 2026-10-12).
  const character = await db.RegistryCharacter.findByPk(voice.registry_character_id, { attributes: ['id', 'display_name', 'depth_level'] });
  const { ACTIVE_STAGES } = require('./pulseVoices');
  if (!character || !ACTIVE_STAGES.includes(String(character.depth_level))) {
    throw new StorylineError(400, `${character?.display_name || `Profile ${profileId}`} is not Active yet, so cannot post.`);
  }
  return voice.registry_character_id;
}

/** Adds a beat after checking its kind, order and poster. */
async function addBeat(db, storyline, { kind, story_order: order, poster_profile_id: poster, brief }) {
  if (!KINDS.includes(kind)) throw new StorylineError(400, `kind must be one of ${KINDS.join(', ')}.`);
  if (!Number.isInteger(order) || order < 0) throw new StorylineError(400, 'story_order must be a whole number.');
  if (!Number.isInteger(poster)) throw new StorylineError(400, 'poster_profile_id is required.');
  const text = String(brief || '').trim();
  if (!text) throw new StorylineError(400, 'Say what the post should do (brief).');
  await posterCharacter(db, poster);
  return db.PulseStorylineBeat.create({
    storyline_id: storyline.id, show_id: storyline.show_id, kind, story_order: order,
    poster_profile_id: poster, brief: text.slice(0, 2000), status: 'planned',
  });
}

/**
 * The automated requests left today (UTC) for the show: the limit, less the
 * requests taken, less the automated jobs already waiting to run before
 * midnight UTC (each takes one when it drafts).
 */
async function automatedRoom(db, showId, now = new Date()) {
  const { automated_requests: limit } = await require('./pulseQueue').settingsOf(db, showId);
  const { automated } = await require('./pulseRequests').usedToday(db, showId, now);
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const [[waiting]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n FROM pulse_jobs
      WHERE show_id = :showId AND kind IN ('event', 'ambient', 'comment', 'storyline')
        AND status IN ('queued', 'running') AND run_after < :reset AND deleted_at IS NULL`,
    { replacements: { showId, reset } });
  return Math.max(0, limit - automated - waiting.n);
}

/** Queues each planned beat whose moment has come, once, within today's automated requests. Returns the jobs. */
async function queueDueBeats(db, showId, now = new Date()) {
  // Storyline posts switched off in Admin › Engine (2026-10-17): the beats wait, planned.
  if (!(await require('./pulseQueue').kindEnabled(db, showId, 'storyline'))) return [];
  const { Op } = require('sequelize');
  const present = await require('./storyClock').presentOrder(db, showId);
  const live = await db.PulseStoryline.findAll({ where: { show_id: showId, status: { [Op.in]: ['planned', 'running'] } }, attributes: ['id'], raw: true });
  if (!live.length) return [];
  const beats = await db.PulseStorylineBeat.findAll({
    where: { show_id: showId, status: 'planned', story_order: { [Op.lte]: present }, storyline_id: { [Op.in]: live.map((s) => s.id) } },
    order: [['story_order', 'ASC'], ['created_at', 'ASC']],
  });
  const queue = require('./pulseQueue');
  const { isApproved } = require('./pulseVoices');
  // Only as many beats as the automated lane has requests left today: a
  // beat refused by the cap went back to planned, and queueing it again
  // every hour until midnight UTC only piled up skipped jobs (Task #3050).
  // It waits, planned, for the reset.
  const room = await automatedRoom(db, showId, now);
  const jobs = [];
  for (const beat of beats) {
    if (jobs.length >= room) break;
    // A beat waits, still planned, until its poster's voice is approved (Task #3029).
    const voice = await db.PulseVoice.findOne({ where: { social_profile_id: beat.poster_profile_id } });
    if (!isApproved(voice)) continue;
    // Claim the beat first so two ticks never queue it twice.
    const [claimed] = await db.PulseStorylineBeat.update({ status: 'queued' }, { where: { id: beat.id, status: 'planned' } });
    if (!claimed) continue;
    const job = await queue.enqueue(db, { showId, kind: 'storyline', payload: { beat_id: beat.id } });
    await beat.update({ status: 'queued', job_id: job.id });
    jobs.push(job);
  }
  return jobs;
}

/** The queue's `storyline` handler: drafts the beat's post. */
async function handleStoryline(db, job) {
  const beatId = job.payload_json?.beat_id;
  const beat = beatId ? await db.PulseStorylineBeat.findByPk(beatId) : null;
  if (!beat) throw new StorylineError(404, `Beat ${beatId} not found.`);
  const storyline = await db.PulseStoryline.findByPk(beat.storyline_id);
  if (!storyline || storyline.status === 'dropped') {
    await beat.update({ status: 'skipped' });
    return { draftIds: [] };
  }
  const characterId = await posterCharacter(db, beat.poster_profile_id);
  // Approval withdrawn since the beat was queued: back to planned, to queue again once approved.
  const blocked = await require('./pulseVoices').automationBlocker(db, characterId);
  if (blocked) {
    await beat.update({ status: 'planned', job_id: null });
    return { skipped: blocked };
  }
  const about = `${storyline.premise ? `${storyline.premise} ` : ''}This post should: ${beat.brief}`;
  let post;
  try {
    ({ post } = await require('./pulseDrafter').draftAndRoute(db, {
      showId: storyline.show_id, characterId, moment: beat.story_order,
      context: { about },
      request: { kind: 'storyline', jobId: job.id },
      alwaysReview: beat.kind === 'payoff' ? ['storyline_payoff'] : [],
    }));
  } catch (err) {
    // Today's automated requests are used (Task #3031): the beat waits, planned, for tomorrow.
    if (err instanceof require('./pulseRequests').RequestCapError) await beat.update({ status: 'planned', job_id: null });
    throw err;
  }
  await beat.update({ status: 'drafted', post_id: post.id });
  const next = beat.kind === 'payoff' ? 'paid_off' : 'running';
  if (storyline.status !== next && storyline.status !== 'paid_off') await storyline.update({ status: next });
  return { draftIds: [post.id] };
}

function registerHandlers() {
  require('./pulseQueue').register('storyline', handleStoryline);
}

/** One AI call proposing beats; nothing is saved. Returns [{ kind, story_order, poster_profile_id, handle, brief }]. */
async function suggestBeats(db, storylineId) {
  const storyline = await db.PulseStoryline.findByPk(storylineId);
  if (!storyline) throw new StorylineError(404, 'Storyline not found');
  const clock = require('./storyClock');
  const present = await clock.presentOrder(db, storyline.show_id);
  // Storylines are ongoing relationships: suggestions use Alive characters (Evoni, 2026-10-12)
  // Lala has met; a public figure she only knows of waits for the meeting (Evoni, 2026-10-16).
  const people = (await require('./pulseVoices').eligible(db, storyline.show_id, { stage: 'alive', met: true })).filter((c) => c.voice);
  if (!people.length) throw new StorylineError(400, 'No Alive character has a Voice Profile yet. Build one in Voices.');
  const byHandle = new Map(people.map((c) => [String(c.profile.handle).toLowerCase(), Number(c.profile.id)]));
  const [episodes] = await db.sequelize.query(
    'SELECT episode_number FROM episodes WHERE show_id = :showId AND deleted_at IS NULL AND episode_number IS NOT NULL ORDER BY episode_number',
    { replacements: { showId: storyline.show_id } });
  const moments = episodes.flatMap((e) => ['announced', 'during_episode', 'after_episode', 'next_day']
    .map((ph) => clock.orderOf(e.episode_number, ph))).filter((o) => o >= present);
  const prompt = `You plan a storyline on The Pulse, LalaVerse's social network: posts by its characters, planted early and paid off later.

Storyline: ${storyline.title}
Premise: ${storyline.premise || '(none given)'}
Who can post (handles): ${people.map((c) => `@${c.profile.handle}`).join(', ')}
Story moments you may use (story orders, earliest first; each is an episode moment): ${moments.slice(0, 24).join(', ') || present}

Propose up to ${MAX_SUGGESTIONS} beats: first plants (small hints nobody notices yet), then builds, then one payoff. Each is one post by one character.
Rules: stay in the world (nothing about a show, episodes or a studio); never state a character's private feelings.
Answer with JSON only: {"beats": [{"kind": "plant" | "build" | "payoff", "story_order": 17, "handle": "@someone", "brief": "what the post does, one line"}]}`;
  await require('./pulseRequests').take(db, { showId: storyline.show_id, lane: 'manual', kind: 'suggestions' });
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[PulseStorylines] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (parseErr) {
    console.error('[PulseStorylines] could not read the suggestions:', parseErr.message);
    throw new StorylineError(502, 'The suggestions came back in a form that could not be read.');
  }
  return (Array.isArray(parsed.beats) ? parsed.beats : [])
    .map((b) => {
      const handle = String(b.handle || '').replace(/^@/, '').toLowerCase();
      return {
        kind: KINDS.includes(b.kind) ? b.kind : null,
        story_order: Number.isInteger(b.story_order) ? b.story_order : null,
        poster_profile_id: byHandle.get(handle) ?? null,
        handle,
        brief: String(b.brief || '').trim().slice(0, 500),
      };
    })
    .filter((b) => b.kind && b.story_order !== null && b.poster_profile_id !== null && b.brief)
    .slice(0, MAX_SUGGESTIONS);
}

/** Queues due beats for every show with a live storyline; returns the jobs. */
async function tick(db) {
  const [shows] = await db.sequelize.query(
    `SELECT DISTINCT show_id FROM pulse_storylines WHERE status IN ('planned', 'running') AND deleted_at IS NULL`);
  const jobs = [];
  for (const s of shows) {
    try {
      jobs.push(...await queueDueBeats(db, s.show_id));
    } catch (err) {
      console.error(`[PulseStorylines] queuing show ${s.show_id} failed:`, err);
    }
  }
  return jobs;
}

let timer = null;

function startScheduler(db = require('../models'), { intervalMs = TICK_MS } = {}) {
  if (timer) return false;
  timer = setInterval(() => {
    tick(db).catch((err) => console.error('[PulseStorylines] the due-beat check failed:', err));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return true;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  MODELS, KINDS, STATUSES, MAX_SUGGESTIONS, StorylineError,
  addBeat, queueDueBeats, handleStoryline, registerHandlers, suggestBeats, tick, startScheduler, stopScheduler,
};

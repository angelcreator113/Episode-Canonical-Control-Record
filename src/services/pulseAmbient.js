'use strict';

/**
 * Ambient posts (Task #2971; The Pulse spec §7 "Ambient posts: a scheduled
 * worker drafts occasional posts between events from each character's
 * Living State"; docs/reads/2026-10-12-pulse-posting-read.md §5, §7).
 * Evoni, 2026-10-12: it ships off; she turns it on with the Engine tab's
 * switch (the show's metadata.pulse_engine.ambient_enabled, #2968).
 *
 *   planAmbient(db, showId, now)
 *     only while PULSE_ENGINE_ENABLED is on and the show's ambient switch
 *     is on; once per WINDOW_HOURS window. Picks a few posting characters
 *     with a voice who have not posted in RECENT_HOURS, by temperament
 *     (oversharers often, lurkers rarely), seeded by the window so a
 *     restart picks the same. Queues `ambient` jobs at the present story
 *     moment, never more than the day's ambient share of the automated requests: the
 *     rest (RESERVE_FOR_EVENTS) is kept for event posts.
 *   handleAmbient(db, job)   pulseDrafter.draftAndRoute with no event:
 *                            the character's Living State shapes it,
 *                            privately; the gate decides publish or Review
 *   tick(db, now)            plans every show with ambient on
 *   startScheduler(db)       an hourly timer (app.js, with the worker)
 */

const WINDOW_HOURS = 6;
const RECENT_HOURS = 24;
const PER_WINDOW = 3;
const RESERVE_FOR_EVENTS = 0.5;
const CHANCE = { oversharer: 0.9, regular: 0.5, lurker: 0.1 };
const TICK_MS = 60 * 60 * 1000;

const windowOf = (now) => Math.floor(now.getTime() / (WINDOW_HOURS * 60 * 60 * 1000));

/** How many ambient drafts the day still allows: its share of the automated requests, less what ambient already made or queued today. */
function ambientRoom({ cap, ambientToday }) {
  return Math.max(0, Math.floor(cap * (1 - RESERVE_FOR_EVENTS)) - ambientToday);
}

/**
 * The window's picks from [{ characterId, temperament }]: each in with its
 * temperament's chance, seeded by window and character; at most `limit`,
 * in seeded order.
 */
function pickAmbient(candidates, windowKey, limit) {
  const { seeded } = require('./pulseEventPosting');
  return candidates
    .map((c) => ({ ...c, roll: seeded(`ambient:${windowKey}:${c.characterId}`) }))
    .filter((c) => c.roll < (CHANCE[c.temperament] ?? CHANCE.regular))
    .sort((a, b) => a.roll - b.roll)
    .slice(0, Math.max(0, limit));
}

const startOfUtcDay = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

async function planAmbient(db, showId, now = new Date()) {
  if (process.env.PULSE_ENGINE_ENABLED !== 'true') return [];
  const queue = require('./pulseQueue');
  const settings = await queue.settingsOf(db, showId);
  if (!settings.ambient_enabled) return [];
  const windowKey = windowOf(now);
  const { sequelize } = db;
  const [[stats]] = await sequelize.query(
    `SELECT
       COUNT(*) FILTER (WHERE payload_json->>'window' = :windowKey)::int AS this_window,
       COUNT(*) FILTER (WHERE created_at >= :since AND status IN ('queued', 'running', 'done'))::int AS today
       FROM pulse_jobs WHERE show_id = :showId AND kind = 'ambient' AND deleted_at IS NULL`,
    { replacements: { showId, windowKey: String(windowKey), since: startOfUtcDay(now) } });
  if (stats.this_window > 0) return [];
  const room = Math.min(PER_WINDOW, ambientRoom({ cap: settings.automated_requests, ambientToday: stats.today }));
  if (room <= 0) return [];

  const moment = await require('./storyClock').presentOrder(db, showId);
  // Only approved voices post on their own (Task #3029).
  const { eligible, isApproved } = require('./pulseVoices');
  const candidates = (await eligible(db, showId, { at: moment })).filter((c) => isApproved(c.voice));
  if (!candidates.length) return [];
  const [recent] = await sequelize.query(
    `SELECT DISTINCT social_profile_id FROM feed_posts
      WHERE show_id = :showId AND deleted_at IS NULL AND social_profile_id IS NOT NULL AND created_at >= :since`,
    { replacements: { showId, since: new Date(now.getTime() - RECENT_HOURS * 60 * 60 * 1000) } });
  const posted = new Set(recent.map((r) => Number(r.social_profile_id)));
  const picks = pickAmbient(
    candidates.filter((c) => !posted.has(Number(c.profile.id)))
      .map((c) => ({ characterId: c.character.id, temperament: c.voice.habits_json?.temperament || 'regular' })),
    windowKey, room);
  const jobs = [];
  for (const p of picks) {
    jobs.push(await queue.enqueue(db, { showId, kind: 'ambient', payload: { character_id: p.characterId, moment, window: String(windowKey) } }));
  }
  return jobs;
}

async function handleAmbient(db, job) {
  const p = job.payload_json || {};
  const blocked = await require('./pulseVoices').automationBlocker(db, p.character_id);
  if (blocked) return { skipped: blocked };
  const { post } = await require('./pulseDrafter').draftAndRoute(db, {
    showId: job.show_id, characterId: p.character_id, moment: p.moment, context: {}, request: { kind: 'ambient', jobId: job.id },
  });
  return { draftIds: [post.id] };
}

function registerHandlers() {
  require('./pulseQueue').register('ambient', handleAmbient);
}

/** Plans every show whose ambient switch is on; returns the jobs queued. */
async function tick(db, now = new Date()) {
  const [shows] = await db.sequelize.query(
    `SELECT id FROM shows WHERE deleted_at IS NULL AND (metadata::jsonb -> 'pulse_engine' ->> 'ambient_enabled') = 'true'`);
  const jobs = [];
  for (const s of shows) {
    try {
      jobs.push(...await planAmbient(db, s.id, now));
    } catch (err) {
      console.error(`[PulseAmbient] planning show ${s.id} failed:`, err);
    }
  }
  return jobs;
}

let timer = null;

/** The hourly ambient planner (app.js starts it with the worker). */
function startScheduler(db = require('../models'), { intervalMs = TICK_MS } = {}) {
  if (timer) return false;
  timer = setInterval(() => {
    tick(db).catch((err) => console.error('[PulseAmbient] the planner failed:', err));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return true;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  WINDOW_HOURS, RECENT_HOURS, PER_WINDOW, RESERVE_FOR_EVENTS, CHANCE,
  windowOf, ambientRoom, pickAmbient, planAmbient, handleAmbient, registerHandlers, tick, startScheduler, stopScheduler,
};

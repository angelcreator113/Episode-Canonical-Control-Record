'use strict';

/**
 * Release time: the second clock (Character Consistency Engine step 6c; the
 * spec's #17 "two-clock model for posts"; Evoni, 2026-10-16: "yes
 * publish/schedule/hold").
 *
 * A post has two independent times. Story time (feed_posts.story_order)
 * places it in LalaVerse: the beat, the script, what Lala can react to; it
 * never changes here. Release time is when the real audience sees it on The
 * Pulse. Approving a draft in Review chooses one of:
 *   publish now   PUT /feed-posts/:id { status: 'live' } (unchanged); it also
 *                 clears any schedule or hold
 *   schedule      release_state 'scheduled', release_at: the release timer
 *                 publishes it when that time comes
 *   hold          release_state 'held': it waits until Evoni releases it
 *
 *   setReleaseTime(post, { mode: 'schedule'|'hold'|'clear', at, now })
 *     a ReleaseError (400/409) when the post is not a draft or the time is
 *     not in the future
 *   releaseDue(db, now)   publishes every scheduled draft whose time has
 *     come, as a release from Review does (posted at its release time; its
 *     numbers and closeness proposed; an edited AI draft teaches the voice).
 *     Returns the ids released.
 *   startScheduler(db)    releaseDue every minute; runs whatever the posting
 *     engine's switch, since Evoni chose each time herself
 *   suggestReleaseTime(db, post, { tzOffset, now })  a release time the story
 *     suggests (Evoni, 2026-10-17: "doesn't the system know a better time
 *     ... and then I can just make adjustments"): from the post's story
 *     time and its episode's air date (a week before for an announcement,
 *     two days before for "before", as it airs for "during", the morning
 *     after for "the day after"...), at a posting hour in Evoni's own time
 *     (tzOffset: the browser's getTimezoneOffset minutes), kept 3 hours
 *     from the poster's other scheduled posts. With no air date, or a time
 *     already past, the next open slot. Returns { at, why }; nothing saved.
 */

const TICK_MS = 60 * 1000;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

class ReleaseError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'ReleaseError'; }
}

/** Sets or clears a draft's release time; returns the post. */
async function setReleaseTime(post, { mode, at = null, now = new Date() } = {}) {
  if (!post) throw new ReleaseError('Post not found.', 404);
  if (post.status !== 'draft' || post.deleted_at) throw new ReleaseError('Only a draft has a release time: a live post is already out.', 409);
  if (mode === 'clear') return post.update({ release_state: null, release_at: null });
  if (mode === 'hold') return post.update({ release_state: 'held', release_at: null });
  if (mode === 'schedule') {
    const when = at instanceof Date ? at : new Date(at);
    if (!at || Number.isNaN(when.getTime())) throw new ReleaseError('Say when it goes live: a date and a time.');
    if (when.getTime() <= now.getTime()) throw new ReleaseError('A scheduled time is in the future. To publish it now, use Release.');
    if (when.getTime() - now.getTime() > MAX_AHEAD_MS) throw new ReleaseError('Schedule it within a year.');
    return post.update({ release_state: 'scheduled', release_at: when });
  }
  throw new ReleaseError('mode is schedule, hold or clear.');
}

/** Publishes the scheduled drafts whose time has come; returns their ids. */
async function releaseDue(db, now = new Date()) {
  const { Op } = require('sequelize');
  const due = await db.FeedPost.findAll({
    where: { status: 'draft', release_state: 'scheduled', release_at: { [Op.lte]: now } },
    order: [['release_at', 'ASC']],
    limit: 50,
  });
  const released = [];
  for (const post of due) {
    try {
      const learn = post.ai_generated && Boolean(post.edited_at);
      await post.update({ status: 'live', posted_at: post.posted_at || post.release_at, release_state: null, release_at: null });
      require('./pulseNumbers').proposeLater(post);
      require('./pulseCloseness').proposeLater(post.id);
      if (learn && post.social_profile_id) {
        await require('./pulseVoices').learnFromEdit(db, { socialProfileId: post.social_profile_id, text: post.content_text, postId: post.id, by: 'scheduled release' });
      }
      released.push(post.id);
    } catch (err) {
      console.error(`[postRelease] the scheduled post ${post.id} could not be released:`, err.message);
    }
  }
  return released;
}

let timer = null;
function startScheduler(db) {
  if (timer) return timer;
  timer = setInterval(() => {
    releaseDue(db).catch((err) => console.error('[postRelease] the release timer failed:', err.message));
  }, TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ── Suggesting a release time ───────────────────────────────────────────────
const HOUR_MS = 60 * 60 * 1000;
const SLOTS = [12, 18, 20];           // posting hours, in Evoni's own time
const GAP_MS = 3 * HOUR_MS;           // one poster's posts stay this far apart
const LATEST_HOUR = 22;
// Story phase (services/storyClock) → days from the air date, hour, and why.
const PHASE_PLAN = {
  1: [-2, 18, 'two days before Episode N airs'],
  2: [-7, 12, 'a week before Episode N airs, when the event is announced'],
  3: [-5, 18, 'five days before Episode N airs, when the invitations go out'],
  4: [0, 9, 'the morning Episode N airs, as Lala arrives'],
  5: [0, null, 'as Episode N airs'],
  7: [0, 21, 'the evening Episode N airs, after it'],
  8: [1, 12, 'the day after Episode N airs'],
  9: [7, 12, 'a week after Episode N airs'],
};

const local = (date, tz) => {
  const d = new Date(date.getTime() - tz * 60000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() };
};
const atLocal = (y, m, d, h, tz, min = 0) => new Date(Date.UTC(y, m, d, h, min) + tz * 60000);

/** The next posting slot at or after `from`. */
function nextSlot(from, tz) {
  const p = local(from, tz);
  for (let day = 0; day < 3; day += 1) {
    for (const h of SLOTS) {
      const t = atLocal(p.y, p.m, p.d + day, h, tz);
      if (t.getTime() >= from.getTime()) return t;
    }
  }
  return atLocal(p.y, p.m, p.d + 1, SLOTS[0], tz);
}

/**
 * `at`, moved later until it is GAP_MS from every one of `taken`: past
 * LATEST_HOUR it goes to the next day's first slot, and a move never lands
 * in the small hours.
 */
function spaced(at, taken, tz) {
  let t = at;
  for (let i = 0; i < 60; i += 1) {
    const clashes = taken.filter((x) => Math.abs(x.getTime() - t.getTime()) < GAP_MS);
    const p = local(t, tz);
    if (!clashes.length && (p.h < LATEST_HOUR || (p.h === LATEST_HOUR && p.min === 0))) return t;
    if (clashes.length) t = new Date(Math.max(...clashes.map((x) => x.getTime())) + GAP_MS);
    const q = local(t, tz);
    if (q.h > LATEST_HOUR || (q.h === LATEST_HOUR && q.min > 0)) t = atLocal(q.y, q.m, q.d + 1, SLOTS[0], tz);
    else if (clashes.length && q.h < SLOTS[0]) t = atLocal(q.y, q.m, q.d, SLOTS[0], tz);
  }
  return t;
}

/**
 * The pure part: { at: Date, why } from the story order, the episode's air
 * date (or null), the poster's other scheduled times, now and the offset.
 */
function suggestTime({ order = null, airDate = null, taken = [], now = new Date(), tzOffset = 0 }) {
  const soonest = new Date(now.getTime() + HOUR_MS);
  const ep = Number.isInteger(order) ? Math.floor(order / 10) : null;
  const plan = Number.isInteger(order) ? PHASE_PLAN[order % 10] : null;
  let target = null;
  let why = null;
  if (ep && plan && airDate) {
    const air = new Date(airDate);
    const [days, hour, words] = plan;
    // A date with no time is stored as midnight UTC: its calendar day is the
    // UTC one (in her own time it would read as the evening before).
    const dateOnly = air.getUTCHours() === 0 && air.getUTCMinutes() === 0;
    const a = dateOnly ? local(air, 0) : local(air, tz(tzOffset));
    const airHasTime = !dateOnly;
    target = hour === null && airHasTime ? air : atLocal(a.y, a.m, a.d + days, hour === null ? 19 : hour, tz(tzOffset));
    why = words.replace('Episode N', `Episode ${ep}`);
  }
  if (!target || target.getTime() < soonest.getTime()) {
    why = target
      ? `the next open time: ${why} has already passed`
      : ep && plan
        ? `the next open time: Episode ${ep} has no air date yet`
        : 'the next open time';
    target = nextSlot(soonest, tz(tzOffset));
  }
  const at = spaced(target, taken.map((x) => new Date(x)), tz(tzOffset));
  if (at.getTime() !== target.getTime()) why += ', moved to keep it apart from their other scheduled posts';
  return { at, why: why.charAt(0).toUpperCase() + why.slice(1) };
}
const tz = (offset) => (Number.isFinite(Number(offset)) ? Math.max(-840, Math.min(840, Number(offset))) : 0);

async function suggestReleaseTime(db, post, { tzOffset = 0, now = new Date() } = {}) {
  if (!post) throw new ReleaseError('Post not found.', 404);
  if (post.status !== 'draft' || post.deleted_at) throw new ReleaseError('Only a draft has a release time: a live post is already out.', 409);
  const clock = require('./storyClock');
  let episode = null;
  if (post.episode_id) {
    [[episode]] = await db.sequelize.query('SELECT episode_number, air_date, show_id FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: post.episode_id } });
  }
  const order = clock.postOrder(post, episode?.episode_number ?? null);
  let airDate = null;
  const number = Number.isInteger(order) ? Math.floor(order / 10) : null;
  const showId = post.show_id || episode?.show_id || null;
  if (number && showId) {
    const [[row]] = await db.sequelize.query(
      'SELECT air_date FROM episodes WHERE show_id = :showId AND episode_number = :number AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
      { replacements: { showId, number } });
    airDate = row?.air_date || null;
  }
  let taken = [];
  if (post.social_profile_id) {
    const [rows] = await db.sequelize.query(
      `SELECT release_at FROM feed_posts WHERE social_profile_id = :pid AND id <> :id AND status = 'draft'
          AND release_state = 'scheduled' AND release_at IS NOT NULL AND deleted_at IS NULL`,
      { replacements: { pid: post.social_profile_id, id: post.id } });
    taken = rows.map((r) => r.release_at);
  }
  const { at, why } = suggestTime({ order, airDate, taken, now, tzOffset });
  return { at: at.toISOString(), why };
}

module.exports = { ReleaseError, setReleaseTime, releaseDue, startScheduler, stopScheduler, suggestReleaseTime, suggestTime, TICK_MS };

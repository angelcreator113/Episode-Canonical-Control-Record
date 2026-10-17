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
 *     already past, the next open slot, then kept inside its story-order
 *     guards. Returns { at, why, problems }; nothing saved.
 *   guardsFor / problemsAt / checkReleaseTime  the story-order guards on a
 *     release time (a load-bearing post before its episode airs; nothing
 *     that happens in an episode before it airs; a reply after its post;
 *     nothing before its reveal), as sentences of what a time breaks
 *   planReleases(db, { showId, tzOffset })  "schedule all": every draft with
 *     no release time, each at its suggested time, in story order; saved
 *     only by scheduleAll(db, items, { anyway }), which skips a time that
 *     breaks the guards unless `anyway`
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

/** When Episode `number` of the show airs (its air_date), or null. */
async function airDateOf(db, showId, number) {
  if (!showId || !Number.isInteger(number) || number < 1) return null;
  const [[row]] = await db.sequelize.query(
    'SELECT air_date FROM episodes WHERE show_id = :showId AND episode_number = :number AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
    { replacements: { showId, number } });
  return row?.air_date || null;
}

/** The post's story order, show and episode's air date. */
async function storyOf(db, post) {
  const clock = require('./storyClock');
  let episode = null;
  if (post.episode_id) {
    [[episode]] = await db.sequelize.query('SELECT episode_number, air_date, show_id FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: post.episode_id } });
  }
  const order = clock.postOrder(post, episode?.episode_number ?? null);
  const number = Number.isInteger(order) ? Math.floor(order / 10) : null;
  const showId = post.show_id || episode?.show_id || null;
  return { order, number, showId, airDate: await airDateOf(db, showId, number) };
}

/** The poster's other scheduled release times. */
async function takenBy(db, post) {
  if (!post.social_profile_id) return [];
  const [rows] = await db.sequelize.query(
    `SELECT release_at FROM feed_posts WHERE social_profile_id = :pid AND id <> :id AND status = 'draft'
        AND release_state = 'scheduled' AND release_at IS NOT NULL AND deleted_at IS NULL`,
    { replacements: { pid: post.social_profile_id, id: post.id } });
  return rows.map((r) => new Date(r.release_at));
}

// ── Story-order guards (Evoni, 2026-10-17: "Yes I want them all") ───────────
// A release time keeps the story's order for the real audience:
//   - a load-bearing post goes out before its episode airs (the story reacts
//     to it, so it is seen first);
//   - a post that happens during its episode or after it does not go out
//     before the episode airs (it would give the episode away);
//   - a reply goes out after the post it answers;
//   - a post, or a character's posts, with a reveal wait for the reveal.
// guardsFor returns { notBefore: [{ at, why }], notAfter: [{ at, why }],
// open: [why] }: open is a rule that cannot be timed yet (the post it
// answers is not scheduled; the reveal's episode has no air date).
const REPLY_GAP_MS = 15 * 60 * 1000;

/** When the episode airs: its air date's time; a date with no time, the start of that day in her time. */
function airTime(airDate, tzOffset) {
  if (!airDate) return null;
  const air = new Date(airDate);
  if (Number.isNaN(air.getTime())) return null;
  if (air.getUTCHours() !== 0 || air.getUTCMinutes() !== 0) return air;
  const a = local(air, 0);
  return atLocal(a.y, a.m, a.d, 0, tz(tzOffset));
}

/** The real time a story moment comes: the release time its phase plans from the air date; null when unknown. */
function momentTime(order, airDate, tzOffset) {
  if (!Number.isInteger(order) || !airDate) return null;
  const phase = order % 10;
  if (phase >= 5) return airTime(airDate, tzOffset);
  const plan = PHASE_PLAN[phase];
  if (!plan) return null;
  const air = new Date(airDate);
  const dateOnly = air.getUTCHours() === 0 && air.getUTCMinutes() === 0;
  const a = local(air, dateOnly ? 0 : tz(tzOffset));
  return atLocal(a.y, a.m, a.d + plan[0], plan[1], tz(tzOffset));
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sat 24 Oct, 18:00" in her own time. */
function when(date, tzOffset) {
  const d = new Date(date.getTime() - tz(tzOffset) * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * The guards on this post's release time. `story` is storyOf(post);
 * `planned` maps post id → a release time chosen in the same batch (a reply
 * whose post is being scheduled with it).
 */
async function guardsFor(db, post, { story, tzOffset = 0, planned = new Map() } = {}) {
  const clock = require('./storyClock');
  const s = story || await storyOf(db, post);
  const guards = { notBefore: [], notAfter: [], open: [] };
  const air = airTime(s.airDate, tzOffset);
  const ep = s.number ? `Episode ${s.number}` : null;
  if (post.post_weight === 'load_bearing' && air) {
    guards.notAfter.push({ at: air, why: `it is load-bearing, so it goes out before ${ep} airs (${when(air, tzOffset)})` });
  }
  if (Number.isInteger(s.order) && s.order % 10 >= 5 && air) {
    guards.notBefore.push({ at: air, why: `it happens ${clock.label(s.order)}, so it waits until ${ep} airs (${when(air, tzOffset)})` });
  }

  if (post.parent_post_id) {
    const parent = await db.FeedPost.findByPk(post.parent_post_id);
    if (parent && !parent.deleted_at) {
      const who = parent.poster_handle ? `@${String(parent.poster_handle).replace(/^@+/, '')}'s post` : 'the post it answers';
      const at = planned.get(parent.id) || (parent.status === 'draft' && parent.release_state === 'scheduled' ? parent.release_at : null);
      if (at) {
        guards.notBefore.push({ at: new Date(new Date(at).getTime() + REPLY_GAP_MS), why: `it answers ${who}, which goes out ${when(new Date(at), tzOffset)}` });
      } else if (parent.status === 'draft') {
        guards.open.push(`it answers ${who}, which is not scheduled yet: schedule that one first`);
      }
    }
  }

  if (db.PulseReveal && s.showId) {
    const { Op } = require('sequelize');
    const items = [{ item_type: 'post', item_id: String(post.id) }];
    if (post.social_profile_id) items.push({ item_type: 'character', item_id: String(post.social_profile_id) });
    const reveals = await db.PulseReveal.findAll({ where: { show_id: s.showId, [Op.or]: items }, raw: true });
    const orders = reveals.length ? await require('./pulseReveals').resolveOrders(db, reveals) : [];
    for (let i = 0; i < reveals.length; i += 1) {
      const order = orders[i];
      if (!Number.isInteger(order)) continue;
      const what = reveals[i].item_type === 'post' ? 'it is revealed' : `${post.poster_handle ? `@${String(post.poster_handle).replace(/^@+/, '')}` : 'its poster'} is revealed`;
      const number = Math.floor(order / 10);
      const at = momentTime(order, await airDateOf(db, s.showId, number), tzOffset);
      if (at) guards.notBefore.push({ at, why: `${what} ${clock.label(order)} (${when(at, tzOffset)})` });
      else guards.open.push(`${what} ${clock.label(order)}, and Episode ${number} has no air date yet`);
    }
  }
  return guards;
}

/** What breaks the guards at this time, as sentences; [] when nothing does. */
function problemsAt(guards, at) {
  const t = new Date(at).getTime();
  const out = [];
  for (const g of guards.notBefore) if (t < g.at.getTime()) out.push(`Too early: ${g.why}.`);
  for (const g of guards.notAfter) if (t >= g.at.getTime()) out.push(`Too late: ${g.why}.`);
  for (const why of guards.open) out.push(`Check the order: ${why}.`);
  return out;
}

/** `at` moved into the guards' window when it can be: no earlier than every notBefore, before every notAfter. */
function fitTime(guards, at, now, tzOffset) {
  let t = at;
  const earliest = Math.max(...guards.notBefore.map((g) => g.at.getTime()), -Infinity);
  if (t.getTime() < earliest) t = new Date(earliest);
  const latest = Math.min(...guards.notAfter.map((g) => g.at.getTime()), Infinity);
  if (t.getTime() >= latest) {
    // The last posting slot before it, not in the past.
    const p = local(new Date(latest - 1), tz(tzOffset));
    const options = [];
    for (let day = 0; day < 3; day += 1) for (const h of SLOTS) options.push(atLocal(p.y, p.m, p.d - day, h, tz(tzOffset)));
    const fit = options.filter((o) => o.getTime() < latest && o.getTime() >= Math.max(earliest, now.getTime() + HOUR_MS)).sort((a, b) => b - a)[0];
    if (fit) t = fit;
  }
  return t;
}

/** One post's suggested release time inside its guards: { at, why, problems }. */
async function planOne(db, post, { tzOffset = 0, now = new Date(), taken = null, planned = new Map() } = {}) {
  const story = await storyOf(db, post);
  const others = taken || await takenBy(db, post);
  const s = suggestTime({ order: story.order, airDate: story.airDate, taken: others, now, tzOffset });
  const guards = await guardsFor(db, post, { story, tzOffset, planned });
  let at = s.at;
  let { why } = s;
  const fitted = fitTime(guards, at, now, tzOffset);
  if (fitted.getTime() !== at.getTime()) {
    at = spaced(fitted, others, tz(tzOffset));
    why += '; moved to keep the story in order';
  }
  return { at, why, problems: problemsAt(guards, at), story };
}

async function suggestReleaseTime(db, post, { tzOffset = 0, now = new Date() } = {}) {
  if (!post) throw new ReleaseError('Post not found.', 404);
  if (post.status !== 'draft' || post.deleted_at) throw new ReleaseError('Only a draft has a release time: a live post is already out.', 409);
  const { at, why, problems } = await planOne(db, post, { tzOffset, now });
  return { at: at.toISOString(), why, problems };
}

/** What breaks the story order if this post goes out at `at` (for scheduling one post). */
async function checkReleaseTime(db, post, at, { tzOffset = 0 } = {}) {
  return problemsAt(await guardsFor(db, post, { tzOffset }), at);
}

const PLAN_LIMIT = 100;

/**
 * "Schedule all" (Evoni, 2026-10-17): every draft of the show with no
 * release time yet, each at the time the story suggests, in story order so
 * a reply is planned after the post it answers and one poster's posts stay
 * apart. Returns { items: [{ post_id, handle, text, story, at, why,
 * problems }], total }. Nothing is saved: she adjusts, then applies.
 */
async function planReleases(db, { showId, tzOffset = 0, now = new Date() } = {}) {
  if (!showId) throw new ReleaseError('show_id is required.');
  const clock = require('./storyClock');
  const drafts = await db.FeedPost.findAll({
    where: { show_id: showId, status: 'draft', release_state: null, deleted_at: null },
    order: [['created_at', 'ASC']],
    limit: PLAN_LIMIT,
  });
  const withStory = [];
  for (const post of drafts) withStory.push({ post, story: await storyOf(db, post) });
  // Story order first (unknown last); a reply after the post it answers.
  const rank = (e) => (Number.isInteger(e.story.order) ? e.story.order : Number.MAX_SAFE_INTEGER);
  withStory.sort((a, b) => rank(a) - rank(b));
  const ids = new Set(drafts.map((p) => p.id));
  const placed = new Set();
  const ordered = [];
  const place = (entry, seen = new Set()) => {
    if (placed.has(entry.post.id) || seen.has(entry.post.id)) return;
    seen.add(entry.post.id);
    const parent = entry.post.parent_post_id && ids.has(entry.post.parent_post_id) ? withStory.find((e) => e.post.id === entry.post.parent_post_id) : null;
    if (parent) place(parent, seen);
    placed.add(entry.post.id);
    ordered.push(entry);
  };
  withStory.forEach((e) => place(e));

  const planned = new Map();
  const takenByPoster = new Map();
  const items = [];
  for (const { post, story } of ordered) {
    const key = post.social_profile_id || null;
    if (key && !takenByPoster.has(key)) takenByPoster.set(key, await takenBy(db, post));
    const taken = key ? takenByPoster.get(key) : [];
    const { at, why, problems } = await planOne(db, post, { tzOffset, now, taken, planned });
    planned.set(post.id, at);
    if (key) taken.push(at);
    items.push({
      post_id: post.id,
      handle: post.poster_handle || null,
      text: String(post.content_text || '').slice(0, 140),
      story: clock.label(story.order),
      post_weight: post.post_weight || null,
      at: at.toISOString(),
      why,
      problems,
    });
  }
  return { items, total: items.length };
}

/**
 * Applies a plan: schedules each { post_id, at } in turn. A time that breaks
 * the story order is skipped with its problems unless `anyway`. Returns
 * { scheduled: [id], skipped: [{ post_id, problems }], failed: [{ post_id, error }] }.
 */
async function scheduleAll(db, items, { tzOffset = 0, now = new Date(), anyway = false } = {}) {
  if (!Array.isArray(items) || !items.length) throw new ReleaseError('Nothing to schedule.');
  if (items.length > PLAN_LIMIT) throw new ReleaseError(`Schedule at most ${PLAN_LIMIT} at a time.`);
  const planned = new Map(items.filter((i) => i && i.post_id && i.at).map((i) => [i.post_id, new Date(i.at)]));
  const result = { scheduled: [], skipped: [], failed: [] };
  for (const item of items) {
    const id = item?.post_id;
    try {
      const post = id ? await db.FeedPost.findByPk(id) : null;
      if (!anyway && post && post.status === 'draft' && !post.deleted_at && item.at) {
        const problems = problemsAt(await guardsFor(db, post, { tzOffset, planned }), item.at);
        if (problems.length) { result.skipped.push({ post_id: id, problems }); continue; }
      }
      await setReleaseTime(post, { mode: 'schedule', at: item.at, now });
      result.scheduled.push(id);
    } catch (err) {
      if (!(err instanceof ReleaseError)) console.error(`[postRelease] the post ${id} could not be scheduled:`, err.message);
      result.failed.push({ post_id: id || null, error: err.message });
    }
  }
  return result;
}

module.exports = {
  ReleaseError, setReleaseTime, releaseDue, startScheduler, stopScheduler, suggestReleaseTime, suggestTime,
  guardsFor, problemsAt, fitTime, momentTime, checkReleaseTime, planReleases, scheduleAll, TICK_MS,
};

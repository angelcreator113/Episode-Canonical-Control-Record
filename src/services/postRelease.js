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
 *   A poster's schedule (social_profiles.posting_schedule, services/
 *     postingSchedule; Evoni, 2026-10-18): when they have one, the suggested
 *     time moves to the first time on their days and in their windows (and
 *     under their posts a week), still inside the story guards and the
 *     Feed's rhythm; the why says "on their schedule (Tue/Thu mornings)".
 *     No schedule, no change.
 *   A poster's rhythm: the suggestions use her own posting hours once
 *     learned (releaseHabits; learnReleaseTime counts every hour she
 *     schedules at, overall and per story phase) and keep one poster's posts
 *     apart by their voice's temperament (an oversharer 2 hours, a lurker a
 *     day)
 *   releaseCalendar(db, { showId, from, to })  the scheduled drafts by
 *     time, for the release calendar (drag a post to another day)
 *   The Feed's rhythm: whoever posts, scheduled and planned posts stay an
 *     hour apart, at most four a day (then the next day); a draft's own
 *     suggestion is its place in the Schedule all plan, so two cards never
 *     suggest the same time
 *   shiftForAirDate(db, { showId, episodeNumber, from, to })  an episode's
 *     air date moved: its scheduled drafts move by the same amount; one that
 *     would land in the past is held
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

// A poster's rhythm (Evoni, 2026-10-17, "Yes I want them all"): the posting
// hours (hers once learned, see releaseHabits), how far apart one poster's
// posts stay (by the voice's temperament: an oversharer posts often, a
// lurker rarely), and the hour she has settled on for a story phase.
const TEMPERAMENT_GAP_MS = { oversharer: 2 * HOUR_MS, regular: GAP_MS, lurker: 24 * HOUR_MS };
const DEFAULT_RHYTHM = Object.freeze({ slots: SLOTS, gapMs: GAP_MS, phaseHours: {} });
const rhythmOf = (r) => ({
  slots: Array.isArray(r?.slots) && r.slots.length ? [...r.slots].sort((a, b) => a - b) : SLOTS,
  gapMs: Number.isFinite(r?.gapMs) && r.gapMs > 0 ? r.gapMs : GAP_MS,
  phaseHours: r?.phaseHours && typeof r.phaseHours === 'object' ? r.phaseHours : {},
});

/** The next posting slot at or after `from`. */
function nextSlot(from, tz, slots = SLOTS) {
  const p = local(from, tz);
  for (let day = 0; day < 3; day += 1) {
    for (const h of slots) {
      const t = atLocal(p.y, p.m, p.d + day, h, tz);
      if (t.getTime() >= from.getTime()) return t;
    }
  }
  return atLocal(p.y, p.m, p.d + 1, slots[0], tz);
}

/**
 * `at`, moved later until it is the gap from every one of `taken`: past
 * LATEST_HOUR it goes to the next day's first slot, and a move never lands
 * in the small hours.
 */
function spaced(at, taken, tz, { slots = SLOTS, gapMs = GAP_MS } = {}) {
  let t = at;
  for (let i = 0; i < 60; i += 1) {
    const clashes = taken.filter((x) => Math.abs(x.getTime() - t.getTime()) < gapMs);
    const p = local(t, tz);
    if (!clashes.length && (p.h < LATEST_HOUR || (p.h === LATEST_HOUR && p.min === 0))) return t;
    if (clashes.length) t = new Date(Math.max(...clashes.map((x) => x.getTime())) + gapMs);
    const q = local(t, tz);
    if (q.h > LATEST_HOUR || (q.h === LATEST_HOUR && q.min > 0)) t = atLocal(q.y, q.m, q.d + 1, slots[0], tz);
    else if (clashes.length && q.h < slots[0]) t = atLocal(q.y, q.m, q.d, slots[0], tz);
  }
  return t;
}

/**
 * The pure part: { at: Date, why } from the story order, the episode's air
 * date (or null), the poster's other scheduled times, now and the offset.
 */
function suggestTime({ order = null, airDate = null, taken = [], now = new Date(), tzOffset = 0, rhythm = DEFAULT_RHYTHM }) {
  const r = rhythmOf(rhythm);
  const soonest = new Date(now.getTime() + HOUR_MS);
  const ep = Number.isInteger(order) ? Math.floor(order / 10) : null;
  const plan = Number.isInteger(order) ? PHASE_PLAN[order % 10] : null;
  let target = null;
  let why = null;
  if (ep && plan && airDate) {
    const air = new Date(airDate);
    const [days, planned, words] = plan;
    // The hour she has settled on for this phase, once she has (releaseHabits).
    const learned = r.phaseHours[order % 10];
    const hour = planned === null ? null : (Number.isInteger(learned) ? learned : planned);
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
    target = nextSlot(soonest, tz(tzOffset), r.slots);
  }
  const at = spaced(target, taken.map((x) => new Date(x)), tz(tzOffset), r);
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
function fitTime(guards, at, now, tzOffset, slots = SLOTS) {
  let t = at;
  const earliest = Math.max(...guards.notBefore.map((g) => g.at.getTime()), -Infinity);
  if (t.getTime() < earliest) t = new Date(earliest);
  const latest = Math.min(...guards.notAfter.map((g) => g.at.getTime()), Infinity);
  if (t.getTime() >= latest) {
    // The last posting slot before it, not in the past.
    const p = local(new Date(latest - 1), tz(tzOffset));
    const options = [];
    for (let day = 0; day < 3; day += 1) for (const h of slots) options.push(atLocal(p.y, p.m, p.d - day, h, tz(tzOffset)));
    const fit = options.filter((o) => o.getTime() < latest && o.getTime() >= Math.max(earliest, now.getTime() + HOUR_MS)).sort((a, b) => b - a)[0];
    if (fit) t = fit;
  }
  return t;
}

/** One post's suggested release time inside its guards: { at, why, problems }. */
// ── Learning her hours (Evoni, 2026-10-17) ──────────────────────────────────
// Every time she schedules a post, the hour she chose (in her own time) is
// counted for the show, overall and for the post's story phase, under
// shows.metadata.pulse_release. Once she has scheduled LEARN_MIN posts the
// suggestions use her three most-chosen hours; once one hour wins a phase
// PHASE_MIN times (and at least half the time), that phase is planned at it.
const LEARN_MIN = 5;
const PHASE_MIN = 3;

/** The show's learned posting habits: { slots, phaseHours, learned }. */
async function releaseHabits(db, showId) {
  const none = { slots: SLOTS, phaseHours: {}, learned: 0 };
  if (!showId) return none;
  const [[row]] = await db.sequelize.query("SELECT metadata->'pulse_release' AS habits FROM shows WHERE id = :showId", { replacements: { showId } });
  const saved = row?.habits && typeof row.habits === 'object' ? row.habits : {};
  const counts = (obj) => Object.entries(obj && typeof obj === 'object' ? obj : {})
    .map(([h, n]) => [Number(h), Number(n)]).filter(([h, n]) => Number.isInteger(h) && h >= 0 && h <= LATEST_HOUR && n > 0);
  const hours = counts(saved.hours);
  const learned = hours.reduce((sum, [, n]) => sum + n, 0);
  const slots = learned >= LEARN_MIN
    ? hours.sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, SLOTS.length).map(([h]) => h).sort((a, b) => a - b)
    : SLOTS;
  const phaseHours = {};
  for (const [phase, byHour] of Object.entries(saved.phase_hours && typeof saved.phase_hours === 'object' ? saved.phase_hours : {})) {
    const list = counts(byHour).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const total = list.reduce((sum, [, n]) => sum + n, 0);
    if (list.length && list[0][1] >= PHASE_MIN && list[0][1] * 2 >= total) phaseHours[phase] = list[0][0];
  }
  return { slots, phaseHours, learned };
}

/** Counts the hour she chose for this post (her own time), overall and for its story phase. Never throws. */
async function learnReleaseTime(db, post, at, { tzOffset = 0 } = {}) {
  try {
    const { showId, order } = await storyOf(db, post);
    if (!showId) return;
    const hour = String(local(new Date(at), tz(tzOffset)).h);
    const [[row]] = await db.sequelize.query("SELECT metadata->'pulse_release' AS habits FROM shows WHERE id = :showId", { replacements: { showId } });
    const saved = row?.habits && typeof row.habits === 'object' ? row.habits : {};
    const hours = { ...(saved.hours || {}) };
    hours[hour] = (Number(hours[hour]) || 0) + 1;
    const phaseHours = { ...(saved.phase_hours || {}) };
    if (Number.isInteger(order)) {
      const phase = String(order % 10);
      phaseHours[phase] = { ...(phaseHours[phase] || {}) };
      phaseHours[phase][hour] = (Number(phaseHours[phase][hour]) || 0) + 1;
    }
    // One statement on the one key: other metadata (pulse_engine, …) is never rewritten.
    await db.sequelize.query(
      `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{pulse_release}', CAST(:habits AS jsonb))::json
        WHERE id = :showId`,
      { replacements: { showId, habits: JSON.stringify({ ...saved, hours, phase_hours: phaseHours }) } });
  } catch (err) {
    console.error('[postRelease] her chosen hour could not be learned:', err.message);
  }
}

/** The poster's rhythm: the show's learned hours, their voice's temperament and their posting schedule. */
async function rhythmFor(db, post, habits) {
  let temperament = 'regular';
  let schedule = null;
  if (post.social_profile_id && db.PulseVoice) {
    const voice = await db.PulseVoice.findOne({ where: { social_profile_id: post.social_profile_id }, attributes: ['habits_json'] });
    temperament = voice?.habits_json?.temperament || 'regular';
  }
  if (post.social_profile_id) {
    try {
      const [[row]] = await db.sequelize.query('SELECT posting_schedule FROM social_profiles WHERE id = :id', { replacements: { id: post.social_profile_id } });
      const raw = row?.posting_schedule;
      schedule = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch (err) {
      console.error('[postRelease] their posting schedule could not be read; suggesting without it:', err.message);
    }
  }
  return { slots: habits.slots, phaseHours: habits.phaseHours, gapMs: TEMPERAMENT_GAP_MS[temperament] || GAP_MS, temperament, schedule };
}

// The Feed's own rhythm (Evoni, 2026-10-17: "its giving me the same date and
// time ... same day"): whoever posts, two posts stay SHOW_GAP_MS apart and a
// day holds at most SHOW_PER_DAY; past that, the next day.
const SHOW_GAP_MS = HOUR_MS;
const SHOW_PER_DAY = 4;

/** The show's other scheduled release times (every poster). */
async function showTakenFor(db, showId, excludeId = null) {
  if (!showId) return [];
  const [rows] = await db.sequelize.query(
    `SELECT release_at FROM feed_posts WHERE show_id = :showId AND status = 'draft' AND release_state = 'scheduled'
        AND release_at IS NOT NULL AND deleted_at IS NULL ${excludeId ? 'AND id <> :excludeId' : ''}`,
    { replacements: { showId, excludeId } });
  return rows.map((r) => new Date(r.release_at));
}

/** `at` moved later until the poster's own gap and the Feed's gap and daily limit all hold. */
function spreadOnFeed(at, posterTaken, showTaken, tzMinutes, rhythm) {
  const r = rhythmOf(rhythm);
  const dayOf = (d) => { const p = local(d, tzMinutes); return `${p.y}-${p.m}-${p.d}`; };
  let t = at;
  for (let i = 0; i < 20; i += 1) {
    let next = spaced(t, posterTaken, tzMinutes, r);
    next = spaced(next, showTaken, tzMinutes, { slots: r.slots, gapMs: SHOW_GAP_MS });
    if (showTaken.filter((x) => dayOf(x) === dayOf(next)).length >= SHOW_PER_DAY) {
      const p = local(next, tzMinutes);
      next = atLocal(p.y, p.m, p.d + 1, r.slots[0], tzMinutes);
    }
    if (next.getTime() === t.getTime()) return t;
    t = next;
  }
  return t;
}

/** The first time on the poster's schedule at or after `at` that keeps the Feed's gap and daily limit. */
function scheduleFit(rhythm, at, posterTaken, showTaken, tzOffset) {
  const ps = require('./postingSchedule');
  const zone = tz(tzOffset);
  const dayOf = (d) => { const p = local(d, zone); return `${p.y}-${p.m}-${p.d}`; };
  let from = at;
  for (let i = 0; i < 40; i += 1) {
    const t = ps.nextSlot(rhythm.schedule, { after: from, tzOffset: zone, taken: posterTaken, gapMs: rhythmOf(rhythm).gapMs });
    if (!t) return null;
    const near = showTaken.filter((x) => Math.abs(x.getTime() - t.getTime()) < SHOW_GAP_MS);
    if (near.length) { from = new Date(Math.max(...near.map((x) => x.getTime())) + SHOW_GAP_MS); continue; }
    if (showTaken.filter((x) => dayOf(x) === dayOf(t)).length >= SHOW_PER_DAY) {
      const p = local(t, zone);
      from = atLocal(p.y, p.m, p.d + 1, 0, zone);
      continue;
    }
    return t;
  }
  return null;
}

async function planOne(db, post, { tzOffset = 0, now = new Date(), taken = null, planned = new Map(), rhythm = null, showTaken = null } = {}) {
  const story = await storyOf(db, post);
  const others = taken || await takenBy(db, post);
  const feed = showTaken || await showTakenFor(db, story.showId, post.id);
  const r = rhythm || await rhythmFor(db, post, await releaseHabits(db, story.showId));
  const s = suggestTime({ order: story.order, airDate: story.airDate, taken: others, now, tzOffset, rhythm: r });
  const guards = await guardsFor(db, post, { story, tzOffset, planned });
  let at = s.at;
  let { why } = s;
  if (Number.isInteger(story.order) && Number.isInteger(r.phaseHours?.[story.order % 10]) && story.airDate) why += ', at the hour you usually choose';
  const fitted = fitTime(guards, at, now, tzOffset, rhythmOf(r).slots);
  if (fitted.getTime() !== at.getTime()) {
    at = spaced(fitted, others, tz(tzOffset), rhythmOf(r));
    why += '; moved to keep the story in order';
  }
  const onFeed = spreadOnFeed(at, others, feed, tz(tzOffset), r);
  if (onFeed.getTime() !== at.getTime()) {
    at = onFeed;
    why += '; moved so The Pulse is not crowded';
  }
  // Their posting schedule (services/postingSchedule; Evoni, 2026-10-18):
  // the first time on their days, in their windows, at or after the time
  // above, still the Feed's gap and daily limit from everyone else; kept only
  // when it breaks no story guard.
  if (r.schedule) {
    const onSchedule = scheduleFit(r, at, others, feed, tzOffset);
    if (onSchedule && !problemsAt(guards, onSchedule).length) {
      if (onSchedule.getTime() !== at.getTime()) at = onSchedule;
      why += `; on their schedule (${require('./postingSchedule').describe(r.schedule)})`;
    } else {
      why += '; their schedule has no open time that keeps the story in order';
    }
  }
  return { at, why, problems: problemsAt(guards, at), story };
}

async function suggestReleaseTime(db, post, { tzOffset = 0, now = new Date() } = {}) {
  if (!post) throw new ReleaseError('Post not found.', 404);
  if (post.status !== 'draft' || post.deleted_at) throw new ReleaseError('Only a draft has a release time: a live post is already out.', 409);
  // A draft with no release time takes its place in the same plan as
  // "Schedule all", so each card suggests its own time, in story order,
  // never the one the next card suggests (Evoni, 2026-10-17).
  if (!post.release_state && post.show_id) {
    const { items } = await planReleases(db, { showId: post.show_id, tzOffset, now });
    const mine = items.find((i) => i.post_id === post.id);
    if (mine) return { at: mine.at, why: mine.why, problems: mine.problems };
  }
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
  const showTaken = await showTakenFor(db, showId);
  const habits = await releaseHabits(db, showId);
  const rhythmByPoster = new Map();
  const items = [];
  for (const { post, story } of ordered) {
    const key = post.social_profile_id || null;
    if (key && !takenByPoster.has(key)) takenByPoster.set(key, await takenBy(db, post));
    const taken = key ? takenByPoster.get(key) : [];
    if (!rhythmByPoster.has(key)) rhythmByPoster.set(key, await rhythmFor(db, post, habits));
    const { at, why, problems } = await planOne(db, post, { tzOffset, now, taken, planned, rhythm: rhythmByPoster.get(key), showTaken });
    planned.set(post.id, at);
    if (key) taken.push(at);
    showTaken.push(at);
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
      await learnReleaseTime(db, post, item.at, { tzOffset });
      result.scheduled.push(id);
    } catch (err) {
      if (!(err instanceof ReleaseError)) console.error(`[postRelease] the post ${id} could not be scheduled:`, err.message);
      result.failed.push({ post_id: id || null, error: err.message });
    }
  }
  return result;
}

/**
 * The release calendar (Evoni, 2026-10-17): the show's scheduled drafts
 * between `from` and `to` (default: the next five weeks), soonest first,
 * with their story time. Returns [{ post_id, handle, text, story,
 * post_weight, release_at }].
 */
async function releaseCalendar(db, { showId, from = new Date(), to = null } = {}) {
  if (!showId) throw new ReleaseError('show_id is required.');
  const start = new Date(from);
  const end = to ? new Date(to) : new Date(start.getTime() + 35 * 24 * HOUR_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new ReleaseError('from and to are dates, from before to.');
  const { Op } = require('sequelize');
  const clock = require('./storyClock');
  const posts = await db.FeedPost.findAll({
    where: { show_id: showId, status: 'draft', release_state: 'scheduled', deleted_at: null, release_at: { [Op.gte]: start, [Op.lt]: end } },
    order: [['release_at', 'ASC']],
    limit: 300,
  });
  const out = [];
  for (const post of posts) {
    const { order } = await storyOf(db, post);
    out.push({
      post_id: post.id,
      handle: post.poster_handle || null,
      text: String(post.content_text || '').slice(0, 100),
      story: clock.label(order),
      post_weight: post.post_weight || null,
      release_at: post.release_at.toISOString(),
    });
  }
  return out;
}

/**
 * An episode's air date moved (Evoni, 2026-10-17): every scheduled draft of
 * that episode moves with it, by the same amount, so a post planned "two
 * days before it airs" still is. One that would land in the past (or within
 * the next minute) is held instead, for her to release or reschedule.
 * Returns { shifted: [id], held: [id] }.
 */
async function shiftForAirDate(db, { showId, episodeNumber, from, to, now = new Date() }) {
  const result = { shifted: [], held: [] };
  const a = from ? new Date(from) : null;
  const b = to ? new Date(to) : null;
  if (!showId || !Number.isInteger(episodeNumber) || !a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return result;
  const delta = b.getTime() - a.getTime();
  if (!delta) return result;
  const clock = require('./storyClock');
  const posts = await db.FeedPost.findAll({ where: { show_id: showId, status: 'draft', release_state: 'scheduled', deleted_at: null }, limit: 500 });
  for (const post of posts) {
    const { order } = await storyOf(db, post);
    if (!Number.isInteger(order) || Math.floor(order / 10) !== episodeNumber || !post.release_at) continue;
    const moved = new Date(new Date(post.release_at).getTime() + delta);
    if (moved.getTime() <= now.getTime() + 60 * 1000) {
      await post.update({ release_state: 'held', release_at: null });
      result.held.push(post.id);
    } else {
      await post.update({ release_at: moved });
      result.shifted.push(post.id);
    }
  }
  if (result.shifted.length || result.held.length) {
    console.log(`[postRelease] ${clock.label(clock.orderOf(episodeNumber))}: air date moved; ${result.shifted.length} scheduled posts moved with it, ${result.held.length} held`);
  }
  return result;
}

module.exports = {
  ReleaseError, setReleaseTime, releaseDue, startScheduler, stopScheduler, suggestReleaseTime, suggestTime,
  guardsFor, problemsAt, fitTime, momentTime, checkReleaseTime, planReleases, scheduleAll,
  releaseHabits, learnReleaseTime, shiftForAirDate, releaseCalendar, TICK_MS,
};

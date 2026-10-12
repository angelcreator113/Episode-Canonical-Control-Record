'use strict';

/**
 * Post numbers on The Pulse (Task #2953; The Pulse spec §8;
 * docs/reads/2026-10-12-pulse-numbers-read.md §2). When a post goes live its
 * likes and shares are proposed from stated factors:
 *
 *   followers  the poster's count at the post's story time (the follower
 *              ledger, services/pulseFollowers.js); with none yet, the
 *              profile's estimate, and the proposal waits (no_followers)
 *   kind       fit, status, announcement or other (postKind), each with a
 *              like rate and a share fraction
 *   trend      a boost when its trending_topic is on another live post
 *   episode    the episode result's tier for an episode's posts
 *   random     a factor from a seed fixed at proposal time, so the numbers
 *              are the same on every read
 *
 * Comments are never proposed: comments_count is the real live comments
 * (services/feedCommentDrafter.js recountComments).
 *
 * Other characters' everyday numbers are accepted at once. Lala's posts,
 * posts about Lala, numbers over 3× the poster's median, and posters with
 * no follower count wait as proposed, with a flag (#2954 reviews them).
 *
 *   propose(db, post)        the post's row, made once
 *   proposeLater(post)       propose after the response; never throws
 *   numbersAt(row, postOrder, at)  the numbers shown at a story moment, on
 *                            the growth curve (Task #2955)
 *   applyNumbers(db, posts, at)    GET /feed-posts' likes, shares and viral
 *                            flags at `at` (none: the final numbers)
 *   decide(row, action, …)   Review's Accept, Adjust (a reason), Make it
 *                            viral, Make it flop (Task #2954); the numbers
 *                            then lock
 */

// Likes as a share of followers, and shares as a share of likes.
const KIND_RATES = {
  fit:          { likes: 0.06, shares: 0.03 },
  status:       { likes: 0.02, shares: 0.08 },
  announcement: { likes: 0.04, shares: 0.12 },
  other:        { likes: 0.03, shares: 0.05 },
};
const TREND_BOOST = 1.3;
const EPISODE_TIER = { slay: 1.5, pass: 1.15, safe: 1, fail: 0.8 };
const RANDOM_SPREAD = 0.15;     // the random factor is 0.85 to 1.15
const SPIKE_TIMES = 3;          // over 3× the poster's median waits
const SPIKE_MIN_POSTS = 3;      // a median needs this many decided posts
const DECIDED = ['accepted', 'adjusted', 'viral', 'flop'];
/**
 * The growth curve (Task #2955; spec §8 "grow along a curve over about two
 * days of story time, then settle"; docs/reads/2026-10-12-pulse-numbers-read.md
 * §5). Story time moves in moments, not hours (services/storyClock.js), so
 * the curve is the share of the numbers shown by how many story moments
 * have passed since the post's own: CURVE[0] at its moment, CURVE[1] one
 * moment later, CURVE[2] (all of it) from two moments on.
 */
const CURVE = [0.55, 0.85, 1];

/** The post's kind for its like rate: fit, status, announcement or other. */
function postKind(post) {
  const type = String(post?.post_type || 'post');
  const fn = String(post?.narrative_function || '');
  if (type === 'notification' || type === 'live' || fn === 'brand_content') return 'announcement';
  if (fn === 'flex' || ((post?.image_url || post?.image_description) && ['post', 'reel', 'story', 'tiktok'].includes(type))) return 'fit';
  if (type === 'tweet' || (type === 'post' && !post?.image_url && !post?.image_description)) return 'status';
  return 'other';
}

/** A seed for a new proposal: a positive 31-bit integer. */
const newSeed = () => 1 + Math.floor(Math.random() * 0x7ffffffe);

/** The random factor a seed fixes (mulberry32's first draw), 1 ± RANDOM_SPREAD. */
function randomFactor(seed) {
  let t = (Number(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.round((1 - RANDOM_SPREAD + u * 2 * RANDOM_SPREAD) * 1000) / 1000;
}

/**
 * The numbers from their factors: { likes, shares }. Pure, so a row's
 * factors_json and seed always give the same numbers.
 */
function numbersFrom({ followers, kind, trending, episode_tier: tier, random }) {
  const rate = KIND_RATES[kind] || KIND_RATES.other;
  const likes = Math.max(0, Math.round((followers || 0) * rate.likes * (trending ? TREND_BOOST : 1) * (EPISODE_TIER[tier] || 1) * (random || 1)));
  return { likes, shares: Math.round(likes * rate.shares) };
}

const ABOUT_LALA = /(^|[^a-z0-9_])@?lala(?![a-z0-9_])/i;

const isLalaPost = (post, lalaProfileId) => (lalaProfileId && post.social_profile_id
  ? Number(post.social_profile_id) === Number(lalaProfileId)
  : String(post.poster_handle || '').replace(/^@/, '').toLowerCase() === 'lala');

const isAboutLala = (post) => ABOUT_LALA.test(`${post.content_text || ''}\n${post.image_description || ''}`);

/** The factors for a post, from the database. */
async function factorsFor(db, post) {
  const { sequelize } = db;
  const { countAt, estimateStart } = require('./pulseFollowers');
  let episode = null;
  if (post.episode_id) {
    [[episode]] = await sequelize.query(
      `SELECT episode_number, evaluation_json->>'tier_final' AS tier FROM episodes WHERE id = :id`,
      { replacements: { id: post.episode_id } });
  }
  const storyOrder = require('./storyClock').postOrder(post, episode?.episode_number);

  let followers = null;
  let followersFrom = 'ledger';
  if (post.social_profile_id) {
    followers = await countAt(db, post.show_id, post.social_profile_id, Number.isInteger(storyOrder) ? storyOrder : undefined);
    if (followers === null) {
      const [[profile]] = await sequelize.query(
        'SELECT follower_count_approx, follower_tier::text AS follower_tier FROM social_profiles WHERE id = :id',
        { replacements: { id: post.social_profile_id } });
      const est = estimateStart(profile);
      followers = est ? est.count : null;
      followersFrom = est ? `${est.from} (no ledger count yet)` : 'none';
    }
  } else {
    followersFrom = 'none';
  }

  let trending = false;
  if (post.trending_topic) {
    const [[row]] = await sequelize.query(
      `SELECT COUNT(*)::int AS n FROM feed_posts
        WHERE show_id = :show AND id <> :id AND status = 'live' AND deleted_at IS NULL
          AND LOWER(trending_topic) = LOWER(:topic)`,
      { replacements: { show: post.show_id, id: post.id, topic: post.trending_topic } });
    trending = row.n > 0;
  }

  const tier = episode?.tier && EPISODE_TIER[episode.tier] ? episode.tier : null;
  return {
    storyOrder,
    factors: {
      followers: followers ?? 0,
      followers_from: followersFrom,
      kind: postKind(post),
      trending,
      trending_topic: post.trending_topic || null,
      episode_tier: tier,
    },
  };
}

/** The median of the poster's decided likes, or null with fewer than SPIKE_MIN_POSTS. */
async function posterMedian(db, post) {
  const by = post.social_profile_id
    ? { sql: 'social_profile_id = :who', who: post.social_profile_id }
    : { sql: 'LOWER(poster_handle) = LOWER(:who)', who: String(post.poster_handle || '') };
  const [[row]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY final_likes) AS median
       FROM pulse_post_numbers
      WHERE show_id = :show AND ${by.sql} AND post_id <> :post AND deleted_at IS NULL
        AND status IN (:decided) AND final_likes IS NOT NULL`,
    { replacements: { show: post.show_id, who: by.who, post: post.id, decided: DECIDED } });
  return row.n >= SPIKE_MIN_POSTS ? Number(row.median) : null;
}

/**
 * The post's numbers row, proposed once: an existing row is returned as it
 * is. A post that is not live gets none (null).
 */
async function propose(db, post, { lalaProfileId } = {}) {
  const { PulsePostNumber } = db;
  if (!post || post.status !== 'live') return null;
  const existing = await PulsePostNumber.findOne({ where: { post_id: post.id } });
  if (existing) return existing;

  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const { storyOrder, factors } = await factorsFor(db, post);
  const seed = newSeed();
  factors.random = randomFactor(seed);
  const { likes, shares } = numbersFrom(factors);

  let flag = null;
  if (isLalaPost(post, lalaId)) flag = 'lala';
  else if (isAboutLala(post)) flag = 'about_lala';
  else if (factors.followers_from !== 'ledger') flag = 'no_followers';
  else {
    const median = await posterMedian(db, post);
    if (median !== null && likes > SPIKE_TIMES * median) {
      flag = 'spike';
      factors.poster_median = median;
    }
  }

  const accept = flag === null;
  try {
    return await PulsePostNumber.create({
      post_id: post.id,
      show_id: post.show_id,
      social_profile_id: post.social_profile_id || null,
      poster_handle: post.poster_handle || null,
      proposed_likes: likes,
      proposed_shares: shares,
      factors_json: factors,
      seed,
      status: accept ? 'accepted' : 'proposed',
      final_likes: accept ? likes : null,
      final_shares: accept ? shares : null,
      flag,
      decided_by: accept ? 'auto' : null,
      decided_at: accept ? new Date() : null,
      story_order: Number.isInteger(storyOrder) ? storyOrder : null,
    });
  } catch (err) {
    // Two releases at once: the other one made the row.
    if (err.name === 'SequelizeUniqueConstraintError') return PulsePostNumber.findOne({ where: { post_id: post.id } });
    throw err;
  }
}

/** Proposes the post's numbers after the response is sent; a failure is logged, never thrown. */
function proposeLater(post) {
  if (!post || post.status !== 'live') return;
  setImmediate(() => {
    propose(require('../models'), post).catch((err) => {
      console.error('[PulseNumbers] proposal failed for post', post.id, err);
    });
  });
}

// Story moments in order: each episode's phases (storyClock PHASES), so "one moment later" skips gaps.
const PHASE_STEPS = [1, 2, 3, 4, 5, 7, 8, 9];
const momentIndex = (order) => {
  const step = PHASE_STEPS.indexOf(order % 10);
  return Math.floor(order / 10) * PHASE_STEPS.length + (step === -1 ? PHASE_STEPS.findIndex((p) => p > order % 10) : step);
};

/**
 * The numbers shown at story moment `at` for a post whose story order is
 * `postOrder` (else the row's): { likes, shares } on the growth curve.
 * Decided numbers are the locked final ones; a proposal not yet decided
 * shows its proposed numbers on the same curve, never more. null when the
 * post is not written yet at `at`. An unknown order or `at` shows them all.
 */
function numbersAt(row, postOrder, at) {
  if (!row) return null;
  const decided = DECIDED.includes(row.status) && row.final_likes != null;
  const likes = Number(decided ? row.final_likes : row.proposed_likes) || 0;
  const shares = Number(decided ? row.final_shares : row.proposed_shares) || 0;
  const order = Number.isInteger(postOrder) ? postOrder : row.story_order;
  if (!Number.isInteger(order) || !Number.isInteger(at)) return { likes, shares };
  if (at < order) return null;
  const share = CURVE[Math.min(CURVE.length - 1, momentIndex(at) - momentIndex(order))];
  return { likes: Math.round(likes * share), shares: Math.round(shares * share) };
}

// viral_reach per viral tier, as feedEngagementService's analysis writes it.
const REACH_TIMES = { ultra: 20, mega: 10, mid: 5, nano: 2 };

/** is_viral and viral_reach from shown likes: VIRAL_THRESHOLDS on likes alone, at story time (no wall-clock velocity). */
function viralFor(likes) {
  const { detectViralTier } = require('./feedEngagementService');
  const tier = detectViralTier(likes, 0);
  return { is_viral: Boolean(tier), viral_reach: tier ? Math.floor(likes * REACH_TIMES[tier]) : 0 };
}

/**
 * GET /feed-posts' numbers (Task #2955): each post with a numbers row shows
 * its likes and shares as they stand at story moment `at` (undefined: the
 * final numbers, the Director view), and its viral flags from them.
 * comments_count stays the real comments; a post with no row is unchanged.
 */
async function applyNumbers(db, posts, at) {
  const ids = posts.map((p) => p.id);
  if (!ids.length || !db.PulsePostNumber) return posts;
  const rows = await db.PulsePostNumber.findAll({ where: { post_id: ids } });
  if (!rows.length) return posts;
  const rowOf = new Map(rows.map((r) => [r.post_id, r]));
  const [orders] = await db.sequelize.query(
    `SELECT fp.id, ${require('./storyClock').postOrderSql('fp')} AS story_order FROM feed_posts fp WHERE fp.id IN (:ids)`,
    { replacements: { ids: [...rowOf.keys()] } });
  const orderOf = new Map(orders.map((o) => [o.id, o.story_order == null ? null : Number(o.story_order)]));
  return posts.map((post) => {
    const row = rowOf.get(post.id);
    if (!row) return post;
    const shown = numbersAt(row, orderOf.get(post.id), at) || { likes: 0, shares: 0 };
    return { ...post, likes: shown.likes, shares: shown.shares, ...viralFor(shown.likes) };
  });
}

// Review's decisions (Task #2954): Make it viral multiplies the proposal, Make it flop shrinks it.
const VIRAL_MULTIPLE = 5;
const FLOP_FRACTION = 0.2;
const ACTIONS = ['accept', 'adjust', 'viral', 'flop'];

class NumbersError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const wholeCount = (n) => Number.isInteger(n) && n >= 0;

/**
 * Decides a proposed row; the numbers then lock (a decided row is a 409).
 *   accept   the proposal as it is
 *   adjust   { likes, shares, reason }: a one-line reason is required
 *   viral    the proposal × VIRAL_MULTIPLE, "Made viral"
 *   flop     the proposal × FLOP_FRACTION, "Made a flop"
 */
async function decide(row, action, { likes, shares, reason, by = null } = {}) {
  if (!ACTIONS.includes(action)) throw new NumbersError(400, `The decision must be one of ${ACTIONS.join(', ')}.`);
  if (row.status !== 'proposed') throw new NumbersError(409, 'These numbers are already decided and locked.');
  const proposed = { likes: Number(row.proposed_likes), shares: Number(row.proposed_shares) };
  let final = proposed;
  let why = null;
  let status = 'accepted';
  if (action === 'adjust') {
    if (!wholeCount(likes) || !wholeCount(shares)) throw new NumbersError(400, 'Likes and shares must be whole numbers, 0 or more.');
    const line = typeof reason === 'string' ? reason.trim() : '';
    if (!line) throw new NumbersError(400, 'Say why in one line.');
    if (/[\r\n]/.test(line)) throw new NumbersError(400, 'Keep the reason to one line.');
    final = { likes, shares };
    why = line.slice(0, 300);
    status = 'adjusted';
  } else if (action === 'viral') {
    final = { likes: Math.round(proposed.likes * VIRAL_MULTIPLE), shares: Math.round(proposed.shares * VIRAL_MULTIPLE) };
    why = 'Made viral';
    status = 'viral';
  } else if (action === 'flop') {
    final = { likes: Math.round(proposed.likes * FLOP_FRACTION), shares: Math.round(proposed.shares * FLOP_FRACTION) };
    why = 'Made a flop';
    status = 'flop';
  }
  await row.update({
    status, final_likes: final.likes, final_shares: final.shares, reason: why, decided_by: by, decided_at: new Date(),
  });
  return row;
}

module.exports = {
  KIND_RATES, TREND_BOOST, EPISODE_TIER, CURVE, SPIKE_TIMES, VIRAL_MULTIPLE, FLOP_FRACTION, ACTIONS,
  postKind, randomFactor, numbersFrom, isAboutLala, propose, proposeLater, numbersAt, viralFor, applyNumbers, decide, NumbersError,
};

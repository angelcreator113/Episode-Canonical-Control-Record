'use strict';

/**
 * A Pulse post's picture is a moment from its poster's camera roll (Evoni,
 * 2026-10-19: "a text post is created it should also go through this
 * generator and create the image that goes with that post … yes start it
 * with your recommendations"). Migration 20261019230001: feed_posts.picture_job
 * and camera_roll_moments.post_id.
 *
 * The rules she approved:
 *   - Only after she approves the post: published (PUT /feed-posts/:id
 *     { status: 'live' }) or scheduled (release-time / release-plan). A draft
 *     never gets one, and approving never fails for want of a picture: the
 *     post goes out and its picture follows ("picture pending", "failed, retry").
 *   - The format decides: a post gets one picture, a carousel three from one
 *     moment; text, quote, story, video and live get none.
 *   - Reuse before making: a photo already in their camera roll that they
 *     posted, on no other post, and that fits the caption (postMedia
 *     rankPictures) is used, with no image call.
 *   - A made picture is a camera-roll moment with purpose 'posted': the post's
 *     day, place, event, the people it @mentions, and what they wore that day;
 *     for Lala, her episode's wardrobe when the post belongs to an episode.
 *     It is made like any camera-roll photo (services/cameraRoll make: their
 *     official headshot as the face reference, the image budget), and is
 *     public because it was posted.
 *   - A brand account (social_profiles.full_profile.lalaverse_brand_id) uses
 *     the brand library's public pictures; when none fits, a product shot
 *     with no person in it is made.
 *   - At most PULSE_POST_IMAGES_PER_DAY post pictures a day (default 20),
 *     counted from ai_usage_logs (route 'pulse-post-picture'). Over it, the
 *     post waits ("waiting_cap") and is made the next day by the release
 *     timer (postRelease.startScheduler), or now with Make now, which still
 *     passes the image budget but not the day's count.
 *   - Never for Dr. Sinclair, the JustAWoman record or a Before Lala
 *     character (cameraRoll.refusalFor).
 *
 *   wanted(post)                      how many pictures its format takes now (0 when it has some)
 *   queue(db, post)                   approval: marks it pending (with the estimate); null when none is wanted
 *   afterApproval(db, post, { by })   queue, then make after the response
 *   run(db, postId, { by, makeNow })  reuse or make, and put the pictures on the post
 *   runWaiting(db)                    the waiting ones, while the day's count allows
 *   statusOf(db, postId)              its job, the estimate, and photos that could be reused
 */

const media = require('./mediaLibrary');
const postMedia = require('./postMedia');
const cameraRoll = require('./cameraRoll');

const ROUTE = 'pulse-post-picture';
const PER_DAY_DEFAULT = 20;
const COUNT = Object.freeze({ post: 1, carousel: 3 });
const STALE_MINUTES = 15;
const SELF = /\b(selfie|outfit|look|fit|ootd|wearing|mirror|my face|hair|makeup|me)\b/i;
const MIRROR = /\b(mirror|outfit|ootd|fit|wearing)\b/i;
const ALBUM_WORDS = [
  ['fashion', /\b(outfit|ootd|fit|wearing|look|dress|gown|heels|closet|style|styled)\b/i],
  ['travel', /\b(trip|travel|flight|airport|hotel|beach|vacation|abroad|train)\b/i],
  ['work', /\b(work|studio|shift|client|meeting|deadline|office|project|shoot)\b/i],
  ['social', /\b(friends?|brunch|dinner|party|girls|crew|date)\b/i],
  ['objects', /\b(coffee|bread|book|candle|flowers|desk|notes|cake|tea)\b/i],
];

class PostPictureError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function dailyCap() {
  const raw = process.env.PULSE_POST_IMAGES_PER_DAY;
  if (raw === undefined || String(raw).trim() === '') return PER_DAY_DEFAULT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : PER_DAY_DEFAULT;
}

const approved = (post) => post.status === 'live' || post.release_state === 'scheduled';
const clip = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));

function wanted(post) {
  if (!post || post.deleted_at) return 0;
  if (postMedia.urlsOf(post).length) return 0;
  return COUNT[postMedia.formatOf(post)] || 0;
}

// A person's photo is a phone's portrait (cameraRoll PHONE_SIZE); a brand's
// product shot stays the library's landscape. Both sizes are priced.
const BRAND_SIZE = Object.freeze({ width: 1536, height: 1024 });

function estimate(n, { brand = false } = {}) {
  if (!n) return 0;
  const size = brand ? BRAND_SIZE : cameraRoll.PHONE_SIZE;
  const e = require('./imageCostService').estimateImageCost({ model: cameraRoll.IMAGE_MODEL, ...size, quality: 'high', count: n });
  return e.usd;
}

async function setJob(post, patch) {
  const job = { ...(post.picture_job || {}), ...patch };
  await post.update({ picture_job: job });
  return job;
}

/** Post pictures made today, from the usage log (every call counts, Make now included). */
async function madeToday(db) {
  const [[row]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n FROM ai_usage_logs
      WHERE route_name = :route AND is_error = false AND created_at >= date_trunc('day', NOW())`,
    { replacements: { route: ROUTE } });
  return row?.n || 0;
}

/** Who the picture is of: a registry character (or why not), a brand account, or nobody. */
async function posterFor(db, post) {
  if (!post.social_profile_id) return null;
  const [[profile]] = await db.sequelize.query(
    `SELECT id, handle, display_name, full_profile, is_justawoman_record FROM social_profiles WHERE id = :id`,
    { replacements: { id: post.social_profile_id } });
  if (!profile) return null;
  if (profile.is_justawoman_record) return { kind: 'refused', reason: 'JustAWoman is not part of LalaWorld\'s camera rolls.' };
  const brandId = profile.full_profile && typeof profile.full_profile === 'object' ? profile.full_profile.lalaverse_brand_id : null;
  if (brandId) {
    const [[brand]] = await db.sequelize.query(
      'SELECT id, name, slug, description, aesthetic, category FROM lalaverse_brands WHERE id = :id AND deleted_at IS NULL',
      { replacements: { id: brandId } });
    if (brand) return { kind: 'brand', brand, profile };
  }
  const [[row]] = await db.sequelize.query(
    `SELECT id FROM registry_characters WHERE feed_profile_id = :pid AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
    { replacements: { pid: profile.id } });
  if (!row) return null;
  const { character, registry } = await cameraRoll.load(db, row.id);
  const refused = await cameraRoll.refusalFor(db, character, registry);
  if (refused) return { kind: 'refused', reason: refused.reason };
  return { kind: 'character', character, registry, profile };
}

const isRollPhoto = (a) => {
  let g = a.generation;
  if (typeof g === 'string') {
    try { g = JSON.parse(g); } catch (err) {
      console.error('[postPictures] a picture\'s generation is not JSON:', err.message);
      return false;
    }
  }
  return Boolean(g && typeof g === 'object' && g.camera_roll);
};

/** Public pictures of theirs that fit the caption and are on no other post, best first. */
async function reusable(db, post, poster) {
  const rows = poster.kind === 'brand'
    ? await media.listFor(db, { entityType: 'brand', entityId: poster.brand.id, audience: 'public' })
    : (await media.listFor(db, { entityType: 'character', entityId: poster.character.id, audience: 'public' })).filter(isRollPhoto);
  // A brand's campaign picture can go on many posts; a person's photo goes on one.
  const free = poster.kind === 'brand'
    ? rows
    : rows.filter((a) => !(a.links || []).some((l) => l.entity_type === 'post' && String(l.entity_id) !== String(post.id)));
  return postMedia.rankPictures(post.content_text, free).filter((r) => r.score > 0);
}

/** What Lala wore in the episode this post belongs to; null when the story does not say. */
async function episodeWardrobe(db, post, character) {
  if (String(character.character_key || '').toLowerCase() !== 'lala') return null;
  let episodeId = post.episode_id || null;
  if (!episodeId && post.event_id) {
    const [[ev]] = await db.sequelize.query('SELECT used_in_episode_id FROM world_events WHERE id = :id', { replacements: { id: post.event_id } });
    episodeId = ev?.used_in_episode_id || null;
  }
  if (!episodeId) return null;
  try {
    const [rows] = await db.sequelize.query(
      `SELECT w.name, w.color, w.clothing_category, w.description FROM episode_wardrobe ew
         JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
        WHERE ew.episode_id = :ep AND ew.deleted_at IS NULL AND COALESCE(ew.approval_status, '') <> 'rejected'
        ORDER BY ew.is_episode_favorite DESC NULLS LAST, ew.created_at ASC LIMIT 6`,
      { replacements: { ep: episodeId } });
    if (!rows.length) return null;
    return `her look from this episode: ${rows.map((w) => [w.color, w.name].filter(Boolean).join(' ') + (w.description ? ` (${clip(w.description, 80)})` : '')).join('; ')}`;
  } catch (err) {
    console.error('[postPictures] the episode wardrobe could not be read; her going-out look is used:', err.message);
    return null;
  }
}

/** The people the post @mentions who are registry characters (never a confidential one or JustAWoman). */
async function mentioned(db, post, character) {
  const handles = [...new Set((String(post.content_text || '').match(/@([A-Za-z0-9_.]{2,60})/g) || []).map((h) => h.slice(1).toLowerCase()))].slice(0, 3);
  if (!handles.length) return [];
  const [rows] = await db.sequelize.query(
    `SELECT rc.id, COALESCE(rc.selected_name, rc.display_name) AS name, rc.character_key, rc.extra_fields, rc.role_type, rc.description
       FROM social_profiles sp JOIN registry_characters rc ON rc.feed_profile_id = sp.id AND rc.deleted_at IS NULL
      WHERE LOWER(sp.handle) IN (:handles) AND sp.deleted_at IS NULL AND COALESCE(sp.is_justawoman_record, false) = false`,
    { replacements: { handles } });
  const { isConfidential } = require('../utils/confidentialCharacters');
  return rows
    .filter((r) => String(r.id) !== String(character.id) && !isConfidential(r) && String(r.character_key).toLowerCase() !== 'justawoman')
    .slice(0, 2).map((r) => ({ character_id: r.id, name: r.name }));
}

/** The moment a post's picture shows, from the post itself: no AI call. */
async function momentFor(db, post, character, { index = 1, of = 1, hasHeadshot = true } = {}) {
  const caption = clip(post.content_text, 400);
  let event = null;
  if (post.event_id) {
    const [[ev]] = await db.sequelize.query('SELECT id, name, event_date, venue_name, used_in_episode_id FROM world_events WHERE id = :id', { replacements: { id: post.event_id } });
    event = ev || null;
  }
  let place = null;
  if (post.place_location_id) {
    const [[loc]] = await db.sequelize.query('SELECT name FROM world_locations WHERE id = :id', { replacements: { id: post.place_location_id } }).catch((err) => {
      console.error('[postPictures] the post\'s venue could not be read:', err.message);
      return [[null]];
    });
    place = loc?.name || null;
  }
  const cityKey = post.place_city || null;
  const city = cityKey ? (require('../utils/lalaHome').dreamCityName(cityKey) || cityKey) : null;
  const selfShot = SELF.test(caption);
  const album = event ? 'events' : (ALBUM_WORDS.find(([, re]) => re.test(caption)) || ['everyday'])[0];
  const day = event?.event_date || post.release_at || post.posted_at || null;
  let people = await mentioned(db, post, character);
  const showsFace = hasHeadshot && (selfShot || Boolean(event));
  if (!hasHeadshot) people = people.map((p) => ({ name: p.name }));
  const m = cameraRoll.normalizeMoment({
    moment: `The photo for their Pulse post${of > 1 ? ` (${index} of ${of}, another angle of the same moment)` : ''}: "${caption}"`,
    purpose: 'posted',
    album,
    taken_by: showsFace ? (MIRROR.test(caption) ? 'mirror' : selfShot ? 'selfie' : 'friend') : 'friend',
    shows_face: showsFace,
    place_text: [place || event?.venue_name, city].filter(Boolean).join(', ') || null,
    story_date: day ? new Date(day).toISOString().slice(0, 10) : null,
  });
  return { ...m, people, event };
}

/** One product or campaign shot for a brand's post: no person in it. */
async function brandShot(db, post, brand, { index, of, by }) {
  const variations = require('./mediaVariations');
  const prompt = [
    `A product or campaign photo posted on The Pulse by ${brand.name}, an original fictional ${brand.category || 'fashion'} house in LalaWorld.`,
    brand.aesthetic && `Their look: ${clip(brand.aesthetic, 200)}.`,
    `The post says: "${clip(post.content_text, 300)}".`,
    of > 1 && `Photo ${index} of ${of}: another angle or detail of the same piece.`,
    'No person and no face in the picture: the pieces, fabric, details, a styled flat lay or a set.',
    'Natural light, real surroundings, editorial but believable. No text, no letters, no logos, no brand names, no watermark.',
  ].filter(Boolean).join(' ');
  let cost = null;
  const buffer = await variations.editImage(prompt, [], { routeName: ROUTE, size: BRAND_SIZE, onLogged: (l) => { cost = l.costUsd; } });
  const { isBlank } = require('./characterAppearance');
  if (await isBlank(buffer)) throw new PostPictureError(422, 'The image service blocked this picture (a black picture comes back when its filter flags one). Nothing was saved.');
  const { storePulseImage } = require('./pulseImageService');
  const stored = await storePulseImage({ buffer, mimetype: 'image/png' }, { keyPrefix: `brands/${brand.id}/pulse`, label: 'The picture' });
  const created = await media.createAsset(db, {
    url: stored.url, storageKey: stored.key, width: stored.width, height: stored.height,
    caption: clip(post.content_text, 200), source: 'generated', status: 'approved', visibility: 'public',
    details: { notes: 'Made for a Pulse post (no person)' },
    generation: { post_picture: { post_id: post.id }, prompt, model: cameraRoll.IMAGE_MODEL, made_at: new Date().toISOString() },
    links: [{ entity_type: 'brand', entity_id: String(brand.id), role: 'owner' }],
    by,
  });
  return { assetId: created.asset.id, cost: typeof cost === 'number' ? cost : estimate(1, { brand: true }) };
}

/** Claim the post for making, so two runs never make it twice. */
async function claim(db, postId) {
  const [rows] = await db.sequelize.query(
    `UPDATE feed_posts SET picture_job = COALESCE(picture_job, '{}'::jsonb) || jsonb_build_object('state', 'making', 'claimed_at', NOW()), updated_at = NOW()
      WHERE id = :id AND (COALESCE(picture_job->>'state', '') <> 'making'
        OR (picture_job->>'claimed_at')::timestamptz < NOW() - INTERVAL '${STALE_MINUTES} minutes')
      RETURNING id`, { replacements: { id: postId } });
  return rows.length > 0;
}

async function queue(db, postOrId) {
  const post = typeof postOrId === 'object' ? postOrId : await postMedia.loadPost(db, postOrId);
  const n = wanted(post);
  if (!n || !approved(post)) return null;
  if (['made', 'making'].includes(post.picture_job?.state)) return post.picture_job;
  return setJob(post, { state: 'pending', count: n, estimate_usd: estimate(n), queued_at: new Date().toISOString(), error: null });
}

async function run(db, postId, { by = null, makeNow = false } = {}) {
  let post = await postMedia.loadPost(db, postId);
  if (!approved(post)) throw new PostPictureError(409, 'Pictures are made only for posts you approved.');
  const n = wanted(post);
  if (!n) {
    const done = postMedia.urlsOf(post).length > 0;
    return setJob(post, { state: done ? 'made' : 'skipped', reason: done ? null : `A ${postMedia.FORMAT_LABELS[postMedia.formatOf(post)].toLowerCase()} post takes no picture.` });
  }
  const poster = await posterFor(db, post);
  if (!poster) return setJob(post, { state: 'failed', count: n, error: 'This post has no character or brand in the studio to make a picture of.' });
  if (poster.kind === 'refused') return setJob(post, { state: 'skipped', count: n, reason: poster.reason, error: null });

  const fits = await reusable(db, post, poster);
  if (fits.length >= n) {
    const ids = fits.slice(0, n).map((r) => r.asset.id);
    await postMedia.attachPictures(db, post.id, { assetIds: ids, format: postMedia.formatOf(post), by });
    post = await postMedia.loadPost(db, post.id);
    return setJob(post, { state: 'made', count: n, reused: true, asset_ids: ids, cost_usd: 0, made_at: new Date().toISOString(), error: null, reason: null });
  }

  const cap = dailyCap();
  if (!makeNow && (await madeToday(db)) + n > cap) {
    return setJob(post, {
      state: 'waiting_cap', count: n, estimate_usd: estimate(n, { brand: poster.kind === 'brand' }), error: null,
      reason: `Today's post-picture limit (${cap}) is reached; it will be made tomorrow, or press Make now.`,
    });
  }
  if (!(await claim(db, post.id))) throw new PostPictureError(409, 'A picture for this post is being made right now.');
  post = await postMedia.loadPost(db, post.id);

  const assetIds = [];
  const momentIds = [];
  let cost = 0;
  try {
    if (poster.kind === 'brand') {
      for (let i = 1; i <= n; i += 1) {
        const shot = await brandShot(db, post, poster.brand, { index: i, of: n, by });
        assetIds.push(shot.assetId);
        cost += shot.cost || 0;
      }
    } else {
      const { character } = poster;
      const hasHeadshot = Boolean(await cameraRoll.headshotOf(db, character.id));
      const wearing = await episodeWardrobe(db, post, character);
      for (let i = 1; i <= n; i += 1) {
        const { event, ...m } = await momentFor(db, post, character, { index: i, of: n, hasHeadshot });
        const row = await db.CameraRollMoment.create({
          character_id: character.id, status: 'kept', ...m, post_id: post.id,
          event_id: event?.id || null, episode_id: post.episode_id || event?.used_in_episode_id || null, created_by: by,
        });
        momentIds.push(row.id);
        const out = await cameraRoll.make(db, row.id, { by, routeName: ROUTE, wearing });
        assetIds.push(out.photo.asset_id);
        await row.reload();
        cost += Number(row.cost) || 0;
      }
    }
  } catch (err) {
    const budget = err.code === 'AI_BUDGET_EXCEEDED';
    console.error(`[postPictures] the picture for post ${post.id} was not made:`, err.message);
    post = await postMedia.loadPost(db, post.id);
    await setJob(post, {
      state: 'failed', count: n, moment_ids: momentIds, asset_ids: assetIds, cost_usd: Math.round(cost * 1e4) / 1e4,
      error: budget ? 'Today\'s image budget is used up, so the picture was not made. Retry when it resets.' : (err.message || 'The picture could not be made.'),
    });
    if (budget) throw err;
    throw new PostPictureError(err.status && err.status < 500 ? err.status : 502, err.message || 'The picture could not be made.');
  }
  // attachPictures tags each picture with the post in the library.
  await postMedia.attachPictures(db, post.id, { assetIds, format: postMedia.formatOf(post), by });
  post = await postMedia.loadPost(db, post.id);
  return setJob(post, {
    state: 'made', count: n, reused: false, moment_ids: momentIds, asset_ids: assetIds,
    cost_usd: Math.round(cost * 1e4) / 1e4, made_at: new Date().toISOString(), make_now: Boolean(makeNow), error: null, reason: null,
  });
}

/** Queue on approval and make after the response; approving never waits for, or fails on, the picture. */
async function afterApproval(db, post, { by = null } = {}) {
  let job = null;
  try {
    job = await queue(db, post);
  } catch (err) {
    console.error(`[postPictures] post ${post.id} could not be queued for a picture:`, err.message);
    return null;
  }
  if (job?.state === 'pending') {
    setImmediate(() => {
      run(db, post.id, { by }).catch((err) => console.error(`[postPictures] post ${post.id}'s picture:`, err.message));
    });
  }
  return job;
}

let running = false;
/** The waiting ones (and any left pending by a restart), oldest first, while today's count allows. */
async function runWaiting(db, { limit = 10 } = {}) {
  if (running) return [];
  running = true;
  const done = [];
  try {
    const [rows] = await db.sequelize.query(
      `SELECT id, COALESCE((picture_job->>'count')::int, 1) AS n FROM feed_posts
        WHERE deleted_at IS NULL AND (status = 'live' OR release_state = 'scheduled')
          AND (picture_job->>'state' = 'waiting_cap'
            OR (picture_job->>'state' = 'pending' AND (picture_job->>'queued_at')::timestamptz < NOW() - INTERVAL '${STALE_MINUTES} minutes'))
        ORDER BY picture_job->>'queued_at' ASC NULLS FIRST LIMIT ${Math.min(Number(limit) || 10, 50)}`);
    const cap = dailyCap();
    for (const r of rows) {
      if ((await madeToday(db)) + r.n > cap) break;
      try {
        done.push({ id: r.id, job: await run(db, r.id, { by: 'post-picture timer' }) });
      } catch (err) {
        console.error(`[postPictures] waiting post ${r.id}:`, err.message);
        if (err.code === 'AI_BUDGET_EXCEEDED') break;
      }
    }
  } finally {
    running = false;
  }
  return done;
}

async function statusOf(db, postId) {
  const post = await postMedia.loadPost(db, postId);
  const n = COUNT[postMedia.formatOf(post)] || 0;
  const poster = await posterFor(db, post);
  let candidates = [];
  if (poster && poster.kind !== 'refused') {
    candidates = (await reusable(db, post, poster)).slice(0, 6)
      .map((r) => ({ id: r.asset.id, url: r.asset.url, caption: r.asset.caption, score: r.score, why: r.why }));
  }
  return {
    post_id: post.id,
    format: postMedia.formatOf(post),
    takes: n,
    approved: approved(post),
    job: post.picture_job || null,
    estimate_usd: estimate(n, { brand: poster?.kind === 'brand' }),
    per_day: dailyCap(),
    made_today: await madeToday(db),
    poster: poster ? { kind: poster.kind, reason: poster.reason || null } : null,
    reuse: candidates,
  };
}

module.exports = {
  PostPictureError, ROUTE, COUNT, PER_DAY_DEFAULT,
  dailyCap, wanted, estimate, madeToday, posterFor, reusable, episodeWardrobe, momentFor,
  queue, run, afterApproval, runWaiting, statusOf,
};

'use strict';

/**
 * The weekly Pulse recap (Task #3008; The Pulse spec §11 "Weekly Pulse
 * recap: a shareable digest of the week's biggest revealed, published
 * moments for the website"; docs/reads/2026-10-12-pulse-public-extras-read.md
 * §4). Evoni, 2026-10-12: a page on the public website, drafted each week,
 * published only when she approves; no email.
 *
 * A week is Monday 00:00 UTC to the next Monday. "This week's moments" are
 * the show's live posts whose posted_at falls in it, shown as The Pulse
 * shows them at the present (GET /feed-posts?at=present): a story order at
 * or before the present (or none), nothing hidden and no character Lala has
 * not met (pulseReveals.revealsAt), numbers on the growth curve
 * (pulseNumbers.applyNumbers). A recap and The Pulse cannot disagree.
 *
 *   weekStartOf(date)                 the Monday (YYYY-MM-DD) a date falls in
 *   candidates(db, showId, weekStart) the week's posts, biggest first
 *   buildDraft(db, showId, weekStart) the week's recap: made once as a draft
 *                                     with the top posts; never AI; a week
 *                                     that has one keeps it as it is
 *   postsOf(db, recap)                its posts as The Pulse shows them now
 *                                     (a post since hidden or taken down
 *                                     drops out, even after publishing)
 *   update / publish / unpublish / drop   Evoni's edits and decisions;
 *                                     publishing copies each post's image
 *                                     to the public site bucket (Task #3099)
 *   publicImageOf(recap, post)        the post's public image { url, alt },
 *                                     or null
 *   tick / startScheduler                  each hour, last week's draft for
 *                                          every show with live posts in it
 *                                          (app.js, with the posting engine)
 */

const TOP = 8;
const MAX_POSTS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const TICK_MS = 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class RecapError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'RecapError'; }
}

/** The Monday (UTC, YYYY-MM-DD) that a date falls in. */
function weekStartOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** A week_start value: a YYYY-MM-DD that is a Monday, or a RecapError. */
function mondayOf(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
    throw new RecapError(400, 'week_start must be a date (YYYY-MM-DD).');
  }
  if (weekStartOf(new Date(`${text}T00:00:00Z`)) !== text) throw new RecapError(400, 'week_start must be a Monday.');
  return text;
}

const range = (weekStart) => {
  const from = new Date(`${weekStart}T00:00:00Z`);
  return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
};

/** "The Pulse, week of 12 October" */
const titleFor = (weekStart) => `The Pulse, week of ${new Date(`${weekStart}T00:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

/**
 * Live posts of the show as The Pulse shows them at the present, narrowed by
 * `where` (SQL on fp, with replacements): numbers on the curve, nothing
 * hidden, and no teaser: The Pulse sends a teaser post with no words, so the
 * public recap must not send them either (Task #3080, as Trending, #3048). Returns [{ id, poster_handle, poster_display_name, content_text,
 * likes, comments_count, posted_at, story_order, image }]: image is the
 * photo as The Pulse shows it (routes/feedPostRoutes applyPostReveal): its
 * teaser while the photo is one, none while it is hidden, else
 * { url, alt } (Task #3099).
 */
async function visiblePosts(db, showId, where, replacements) {
  const clock = require('./storyClock');
  const present = await clock.presentOrder(db, showId);
  const order = clock.postOrderSql('fp');
  const [rows] = await db.sequelize.query(
    `SELECT fp.id, fp.social_profile_id, fp.poster_handle, fp.poster_display_name, fp.content_text,
            fp.image_url, fp.image_description, fp.likes, fp.comments_count, fp.posted_at, ${order} AS story_order
       FROM feed_posts fp
      WHERE fp.show_id = :showId AND fp.status = 'live' AND fp.deleted_at IS NULL
        AND (${order} IS NULL OR ${order} <= :present) AND ${where}`,
    { replacements: { ...replacements, showId, present } });
  if (!rows.length) return [];
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const reveals = await require('./pulseReveals').revealsAt(db, showId, present, { lalaProfileId: lalaId });
  const hidden = new Set([...reveals.hiddenIds('post'), ...reveals.teaserIds('post')].map(String));
  const kept = rows.filter((r) => !hidden.has(String(r.id))
    && !(r.social_profile_id != null && reveals.hiddenProfiles.has(Number(r.social_profile_id))));
  const shown = await require('./pulseNumbers').applyNumbers(db, kept, present);
  return shown.map((p) => ({
    id: p.id, poster_handle: p.poster_handle, poster_display_name: p.poster_display_name || null,
    content_text: p.content_text, likes: Number(p.likes) || 0, comments_count: Number(p.comments_count) || 0,
    posted_at: p.posted_at, story_order: p.story_order == null ? null : Number(p.story_order),
    image: imageAsShown(p, reveals),
  }));
}

/** A post's photo as The Pulse shows it: the teaser while it is one, none while hidden. */
function imageAsShown(post, reveals) {
  if (!post.image_url) return null;
  const state = reveals.stateOf('image', post.id, 'post_photo');
  if (state === 'hidden') return null;
  if (state === 'teaser') {
    const teaser = reveals.teaserOf('image', post.id, 'post_photo');
    return teaser?.url ? { url: teaser.url, alt: '' } : null;
  }
  return { url: post.image_url, alt: post.image_description || '' };
}

const PUBLIC_IMAGE_SIDE = 1600;

/**
 * Copies each post's image, as The Pulse shows it now, into the public site
 * bucket, re-encoded (no camera metadata) and resized; a post whose copy
 * already matches is left alone. Without SITE_PUBLIC_BUCKET nothing is
 * copied (text only); an image that cannot be read or stored is marked
 * failed and the rest go on. Returns the recap's images map.
 */
async function copyImages(posts, recap) {
  const slots = require('./websiteSlotService');
  const cfg = slots.storageConfig();
  const images = { ...(recap.images || {}) };
  if (!cfg) return images;
  for (const post of posts) {
    const id = String(post.id);
    if (!post.image) continue;
    if (images[id]?.key && images[id].source === post.image.url) continue;
    try {
      const sharp = require('sharp');
      const bytes = await module.exports.imageBytes(post.image.url);
      const buffer = await sharp(bytes).rotate()
        .resize({ width: PUBLIC_IMAGE_SIDE, height: PUBLIC_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86 }).toBuffer();
      const key = `${cfg.prefix}/recaps/${recap.id}/${require('crypto').randomUUID()}.jpg`;
      await slots.putObject(cfg, key, buffer, 'image/jpeg');
      images[id] = { key, source: post.image.url };
    } catch (err) {
      console.error(`[PulseRecap] the image of post ${id} could not be copied to the public site:`, err.message);
      images[id] = { failed: true, source: post.image.url };
    }
  }
  return images;
}

/** The post's public image { url, alt } while its copy matches what The Pulse shows now; else null. */
function publicImageOf(recap, post) {
  const copy = (recap.images || {})[String(post.id)];
  if (!copy?.key || !post.image || copy.source !== post.image.url) return null;
  const url = require('./websiteSlotService').publicUrl(copy.key);
  return url ? { url, alt: post.image.alt || '' } : null;
}

/** The week's moments, biggest first (likes, then comments, then newest). */
async function candidates(db, showId, weekStart) {
  const { from, to } = range(mondayOf(weekStart));
  const posts = await visiblePosts(db, showId, 'fp.posted_at >= :from AND fp.posted_at < :to', { from, to });
  return posts.sort((a, b) => (b.likes - a.likes) || (b.comments_count - a.comments_count)
    || (new Date(b.posted_at) - new Date(a.posted_at)));
}

/** The week's recap: made once, as a draft with the top posts; a week that has one keeps it. */
async function buildDraft(db, showId, weekStart, { top = TOP } = {}) {
  const week = mondayOf(weekStart);
  const existing = await db.PulseRecap.findOne({ where: { show_id: showId, week_start: week } });
  if (existing) return { recap: existing, created: false };
  const posts = (await candidates(db, showId, week)).slice(0, top);
  try {
    const recap = await db.PulseRecap.create({
      show_id: showId, week_start: week, status: 'draft', title: titleFor(week), post_ids: posts.map((p) => p.id),
    });
    return { recap, created: true };
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return { recap: await db.PulseRecap.findOne({ where: { show_id: showId, week_start: week } }), created: false };
    }
    throw err;
  }
}

/** The recap's posts, in its order, as The Pulse shows them now; gone or hidden ones drop out. */
async function postsOf(db, recap) {
  const ids = (recap.post_ids || []).map(String).filter((id) => UUID_RE.test(id) || /^\d+$/.test(id));
  if (!ids.length) return [];
  const posts = await visiblePosts(db, recap.show_id, 'fp.id::text IN (:ids)', { ids });
  const byId = new Map(posts.map((p) => [String(p.id), p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Evoni's edits: title, intro, and the posts (a reorder or a drop; each a live post of the show). */
async function update(db, recap, { title, intro, postIds }) {
  if (recap.status === 'dropped') throw new RecapError(409, 'This recap was dropped.');
  const changes = {};
  if (title !== undefined) {
    const text = String(title || '').trim();
    if (!text) throw new RecapError(400, 'A recap needs a title.');
    changes.title = text.slice(0, 200);
  }
  if (intro !== undefined) changes.intro = String(intro || '').trim().slice(0, 4000) || null;
  if (postIds !== undefined) {
    if (!Array.isArray(postIds) || postIds.length > MAX_POSTS) throw new RecapError(400, `post_ids must be a list of up to ${MAX_POSTS} posts.`);
    const ids = [...new Set(postIds.map(String))];
    if (ids.length) {
      const [rows] = await db.sequelize.query(
        `SELECT id::text AS id FROM feed_posts WHERE id::text IN (:ids) AND show_id = :showId AND status = 'live' AND deleted_at IS NULL`,
        { replacements: { ids, showId: recap.show_id } });
      const known = new Set(rows.map((r) => r.id));
      const missing = ids.find((id) => !known.has(id));
      if (missing) throw new RecapError(400, `Post ${missing} is not a live post of this show.`);
    }
    changes.post_ids = ids;
  }
  return recap.update(changes);
}

async function publish(db, recap, by) {
  if (recap.status === 'published') throw new RecapError(409, 'This recap is already published.');
  if (recap.status === 'dropped') throw new RecapError(409, 'This recap was dropped.');
  const posts = await postsOf(db, recap);
  if (!posts.length) throw new RecapError(400, 'A recap needs at least one post to publish.');
  const images = await copyImages(posts, recap);
  return recap.update({ status: 'published', published_at: new Date(), published_by: by || null, images });
}

async function unpublish(recap) {
  if (recap.status !== 'published') throw new RecapError(409, 'This recap is not published.');
  return recap.update({ status: 'draft', published_at: null, published_by: null });
}

async function drop(recap) {
  if (recap.status === 'published') throw new RecapError(409, 'Unpublish it first.');
  return recap.update({ status: 'dropped' });
}

/** Each hour: last week's draft for every show with live posts in it. Returns the recaps made. */
async function tick(db, now = new Date()) {
  const lastWeek = weekStartOf(new Date(now.getTime() - 7 * DAY_MS));
  const { from, to } = range(lastWeek);
  const [shows] = await db.sequelize.query(
    `SELECT DISTINCT fp.show_id FROM feed_posts fp
      WHERE fp.status = 'live' AND fp.deleted_at IS NULL AND fp.show_id IS NOT NULL
        AND fp.posted_at >= :from AND fp.posted_at < :to`, { replacements: { from, to } });
  const made = [];
  for (const s of shows) {
    try {
      const { recap, created } = await buildDraft(db, s.show_id, lastWeek);
      if (created) made.push(recap);
    } catch (err) {
      console.error(`[PulseRecap] the draft for show ${s.show_id} failed:`, err);
    }
  }
  return made;
}

let timer = null;

function startScheduler(db = require('../models'), { intervalMs = TICK_MS } = {}) {
  if (timer) return false;
  timer = setInterval(() => {
    tick(db).catch((err) => console.error('[PulseRecap] the weekly draft check failed:', err));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return true;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  TOP, MAX_POSTS, RecapError,
  weekStartOf, candidates, buildDraft, postsOf, update, publish, unpublish, drop, tick, startScheduler, stopScheduler,
  publicImageOf,
  // The bytes of a stored image (pulseTeasers.imageBytes); here so a test can stand in for the download.
  imageBytes: (url) => require('./pulseTeasers').imageBytes(url),
};

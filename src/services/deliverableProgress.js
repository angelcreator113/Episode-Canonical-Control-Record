'use strict';

/**
 * Deliverables that check themselves (Evoni, 2026-10-19: "yes start
 * deliverables after phase 2"). A deal's deliverables (event_deliverables:
 * "1 Pulse video", "3 Pulse stories") tick off as the posts linked to them
 * go out on The Pulse.
 *
 *   deliverable_posts (migration 20261019140000) says which post counts
 *   toward which deliverable; a post counts toward one at most.
 *
 * How a post gets linked: by hand (Evoni links it from the deal's
 * deliverables or from the post's card in Pulse Review). The app suggests
 * the likely posts — same show, the deliverable's format, not already
 * counted, ranked by naming the brand or the event and by Lala posting it —
 * but never links one on its own, so a post never counts toward a deal she
 * did not choose.
 *
 * How progress counts (computed on every read, never stored):
 *   - only a deliverable whose format goes out as a post counts posts
 *     (postMedia.FORMAT_FOR_DELIVERABLE: Pulse post, carousel, stories,
 *     Pulse video, GRWM, try-on, live); link in bio, content for the brand
 *     and "other" are not posts and stay as they are;
 *   - a linked post counts while it is live (status 'live', not deleted) and
 *     its format is the deliverable's; a story that has ended still counts
 *     (it went out); a post taken down or deleted stops counting;
 *   - done when the posts reach the quantity; a deal's deliverables are all
 *     done when every countable one is.
 * The deliverable's own fulfilment status (pending → approved) and any money
 * are never changed here: this only reads and shows.
 *
 *   progressForEvent(db, eventId)        { event_id, deliverables, countable, done, all_done, done_at }
 *   progressForOpportunity(db, oppId)    the same, for the deal's event
 *   progressForBrand(db, brandName)      every deal with that brand (for the
 *                                        brand profile once it merges, #3395)
 *   link / unlink(db, …)                 ADMIN writes
 *   suggestions(db, deliverableId)       ranked posts to link
 *   forPost(db, postId)                  what it counts toward, and the open
 *                                        deliverables it could count toward
 *   dealsDone(db, { start, end })        deals whose last deliverable went out in the window
 *   dueSoon(db, { now, until })          deals going public in the window with deliverables left
 */

const { DELIVERABLE_FORMATS } = require('../utils/deliverableFormats');
const { FORMAT_FOR_DELIVERABLE, formatOf } = require('./postMedia');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUGGEST_LIMIT = 10;

class DeliverableError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const q = (db, sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: db.sequelize.QueryTypes.SELECT });
const clip = (v, n = 160) => (v == null ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const iso = (d) => (d ? new Date(d).toISOString() : null);

/** The post format a deliverable is delivered by, or null when it is not a post. */
function formatFor(type) {
  return FORMAT_FOR_DELIVERABLE[type] || null;
}

/** "Pulse stories" for a deliverable type ("Pulse video" for one); its description when the type is unknown. */
function labelOf(d) {
  const f = DELIVERABLE_FORMATS[d.deliverable_type];
  if (!f) return clip(d.description, 80) || 'Deliverable';
  const one = Math.max(1, Number(d.quantity) || 1) === 1;
  return (one ? f.noun?.[0] : f.noun?.[1]) || f.label;
}

/** Whether a linked post counts: live, not deleted, and in the deliverable's format. */
function counts(post, format) {
  if (!post || post.deleted_at || post.status !== 'live') return false;
  return formatOf(post) === format;
}

/** One deliverable's progress from its linked posts (pure). */
function progressOf(d, posts = []) {
  const format = formatFor(d.deliverable_type);
  const quantity = Math.max(1, Number(d.quantity) || 1);
  const counted = format ? posts.filter((p) => counts(p, format)) : [];
  const label = labelOf(d);
  return {
    id: d.id,
    type: d.deliverable_type || null,
    description: d.description,
    label,
    format,
    countable: Boolean(format),
    quantity,
    counted: counted.length,
    done: Boolean(format) && counted.length >= quantity,
    line: format ? `${label}: ${Math.min(counted.length, quantity)} of ${quantity}` : null,
    due_date: d.due_date || null,
    owed_to: d.owed_to,
    done_at: format && counted.length >= quantity
      ? iso(counted.map((p) => p.posted_at || p.updated_at).sort((a, b) => new Date(a) - new Date(b))[quantity - 1])
      : null,
    posts: posts.map((p) => ({
      id: p.id, handle: p.poster_handle || null, text: clip(p.content_text), status: p.status,
      format: formatOf(p), posted_at: iso(p.posted_at), counts: Boolean(format) && counts(p, format),
    })),
  };
}

/** A deal's progress (pure): every deliverable, and whether the countable ones are all done. */
function summarize(eventId, rows) {
  const countable = rows.filter((r) => r.countable);
  const allDone = countable.length > 0 && countable.every((r) => r.done);
  return {
    event_id: eventId,
    deliverables: rows,
    countable: countable.length,
    done: countable.filter((r) => r.done).length,
    all_done: allDone,
    done_at: allDone ? countable.map((r) => r.done_at).filter(Boolean).sort().pop() || null : null,
  };
}

async function deliverablesOf(db, eventIds) {
  if (!eventIds.length) return [];
  return q(db, `SELECT id, event_id, description, deliverable_type, quantity, due_date, owed_to
    FROM event_deliverables WHERE deleted_at IS NULL AND event_id IN (:eventIds) ORDER BY created_at ASC`, { eventIds });
}

async function linkedPosts(db, deliverableIds) {
  if (!deliverableIds.length) return new Map();
  const rows = await q(db, `SELECT dp.deliverable_id, fp.id, fp.poster_handle, fp.content_text, fp.status, fp.post_format, fp.post_type,
      fp.posted_at, fp.updated_at, fp.deleted_at
    FROM deliverable_posts dp JOIN feed_posts fp ON fp.id = dp.feed_post_id
    WHERE dp.deleted_at IS NULL AND dp.deliverable_id IN (:deliverableIds) ORDER BY COALESCE(fp.posted_at, fp.created_at) ASC`, { deliverableIds });
  const by = new Map();
  for (const r of rows) by.set(r.deliverable_id, [...(by.get(r.deliverable_id) || []), r]);
  return by;
}

/** Progress for several deals' events at once: Map(event_id → summary). */
async function progressForEvents(db, eventIds) {
  const ids = [...new Set(eventIds.filter((id) => UUID_RE.test(String(id))))];
  const delivs = await deliverablesOf(db, ids);
  const posts = await linkedPosts(db, delivs.map((d) => d.id));
  const byEvent = new Map(ids.map((id) => [id, []]));
  for (const d of delivs) byEvent.get(d.event_id).push(progressOf(d, posts.get(d.id) || []));
  return new Map([...byEvent].map(([id, rows]) => [id, summarize(id, rows)]));
}

async function progressForEvent(db, eventId) {
  if (!UUID_RE.test(String(eventId))) throw new DeliverableError(404, 'Event not found.');
  const [event] = await q(db, 'SELECT id FROM world_events WHERE id = :eventId AND deleted_at IS NULL', { eventId });
  if (!event) throw new DeliverableError(404, 'Event not found.');
  return (await progressForEvents(db, [eventId])).get(eventId);
}

async function progressForOpportunity(db, oppId) {
  if (!UUID_RE.test(String(oppId))) throw new DeliverableError(404, 'Deal not found.');
  const [opp] = await q(db, 'SELECT id, event_id FROM opportunities WHERE id = :oppId AND deleted_at IS NULL', { oppId });
  if (!opp) throw new DeliverableError(404, 'Deal not found.');
  if (!opp.event_id) return { opportunity_id: opp.id, event_id: null, deliverables: [], countable: 0, done: 0, all_done: false, done_at: null };
  return { opportunity_id: opp.id, ...(await progressForEvent(db, opp.event_id)) };
}

/** Every deal with a brand, by name (the brand profile, once #3395 merges, can pass its name). */
async function progressForBrand(db, brandName) {
  const name = String(brandName || '').trim();
  if (!name) return [];
  const opps = await q(db, `SELECT id, name, status, event_id, publish_date FROM opportunities
    WHERE deleted_at IS NULL AND event_id IS NOT NULL AND LOWER(TRIM(brand_or_company)) = LOWER(:name)
    ORDER BY created_at DESC LIMIT 50`, { name });
  const progress = await progressForEvents(db, opps.map((o) => o.event_id));
  return opps.map((o) => ({ opportunity_id: o.id, name: o.name, status: o.status, publish_date: o.publish_date, ...progress.get(o.event_id) }));
}

async function deliverableRow(db, deliverableId) {
  if (!UUID_RE.test(String(deliverableId))) throw new DeliverableError(404, 'Deliverable not found.');
  const [d] = await q(db, `SELECT ed.id, ed.event_id, ed.description, ed.deliverable_type, ed.quantity, ed.due_date, ed.owed_to,
      we.show_id, we.name AS event_name, o.brand_or_company
    FROM event_deliverables ed JOIN world_events we ON we.id = ed.event_id AND we.deleted_at IS NULL
    LEFT JOIN opportunities o ON o.event_id = ed.event_id AND o.deleted_at IS NULL
    WHERE ed.id = :deliverableId AND ed.deleted_at IS NULL LIMIT 1`, { deliverableId });
  if (!d) throw new DeliverableError(404, 'Deliverable not found.');
  return d;
}

/** Counts a post toward a deliverable. 409 when its format is not the deliverable's or it already counts elsewhere. */
async function link(db, { deliverableId, postId, by = null }) {
  const d = await deliverableRow(db, deliverableId);
  const format = formatFor(d.deliverable_type);
  if (!format) throw new DeliverableError(409, `${labelOf(d)} is not delivered by a post on The Pulse.`);
  if (!UUID_RE.test(String(postId))) throw new DeliverableError(404, 'Post not found.');
  const [post] = await q(db, 'SELECT id, show_id, post_format, post_type FROM feed_posts WHERE id = :postId AND deleted_at IS NULL', { postId });
  if (!post) throw new DeliverableError(404, 'Post not found.');
  if (d.show_id && post.show_id && String(d.show_id) !== String(post.show_id)) throw new DeliverableError(409, 'That post is in another show.');
  if (formatOf(post) !== format) {
    const { FORMAT_LABELS } = require('./postMedia');
    throw new DeliverableError(409, `That post is a ${FORMAT_LABELS[formatOf(post)].toLowerCase()}; ${labelOf(d)} need a ${FORMAT_LABELS[format].toLowerCase()}.`);
  }
  const [taken] = await q(db, `SELECT dp.deliverable_id FROM deliverable_posts dp WHERE dp.feed_post_id = :postId AND dp.deleted_at IS NULL`, { postId });
  if (taken) {
    if (taken.deliverable_id === d.id) return progressForEvent(db, d.event_id);
    throw new DeliverableError(409, 'That post already counts toward another deliverable. Unlink it there first.');
  }
  await db.sequelize.query(`INSERT INTO deliverable_posts (deliverable_id, feed_post_id, created_by) VALUES (:deliverableId, :postId, :by)`,
    { replacements: { deliverableId: d.id, postId, by } });
  return progressForEvent(db, d.event_id);
}

async function unlink(db, { deliverableId, postId }) {
  const d = await deliverableRow(db, deliverableId);
  if (!UUID_RE.test(String(postId))) throw new DeliverableError(404, 'Post not found.');
  const [, meta] = await db.sequelize.query(`UPDATE deliverable_posts SET deleted_at = NOW(), updated_at = NOW()
    WHERE deliverable_id = :deliverableId AND feed_post_id = :postId AND deleted_at IS NULL`, { replacements: { deliverableId: d.id, postId } });
  if (!meta?.rowCount) throw new DeliverableError(404, 'That post does not count toward this deliverable.');
  return progressForEvent(db, d.event_id);
}

/** Words worth matching: the brand's and the event's, without the short ones. */
const wordsOf = (v) => String(v || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/**
 * Posts that could count toward a deliverable, best first: same show, the
 * deliverable's format, not counted anywhere yet. +3 for naming the brand,
 * +2 for naming the event, +1 when Lala posted it; ties go to live posts,
 * then the newest. Deterministic; no AI.
 */
function rankSuggestions(d, posts, { lalaProfileId = null } = {}) {
  const brand = wordsOf(d.brand_or_company);
  const event = wordsOf(d.event_name);
  const scored = posts.map((p) => {
    const text = ` ${String(p.content_text || '').toLowerCase()} ${String(p.poster_handle || '').toLowerCase()} `;
    const has = (words) => words.length > 0 && words.every((w) => text.includes(w));
    let score = 0;
    if (has(brand)) score += 3;
    if (has(event)) score += 2;
    if (lalaProfileId && Number(p.social_profile_id) === Number(lalaProfileId)) score += 1;
    return { p, score };
  });
  return scored.sort((a, b) => (b.score - a.score)
    || ((b.p.status === 'live') - (a.p.status === 'live'))
    || (new Date(b.p.posted_at || b.p.created_at) - new Date(a.p.posted_at || a.p.created_at))
    || String(a.p.id).localeCompare(String(b.p.id)))
    .map(({ p, score }) => ({
      id: p.id, handle: p.poster_handle || null, text: clip(p.content_text), status: p.status,
      format: formatOf(p), posted_at: iso(p.posted_at), score,
    }));
}

async function suggestions(db, deliverableId) {
  const d = await deliverableRow(db, deliverableId);
  const format = formatFor(d.deliverable_type);
  if (!format) return { deliverable_id: d.id, format: null, posts: [] };
  const posts = await q(db, `SELECT fp.id, fp.poster_handle, fp.content_text, fp.status, fp.post_format, fp.post_type, fp.posted_at,
      fp.created_at, fp.social_profile_id
    FROM feed_posts fp
    WHERE fp.deleted_at IS NULL AND fp.show_id = :showId AND fp.status IN ('live', 'draft')
      AND NOT EXISTS (SELECT 1 FROM deliverable_posts dp WHERE dp.feed_post_id = fp.id AND dp.deleted_at IS NULL)
    ORDER BY COALESCE(fp.posted_at, fp.created_at) DESC LIMIT 300`, { showId: d.show_id });
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const ofFormat = posts.filter((p) => formatOf(p) === format);
  return { deliverable_id: d.id, format, posts: rankSuggestions(d, ofFormat, { lalaProfileId }).slice(0, SUGGEST_LIMIT) };
}

/** What a post counts toward now, and the open deliverables in its show it could count toward. */
async function forPost(db, postId) {
  if (!UUID_RE.test(String(postId))) throw new DeliverableError(404, 'Post not found.');
  const [post] = await q(db, 'SELECT id, show_id, post_format, post_type FROM feed_posts WHERE id = :postId AND deleted_at IS NULL', { postId });
  if (!post) throw new DeliverableError(404, 'Post not found.');
  const [current] = await q(db, `SELECT ed.id, ed.description, ed.deliverable_type, ed.quantity, we.name AS event_name, o.name AS deal_name
    FROM deliverable_posts dp JOIN event_deliverables ed ON ed.id = dp.deliverable_id AND ed.deleted_at IS NULL
    JOIN world_events we ON we.id = ed.event_id
    LEFT JOIN opportunities o ON o.event_id = ed.event_id AND o.deleted_at IS NULL
    WHERE dp.feed_post_id = :postId AND dp.deleted_at IS NULL LIMIT 1`, { postId });
  const format = formatOf(post);
  const types = Object.entries(FORMAT_FOR_DELIVERABLE).filter(([, f]) => f === format).map(([t]) => t);
  const open = types.length ? await q(db, `SELECT ed.id, ed.description, ed.deliverable_type, ed.quantity, ed.event_id, we.name AS event_name, o.name AS deal_name
    FROM event_deliverables ed JOIN world_events we ON we.id = ed.event_id AND we.deleted_at IS NULL
    LEFT JOIN opportunities o ON o.event_id = ed.event_id AND o.deleted_at IS NULL
    WHERE ed.deleted_at IS NULL AND we.show_id = :showId AND ed.deliverable_type IN (:types)
    ORDER BY we.name ASC LIMIT 50`, { showId: post.show_id, types }) : [];
  const progress = await progressForEvents(db, open.map((o) => o.event_id));
  const name = (r) => `${r.deal_name || r.event_name} · ${labelOf(r)}`;
  return {
    post_id: post.id,
    format,
    counts_toward: current ? { deliverable_id: current.id, name: name(current) } : null,
    open: open
      .map((o) => ({ deliverable_id: o.id, name: name(o), line: progress.get(o.event_id)?.deliverables.find((x) => x.id === o.id)?.line || null,
        done: Boolean(progress.get(o.event_id)?.deliverables.find((x) => x.id === o.id)?.done) }))
      .filter((o) => !o.done),
  };
}

/** Deals booked or underway whose countable deliverables all went out, the last one in [start, end). */
async function dealsDone(db, { start, end }) {
  const opps = await q(db, `SELECT id, show_id, name, brand_or_company, event_id FROM opportunities
    WHERE deleted_at IS NULL AND event_id IS NOT NULL AND status NOT IN ('declined', 'expired', 'cancelled', 'archived')
    ORDER BY created_at DESC LIMIT 200`);
  const progress = await progressForEvents(db, opps.map((o) => o.event_id));
  return opps
    .map((o) => ({ o, p: progress.get(o.event_id) }))
    .filter(({ p }) => p?.all_done && p.done_at && new Date(p.done_at) >= start && new Date(p.done_at) < end)
    .map(({ o, p }) => ({ id: o.id, show_id: o.show_id, name: o.name, brand: o.brand_or_company || null, done_at: p.done_at,
      lines: p.deliverables.filter((d) => d.countable).map((d) => d.line) }));
}

/** Deals going public in [now, until] with deliverables still to post. */
async function dueSoon(db, { now, until }) {
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  const opps = await q(db, `SELECT id, show_id, name, brand_or_company, event_id, publish_date FROM opportunities
    WHERE deleted_at IS NULL AND event_id IS NOT NULL AND status NOT IN ('declined', 'expired', 'cancelled', 'archived', 'completed', 'paid')
      AND publish_date BETWEEN :from AND :to ORDER BY publish_date ASC LIMIT 50`, { from: day(now), to: day(until) });
  const progress = await progressForEvents(db, opps.map((o) => o.event_id));
  return opps
    .map((o) => ({ o, p: progress.get(o.event_id) }))
    .filter(({ p }) => p && p.countable > p.done)
    .map(({ o, p }) => ({ id: o.id, show_id: o.show_id, name: o.name, brand: o.brand_or_company || null, publish_date: o.publish_date,
      left: p.deliverables.filter((d) => d.countable && !d.done).map((d) => d.line) }));
}

module.exports = {
  DeliverableError, formatFor, labelOf, counts, progressOf, summarize, rankSuggestions,
  progressForEvents, progressForEvent, progressForOpportunity, progressForBrand,
  link, unlink, suggestions, forPost, dealsDone, dueSoon,
};

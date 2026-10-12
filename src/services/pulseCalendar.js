'use strict';

/**
 * Admin › The Pulse › Calendar (Task #2988; The Pulse spec §4 "Calendar —
 * every post, reveal and event on one story-time calendar";
 * docs/reads/2026-10-12-pulse-world-depth-read.md §6). Read only.
 *
 *   calendarOf(db, showId, { from, to })
 *     → { moments: [{ order, label, posts, reveals, events, closeness, dms }],
 *         unplaced: { posts, reveals } }
 *
 * Everything is keyed on story order (services/storyClock.js):
 *   posts      postOrderSql (stamped, else its episode and phase), live and
 *              drafts, the drafts marked
 *   reveals    pulseReveals.resolveOrders: the moment each item is revealed
 *   events     their episode's During; the free-text date as written, never
 *              parsed (world_events.event_date)
 *   closeness  the closeness ledger (Task #2983), not the rejected changes
 *   dms        DM messages (Task #2984), not the rejected ones; included once
 *              the DM tables exist
 * Posts and reveals whose story time is not known yet are counted apart
 * (unplaced). The novel's story_calendar_events is a different calendar and
 * is not read.
 */

const SNIPPET = 140;
const cut = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > SNIPPET ? `${t.slice(0, SNIPPET - 1)}…` : t;
};

async function calendarOf(db, showId, { from = null, to = null } = {}) {
  const { sequelize } = db;
  const { postOrderSql, label } = require('./storyClock');
  const moments = new Map();
  const at = (order) => {
    if (!moments.has(order)) moments.set(order, { order, label: label(order), posts: [], reveals: [], events: [], closeness: [], dms: [] });
    return moments.get(order);
  };
  const inRange = (order) => Number.isInteger(order) && (from === null || order >= from) && (to === null || order <= to);
  const unplaced = { posts: 0, reveals: 0 };

  const [posts] = await sequelize.query(
    `SELECT fp.id, fp.status, fp.poster_handle, fp.content_text, fp.post_type, ${postOrderSql('fp')} AS story_order
       FROM feed_posts fp
      WHERE fp.show_id = :showId AND fp.deleted_at IS NULL AND fp.status IN ('draft', 'live')
      ORDER BY fp.posted_at NULLS LAST, fp.created_at`, { replacements: { showId } });
  for (const p of posts) {
    const order = p.story_order == null ? null : Number(p.story_order);
    if (order === null) { unplaced.posts += 1; continue; }
    if (inRange(order)) at(order).posts.push({ id: p.id, status: p.status, poster_handle: p.poster_handle, post_type: p.post_type, text: cut(p.content_text) });
  }

  if (db.PulseReveal) {
    const reveals = await db.PulseReveal.findAll({ where: { show_id: showId }, raw: true });
    const orders = await require('./pulseReveals').resolveOrders(db, reveals);
    reveals.forEach((r, i) => {
      if (!Number.isInteger(orders[i])) { unplaced.reveals += 1; return; }
      if (inRange(orders[i])) {
        at(orders[i]).reveals.push({ id: r.id, item_type: r.item_type, item_id: r.item_id, image_kind: r.image_kind, moment: r.moment, mode: r.mode });
      }
    });
  }

  const [events] = await sequelize.query(
    `SELECT we.id, we.name, we.event_date, we.event_time, we.venue_name, e.episode_number
       FROM world_events we JOIN episodes e ON e.id = we.used_in_episode_id AND e.deleted_at IS NULL
      WHERE we.show_id = :showId AND we.deleted_at IS NULL AND e.episode_number IS NOT NULL`, { replacements: { showId } });
  const { orderOf } = require('./storyClock');
  for (const ev of events) {
    const order = orderOf(ev.episode_number, 'during_episode');
    if (inRange(order)) {
      at(order).events.push({
        id: ev.id, name: ev.name, episode_number: Number(ev.episode_number),
        date: ev.event_date || null, time: ev.event_time || null, venue: ev.venue_name || null,
      });
    }
  }

  const handleOf = new Map();
  const handles = async (ids) => {
    const missing = [...new Set(ids.map(Number))].filter((id) => !handleOf.has(id));
    if (!missing.length) return;
    const [rows] = await sequelize.query('SELECT id, handle FROM social_profiles WHERE id IN (:ids)', { replacements: { ids: missing } });
    for (const r of rows) handleOf.set(Number(r.id), r.handle);
  };

  if (db.PulseCloseness) {
    const { Op } = require('sequelize');
    const changes = await db.PulseCloseness.findAll({ where: { show_id: showId, status: { [Op.ne]: 'rejected' } }, raw: true });
    await handles(changes.flatMap((c) => [c.profile_a_id, c.profile_b_id]));
    for (const c of changes) {
      if (inRange(Number(c.story_order))) {
        at(Number(c.story_order)).closeness.push({
          id: c.id, a: handleOf.get(Number(c.profile_a_id)) || null, b: handleOf.get(Number(c.profile_b_id)) || null,
          delta: Number(c.delta), cause: c.cause, status: c.status,
        });
      }
    }
  }

  if (db.PulseDmMessage) {
    const { Op } = require('sequelize');
    const messages = await db.PulseDmMessage.findAll({ where: { show_id: showId, status: { [Op.ne]: 'rejected' } }, raw: true });
    await handles(messages.map((m) => m.sender_profile_id));
    for (const m of messages) {
      if (inRange(Number(m.story_order))) {
        at(Number(m.story_order)).dms.push({
          id: m.id, thread_id: m.thread_id, sender: handleOf.get(Number(m.sender_profile_id)) || null, status: m.status, text: cut(m.text),
        });
      }
    }
  }

  return { moments: [...moments.values()].sort((x, y) => x.order - y.order), unplaced };
}

module.exports = { calendarOf, SNIPPET };

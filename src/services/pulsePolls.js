'use strict';

/**
 * Audience polls (Task #3005; The Pulse spec §11 "Audience voting: a public
 * poll ('which look for <event>?') whose result is offered to Evoni as a
 * choice on the Style Page"; docs/reads/2026-10-12-pulse-public-extras-read.md
 * §2, §3). Evoni, 2026-10-12: one vote per browser plus a rate limit; no
 * accounts, no captcha; results are advisory.
 *
 *   createPoll / updatePoll   a draft about an event (its episode found
 *                             through used_in_episode_id) or an episode; 2-6
 *                             options, each a label and wardrobe item ids
 *   openPoll / closePoll      draft -> open -> closed; an open poll past its
 *                             closes_at reads and votes as closed (and is
 *                             stamped closed when next touched)
 *   listForShow               Admin: every poll with its options and counts
 *   publicPolls               the public site: open polls (no counts) and
 *                             polls closed in the last week (with counts);
 *                             labels only, never wardrobe, event or episode ids
 *   castVote                  one vote per poll per voter cookie and per IP,
 *                             each hashed with POLL_HASH_SALT; never stored raw
 */

const crypto = require('crypto');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const RESULTS_DAYS = 7;   // a closed poll's result stays on the public site this long
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PollError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'PollError'; }
}

/** sha256 of the salt and a value, hex; null when there is no salt. */
function hashWith(salt, kind, value) {
  if (!salt) return null;
  return crypto.createHash('sha256').update(`${salt}:${kind}:${value}`).digest('hex');
}

/** The salt votes are hashed with, or null (votes are then refused). */
const saltOf = () => String(process.env.POLL_HASH_SALT || '').trim() || null;

/** open, closed or draft as it stands now: an open poll past closes_at is closed. */
function statusAt(poll, now = new Date()) {
  if (poll.status === 'open' && poll.closes_at && new Date(poll.closes_at) <= now) return 'closed';
  return poll.status;
}

/** Stamps a due poll closed. */
async function closeIfDue(poll, now = new Date()) {
  if (poll.status === 'open' && statusAt(poll, now) === 'closed') {
    await poll.update({ status: 'closed', closed_at: poll.closes_at });
  }
  return poll;
}

/** Checks the options: 2-6, each a label and existing wardrobe item ids. Returns them cleaned. */
async function cleanOptions(db, options) {
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    throw new PollError(400, `A poll needs ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`);
  }
  const cleaned = options.map((o, i) => {
    const label = String(o?.label || '').trim();
    if (!label) throw new PollError(400, `Option ${i + 1} needs a label.`);
    const ids = Array.isArray(o.wardrobe_ids) ? [...new Set(o.wardrobe_ids.map(String))] : [];
    if (ids.some((id) => !UUID_RE.test(id))) throw new PollError(400, `Option ${i + 1} names a wardrobe item that is not an id.`);
    return { label: label.slice(0, 200), wardrobe_ids: ids, sort_order: i };
  });
  const all = [...new Set(cleaned.flatMap((o) => o.wardrobe_ids))];
  if (all.length) {
    const [found] = await db.sequelize.query(
      'SELECT id FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids: all } });
    const known = new Set(found.map((r) => String(r.id)));
    const missing = all.filter((id) => !known.has(id));
    if (missing.length) throw new PollError(400, `Wardrobe item ${missing[0]} was not found.`);
  }
  return cleaned;
}

/** The subject: an event of the show (and its episode), or an episode of the show. */
async function subjectOf(db, showId, { worldEventId, episodeId }) {
  if (worldEventId) {
    if (!UUID_RE.test(String(worldEventId))) throw new PollError(400, 'world_event_id must be an event id.');
    const [[ev]] = await db.sequelize.query(
      'SELECT id, name, used_in_episode_id FROM world_events WHERE id = :id AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { id: worldEventId, showId } });
    if (!ev) throw new PollError(400, 'That event is not one of this show\'s.');
    return { world_event_id: ev.id, episode_id: ev.used_in_episode_id || null, name: ev.name };
  }
  if (episodeId) {
    if (!UUID_RE.test(String(episodeId))) throw new PollError(400, 'episode_id must be an episode id.');
    const [[ep]] = await db.sequelize.query(
      'SELECT id, title FROM episodes WHERE id = :id AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { id: episodeId, showId } });
    if (!ep) throw new PollError(400, 'That episode is not one of this show\'s.');
    return { world_event_id: null, episode_id: ep.id, name: ep.title };
  }
  throw new PollError(400, 'Say which event (world_event_id) or episode (episode_id) the poll is about.');
}

/** A closes_at value: null, or a future date. */
function closesAtOf(value) {
  if (value === undefined || value === null || value === '') return null;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw new PollError(400, 'closes_at must be a date.');
  if (when <= new Date()) throw new PollError(400, 'closes_at must be in the future.');
  return when;
}

async function createPoll(db, { showId, worldEventId, episodeId, question, options, closesAt }) {
  const subject = await subjectOf(db, showId, { worldEventId, episodeId });
  const cleaned = await cleanOptions(db, options);
  const text = String(question || '').trim() || `Which look for ${subject.name || 'the event'}?`;
  return db.sequelize.transaction(async (transaction) => {
    const poll = await db.PulsePoll.create({
      show_id: showId, world_event_id: subject.world_event_id, episode_id: subject.episode_id,
      question: text.slice(0, 500), status: 'draft', closes_at: closesAtOf(closesAt),
    }, { transaction });
    await db.PulsePollOption.bulkCreate(cleaned.map((o) => ({ ...o, poll_id: poll.id })), { transaction });
    return poll;
  });
}

/** Edits a draft: its question, closing time and options (replaced whole). */
async function updatePoll(db, poll, { question, options, closesAt }) {
  if (poll.status !== 'draft') throw new PollError(409, 'Only a draft poll can be edited.');
  const cleaned = options !== undefined ? await cleanOptions(db, options) : null;
  return db.sequelize.transaction(async (transaction) => {
    const updates = {};
    if (question !== undefined) {
      const text = String(question || '').trim();
      if (!text) throw new PollError(400, 'A poll needs a question.');
      updates.question = text.slice(0, 500);
    }
    if (closesAt !== undefined) updates.closes_at = closesAtOf(closesAt);
    if (Object.keys(updates).length) await poll.update(updates, { transaction });
    if (cleaned) {
      await db.PulsePollOption.destroy({ where: { poll_id: poll.id }, force: true, transaction });
      await db.PulsePollOption.bulkCreate(cleaned.map((o) => ({ ...o, poll_id: poll.id })), { transaction });
    }
    return poll;
  });
}

async function openPoll(db, poll) {
  if (poll.status !== 'draft') throw new PollError(409, `This poll is already ${poll.status}.`);
  if (poll.closes_at && new Date(poll.closes_at) <= new Date()) throw new PollError(400, 'Its closing time has passed; set a new one first.');
  const options = await db.PulsePollOption.count({ where: { poll_id: poll.id } });
  if (options < MIN_OPTIONS) throw new PollError(400, `A poll needs ${MIN_OPTIONS} options before it opens.`);
  return poll.update({ status: 'open', opened_at: new Date() });
}

async function closePoll(poll) {
  await closeIfDue(poll);
  if (poll.status !== 'open') throw new PollError(409, poll.status === 'closed' ? 'This poll is already closed.' : 'A draft poll is not open.');
  return poll.update({ status: 'closed', closed_at: new Date() });
}

/** Map(option id -> votes) for some polls. */
async function countsOf(db, pollIds) {
  if (!pollIds.length) return new Map();
  const [rows] = await db.sequelize.query(
    `SELECT option_id, COUNT(*)::int AS n FROM pulse_poll_votes
      WHERE poll_id IN (:ids) AND deleted_at IS NULL GROUP BY option_id`, { replacements: { ids: pollIds } });
  return new Map(rows.map((r) => [String(r.option_id), r.n]));
}

async function optionsOf(db, pollIds) {
  if (!pollIds.length) return [];
  return db.PulsePollOption.findAll({ where: { poll_id: pollIds }, order: [['sort_order', 'ASC']], raw: true });
}

/** Admin: every poll of the show, newest first, with options, counts and its status now. */
async function listForShow(db, showId) {
  const polls = await db.PulsePoll.findAll({ where: { show_id: showId }, order: [['created_at', 'DESC']] });
  for (const p of polls) await closeIfDue(p);
  const ids = polls.map((p) => p.id);
  const [options, counts] = await Promise.all([optionsOf(db, ids), countsOf(db, ids)]);
  return polls.map((p) => {
    const mine = options.filter((o) => o.poll_id === p.id).map((o) => ({
      id: o.id, label: o.label, wardrobe_ids: o.wardrobe_ids, sort_order: o.sort_order, votes: counts.get(String(o.id)) || 0,
    }));
    return {
      id: p.id, show_id: p.show_id, world_event_id: p.world_event_id, episode_id: p.episode_id,
      question: p.question, status: p.status, closes_at: p.closes_at, opened_at: p.opened_at, closed_at: p.closed_at,
      created_at: p.created_at, options: mine, total: mine.reduce((n, o) => n + o.votes, 0),
    };
  });
}

/**
 * The public site's polls: open ones (labels, no counts) and those closed in
 * the last RESULTS_DAYS (with counts). Only the poll's own ids, its question
 * and its labels leave the server: no wardrobe, event, episode or show ids.
 */
async function publicPolls(db, now = new Date()) {
  const { Op } = require('sequelize');
  const since = new Date(now.getTime() - RESULTS_DAYS * 24 * 60 * 60 * 1000);
  const polls = await db.PulsePoll.findAll({
    where: { status: { [Op.in]: ['open', 'closed'] } },
    order: [['opened_at', 'DESC']],
  });
  for (const p of polls) await closeIfDue(p, now);
  const shown = polls.filter((p) => p.status === 'open' || (p.closed_at && new Date(p.closed_at) >= since));
  const ids = shown.map((p) => p.id);
  const [options, counts] = await Promise.all([optionsOf(db, ids), countsOf(db, ids)]);
  return shown.map((p) => {
    const closed = p.status === 'closed';
    const mine = options.filter((o) => o.poll_id === p.id)
      .map((o) => ({ id: o.id, label: o.label, ...(closed ? { votes: counts.get(String(o.id)) || 0 } : {}) }));
    return {
      id: p.id, question: p.question, status: p.status, closes_at: closed ? null : p.closes_at,
      options: mine, ...(closed ? { total: mine.reduce((n, o) => n + o.votes, 0) } : {}),
    };
  });
}

/**
 * One vote. voterId is the browser's cookie id, ip the request's address;
 * both are hashed with POLL_HASH_SALT and never stored raw. A second vote
 * from the same cookie or IP is a 409.
 */
async function castVote(db, { pollId, optionId, voterId, ip }) {
  const salt = saltOf();
  if (!salt) throw new PollError(503, 'Voting is not set up yet.');
  if (!UUID_RE.test(String(pollId)) || !UUID_RE.test(String(optionId || ''))) throw new PollError(404, 'Poll not found');
  const poll = await db.PulsePoll.findByPk(pollId);
  if (!poll || poll.status === 'draft') throw new PollError(404, 'Poll not found');
  await closeIfDue(poll);
  if (poll.status !== 'open') throw new PollError(409, 'This poll has closed.');
  const option = await db.PulsePollOption.findOne({ where: { id: optionId, poll_id: poll.id } });
  if (!option) throw new PollError(400, 'That is not one of this poll\'s options.');
  try {
    await db.PulsePollVote.create({
      poll_id: poll.id, option_id: option.id,
      voter_hash: hashWith(salt, 'voter', voterId), ip_hash: hashWith(salt, 'ip', ip || 'unknown'),
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw new PollError(409, 'You\'ve voted already.');
    throw err;
  }
  return { ok: true };
}

module.exports = {
  MIN_OPTIONS, MAX_OPTIONS, RESULTS_DAYS, PollError,
  hashWith, statusAt, createPoll, updatePoll, openPoll, closePoll, listForShow, publicPolls, castVote,
};

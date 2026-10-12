'use strict';
/**
 * The follower ledger (Task #2952; The Pulse spec §8; services/pulseFollowers.js).
 * Mounted at /api/v1/pulse-followers.
 *
 *   GET  /?show_id=&at=            every profile's count at a story moment
 *                                  (no `at`: the latest), with its handle,
 *                                  name and tier, and the proposed rows
 *                                  waiting for Evoni (requireAuth)
 *   GET  /history?show_id=&profile_id=  one profile's rows, oldest first
 *                                  (requireAuth)
 *   POST /starts { show_id }       proposes starting counts for profiles
 *                                  with none (requireAuth + ADMIN)
 *   PUT  /:id/accept               accepts a proposed row (ADMIN)
 *   PUT  /:id/adjust { count | change, reason }  accepts it at another
 *                                  count, or with another change (ADMIN);
 *                                  an episode change also writes Lala's
 *                                  Decision Log row (Task #2956)
 *   POST /override { show_id, profile_id, change, reason, at? }
 *                                  an accepted change with a reason; `at`
 *                                  defaults to the present (ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badShow = (res) => res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

const shape = (r) => ({
  id: r.id,
  social_profile_id: Number(r.social_profile_id),
  story_order: Number(r.story_order),
  change: Number(r.change),
  count_after: r.count_after == null ? null : Number(r.count_after),
  cause: r.cause,
  cause_id: r.cause_id,
  reason: r.reason,
  status: r.status,
  decided_by: r.decided_by,
  decided_at: r.decided_at,
  factors: r.factors_json || null,
});

/** A LedgerError or a 400 from the story clock as its response; false otherwise. */
function sendKnown(res, err) {
  if (err instanceof require('../services/pulseFollowers').LedgerError || err.status === 400) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const db = getModels();
    const { countsAt } = require('../services/pulseFollowers');
    const at = await require('../services/storyClock').resolveAt(db, showId, req.query.at);
    const counts = await countsAt(db, showId, at);
    const proposed = await db.PulseFollower.findAll({
      where: { show_id: showId, status: 'proposed' }, order: [['story_order', 'ASC'], ['created_at', 'ASC']] });
    const ids = [...new Set([...counts.map((c) => c.social_profile_id), ...proposed.map((p) => Number(p.social_profile_id))])];
    const [profiles] = ids.length ? await db.sequelize.query(
      `SELECT id, handle, display_name, follower_tier::text AS follower_tier
         FROM social_profiles WHERE id IN (:ids)`, { replacements: { ids } }) : [[]];
    const profileOf = new Map(profiles.map((p) => [Number(p.id), p]));
    const who = (id) => {
      const p = profileOf.get(id);
      return { handle: p?.handle || null, display_name: p?.display_name || null, follower_tier: p?.follower_tier || null };
    };
    return res.json({
      success: true,
      at: at ?? null,
      counts: counts.map((c) => ({ ...c, ...who(c.social_profile_id) })),
      proposed: proposed.map((p) => ({ ...shape(p), ...who(Number(p.social_profile_id)) })),
    });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseFollowers] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const profileId = Number(req.query.profile_id);
    if (!Number.isInteger(profileId) || profileId < 1) return res.status(400).json({ success: false, error: 'profile_id must be a Feed profile id.' });
    const { PulseFollower } = getModels();
    const rows = await PulseFollower.findAll({
      where: { show_id: showId, social_profile_id: profileId },
      order: [['story_order', 'ASC'], ['decided_at', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ success: true, history: rows.map(shape) });
  } catch (err) {
    console.error('[PulseFollowers] GET history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /growth?show_id= (Task #2957): Admin › The Pulse › Growth, read only
// (services/pulseGrowth.js): Lala's follower line, projection, best and
// worst posts and biggest jumps. Count and tier only; no Influence yet.
router.get('/growth', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const db = getModels();
    const growth = await require('../services/pulseGrowth').growthOf(db, showId);
    return res.json({ success: true, ...growth });
  } catch (err) {
    console.error('[PulseFollowers] GET growth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/starts', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = String(req.body?.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const db = getModels();
    if (!(await db.Show.findByPk(showId))) return res.status(404).json({ success: false, error: 'Show not found' });
    const { lalaProfileId } = require('../services/lalaFeedProfile');
    const { proposeStarts } = require('../services/pulseFollowers');
    const result = await proposeStarts(db, showId, { lalaProfileId: await lalaProfileId(db.sequelize) });
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (err) {
    console.error('[PulseFollowers] POST starts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function decideRoute(req, res, adjust) {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Change not found' });
    const db = getModels();
    const row = await db.PulseFollower.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Change not found' });
    const { decide } = require('../services/pulseFollowers');
    const opts = { by: byOf(req) };
    if (adjust) {
      if (req.body?.change !== undefined) opts.adjustBy = Number.isInteger(req.body.change) ? req.body.change : Number.NaN;
      else opts.adjustTo = Number.isInteger(req.body?.count) ? req.body.count : Number.NaN;
      opts.reason = req.body?.reason ?? null;
    }
    await decide(db, row, opts);
    return res.json({ success: true, change: shape(row) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error(`[PulseFollowers] PUT ${adjust ? 'adjust' : 'accept'} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

router.put('/:id/accept', requireAuth, authorize(['ADMIN']), (req, res) => decideRoute(req, res, false));
router.put('/:id/adjust', requireAuth, authorize(['ADMIN']), (req, res) => decideRoute(req, res, true));

router.post('/override', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const profileId = Number(body.profile_id);
    if (!Number.isInteger(profileId) || profileId < 1) return res.status(400).json({ success: false, error: 'profile_id must be a Feed profile id.' });
    const db = getModels();
    const at = await require('../services/storyClock').resolveAt(db, showId, body.at ?? 'present');
    const { override } = require('../services/pulseFollowers');
    const row = await override(db, { showId, profileId, change: body.change, reason: body.reason, at, by: byOf(req) });
    return res.status(201).json({ success: true, change: shape(row) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseFollowers] POST override error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

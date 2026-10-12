'use strict';
/**
 * Post numbers in Review (Task #2954; The Pulse spec §8 "Review: Lala's
 * numbers always wait for Evoni"; services/pulseNumbers.js).
 * Mounted at /api/v1/pulse-numbers.
 *
 *   GET /?show_id=&status=     the show's rows (proposed by default), each
 *                              with its post, poster and factors, and the
 *                              total (requireAuth)
 *   PUT /:id/accept            the proposal as it is (requireAuth + ADMIN)
 *   PUT /:id/adjust { likes, shares, reason }  a one-line reason (ADMIN)
 *   PUT /:id/viral             the proposal × a viral multiple (ADMIN)
 *   PUT /:id/flop              the proposal × a flop fraction (ADMIN)
 *
 * A decision records who and when, and the numbers lock: deciding again is
 * a 409.
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['proposed', 'accepted', 'adjusted', 'viral', 'flop'];
const LIMIT = 100;

const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

const shape = (r, post = null) => ({
  id: r.id,
  post_id: r.post_id,
  social_profile_id: r.social_profile_id == null ? null : Number(r.social_profile_id),
  poster_handle: r.poster_handle,
  proposed: { likes: Number(r.proposed_likes), shares: Number(r.proposed_shares) },
  final: r.final_likes == null ? null : { likes: Number(r.final_likes), shares: Number(r.final_shares) },
  factors: r.factors_json || {},
  status: r.status,
  flag: r.flag,
  reason: r.reason,
  story_order: r.story_order == null ? null : Number(r.story_order),
  decided_by: r.decided_by,
  decided_at: r.decided_at,
  post,
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const status = req.query.status === undefined ? 'proposed' : String(req.query.status);
    if (!STATUSES.includes(status)) return res.status(400).json({ success: false, error: `status must be one of ${STATUSES.join(', ')}.` });
    const { PulsePostNumber, sequelize } = getModels();
    const { rows, count } = await PulsePostNumber.findAndCountAll({
      where: { show_id: showId, status },
      order: [['created_at', 'ASC']],
      limit: LIMIT,
    });
    const postIds = rows.map((r) => r.post_id);
    const [posts] = postIds.length ? await sequelize.query(
      `SELECT fp.id, fp.content_text, fp.image_url, fp.post_type, fp.poster_handle, fp.posted_at,
              COALESCE(fp.poster_display_name, sp.display_name) AS poster_display_name
         FROM feed_posts fp LEFT JOIN social_profiles sp ON sp.id = fp.social_profile_id
        WHERE fp.id IN (:postIds)`, { replacements: { postIds } }) : [[]];
    const postOf = new Map(posts.map((p) => [p.id, p]));
    return res.json({ success: true, total: count, numbers: rows.map((r) => shape(r, postOf.get(r.post_id) || null)) });
  } catch (err) {
    console.error('[PulseNumbers] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const decideRoute = (action) => async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Numbers not found' });
    const { PulsePostNumber } = getModels();
    const row = await PulsePostNumber.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Numbers not found' });
    const { decide } = require('../services/pulseNumbers');
    const body = req.body || {};
    await decide(row, action, { likes: body.likes, shares: body.shares, reason: body.reason, by: byOf(req) });
    return res.json({ success: true, numbers: shape(row) });
  } catch (err) {
    if (err instanceof require('../services/pulseNumbers').NumbersError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error(`[PulseNumbers] PUT ${action} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

for (const action of ['accept', 'adjust', 'viral', 'flop']) {
  router.put(`/:id/${action}`, requireAuth, authorize(['ADMIN']), decideRoute(action));
}

module.exports = router;

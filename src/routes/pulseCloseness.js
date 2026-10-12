'use strict';
/**
 * Closeness changes in Review (Task #2983; The Pulse spec §9 "proposed and
 * approved like numbers"; services/pulseCloseness.js).
 * Mounted at /api/v1/pulse-closeness.
 *
 *   GET /?show_id=&status=     the show's changes (proposed by default), each
 *                              with both profiles, its cause and the post
 *                              behind it, and the total (requireAuth)
 *   PUT /:id/accept            the change as proposed (requireAuth + ADMIN)
 *   PUT /:id/adjust { delta, reason }  a different change, a one-line reason (ADMIN)
 *   PUT /:id/reject            (ADMIN)
 *
 * A decision records who and when; deciding again is a 409.
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['proposed', 'accepted', 'rejected'];
const LIMIT = 100;

const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);
const num = (v) => (v == null ? null : Number(v));

const shape = (r, extra = {}) => ({
  id: r.id,
  profile_a_id: Number(r.profile_a_id),
  profile_b_id: Number(r.profile_b_id),
  story_order: Number(r.story_order),
  delta: num(r.delta),
  closeness_after: num(r.closeness_after),
  cause: r.cause,
  source_id: r.source_id,
  reason: r.reason,
  status: r.status,
  decided_by: r.decided_by,
  decided_at: r.decided_at,
  ...extra,
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const status = req.query.status === undefined ? 'proposed' : String(req.query.status);
    if (!STATUSES.includes(status)) return res.status(400).json({ success: false, error: `status must be one of ${STATUSES.join(', ')}.` });
    const { PulseCloseness, sequelize } = getModels();
    const { rows, count } = await PulseCloseness.findAndCountAll({ where: { show_id: showId, status }, order: [['story_order', 'ASC'], ['created_at', 'ASC']], limit: LIMIT });
    const profileIds = [...new Set(rows.flatMap((r) => [r.profile_a_id, r.profile_b_id]))];
    const [profiles] = profileIds.length ? await sequelize.query(
      'SELECT id, handle, display_name FROM social_profiles WHERE id IN (:profileIds)', { replacements: { profileIds } }) : [[]];
    const profileOf = new Map(profiles.map((p) => [Number(p.id), { id: Number(p.id), handle: p.handle, display_name: p.display_name }]));
    // The post behind each change: the post itself (mention, ignored) or the comment's post.
    const sources = rows.map((r) => r.source_id).filter((s) => s && UUID_RE.test(s));
    const [posts] = sources.length ? await sequelize.query(
      `SELECT fp.id::text AS source_id, fp.id AS post_id, fp.content_text, fp.poster_handle, NULL::text AS comment_text FROM feed_posts fp WHERE fp.id::text IN (:sources)
       UNION ALL
       SELECT fc.id::text AS source_id, fp.id AS post_id, fp.content_text, fp.poster_handle, fc.text AS comment_text
         FROM feed_comments fc JOIN feed_posts fp ON fp.id = fc.feed_post_id WHERE fc.id::text IN (:sources)`,
      { replacements: { sources } }) : [[]];
    const sourceOf = new Map(posts.map((p) => [String(p.source_id), { post_id: p.post_id, content_text: p.content_text, poster_handle: p.poster_handle, comment_text: p.comment_text }]));
    const { closenessAt } = require('../services/pulseCloseness');
    const out = [];
    for (const r of rows) {
      const before = await closenessAt(getModels(), showId, r.profile_a_id, r.profile_b_id, r.story_order);
      out.push(shape(r, {
        a: profileOf.get(Number(r.profile_a_id)) || null,
        b: profileOf.get(Number(r.profile_b_id)) || null,
        closeness_before: r.status === 'accepted' ? null : before,
        source: sourceOf.get(String(r.source_id)) || null,
        label: require('../services/storyClock').label(Number(r.story_order)),
      }));
    }
    return res.json({ success: true, total: count, changes: out });
  } catch (err) {
    console.error('[PulseCloseness] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const decideRoute = (action) => async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Change not found' });
    const row = await getModels().PulseCloseness.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Change not found' });
    const body = req.body || {};
    await require('../services/pulseCloseness').decide(row, action, { delta: body.delta, reason: body.reason, by: byOf(req) });
    return res.json({ success: true, change: shape(row) });
  } catch (err) {
    if (err instanceof require('../services/pulseCloseness').ClosenessError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error(`[PulseCloseness] PUT ${action} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

for (const action of ['accept', 'adjust', 'reject']) {
  router.put(`/:id/${action}`, requireAuth, authorize(['ADMIN']), decideRoute(action));
}

module.exports = router;

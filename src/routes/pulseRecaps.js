'use strict';
/**
 * The weekly Pulse recap, Admin side (Task #3008; The Pulse spec §11;
 * services/pulseRecap.js). Mounted at /api/v1/pulse-recaps. The public read
 * is routes/publicRecaps.js.
 *
 *   GET /?show_id=                 the show's recaps, newest week first, each
 *                                  with its posts as The Pulse shows them now
 *                                  (requireAuth)
 *   GET /:id/candidates            the recap's week's posts, biggest first, to
 *                                  add from (requireAuth)
 *   POST /build { show_id, week_start? }   the week's draft (default: last
 *                                  week); a week that has one keeps it (ADMIN)
 *   PUT /:id { title?, intro?, post_ids? } (ADMIN)
 *   POST /:id/publish | /:id/unpublish | /:id/drop (ADMIN)
 *   PUT /:id/posts/:postId/image-rights { category, note?, create? }
 *                                  the rights declaration for the image that
 *                                  chosen post shows (ADMIN; Evoni,
 *                                  2026-11-15): category is one of
 *                                  mediaLibrary.RIGHTS, else 400; note (up to
 *                                  500 characters) with licensed, retailer or
 *                                  ai_cleared only; with no library record
 *                                  409, or create: true makes one for that
 *                                  exact URL as a private draft. Publishing
 *                                  copies, and the public site serves, only an
 *                                  image that is approved, public and cleared
 *                                  (pulseRecap.clearedForPublic).
 *
 * An ADMIN's recap also carries, per post with an image, `image_rights`
 * (library standing, rights, public or not, a copy awaiting revocation) and
 * `pending_revocations`; no other reader is sent them.
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

const isAdmin = (req) => require('../services/mediaLibrary').audienceOf(req.user) === 'admin';

function sendKnown(res, err) {
  const { RecapError } = require('../services/pulseRecap');
  const { MediaError } = require('../services/mediaLibrary');
  if (err instanceof RecapError || err instanceof MediaError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

/** The recap by id, or a 404 sent. */
async function recapOr404(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ success: false, error: 'Recap not found' }); return null; }
  const recap = await getModels().PulseRecap.findByPk(req.params.id);
  if (!recap) { res.status(404).json({ success: false, error: 'Recap not found' }); return null; }
  return recap;
}

/** The recap for the studio; `admin` adds each image's rights review (the note, the declarer and storage keys are an ADMIN's to read). */
async function shaped(recap, admin = false) {
  const svc = require('../services/pulseRecap');
  let posts = await svc.postsOf(getModels(), recap);
  let review = null;
  if (admin) {
    review = await svc.imageReview(getModels(), recap, posts);
    posts = posts.map((p) => ({ ...p, image_rights: review.byPost[String(p.id)] || null }));
  }
  return {
    id: recap.id, show_id: recap.show_id, week_start: recap.week_start, status: recap.status,
    title: recap.title, intro: recap.intro, post_ids: recap.post_ids, posts,
    // Copies that may no longer be served: still in the public bucket, to be removed by hand (never by this app).
    ...(admin ? { pending_revocations: review.pending, revocation_note: review.pending.length ? svc.REVOCATION_NOTE : null } : {}),
    published_at: recap.published_at, published_by: recap.published_by,
    // Images copied to the public site at publishing, and those that could not be (Task #3099).
    public_images: Object.values(recap.images || {}).reduce((n, c) => ({
      copied: n.copied + (c?.key ? 1 : 0), failed: n.failed + (c?.failed ? 1 : 0),
    }), { copied: 0, failed: 0 }),
  };
}

/** The five rights categories, in order, for the review's picker. */
function rightsCategories() {
  const media = require('../services/mediaLibrary');
  return media.RIGHTS_CATEGORIES.map((key) => ({
    key, label: media.RIGHTS[key], cleared: media.CLEARED_RIGHTS.includes(key), note: media.RIGHTS_NOTE_CATEGORIES.includes(key),
  }));
}

/** The decisions share one shape: run it, answer with the recap. */
const decision = (name, run) => async (req, res) => {
  try {
    const recap = await recapOr404(req, res);
    if (!recap) return undefined;
    await run(recap, req);
    return res.json({ success: true, recap: await shaped(recap, isAdmin(req)) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error(`[PulseRecaps] ${name} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const recaps = await getModels().PulseRecap.findAll({ where: { show_id: showId }, order: [['week_start', 'DESC']] });
    const svc = require('../services/pulseRecap');
    return res.json({
      success: true,
      this_week: svc.weekStartOf(new Date()),
      recaps: await Promise.all(recaps.map((r) => shaped(r, isAdmin(req)))),
      ...(isAdmin(req) ? { rights_categories: rightsCategories() } : {}),
    });
  } catch (err) {
    console.error('[PulseRecaps] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/candidates', requireAuth, async (req, res) => {
  try {
    const recap = await recapOr404(req, res);
    if (!recap) return undefined;
    const posts = await require('../services/pulseRecap').candidates(getModels(), recap.show_id, recap.week_start);
    return res.json({ success: true, posts });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseRecaps] candidates error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/build', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const svc = require('../services/pulseRecap');
    const week = body.week_start || svc.weekStartOf(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const { recap, created } = await svc.buildDraft(getModels(), showId, week);
    return res.status(created ? 201 : 200).json({ success: true, created, recap: await shaped(recap, isAdmin(req)) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseRecaps] build error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, authorize(['ADMIN']), decision('PUT', (recap, req) => {
  const body = req.body || {};
  return require('../services/pulseRecap').update(getModels(), recap, { title: body.title, intro: body.intro, postIds: body.post_ids });
}));
router.post('/:id/publish', requireAuth, authorize(['ADMIN']), decision('publish', (recap, req) => require('../services/pulseRecap').publish(getModels(), recap, byOf(req))));
router.post('/:id/unpublish', requireAuth, authorize(['ADMIN']), decision('unpublish', (recap) => require('../services/pulseRecap').unpublish(recap)));
router.post('/:id/drop', requireAuth, authorize(['ADMIN']), decision('drop', (recap) => require('../services/pulseRecap').drop(recap)));

// The body is checked before anything is read or written: a category outside the five is a 400 with nothing changed.
router.put('/:id/posts/:postId/image-rights', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const input = require('../services/mediaLibrary').normalizeRights({ category: body.category, note: body.note });
    if (body.create !== undefined && typeof body.create !== 'boolean') return res.status(400).json({ success: false, error: 'create must be true or false.' });
    if (!UUID_RE.test(req.params.postId)) return res.status(404).json({ success: false, error: 'That post is not in this recap.' });
    const recap = await recapOr404(req, res);
    if (!recap) return undefined;
    await require('../services/pulseRecap').declareImageRights(getModels(), recap, req.params.postId, { ...input, create: body.create === true }, byOf(req));
    return res.json({ success: true, recap: await shaped(recap, true) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseRecaps] image-rights error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

'use strict';
/**
 * Storylines on The Pulse (Task #2989; The Pulse spec §4;
 * services/pulseStorylines.js). Mounted at /api/v1/pulse-storylines.
 *
 *   GET /?show_id=                 the show's storylines with their beats
 *                                  (poster handle, story label, the post a
 *                                  beat made and its status), the show's
 *                                  threads to follow, and the present (requireAuth)
 *   POST / { show_id, title, premise?, show_story_thread_id? }    (ADMIN)
 *   PUT /:id { title?, premise?, status?, show_story_thread_id? }  (ADMIN)
 *   POST /:id/beats { kind, story_order, poster_profile_id, brief }
 *                                  adds a beat; a beat whose moment has come
 *                                  is queued at once (queue only) (ADMIN)
 *   DELETE /:id/beats/:beatId      a beat not yet queued (ADMIN)
 *   POST /:id/suggest              one AI call proposing beats; nothing saved
 *                                  (ADMIN + aiRateLimiter)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendKnown(res, err) {
  const { StorylineError } = require('../services/pulseStorylines');
  // RequestCapError: today's manual requests are used (429; Task #3031).
  if (err instanceof StorylineError || err instanceof require('../services/pulseRequests').RequestCapError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

const shapeLine = (s, beats = []) => ({
  id: s.id, show_id: s.show_id, title: s.title, premise: s.premise, status: s.status,
  show_story_thread_id: s.show_story_thread_id, created_at: s.created_at, beats,
});

/** The storyline by id, or a 404 sent. */
async function lineOr404(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ success: false, error: 'Storyline not found' }); return null; }
  const line = await getModels().PulseStoryline.findByPk(req.params.id);
  if (!line) { res.status(404).json({ success: false, error: 'Storyline not found' }); return null; }
  return line;
}

/** A thread id the show owns, null, or a 400 sent (false). */
async function threadOrBad(res, showId, value) {
  if (value === undefined || value === null || value === '') return null;
  if (!UUID_RE.test(String(value))) { res.status(400).json({ success: false, error: 'show_story_thread_id must be a thread id.' }); return false; }
  const [[row]] = await getModels().sequelize.query(
    'SELECT id FROM show_story_threads WHERE id = :id AND show_id = :showId AND deleted_at IS NULL', { replacements: { id: value, showId } });
  if (!row) { res.status(400).json({ success: false, error: 'That thread is not one of this show\'s.' }); return false; }
  return row.id;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const models = getModels();
    const { sequelize } = models;
    const clock = require('../services/storyClock');
    const lines = await models.PulseStoryline.findAll({ where: { show_id: showId }, order: [['created_at', 'DESC']] });
    const beats = lines.length ? await models.PulseStorylineBeat.findAll({
      where: { storyline_id: lines.map((l) => l.id) }, order: [['story_order', 'ASC'], ['created_at', 'ASC']],
    }) : [];
    const profileIds = [...new Set(beats.map((b) => Number(b.poster_profile_id)))];
    const [profiles] = profileIds.length ? await sequelize.query('SELECT id, handle FROM social_profiles WHERE id IN (:ids)', { replacements: { ids: profileIds } }) : [[]];
    const handleOf = new Map(profiles.map((p) => [Number(p.id), p.handle]));
    const postIds = beats.map((b) => b.post_id).filter(Boolean);
    const [posts] = postIds.length ? await sequelize.query('SELECT id, status, content_text FROM feed_posts WHERE id IN (:ids)', { replacements: { ids: postIds } }) : [[]];
    const postOf = new Map(posts.map((p) => [p.id, p]));
    const [threads] = await sequelize.query(
      `SELECT id, title, status FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC`, { replacements: { showId } });
    const shapeBeat = (b) => {
      const post = b.post_id ? postOf.get(b.post_id) : null;
      return {
        id: b.id, kind: b.kind, story_order: Number(b.story_order), label: clock.label(Number(b.story_order)),
        poster_profile_id: Number(b.poster_profile_id), handle: handleOf.get(Number(b.poster_profile_id)) || null,
        brief: b.brief, status: b.status, post_id: b.post_id,
        post: post ? { id: post.id, status: post.status, text: post.content_text } : null,
      };
    };
    return res.json({
      success: true,
      present: await clock.presentOrder(models, showId),
      threads,
      storylines: lines.map((l) => shapeLine(l, beats.filter((b) => b.storyline_id === l.id).map(shapeBeat))),
    });
  } catch (err) {
    console.error('[PulseStorylines] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const title = String(body.title || '').trim();
    if (!title) return res.status(400).json({ success: false, error: 'A storyline needs a title.' });
    const thread = await threadOrBad(res, showId, body.show_story_thread_id);
    if (thread === false) return undefined;
    const line = await getModels().PulseStoryline.create({
      show_id: showId, title: title.slice(0, 200), premise: body.premise ? String(body.premise).trim().slice(0, 4000) : null,
      show_story_thread_id: thread, status: 'planned',
    });
    return res.status(201).json({ success: true, storyline: shapeLine(line) });
  } catch (err) {
    console.error('[PulseStorylines] POST error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const line = await lineOr404(req, res);
    if (!line) return undefined;
    const body = req.body || {};
    const updates = {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (!title) return res.status(400).json({ success: false, error: 'A storyline needs a title.' });
      updates.title = title.slice(0, 200);
    }
    if (body.premise !== undefined) updates.premise = body.premise ? String(body.premise).trim().slice(0, 4000) : null;
    if (body.status !== undefined) {
      const { STATUSES } = require('../services/pulseStorylines');
      if (!STATUSES.includes(body.status)) return res.status(400).json({ success: false, error: `status must be one of ${STATUSES.join(', ')}.` });
      updates.status = body.status;
    }
    if (body.show_story_thread_id !== undefined) {
      const thread = await threadOrBad(res, line.show_id, body.show_story_thread_id);
      if (thread === false) return undefined;
      updates.show_story_thread_id = thread;
    }
    await line.update(updates);
    return res.json({ success: true, storyline: shapeLine(line) });
  } catch (err) {
    console.error('[PulseStorylines] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/beats', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const line = await lineOr404(req, res);
    if (!line) return undefined;
    if (line.status === 'dropped' || line.status === 'paid_off') return res.status(409).json({ success: false, error: `This storyline is ${line.status.replace('_', ' ')}.` });
    const body = req.body || {};
    const models = getModels();
    const svc = require('../services/pulseStorylines');
    const beat = await svc.addBeat(models, line, {
      kind: body.kind, story_order: Number.isInteger(Number(body.story_order)) && body.story_order !== '' ? Number(body.story_order) : NaN,
      poster_profile_id: Number.isInteger(Number(body.poster_profile_id)) ? Number(body.poster_profile_id) : NaN, brief: body.brief,
    });
    // A beat whose moment has already come is queued now (queue only, no AI in the request).
    await svc.queueDueBeats(models, line.show_id);
    await beat.reload();
    return res.status(201).json({ success: true, beat: { id: beat.id, status: beat.status, job_id: beat.job_id }, queued: beat.status === 'queued', engine_on: process.env.PULSE_ENGINE_ENABLED === 'true' });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseStorylines] POST beat error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id/beats/:beatId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const line = await lineOr404(req, res);
    if (!line) return undefined;
    if (!UUID_RE.test(req.params.beatId)) return res.status(404).json({ success: false, error: 'Beat not found' });
    const beat = await getModels().PulseStorylineBeat.findOne({ where: { id: req.params.beatId, storyline_id: line.id } });
    if (!beat) return res.status(404).json({ success: false, error: 'Beat not found' });
    if (beat.status !== 'planned') return res.status(409).json({ success: false, error: 'This beat is already queued or drafted.' });
    await beat.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('[PulseStorylines] DELETE beat error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/suggest', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const line = await lineOr404(req, res);
    if (!line) return undefined;
    const suggestions = await require('../services/pulseStorylines').suggestBeats(getModels(), line.id);
    return res.json({ success: true, suggestions });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseStorylines] suggest error:', err);
    return res.status(err.status === 429 ? 429 : 500).json({ success: false, error: err.message });
  }
});

module.exports = router;

'use strict';
/**
 * Lala's everyday fits (Task #2922; The Pulse spec §3 "Latest fit", §4
 * Uploads): outfits she wears outside episodes, one photo each with an
 * optional caption and the story date she wore it. Mounted at
 * /api/v1/pulse-fits; every route requireAuth.
 *
 *   GET    /?show_id=     the show's fits, newest story date first (undated last)
 *   GET    /latest?show_id=&at=  The Pulse's "Check out the latest fit" (Task #2924;
 *                         as of a story moment, Task #2937)
 *   POST   /              multipart: image, show_id, caption?, image_alt?, story_date?
 *   PATCH  /:id           { caption?, image_alt?, story_date? }
 *   DELETE /:id           soft delete (paranoid)
 *
 * Photos go to the studio's storage through pulseImageService.
 */
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ALT = 300;
const MAX_CAPTION = 2000;

const fitUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } }).single('image');
const oneFit = (req, res, next) => fitUpload(req, res, (err) => {
  if (!err) return next();
  console.error('[PulseFits] upload rejected:', err.message);
  return res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'The photo is 15 MB at most.' : err.message });
});

/** The editable fields from a body: { value } or { error }. Only keys present are read. */
function readFields(body = {}) {
  const value = {};
  if (body.caption !== undefined) {
    if (body.caption !== null && typeof body.caption !== 'string') return { error: 'The caption must be text.' };
    const caption = (body.caption || '').trim();
    if (caption.length > MAX_CAPTION) return { error: `The caption is ${MAX_CAPTION} characters at most.` };
    value.caption = caption || null;
  }
  if (body.image_alt !== undefined) {
    if (body.image_alt !== null && typeof body.image_alt !== 'string') return { error: 'The alt text must be text.' };
    const alt = (body.image_alt || '').trim();
    if (alt.length > MAX_ALT) return { error: `The alt text is ${MAX_ALT} characters at most.` };
    value.image_alt = alt || null;
  }
  if (body.story_date !== undefined) {
    const date = body.story_date === null ? '' : String(body.story_date).trim();
    if (date && (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) return { error: 'The story date is a date like 2026-10-11.' };
    value.story_date = date || null;
  }
  return { value };
}

const shape = (fit) => ({
  id: fit.id,
  show_id: fit.show_id,
  image_url: fit.image_url,
  image_alt: fit.image_alt,
  caption: fit.caption,
  story_date: fit.story_date,
  story_order: fit.story_order ?? null,
  width: fit.width,
  height: fit.height,
  created_at: fit.createdAt || fit.created_at || null,
});

router.get('/', async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const { PulseFit, sequelize } = getModels();
    const fits = await PulseFit.findAll({
      where: { show_id: showId },
      order: [[sequelize.literal('story_date DESC NULLS LAST')], ['created_at', 'DESC']],
    });
    return res.json({ success: true, fits: fits.map(shape) });
  } catch (err) {
    console.error('[PulseFits] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * The latest fit as of a story moment (?at=, services/storyClock.js;
 * default the present, after the latest published episode; Task #2937):
 * the later in story time of (a) the show's newest everyday fit uploaded
 * no later than that moment (pulse_fits.story_order) and (b) the front
 * photo (else the hero photo) on the Style Page of its latest published
 * episode that has ended by then (episode_number * 10 + after_episode).
 * A tie goes to the fit: it was uploaded once that episode had ended.
 * A fit uploaded before story_order existed has unknown story time; it is
 * kept, and compared with the episode by when each was added. Read only:
 * it never creates a Lookbook row. Both candidates are returned.
 */
router.get('/latest', async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const models = getModels();
    const { PulseFit, sequelize } = models;
    const clock = require('../services/storyClock');
    let at;
    try { at = await clock.resolveAt(models, showId, req.query.at ?? 'present'); } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      throw err;
    }
    const { Op } = require('sequelize');
    // Reveals at that moment (Task #2939): a hidden fit is passed over; a teaser is flagged to blur.
    const reveals = await require('../services/pulseReveals').revealsAt(models, showId, at);
    const hiddenFits = reveals.hiddenIds('image', 'fit');
    const fitRow = await PulseFit.findOne({
      where: {
        show_id: showId,
        [Op.or]: [{ story_order: null }, { story_order: { [Op.lte]: at } }],
        ...(hiddenFits.length ? { id: { [Op.notIn]: hiddenFits } } : {}),
      },
      order: [[sequelize.literal('story_order DESC NULLS LAST')], [sequelize.literal('story_date DESC NULLS LAST')], ['created_at', 'DESC']],
    });
    const [[episodeRow]] = await sequelize.query(
      `SELECT i.image_url, i.category, i.created_at, e.episode_number
         FROM episode_lookbook_images i
         JOIN episodes e ON e.id = i.episode_id
        WHERE e.show_id = :showId AND e.status = 'published' AND e.deleted_at IS NULL
          AND e.episode_number IS NOT NULL AND e.episode_number * 10 + :after <= :at
          AND i.deleted_at IS NULL AND i.in_lookbook = true AND i.image_url IS NOT NULL
          AND i.category IN ('front', 'hero')
        ORDER BY e.episode_number DESC, (i.category = 'front') DESC, i.sort_order ASC, i.created_at DESC
        LIMIT 1`, { replacements: { showId, at, after: clock.PHASES.after_episode } });

    const fit = fitRow ? {
      source: 'fit', id: fitRow.id, image_url: fitRow.image_url, image_alt: fitRow.image_alt, caption: fitRow.caption,
      story_date: fitRow.story_date, story_order: fitRow.story_order ?? null, added_at: fitRow.createdAt || fitRow.created_at,
      ...(reveals.stateOf('image', fitRow.id, 'fit') === 'teaser' ? { teaser: true } : {}),
    } : null;
    const episode = episodeRow ? {
      source: 'episode', image_url: episodeRow.image_url, image_alt: null, caption: null,
      episode_number: episodeRow.episode_number, story_order: clock.orderOf(episodeRow.episode_number, 'after_episode'),
      added_at: episodeRow.created_at,
    } : null;
    let latest = fit || episode;
    if (fit && episode) {
      latest = Number.isInteger(fit.story_order)
        ? (fit.story_order >= episode.story_order ? fit : episode)
        : (new Date(fit.added_at) >= new Date(episode.added_at) ? fit : episode);
    }
    return res.json({ success: true, at, latest, fit, episode });
  } catch (err) {
    console.error('[PulseFits] GET latest error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', oneFit, async (req, res) => {
  const { storePulseImage, PulseImageError } = require('../services/pulseImageService');
  try {
    const showId = String(req.body?.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const { PulseFit, Show } = getModels();
    if (!(await Show.findByPk(showId))) return res.status(404).json({ success: false, error: 'Show not found' });
    const fields = readFields(req.body);
    if (fields.error) return res.status(400).json({ success: false, error: fields.error, code: 'BAD_FIELD' });
    const stored = await storePulseImage(req.file, { keyPrefix: `shows/pulse-fits/${showId}`, maxSide: 2000, minSide: 300, label: 'The photo' });
    // Stamped with the story time it is uploaded at, as a wall post is (Task #2937).
    const storyOrder = await require('../services/storyClock').presentOrder(getModels(), showId);
    const fit = await PulseFit.create({
      show_id: showId,
      story_order: storyOrder,
      image_url: stored.url,
      s3_key: stored.url.startsWith('https://') ? stored.key : null,
      width: stored.width,
      height: stored.height,
      ...fields.value,
    });
    return res.status(201).json({ success: true, fit: shape(fit) });
  } catch (err) {
    console.error('[PulseFits] POST error:', err);
    if (err instanceof PulseImageError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Fit not found' });
    const { PulseFit } = getModels();
    const fit = await PulseFit.findByPk(req.params.id);
    if (!fit) return res.status(404).json({ success: false, error: 'Fit not found' });
    const fields = readFields(req.body);
    if (fields.error) return res.status(400).json({ success: false, error: fields.error, code: 'BAD_FIELD' });
    await fit.update(fields.value);
    return res.json({ success: true, fit: shape(fit) });
  } catch (err) {
    console.error('[PulseFits] PATCH error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Fit not found' });
    const { PulseFit } = getModels();
    const fit = await PulseFit.findByPk(req.params.id);
    if (!fit) return res.status(404).json({ success: false, error: 'Fit not found' });
    await fit.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('[PulseFits] DELETE error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

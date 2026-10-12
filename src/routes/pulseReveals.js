'use strict';
/**
 * Reveals on The Pulse (Task #2938; The Pulse spec §5; services/pulseReveals.js).
 * Mounted at /api/v1/pulse-reveals.
 *
 *   GET    /?show_id=      the show's reveals, each with its story order
 *                          resolved now and its label (requireAuth)
 *   GET    /met?show_id=   the episode each Feed profile meets Lala in:
 *                          derived, and any set override (requireAuth)
 *   PUT    /               upsert one item's reveal (requireAuth + ADMIN)
 *                          { show_id, item_type, item_id, image_kind?,
 *                            event_id?, episode_id?, moment, at?, mode? }
 *                          moment story_time takes `at` (an order or
 *                          ep:<n>:<phase>, services/storyClock.js)
 *   DELETE /:id            soft delete (requireAuth + ADMIN)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const shape = (r, storyOrder = r.story_order) => {
  const { label } = require('../services/storyClock');
  return {
    id: r.id,
    show_id: r.show_id,
    item_type: r.item_type,
    item_id: r.item_id,
    image_kind: r.image_kind,
    event_id: r.event_id,
    episode_id: r.episode_id,
    moment: r.moment,
    story_order: storyOrder ?? null,
    label: label(storyOrder),
    mode: r.mode,
    source: r.source,
  };
};

const badShow = (res) => res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const db = getModels();
    const { resolveOrder } = require('../services/pulseReveals');
    const rows = await db.PulseReveal.findAll({ where: { show_id: showId }, order: [['created_at', 'ASC']] });
    // Resolved now: an event's episode may have been set since the reveal was saved.
    const reveals = await Promise.all(rows.map(async (r) => shape(r, await resolveOrder(db, r))));
    return res.json({ success: true, reveals });
  } catch (err) {
    console.error('[PulseReveals] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/met', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const db = getModels();
    const { metLala, resolveOrder } = require('../services/pulseReveals');
    const derived = await metLala(db, showId);
    const set = await db.PulseReveal.findAll({ where: { show_id: showId, item_type: 'character', source: 'set' } });
    const setBy = new Map(set.map((r) => [Number(r.item_id), r]));
    const ids = [...new Set([...derived.keys(), ...setBy.keys()])].filter(Number.isInteger).sort((a, b) => a - b);
    const met = await Promise.all(ids.map(async (profileId) => {
      const d = derived.get(profileId) || null;
      const s = setBy.get(profileId);
      const setShape = s ? shape(s, await resolveOrder(db, s)) : null;
      return {
        profile_id: profileId,
        derived: d,
        set: setShape,
        episode_number: s ? (setShape.story_order != null ? Math.floor(setShape.story_order / 10) : null) : d?.episode_number ?? null,
      };
    }));
    return res.json({ success: true, met });
  } catch (err) {
    console.error('[PulseReveals] GET met error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** The body's fields, checked; { value } or { error }. */
function readBody(body = {}) {
  const { ITEM_TYPES, IMAGE_KINDS, MODES, MOMENTS } = require('../services/pulseReveals');
  const { parseAt } = require('../services/storyClock');
  const showId = String(body.show_id || '');
  if (!UUID_RE.test(showId)) return { error: 'show_id must be a show id (UUID).' };
  if (!ITEM_TYPES.includes(body.item_type)) return { error: `item_type must be one of ${ITEM_TYPES.join(', ')}.` };
  const itemId = String(body.item_id ?? '');
  if (!ITEM_ID_RE.test(itemId)) return { error: 'item_id must be the item\'s id.' };
  if (body.item_type === 'character' && !/^\d+$/.test(itemId)) return { error: 'A character is its Feed profile id.' };
  let imageKind = null;
  if (body.item_type === 'image') {
    if (!IMAGE_KINDS.includes(body.image_kind)) return { error: `image_kind must be one of ${IMAGE_KINDS.join(', ')}.` };
    imageKind = body.image_kind;
  } else if (body.image_kind != null) return { error: 'image_kind is for images only.' };
  if (!MOMENTS.includes(body.moment)) return { error: `moment must be one of ${MOMENTS.join(', ')}.` };
  const mode = body.mode === undefined ? 'teaser' : body.mode;
  if (!MODES.includes(mode)) return { error: 'mode must be hidden or teaser.' };
  const eventId = body.event_id || null;
  const episodeId = body.episode_id || null;
  if (eventId && !UUID_RE.test(String(eventId))) return { error: 'event_id must be an event id (UUID).' };
  if (episodeId && !UUID_RE.test(String(episodeId))) return { error: 'episode_id must be an episode id (UUID).' };
  let storyOrder = null;
  if (body.moment === 'story_time') {
    storyOrder = parseAt(body.at);
    if (storyOrder === null) return { error: 'A set story time needs at: a story order or ep:<n>:<phase>.' };
  } else if (!eventId && !episodeId) {
    return { error: 'A moment needs its event_id or episode_id.' };
  }
  return {
    value: {
      show_id: showId, item_type: body.item_type, item_id: itemId, image_kind: imageKind,
      event_id: eventId, episode_id: episodeId, moment: body.moment, story_order: storyOrder, mode, source: 'set',
    },
  };
}

router.put('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const fields = readBody(req.body);
    if (fields.error) return res.status(400).json({ success: false, error: fields.error, code: 'BAD_FIELD' });
    const db = getModels();
    const { resolveOrder } = require('../services/pulseReveals');
    const value = { ...fields.value };
    if (!(await db.Show.findByPk(value.show_id))) return res.status(404).json({ success: false, error: 'Show not found' });
    value.story_order = await resolveOrder(db, value);
    const where = { show_id: value.show_id, item_type: value.item_type, item_id: value.item_id, image_kind: value.image_kind };
    let reveal = await db.PulseReveal.findOne({ where });
    const created = !reveal;
    if (reveal) await reveal.update(value);
    else reveal = await db.PulseReveal.create(value);
    return res.status(created ? 201 : 200).json({ success: true, reveal: shape(reveal) });
  } catch (err) {
    console.error('[PulseReveals] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, error: 'Reveal not found' });
    const { PulseReveal } = getModels();
    const reveal = await PulseReveal.findByPk(req.params.id);
    if (!reveal) return res.status(404).json({ success: false, error: 'Reveal not found' });
    await reveal.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('[PulseReveals] DELETE error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

'use strict';
/**
 * Voice Profiles (Task #2967; The Pulse spec §7; services/pulseVoices.js).
 * Mounted at /api/v1/pulse-voices.
 *
 *   GET    /?show_id=                 the show's posting characters, each
 *                                     with their voice or none; not_met:
 *                                     those Lala has not met yet, whose
 *                                     voices can be built and approved now
 *                                     (they post on their own only once
 *                                     met); and the banned phrases (requireAuth)
 *   POST   /:characterId/build        builds or rebuilds a voice: one AI
 *                                     call (requireAuth + ADMIN + aiRateLimiter)
 *   PUT    /:id { habits }            Evoni's edit of the habits (ADMIN);
 *                                     keeps an approval
 *   POST   /:id/approve               Evoni approves the voice: the worker
 *                                     may now post for the character (ADMIN;
 *                                     Task #3029). A rebuild clears it.
 *   POST   /:id/unapprove             withdraws it (ADMIN)
 *   POST   /:id/examples { text, kind?, post_id? }  a pinned post or an
 *                                     edit as an example (ADMIN)
 *   DELETE /:id/examples/:exampleId   (ADMIN)
 *   POST   /pin { post_id }           pins a post as an example of its
 *                                     poster's voice (ADMIN; Task #2972)
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

const shape = (v) => (v ? {
  id: v.id,
  registry_character_id: v.registry_character_id,
  social_profile_id: v.social_profile_id == null ? null : Number(v.social_profile_id),
  habits: v.habits_json || {},
  examples: v.examples_json || [],
  status: v.status,
  built_at: v.built_at,
  edited_by: v.edited_by,
  edited_at: v.edited_at,
  approved_at: v.approved_at || null,
  approved_by: v.approved_by || null,
} : null);

/** A VoiceError as its response; false for anything else. */
function sendKnown(res, err) {
  // RequestCapError: today's manual requests are used (429; Task #3031).
  if (err instanceof require('../services/pulseVoices').VoiceError || err instanceof require('../services/pulseRequests').RequestCapError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });
    const { eligible, BANNED_PHRASES } = require('../services/pulseVoices');
    const rows = await eligible(getModels(), showId, { includeUnmet: true });
    const row = ({ character, profile, voice, needs_rebuild: needsRebuild, meets_in: meetsIn }) => ({
      registry_character_id: character.id,
      display_name: character.selected_name || character.display_name,
      depth_level: character.depth_level,
      portrait_url: character.portrait_url || null,
      social_profile_id: Number(profile.id),
      handle: profile.handle,
      voice: shape(voice),
      needs_rebuild: needsRebuild,
      meets_in: meetsIn ?? null,
    });
    return res.json({
      success: true,
      banned_phrases: BANNED_PHRASES,
      characters: rows.filter((r) => r.met).map(row),
      not_met: rows.filter((r) => !r.met).map(row),
    });
  } catch (err) {
    console.error('[PulseVoices] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pin', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const postId = String(req.body?.post_id || '');
    if (!UUID_RE.test(postId)) return res.status(400).json({ success: false, error: 'post_id must be a post id.' });
    const db = getModels();
    const post = await db.FeedPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    const voice = post.social_profile_id
      ? await db.PulseVoice.findOne({ where: { social_profile_id: post.social_profile_id } })
      : null;
    if (!voice) {
      return res.status(409).json({ success: false, error: `@${post.poster_handle} has no Voice Profile yet. Build it in Voices first.` });
    }
    const example = await require('../services/pulseVoices').addExample(voice, {
      text: post.content_text, kind: 'pinned', postId: post.id, by: byOf(req),
    });
    return res.status(201).json({ success: true, example, voice: shape(voice), handle: post.poster_handle });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseVoices] pin error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:characterId/build', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.characterId)) return res.status(404).json({ success: false, error: 'Character not found' });
    const voice = await require('../services/pulseVoices').buildVoice(getModels(), req.params.characterId);
    return res.json({ success: true, voice: shape(voice) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseVoices] build error:', err);
    return res.status(err.status === 429 ? 429 : 500).json({ success: false, error: err.message });
  }
});

/** The voice by id, or a 404 sent. */
async function voiceOr404(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ success: false, error: 'Voice not found' }); return null; }
  const voice = await getModels().PulseVoice.findByPk(req.params.id);
  if (!voice) { res.status(404).json({ success: false, error: 'Voice not found' }); return null; }
  return voice;
}

router.put('/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const voice = await voiceOr404(req, res);
    if (!voice) return undefined;
    const habits = req.body?.habits;
    if (!habits || typeof habits !== 'object' || Array.isArray(habits)) {
      return res.status(400).json({ success: false, error: 'habits must be an object.' });
    }
    const { normalizeHabits } = require('../services/pulseVoices');
    await voice.update({ habits_json: normalizeHabits(habits), status: 'edited', edited_by: byOf(req), edited_at: new Date() });
    return res.json({ success: true, voice: shape(voice) });
  } catch (err) {
    console.error('[PulseVoices] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const voice = await voiceOr404(req, res);
    if (!voice) return undefined;
    await require('../services/pulseVoices').approveVoice(voice, byOf(req));
    return res.json({ success: true, voice: shape(voice) });
  } catch (err) {
    console.error('[PulseVoices] approve error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/unapprove', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const voice = await voiceOr404(req, res);
    if (!voice) return undefined;
    await require('../services/pulseVoices').unapproveVoice(voice);
    return res.json({ success: true, voice: shape(voice) });
  } catch (err) {
    console.error('[PulseVoices] unapprove error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/examples', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const voice = await voiceOr404(req, res);
    if (!voice) return undefined;
    const body = req.body || {};
    const postId = body.post_id == null ? null : String(body.post_id);
    if (postId && !UUID_RE.test(postId)) return res.status(400).json({ success: false, error: 'post_id must be a post id.' });
    const example = await require('../services/pulseVoices').addExample(voice, { text: body.text, kind: body.kind ?? 'pinned', postId, by: byOf(req) });
    return res.status(201).json({ success: true, example, voice: shape(voice) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseVoices] POST example error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id/examples/:exampleId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const voice = await voiceOr404(req, res);
    if (!voice) return undefined;
    await require('../services/pulseVoices').removeExample(voice, req.params.exampleId);
    return res.json({ success: true, voice: shape(voice) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseVoices] DELETE example error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

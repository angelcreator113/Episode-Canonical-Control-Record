'use strict';
/**
 * Character voices that learn (Evoni, 2026-10-25; services/characterVoice.js).
 * Mounted at /api/v1/voice.
 *
 *   POST /signals { episodeId, beatNumber, speaker, original, edited, direction? }
 *        a rewrite she accepted on the Script tab: what the AI first wrote
 *        and the version she took (requireAuth). 201 { signal }, or 200
 *        { skipped, reason } (no change, an unknown speaker, already kept)
 *   POST /learn/:characterKey   the character's new signals become rules
 *        now: one AI side call (requireAuth + ADMIN + aiRateLimiter)
 *   GET  /characters/:characterKey[?showId=]  the voice page: profile voice,
 *        rules (every status, newest first), the newest 40 approved lines,
 *        counts (requireAuth)
 *   GET  /speakers?episodeId=   who speaks in the episode's script and whose
 *        voice each is: [{ speaker, labels, characterKey, name }]
 *        (characterKey and name null for a speaker no one answers to) (requireAuth)
 *   GET  /episode/:episodeId/rules  { episodeId, speakers, rules }: the live
 *        rules of everyone who speaks in the episode, each with its
 *        character_key, name and check_json, for the Script tab's drift
 *        check (requireAuth); before the migration, rules [] and
 *        schema_pending true
 *   POST /rules/:id/approve | /dismiss | /undo  her decisions
 *        (requireAuth + ADMIN); undo is for a rule that applied by itself:
 *        it is dismissed and the rule it replaced comes back
 *
 * Before the migration (20261025200000) has run, the writes and the voice
 * page answer 409 { code: 'VOICE_SCHEMA_MISSING' }.
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const router = express.Router();
const getModels = () => require('../models');
const voice = () => require('../services/characterVoice');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINE = 2000;

/** A VoiceError, or a missing table or column, as its response; else a 500. */
function fail(res, err, label) {
  const v = voice();
  if (err instanceof v.VoiceError) return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  if (v.isSchemaMissing(err)) {
    console.error(`[VoiceRoutes] ${label}: the voice migration has not run:`, err.message);
    return res.status(409).json({ error: "The database update for learned voices hasn't run yet.", code: 'VOICE_SCHEMA_MISSING' });
  }
  console.error(`[VoiceRoutes] ${label} failed:`, err.message);
  if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
  return res.status(500).json({ error: err.message });
}

router.post('/signals', requireAuth, async (req, res) => {
  try {
    const { episodeId, speaker, original, edited, direction } = req.body || {};
    const beatNumber = req.body?.beatNumber === undefined || req.body?.beatNumber === null ? null : Number(req.body.beatNumber);
    if (!episodeId || !UUID_RE.test(String(episodeId))) return res.status(400).json({ error: 'episodeId must be an episode id (UUID)' });
    if (beatNumber !== null && (!Number.isInteger(beatNumber) || beatNumber < 1 || beatNumber > 14)) return res.status(400).json({ error: 'beatNumber must be 1-14' });
    if (typeof speaker !== 'string' || !speaker.trim() || speaker.length > 60) return res.status(400).json({ error: 'speaker is required (at most 60 characters)' });
    for (const [name, v] of [['original', original], ['edited', edited]]) {
      if (typeof v !== 'string' || !v.trim()) return res.status(400).json({ error: `${name} is required` });
      if (v.length > MAX_LINE) return res.status(400).json({ error: `${name} takes at most ${MAX_LINE} characters` });
    }
    if (direction !== undefined && direction !== null && (typeof direction !== 'string' || direction.length > 300)) {
      return res.status(400).json({ error: 'direction must be text (at most 300 characters)' });
    }
    const result = await voice().recordSignal(getModels(), { episodeId, beatNumber, speaker: speaker.trim(), original, edited, direction: direction || null });
    return res.status(result.signal ? 201 : 200).json(result);
  } catch (err) {
    return fail(res, err, 'signal');
  }
});

router.post('/learn/:characterKey', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const result = await voice().learnVoice(getModels(), { characterKey: req.params.characterKey });
    return res.json(result);
  } catch (err) {
    return fail(res, err, 'learn');
  }
});

router.get('/characters/:characterKey', requireAuth, async (req, res) => {
  try {
    const showId = req.query.showId && UUID_RE.test(String(req.query.showId)) ? String(req.query.showId) : null;
    return res.json(await voice().characterVoiceView(getModels(), req.params.characterKey, { showId }));
  } catch (err) {
    return fail(res, err, 'character');
  }
});

router.get('/speakers', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.query;
    if (!episodeId || !UUID_RE.test(String(episodeId))) return res.status(400).json({ error: 'episodeId must be an episode id (UUID)' });
    return res.json(await voice().episodeSpeakers(getModels(), String(episodeId)));
  } catch (err) {
    return fail(res, err, 'speakers');
  }
});

router.get('/episode/:episodeId/rules', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    if (!UUID_RE.test(String(episodeId))) return res.status(400).json({ error: 'episodeId must be an episode id (UUID)' });
    return res.json(await voice().episodeRules(getModels(), episodeId));
  } catch (err) {
    return fail(res, err, 'episode rules');
  }
});

for (const action of ['approve', 'dismiss', 'undo']) {
  router.post(`/rules/:id/${action}`, requireAuth, authorize(['ADMIN']), async (req, res) => {
    try {
      const v = voice();
      const fn = { approve: v.approveRule, dismiss: v.dismissRule, undo: v.undoRule }[action];
      return res.json(await fn(getModels(), req.params.id));
    } catch (err) {
      return fail(res, err, action);
    }
  });
}

module.exports = router;

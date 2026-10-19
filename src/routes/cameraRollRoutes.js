'use strict';
/**
 * A character's camera roll (Evoni, 2026-10-19; services/cameraRoll.js).
 * Mounted at /api/v1/camera-roll. The read needs sign-in and shows only what
 * the reader may see (an ADMIN every moment and photo; anyone else the
 * approved photos that are not private); every write is ADMIN, and the AI
 * ones take aiRateLimiter.
 *
 *   GET    /characters/:id               the headshot, moments, photos and albums
 *   PUT    /characters/:id/headshot      { asset_id } or { url }: the official headshot
 *   POST   /characters/:id/plan          { count?, idea? }: one Claude call proposes moments
 *   POST   /characters/:id/make-kept     makes every kept moment, stopping at a budget refusal
 *   PATCH  /moments/:id                  edit a moment (once made: purpose and album)
 *   POST   /moments/:id/keep             keep a proposed (or dropped) moment
 *   POST   /moments/:id/drop             drop it
 *   POST   /moments/:id/make             one image call: the photo
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const { aiFailure } = require('../utils/aiFailure');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];
const models = () => require('../models');
const roll = () => require('../services/cameraRoll');
const byOf = (req) => String(req.user?.email || req.user?.id || '').slice(0, 255) || null;

function sendError(res, err, label) {
  if (aiFailure(res, err)) {
    console.error(`[CameraRoll] ${label}: the AI call failed:`, err.message);
    return res;
  }
  const { CameraRollError } = roll();
  const { MediaError } = require('../services/mediaLibrary');
  const { PulseImageError } = require('../services/pulseImageService');
  if (err instanceof CameraRollError || err instanceof MediaError || err instanceof PulseImageError) {
    console.error(`[CameraRoll] ${label}:`, err.message);
    return res.status(err.status).json({ success: false, error: err.message });
  }
  console.error(`[CameraRoll] ${label} error:`, err);
  return res.status(500).json({ success: false, error: 'That could not be done; nothing was saved.' });
}

router.get('/characters/:id', requireAuth, async (req, res) => {
  try {
    const { audienceOf } = require('../services/mediaLibrary');
    const data = await roll().rollFor(models(), req.params.id, { audience: audienceOf(req.user) });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, 'GET /characters/:id');
  }
});

router.put('/characters/:id/headshot', ...admin, async (req, res) => {
  try {
    const { asset_id: assetId, url } = req.body || {};
    const headshot = await roll().setHeadshot(models(), req.params.id, { assetId, url, by: byOf(req) });
    res.json({ success: true, data: { headshot } });
  } catch (err) {
    sendError(res, err, 'PUT /characters/:id/headshot');
  }
});

router.post('/characters/:id/plan', ...admin, aiRateLimiter, async (req, res) => {
  try {
    const { count, idea } = req.body || {};
    const moments = await roll().plan(models(), req.params.id, { count, idea, by: byOf(req) });
    res.status(201).json({ success: true, data: { moments } });
  } catch (err) {
    sendError(res, err, 'POST /characters/:id/plan');
  }
});

router.post('/characters/:id/make-kept', ...admin, aiRateLimiter, async (req, res) => {
  try {
    const data = await roll().makeKept(models(), req.params.id, { by: byOf(req) });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, 'POST /characters/:id/make-kept');
  }
});

router.patch('/moments/:id', ...admin, async (req, res) => {
  try {
    const moment = await roll().updateMoment(models(), req.params.id, req.body || {});
    res.json({ success: true, data: { moment } });
  } catch (err) {
    sendError(res, err, 'PATCH /moments/:id');
  }
});

router.post('/moments/:id/keep', ...admin, async (req, res) => {
  try {
    res.json({ success: true, data: { moment: await roll().keep(models(), req.params.id) } });
  } catch (err) {
    sendError(res, err, 'POST /moments/:id/keep');
  }
});

router.post('/moments/:id/drop', ...admin, async (req, res) => {
  try {
    res.json({ success: true, data: { moment: await roll().drop(models(), req.params.id) } });
  } catch (err) {
    sendError(res, err, 'POST /moments/:id/drop');
  }
});

router.post('/moments/:id/make', ...admin, aiRateLimiter, async (req, res) => {
  try {
    const data = await roll().make(models(), req.params.id, { by: byOf(req) });
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendError(res, err, 'POST /moments/:id/make');
  }
});

module.exports = router;

'use strict';

/**
 * My Little List ♡ (Evoni, 2026-10-26, Phase 1): Lala's own list on her
 * phone, as of a beat and line of the episode (services/myLittleListService).
 *
 *   GET    /api/v1/episodes/:episodeId/my-little-list?beat=&line=
 *            { app, items: [{ key, title, note, done, can_check, can_edit, can_remove }], progress }
 *            only what she knows by then, in her words; the start of the
 *            episode when no beat is given
 *   GET    /api/v1/episodes/:episodeId/my-little-list/review?beat=&line=
 *            the producer's view: items hidden for wording, a spoiler or a
 *            missing rule, with their production labels. Never for the phone.
 *   POST   /api/v1/episodes/:episodeId/my-little-list/items
 *            { title, note?, reveal?: { when, ref? } } adds one of her reminders
 *   PATCH  /api/v1/episodes/:episodeId/my-little-list/items/:key
 *            { title?, note?, done?, beat?, line? } on an item she sees then
 *   DELETE /api/v1/episodes/:episodeId/my-little-list/items/:key?beat=&line=
 *            removes one of her reminders
 *
 * Every route needs a login. A key she can't see at that beat is a 404,
 * so a hidden item's existence is never confirmed.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const list = require('../services/myLittleListService');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^mll_[0-9a-f]{24}$/;

const modelsOf = (req) => req.app.get('models') || require('../models');

function guard(req, res) {
  if (!UUID.test(req.params.episodeId)) {
    res.status(400).json({ success: false, code: list.CODES.INVALID, error: 'episodeId must be a UUID' });
    return false;
  }
  if (req.params.key !== undefined && !KEY.test(req.params.key)) {
    res.status(404).json({ success: false, code: list.CODES.NOT_FOUND, error: 'No such item on her list.' });
    return false;
  }
  return true;
}

function answer(res, err, tag) {
  if (err.status && err.code) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  console.error(`[MyLittleList] ${tag} failed:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.get('/episodes/:episodeId/my-little-list', requireAuth, async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const at = list.positionOf(req.query);
    const out = await list.getMyLittleList(modelsOf(req), req.params.episodeId, at);
    if (!out) return res.status(404).json({ success: false, error: 'Episode not found' });
    return res.json({ success: true, as_of: at, ...out });
  } catch (err) {
    return answer(res, err, 'GET');
  }
});

router.get('/episodes/:episodeId/my-little-list/review', requireAuth, async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const at = list.positionOf(req.query);
    const out = await list.getReview(modelsOf(req), req.params.episodeId, at);
    if (!out) return res.status(404).json({ success: false, error: 'Episode not found' });
    return res.json({ success: true, as_of: at, ...out });
  } catch (err) {
    return answer(res, err, 'GET review');
  }
});

router.post('/episodes/:episodeId/my-little-list/items', requireAuth, async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const out = await list.addReminder(modelsOf(req), req.params.episodeId, req.body || {});
    return res.status(201).json({ success: true, ...out });
  } catch (err) {
    return answer(res, err, 'POST item');
  }
});

router.patch('/episodes/:episodeId/my-little-list/items/:key', requireAuth, async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const { beat, line, ...changes } = req.body || {};
    const at = list.positionOf({ beat, line });
    const out = await list.updateItem(modelsOf(req), req.params.episodeId, req.params.key, changes, at);
    return res.json({ success: true, ...out });
  } catch (err) {
    return answer(res, err, 'PATCH item');
  }
});

router.delete('/episodes/:episodeId/my-little-list/items/:key', requireAuth, async (req, res) => {
  if (!guard(req, res)) return undefined;
  try {
    const at = list.positionOf(req.query);
    const out = await list.removeItem(modelsOf(req), req.params.episodeId, req.params.key, at);
    return res.json({ success: true, ...out });
  } catch (err) {
    return answer(res, err, 'DELETE item');
  }
});

module.exports = router;

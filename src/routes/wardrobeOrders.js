'use strict';
/**
 * Amazon order history onto wardrobe pieces (Task #3102;
 * services/wardrobeOrderImport.js). Mounted at /api/v1/wardrobe-orders.
 * Evoni's real purchases: every route is requireAuth + ADMIN. Nothing here
 * touches coins (the piece's coin price, ownership and Lala's balance are
 * never written; that is /wardrobe/purchase, an in-world action).
 *
 *   POST /preview   multipart `file` (the CSV, read in memory, never stored)
 *                   and `show_id`: each line new or a duplicate, with its
 *                   suggested piece; nothing stored
 *   POST /confirm   { show_id, lines: [{ order_id, asin, title, order_date,
 *                   price_paid, list_price, quantity, currency, website,
 *                   wardrobe_id|null }] }: stores the new lines; a line with
 *                   a piece fills that piece's empty real-world fields
 *   GET  /?show_id=&status=unmatched   the imported lines
 *   PUT  /:id { wardrobe_id }          an unmatched line onto a piece
 */
const express = require('express');
const multer = require('multer');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

const showOf = (value) => (value && UUID_RE.test(String(value)) ? String(value) : null);

function sendError(res, err, where) {
  const { OrderImportError } = require('../services/wardrobeOrderImport');
  if (err instanceof OrderImportError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[WardrobeOrders] ${where} error:`, err);
  return res.status(500).json({ success: false, error: 'The order import failed.' });
}

router.post('/preview', requireAuth, authorize(['ADMIN']), (req, res) => {
  csvUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('[WardrobeOrders] upload refused:', uploadErr.message);
      return res.status(400).json({ success: false, error: uploadErr.code === 'LIMIT_FILE_SIZE' ? 'The file is over 5 MB.' : 'Upload one CSV file.' });
    }
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'Choose the order history CSV.' });
      const text = req.file.buffer.toString('utf8');
      const out = await require('../services/wardrobeOrderImport').preview(getModels(), { text, showId: showOf(req.body?.show_id) });
      return res.json({ success: true, ...out });
    } catch (err) {
      return sendError(res, err, 'preview');
    }
  });
});

router.post('/confirm', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const out = await require('../services/wardrobeOrderImport').confirm(getModels(), { showId: showOf(req.body?.show_id), lines: req.body?.lines });
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'confirm');
  }
});

router.get('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const lines = await require('../services/wardrobeOrderImport').listLines(getModels(), { showId: showOf(req.query.show_id), status: req.query.status || null });
    return res.json({ success: true, lines });
  } catch (err) {
    return sendError(res, err, 'list');
  }
});

router.put('/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const out = await require('../services/wardrobeOrderImport').matchLater(getModels(), req.params.id, req.body?.wardrobe_id);
    return res.json({ success: true, ...out });
  } catch (err) {
    return sendError(res, err, 'match');
  }
});

module.exports = router;

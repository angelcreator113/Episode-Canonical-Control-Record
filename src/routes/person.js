'use strict';

/**
 * One person page (Evoni, 2026-10-23): the character page reads who they
 * are, their Pulse account, relationships, episode history and what the
 * writers know about them in one call (services/personPage), each shown in
 * the tab it belongs to.
 *
 *   GET /api/v1/person/:id    everything for one registry character
 *
 * Reads only; requireAuth.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { personPage } = require('../services/personPage');

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const person = await personPage(sequelize, req.params.id);
    return res.json({ success: true, person });
  } catch (err) {
    console.error('[Person] GET /:id error:', err);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;

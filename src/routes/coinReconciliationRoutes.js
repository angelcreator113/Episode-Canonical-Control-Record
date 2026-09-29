'use strict';

/**
 * POST /api/v1/admin/coins/reconcile — D1's one-time reconciliation
 * (§8(y) Q9; Task #2250). ADMIN only.
 *
 * Applies the approvals in src/config/d1ReconciliationApprovals.js and
 * nothing else: the body cannot add a show. A dry run is the default; a real
 * apply needs { "dry_run": false, "confirm": "apply-d1-approvals" }.
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const { applyReconciliation } = require('../services/coinReconciliation');
const { D1_RECONCILIATION_APPROVALS } = require('../config/d1ReconciliationApprovals');

const router = express.Router();

const CONFIRM = 'apply-d1-approvals';

router.post('/admin/coins/reconcile', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const dryRun = req.body?.dry_run !== false;
    if (!dryRun && req.body?.confirm !== CONFIRM) {
      return res.status(400).json({
        success: false,
        error: `A real apply needs "confirm": "${CONFIRM}"`,
        code: 'CONFIRMATION_REQUIRED',
      });
    }
    const models = req.app?.get?.('models') || require('../models');
    const actor = req.user?.email || req.user?.id || null;
    const outcome = await applyReconciliation(models.sequelize, D1_RECONCILIATION_APPROVALS, { dryRun, actor });
    return res.json({ success: outcome.refused.length === 0, approvals: D1_RECONCILIATION_APPROVALS.length, ...outcome });
  } catch (err) {
    console.error('[coinReconciliation] reconcile error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

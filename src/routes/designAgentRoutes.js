const express = require('express');
const router  = express.Router();
const { requireAuth, authorize } = require('../middleware/auth');
const { runFullAudit, runSubAgent, quickSummary } = require('../services/designAgent');

// Full design audit — all 4 sub-agents
router.get('/scan', requireAuth, authorize(['ADMIN']), (_req, res, next) => {
  try {
    const report = runFullAudit();
    res.json(report);
  } catch (err) { next(err); }
});

// Run a single sub-agent by name
router.get('/agent/:name', requireAuth, authorize(['ADMIN']), (req, res, next) => {
  try {
    const report = runSubAgent(req.params.name);
    res.json(report);
  } catch (err) { next(err); }
});

// Lightweight summary
router.get('/quick', requireAuth, authorize(['ADMIN']), (_req, res, next) => {
  try {
    const summary = quickSummary();
    res.json(summary);
  } catch (err) { next(err); }
});

module.exports = router;

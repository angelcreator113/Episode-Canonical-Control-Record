const express = require('express');
const router  = express.Router();
const { runFullAudit, runSubAgent, quickSummary } = require('../services/designAgent');

// Full design audit — all 4 sub-agents
router.get('/scan', (_req, res, next) => {
  try {
    const report = runFullAudit();
    res.json(report);
  } catch (err) { next(err); }
});

// Run a single sub-agent by name
router.get('/agent/:name', (req, res, next) => {
  try {
    const report = runSubAgent(req.params.name);
    res.json(report);
  } catch (err) { next(err); }
});

// Lightweight summary
router.get('/quick', (_req, res, next) => {
  try {
    const summary = quickSummary();
    res.json(summary);
  } catch (err) { next(err); }
});

module.exports = router;

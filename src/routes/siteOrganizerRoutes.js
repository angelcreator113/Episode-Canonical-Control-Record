/**
 * siteOrganizerRoutes.js — API routes for the Site Organizer Agent
 *
 * GET  /scan          — full scan (all 4 sub-agents)
 * GET  /agent/:name   — run single sub-agent
 * GET  /quick         — lightweight summary (counts only)
 */
const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middleware/auth');
const { runFullScan, runSubAgent, quickSummary } = require('../services/siteOrganizerAgent');

router.get('/scan', requireAuth, authorize(['ADMIN']), (_req, res) => {
  try {
    const report = runFullScan();
    res.json(report);
  } catch (err) {
    console.error('[SiteOrg] Full scan failed:', err);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

router.get('/agent/:name', requireAuth, authorize(['ADMIN']), (req, res) => {
  try {
    const result = runSubAgent(req.params.name);
    res.json(result);
  } catch (err) {
    console.error(`[SiteOrg] Agent ${req.params.name} failed:`, err);
    res.status(500).json({ error: 'Agent failed', details: err.message });
  }
});

router.get('/quick', requireAuth, authorize(['ADMIN']), (_req, res) => {
  try {
    res.json(quickSummary());
  } catch (err) {
    res.status(500).json({ error: 'Quick summary failed', details: err.message });
  }
});

module.exports = router;

// ════════════════════════════════════════════════════════════════════════════
// LUXURY FILTER ROUTES — v1.1 (tightened regex + optionalAuth)
// Mount at: /api/v1/luxury-filter
// ════════════════════════════════════════════════════════════════════════════

const express = require('express');
const luxuryFilterRouter = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { runLuxuryFilter, quickCheck } = require('../services/luxuryFilterService');

luxuryFilterRouter.post('/validate', optionalAuth, async (req, res) => {
  try {
    const { scriptText, episodeTitle, episodeArchetype, designedIntent, skipSemanticPass = false } = req.body;

    if (!scriptText || typeof scriptText !== 'string' || scriptText.trim().length < 50) {
      return res.status(400).json({ error: 'scriptText (string, min 50 chars) is required' });
    }

    const result = await runLuxuryFilter(
      scriptText,
      { episodeTitle, episodeArchetype, designedIntent },
      { runClaudePass: !skipSemanticPass }
    );

    return res.json(result);
  } catch (err) {
    console.error('[LuxuryFilter] validate error:', err);
    return res.status(500).json({ error: 'Luxury filter failed', detail: err.message });
  }
});

luxuryFilterRouter.post('/quick-check', optionalAuth, (req, res) => {
  try {
    const { scriptText } = req.body;
    if (!scriptText || typeof scriptText !== 'string') {
      return res.status(400).json({ error: 'scriptText (string) is required' });
    }
    return res.json(quickCheck(scriptText));
  } catch (err) {
    console.error('[LuxuryFilter] quick-check error:', err);
    return res.status(500).json({ error: 'Quick check failed', detail: err.message });
  }
});

module.exports = luxuryFilterRouter;

const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { recentRefusals } = require('../middleware/rateLimits');

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many queries, slow down' },
});

async function getModels() {
  try { return require('../models'); } catch { return null; }
}

// ═══════════════════════════════════════════
// POST /query  — Run a read-only SQL query (admin only)
// ═══════════════════════════════════════════
router.post('/query', requireAuth, authorize(['admin']), queryLimiter, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });
    const { sequelize } = models;
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql field required' });

    // Only allow safe read-only SELECT queries
    const trimmed = sql.trim().toLowerCase();
    if (!trimmed.startsWith('select')) {
      return res.status(403).json({ error: 'Only SELECT queries allowed' });
    }

    // Block dangerous SQL patterns that could piggyback on SELECT
    const forbidden = /;|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\balter\b|\bcreate\b|\btruncate\b|\bexec\b|\bexecute\b|\bgrant\b|\brevoke\b|\bcopy\b|\binto\s+outfile\b|\binto\s+dumpfile\b|\bload_file\b|\bpg_sleep\b|\bpg_read_file\b|\blo_import\b|\blo_export\b/i;
    if (forbidden.test(sql)) {
      return res.status(403).json({ error: 'Query contains forbidden keywords' });
    }

    const rows = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
    res.json({ success: true, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /rate-limit-refusals — the last 200 requests a rate limit refused,
// newest first, with a count per limit (Admin › Tools, "Recent refusals").
// Kept in this process's memory (middleware/rateLimits recentRefusals), so it
// starts empty after every restart.
// ═══════════════════════════════════════════
router.get('/rate-limit-refusals', requireAuth, authorize(['ADMIN']), (req, res) => {
  try {
    const { refusals, counts, kept } = recentRefusals();
    res.json({ success: true, data: { refusals, counts, kept } });
  } catch (err) {
    console.error('rate-limit-refusals error:', err.message);
    res.status(500).json({ success: false, error: 'Could not read the refusals list' });
  }
});

// The test route GET /create-video-compositions-table is removed (Evoni, 2026-11-04):
// video_compositions is created by migration 20261104200000, and a request never
// creates tables.

module.exports = router;

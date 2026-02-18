/**
 * World Routes — API for World Admin page
 * 
 * GET /api/v1/world/:showId/history    — Character state history ledger
 * GET /api/v1/world/:showId/decisions  — Decision log entries
 * GET /api/v1/world/:showId/stats      — Aggregated decision stats
 * POST /api/v1/world/:showId/browse-pool — Generate browse pool for an episode
 * 
 * Location: src/routes/world.js
 */

'use strict';

const express = require('express');
const router = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}

let browsePoolGenerator;
try { browsePoolGenerator = require('../utils/browsePoolGenerator'); } catch (e) { browsePoolGenerator = null; }

let decisionLoggerModule;
try { decisionLoggerModule = require('../utils/decisionLogger'); } catch (e) { decisionLoggerModule = null; }


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/history
// ═══════════════════════════════════════════

router.get('/world/:showId/history', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { limit = 50 } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const [history] = await models.sequelize.query(
      `SELECT csh.*, e.title as episode_title, e.episode_number
       FROM character_state_history csh
       LEFT JOIN episodes e ON e.id = csh.episode_id
       WHERE csh.show_id = :showId
       ORDER BY csh.created_at DESC
       LIMIT :limit`,
      { replacements: { showId, limit: parseInt(limit) } }
    );

    return res.json({ success: true, history });
  } catch (error) {
    console.error('World history error:', error);
    return res.status(500).json({ error: 'Failed to load history', message: error.message });
  }
});


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/decisions
// ═══════════════════════════════════════════

router.get('/world/:showId/decisions', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { limit = 50, type } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    let query = `SELECT * FROM decision_log WHERE show_id = :showId`;
    const replacements = { showId, limit: parseInt(limit) };

    if (type) {
      query += ` AND type = :type`;
      replacements.type = type;
    }

    query += ` ORDER BY created_at DESC LIMIT :limit`;

    const [decisions] = await models.sequelize.query(query, { replacements });

    return res.json({ success: true, decisions });
  } catch (error) {
    // Table might not exist yet
    if (error.message?.includes('decision_log') || error.message?.includes('does not exist')) {
      return res.json({ success: true, decisions: [], note: 'Decision log table not yet created. Run migrations.' });
    }
    console.error('World decisions error:', error);
    return res.status(500).json({ error: 'Failed to load decisions', message: error.message });
  }
});


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/stats
// ═══════════════════════════════════════════

router.get('/world/:showId/stats', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Episode tier distribution
    const [tierDist] = await models.sequelize.query(
      `SELECT 
         evaluation_json->>'tier_final' as tier,
         COUNT(*) as count,
         AVG((evaluation_json->>'score')::float) as avg_score
       FROM episodes
       WHERE show_id = :showId AND evaluation_status = 'accepted'
       GROUP BY evaluation_json->>'tier_final'`,
      { replacements: { showId } }
    );

    // Override usage
    let overrideStats = [];
    try {
      const [os] = await models.sequelize.query(
        `SELECT type, COUNT(*) as count FROM decision_log
         WHERE show_id = :showId AND type = 'tier_override'
         GROUP BY type`,
        { replacements: { showId } }
      );
      overrideStats = os;
    } catch (e) { /* table might not exist */ }

    // Economy
    const [economy] = await models.sequelize.query(
      `SELECT 
         SUM(CASE WHEN (evaluation_json->'stat_deltas'->>'coins')::int < 0 
             THEN ABS((evaluation_json->'stat_deltas'->>'coins')::int) ELSE 0 END) as total_spent,
         SUM(CASE WHEN (evaluation_json->'stat_deltas'->>'coins')::int > 0 
             THEN (evaluation_json->'stat_deltas'->>'coins')::int ELSE 0 END) as total_earned
       FROM episodes
       WHERE show_id = :showId AND evaluation_status = 'accepted'`,
      { replacements: { showId } }
    );

    return res.json({
      success: true,
      stats: {
        tier_distribution: tierDist,
        override_usage: overrideStats,
        economy: economy[0] || { total_spent: 0, total_earned: 0 },
      },
    });
  } catch (error) {
    console.error('World stats error:', error);
    return res.status(500).json({ error: 'Failed to load stats', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/browse-pool
// ═══════════════════════════════════════════

router.post('/world/:showId/browse-pool', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      episode_id,
      bias = 'balanced',
      pool_size = 8,
      include_wildcard = true,
    } = req.body;

    if (!browsePoolGenerator) {
      return res.status(500).json({ error: 'Browse pool generator not loaded' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get all wardrobe items for this show
    let wardrobeItems = [];
    try {
      const [items] = await models.sequelize.query(
        `SELECT * FROM wardrobe WHERE show_id = :showId`,
        { replacements: { showId } }
      );
      wardrobeItems = items || [];
    } catch (e) {
      // Try without show_id filter
      try {
        const [items] = await models.sequelize.query(`SELECT * FROM wardrobe LIMIT 100`);
        wardrobeItems = items || [];
      } catch (e2) { /* no wardrobe */ }
    }

    // Get episode event data
    let event = {};
    let selectedOutfit = {};
    if (episode_id) {
      const episode = await models.Episode.findByPk(episode_id);
      if (episode?.script_content) {
        const eventMatch = episode.script_content.match(/\[EVENT:\s*(.+?)\]/i);
        if (eventMatch) {
          const pairs = eventMatch[1].match(/(\w+)=(?:"([^"]+)"|(\S+))/g) || [];
          for (const p of pairs) {
            const m = p.match(/(\w+)=(?:"([^"]+)"|(\S+))/);
            if (m) event[m[1].toLowerCase()] = m[2] || m[3];
          }
        }
      }

      // Get assigned wardrobe
      try {
        const [assigned] = await models.sequelize.query(
          `SELECT w.* FROM wardrobe w JOIN episode_wardrobe ew ON ew.wardrobe_id = w.id WHERE ew.episode_id = :episodeId`,
          { replacements: { episodeId: episode_id } }
        );
        if (assigned?.length > 0) {
          const outfit = assigned.find(a => ['dress', 'outfit', 'top'].includes((a.clothing_category || '').toLowerCase()));
          if (outfit) selectedOutfit.outfit_id = outfit.id;
          // etc for accessories, shoes
        }
      } catch (e) { /* no assigned wardrobe */ }
    }

    // Generate pool
    const result = browsePoolGenerator.generateBrowsePool({
      wardrobeItems: wardrobeItems.map(w => ({
        ...w,
        tags: typeof w.tags === 'string' ? JSON.parse(w.tags) : w.tags,
      })),
      selectedOutfit,
      event,
      bias,
      poolSize: pool_size,
      includeWildcard: include_wildcard,
    });

    // Save to episode if provided
    if (episode_id) {
      try {
        await models.Episode.update(
          { browse_pool_json: result },
          { where: { id: episode_id } }
        );
      } catch (e) {
        console.log('Could not save browse pool to episode:', e.message);
      }
    }

    // Log decision
    if (decisionLoggerModule && models.sequelize) {
      const logger = new decisionLoggerModule.DecisionLogger(models.sequelize);
      await logger.logBrowsePoolGenerated({
        episode_id,
        show_id: showId,
        bias,
        pool_size,
        total_items: result.config.total_items,
        has_wardrobe: wardrobeItems.length > 0,
      }).catch(() => {});
    }

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Browse pool error:', error);
    return res.status(500).json({ error: 'Browse pool generation failed', message: error.message });
  }
});


module.exports = router;

/**
 * aiUsageRoutes.js — AI Cost Dashboard API
 *
 * GET /api/v1/ai-usage/summary        — overall spend + token totals
 * GET /api/v1/ai-usage/by-model       — breakdown by model
 * GET /api/v1/ai-usage/by-route       — breakdown by route/feature
 * GET /api/v1/ai-usage/daily          — daily spend chart data
 * GET /api/v1/ai-usage/recent         — last N API calls
 * GET /api/v1/ai-usage/optimizations  — cost-saving recommendations
 */

const express = require('express');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Model pricing for display purposes
const MODEL_TIERS = {
  opus:   { label: 'Opus ($$$$)',   models: ['claude-opus-4-20250514', 'claude-opus-4'] },
  sonnet: { label: 'Sonnet ($$)',   models: ['claude-sonnet-4-20250514', 'claude-sonnet-4-6', 'claude-sonnet-4', 'claude-3-5-sonnet-20241022'] },
  haiku:  { label: 'Haiku ($)',     models: ['claude-haiku-4-5-20251001', 'claude-haiku-4', 'claude-3-haiku-20240307'] },
};

function getDb() {
  return require('../models');
}

// Helper: parse "days" query param (default 30)
function getDaysFilter(req) {
  const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
  return {
    created_at: { [Op.gte]: new Date(Date.now() - days * 86400000) },
  };
}

// ─── GET /summary ──────────────────────────────────────────────
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const _where = getDaysFilter(req);

    const [totals] = await db.sequelize.query(`
      SELECT
        COUNT(*)::int                             AS total_calls,
        COALESCE(SUM(input_tokens), 0)::bigint    AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint   AS total_output_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0)::bigint AS total_cache_reads,
        COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS total_cost,
        COALESCE(AVG(duration_ms), 0)::int        AS avg_duration_ms,
        COUNT(*) FILTER (WHERE is_error)::int     AS total_errors,
        MIN(created_at)                            AS first_log,
        MAX(created_at)                            AS last_log
      FROM ai_usage_logs
      WHERE created_at >= :since
    `, {
      replacements: { since: new Date(Date.now() - (parseInt(req.query.days) || 30) * 86400000) },
      type: db.sequelize.QueryTypes.SELECT,
    });

    // Today's spend
    const [today] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS today_cost,
             COUNT(*)::int AS today_calls
      FROM ai_usage_logs
      WHERE created_at >= CURRENT_DATE
    `, { type: db.sequelize.QueryTypes.SELECT });

    res.json({
      ...totals,
      today_cost: today.today_cost,
      today_calls: today.today_calls,
      days: parseInt(req.query.days) || 30,
    });
  } catch (err) {
    console.error('AI usage summary error:', err.message);
    res.status(500).json({ error: 'Failed to load AI usage summary' });
  }
});

// ─── GET /by-model ─────────────────────────────────────────────
router.get('/by-model', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.sequelize.query(`
      SELECT
        model_name,
        COUNT(*)::int                             AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint    AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint   AS output_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost,
        COALESCE(AVG(duration_ms), 0)::int        AS avg_ms
      FROM ai_usage_logs
      WHERE created_at >= :since
      GROUP BY model_name
      ORDER BY cost DESC
    `, {
      replacements: { since: new Date(Date.now() - (parseInt(req.query.days) || 30) * 86400000) },
      type: db.sequelize.QueryTypes.SELECT,
    });

    // Annotate with tier info
    const annotated = rows.map(r => {
      let tier = 'unknown';
      for (const [t, info] of Object.entries(MODEL_TIERS)) {
        if (info.models.includes(r.model_name)) { tier = t; break; }
      }
      return { ...r, tier };
    });

    res.json(annotated);
  } catch (err) {
    console.error('AI usage by-model error:', err.message);
    res.status(500).json({ error: 'Failed to load model breakdown' });
  }
});

// ─── GET /by-route ─────────────────────────────────────────────
router.get('/by-route', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.sequelize.query(`
      SELECT
        route_name,
        COUNT(*)::int                             AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint    AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint   AS output_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost,
        COALESCE(AVG(duration_ms), 0)::int        AS avg_ms,
        COUNT(DISTINCT model_name)::int           AS models_used
      FROM ai_usage_logs
      WHERE created_at >= :since
      GROUP BY route_name
      ORDER BY cost DESC
    `, {
      replacements: { since: new Date(Date.now() - (parseInt(req.query.days) || 30) * 86400000) },
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json(rows);
  } catch (err) {
    console.error('AI usage by-route error:', err.message);
    res.status(500).json({ error: 'Failed to load route breakdown' });
  }
});

// ─── GET /daily ────────────────────────────────────────────────
router.get('/daily', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.sequelize.query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS calls,
        COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM ai_usage_logs
      WHERE created_at >= :since
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, {
      replacements: { since: new Date(Date.now() - (parseInt(req.query.days) || 30) * 86400000) },
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json(rows);
  } catch (err) {
    console.error('AI usage daily error:', err.message);
    res.status(500).json({ error: 'Failed to load daily data' });
  }
});

// ─── GET /recent ───────────────────────────────────────────────
router.get('/recent', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const rows = await db.AIUsageLog.findAll({
      order: [['created_at', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (err) {
    console.error('AI usage recent error:', err.message);
    res.status(500).json({ error: 'Failed to load recent calls' });
  }
});

// ─── GET /optimizations ────────────────────────────────────────
router.get('/optimizations', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const tips = [];

    // 1. Find routes using expensive models for simple tasks
    const opusRoutes = await db.sequelize.query(`
      SELECT route_name, COUNT(*)::int AS calls,
             COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost
      FROM ai_usage_logs
      WHERE model_name LIKE '%opus%' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY route_name ORDER BY cost DESC LIMIT 5
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (opusRoutes.length > 0) {
      tips.push({
        type: 'downgrade',
        severity: 'high',
        title: 'Routes using Opus (most expensive)',
        detail: `${opusRoutes.length} routes are using Opus. Consider switching to Sonnet for ~5× savings.`,
        routes: opusRoutes,
        potential_savings: '80%',
      });
    }

    // 2. Identify routes with the highest spend overall
    const topSpenders = await db.sequelize.query(`
      SELECT route_name, model_name,
             COUNT(*)::int AS calls,
             COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost,
             COALESCE(AVG(input_tokens), 0)::int AS avg_input
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY route_name, model_name
      ORDER BY cost DESC LIMIT 10
    `, { type: db.sequelize.QueryTypes.SELECT });

    // 3. Suggest Haiku for routes with small avg inputs
    const haikuCandidates = topSpenders.filter(r =>
      r.avg_input < 2000 && !r.model_name.includes('haiku')
    );
    if (haikuCandidates.length > 0) {
      tips.push({
        type: 'haiku-switch',
        severity: 'medium',
        title: 'Small-input routes could use Haiku',
        detail: `${haikuCandidates.length} routes send <2k tokens on average — Haiku would be ~4× cheaper with similar quality for simple tasks.`,
        routes: haikuCandidates,
        potential_savings: '75%',
      });
    }

    // 4. Cache effectiveness
    const [cacheStats] = await db.sequelize.query(`
      SELECT
        COALESCE(SUM(cache_read_input_tokens), 0)::bigint AS cache_reads,
        COALESCE(SUM(input_tokens), 0)::bigint AS total_input
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const cacheRate = cacheStats.total_input > 0
      ? ((cacheStats.cache_reads / cacheStats.total_input) * 100).toFixed(1)
      : '0';

    tips.push({
      type: 'caching',
      severity: parseFloat(cacheRate) < 10 ? 'medium' : 'info',
      title: `Cache hit rate: ${cacheRate}%`,
      detail: parseFloat(cacheRate) < 10
        ? 'Low cache utilization. Adding prompt caching to frequent system prompts could save 90% on cached tokens.'
        : 'Cache is working well. Cached reads save 90% on input token costs.',
    });

    // 5. Error rate
    const [errorStats] = await db.sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_error)::int AS errors,
        COUNT(*)::int AS total
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const errorRate = errorStats.total > 0
      ? ((errorStats.errors / errorStats.total) * 100).toFixed(1)
      : '0';

    if (parseFloat(errorRate) > 5) {
      tips.push({
        type: 'errors',
        severity: 'high',
        title: `High error rate: ${errorRate}% (last 7 days)`,
        detail: `${errorStats.errors} of ${errorStats.total} calls failed. Errors waste money on partial responses.`,
      });
    }

    res.json({ tips, top_spenders: topSpenders });
  } catch (err) {
    console.error('AI usage optimizations error:', err.message);
    res.status(500).json({ error: 'Failed to generate optimization tips' });
  }
});

// ── GET /cache-stats — AI response cache hit/miss stats ──────────────────────
router.get('/cache-stats', requireAuth, async (_req, res) => {
  try {
    const { getCacheStats, CACHE_ENABLED } = require('../services/aiResponseCache');
    const stats = getCacheStats();
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : '0.0';
    res.json({ enabled: CACHE_ENABLED, ...stats, hit_rate_pct: hitRate });
  } catch (err) {
    res.json({ enabled: false, error: err.message });
  }
});

module.exports = router;

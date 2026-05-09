/**
 * cfoAgentRoutes.js — API endpoints for the CFO Agent system
 */
const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middleware/auth');
const { runFullAudit, runSubAgent, getHistory, getSchedulerStatus, startScheduler, stopScheduler, getBudget, setBudget } = require('../services/cfoAgent');

// GET /api/v1/cfo/audit — Run full audit (all 5 sub-agents)
router.get('/audit', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const report = await runFullAudit();
    res.json(report);
  } catch (err) {
    console.error('CFO full audit error:', err);
    res.status(500).json({ error: 'CFO audit failed', message: err.message });
  }
});

// GET /api/v1/cfo/agent/:name — Run a single sub-agent
router.get('/agent/:name', requireAuth, authorize(['ADMIN']), async (req, res) => {
  const validAgents = ['cost_watchdog', 'dependency_audit', 'resource_monitor', 'lights_off', 'health_patrol'];
  const { name } = req.params;

  if (!validAgents.includes(name)) {
    return res.status(400).json({ error: `Invalid agent name. Valid: ${validAgents.join(', ')}` });
  }

  try {
    const result = await runSubAgent(name);
    res.json(result);
  } catch (err) {
    console.error(`CFO sub-agent ${name} error:`, err);
    res.status(500).json({ error: `Sub-agent ${name} failed`, message: err.message });
  }
});

// GET /api/v1/cfo/quick — Lightweight health score only (no expensive scans)
router.get('/quick', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = require('../models');

    // Quick checks without heavy queries
    const [costRow] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS today_cost
      FROM ai_usage_logs WHERE created_at >= CURRENT_DATE
    `, { type: db.sequelize.QueryTypes.SELECT });

    const [errorRow] = await db.sequelize.query(`
      SELECT COUNT(*)::int AS errors_1h
      FROM ai_usage_logs WHERE is_error AND created_at >= NOW() - INTERVAL '1 hour'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const uptimeH = (process.uptime() / 3600).toFixed(1);

    // Budget data
    const budget = getBudget();
    const todayCostNum = Number(costRow.today_cost);

    const [monthRow] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost
      FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '30 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const [avgRow] = await db.sequelize.query(`
      SELECT COALESCE(AVG(daily_cost), 0)::numeric(12,4) AS avg_cost FROM (
        SELECT DATE(created_at) AS d, SUM(cost_usd) AS daily_cost
        FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      ) sub
    `, { type: db.sequelize.QueryTypes.SELECT });

    const monthlyCost = Number(monthRow.cost);
    const avgDailyCost = Number(avgRow.avg_cost);
    const dailyPct  = budget.daily_limit   > 0 ? Math.round((todayCostNum / budget.daily_limit) * 100) : 0;
    const monthlyPct = budget.monthly_limit > 0 ? Math.round((monthlyCost / budget.monthly_limit) * 100) : 0;
    const daysRemaining = avgDailyCost > 0 ? Math.max(0, Math.round((budget.monthly_limit - monthlyCost) / avgDailyCost)) : null;

    res.json({
      today_cost: todayCostNum,
      monthly_cost: monthlyCost,
      errors_last_hour: errorRow.errors_1h,
      memory_mb: memMB,
      uptime_hours: uptimeH,
      status: errorRow.errors_1h > 5 ? 'warning' : 'ok',
      budget: {
        ...budget,
        daily_pct: dailyPct,
        monthly_pct: monthlyPct,
        days_remaining: daysRemaining,
        daily_exceeded: dailyPct >= 100,
        monthly_exceeded: monthlyPct >= 100,
        daily_warning: dailyPct >= budget.warn_pct,
        monthly_warning: monthlyPct >= budget.warn_pct,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/cfo/history — Past audit reports
router.get('/history', requireAuth, authorize(['ADMIN']), (req, res) => {
  res.json(getHistory());
});

// GET /api/v1/cfo/scheduler — Scheduler status
router.get('/scheduler', requireAuth, authorize(['ADMIN']), (req, res) => {
  res.json(getSchedulerStatus());
});

// POST /api/v1/cfo/scheduler/start — Start automated audits
router.post('/scheduler/start', requireAuth, authorize(['ADMIN']), (req, res) => {
  const hours = Number(req.body?.interval_hours);
  const interval = hours > 0 ? hours : undefined;
  startScheduler(interval);
  res.json(getSchedulerStatus());
});

// POST /api/v1/cfo/scheduler/stop — Stop automated audits
router.post('/scheduler/stop', requireAuth, authorize(['ADMIN']), (req, res) => {
  stopScheduler();
  res.json(getSchedulerStatus());
});

// GET /api/v1/cfo/budget — Get current budget configuration
router.get('/budget', requireAuth, authorize(['ADMIN']), (req, res) => {
  res.json(getBudget());
});

// PUT /api/v1/cfo/budget — Update budget limits
router.put('/budget', requireAuth, authorize(['ADMIN']), (req, res) => {
  const { daily_limit, monthly_limit, warn_pct } = req.body || {};
  const updated = setBudget({ daily_limit, monthly_limit, warn_pct });
  res.json(updated);
});

module.exports = router;

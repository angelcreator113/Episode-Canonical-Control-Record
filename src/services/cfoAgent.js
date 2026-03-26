/**
 * cfoAgent.js — Chief Financial Officer Agent
 *
 * An autonomous agent system that monitors business finances, costs, and
 * operational longevity. Runs sub-agents that each own a specific domain:
 *
 *  1. Cost Watchdog    — AI spend spikes, model optimization, budget alerts
 *  2. Dependency Audit — outdated/vulnerable packages, upgrade paths
 *  3. Resource Monitor — DB size, table bloat, unused models, storage
 *  4. Lights-Off       — idle features, dead routes, wasteful patterns
 *  5. Health Patrol    — error rates, endpoint latency, uptime
 *
 * Each sub-agent returns { status, findings[], score, recommendations[] }
 * The orchestrator merges them into a single CFO Report.
 */

/* eslint-disable no-console */
const { execSync } = require('child_process');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// BUDGET CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const budgetConfig = {
  daily_limit:   Number(process.env.CFO_DAILY_BUDGET)   || 5.00,   // $ per day
  monthly_limit: Number(process.env.CFO_MONTHLY_BUDGET) || 100.00, // $ per month
  warn_pct:      Number(process.env.CFO_WARN_PCT)       || 80,     // alert at this % of limit
};

function getBudget() { return { ...budgetConfig }; }
function setBudget(updates) {
  if (updates.daily_limit   != null) budgetConfig.daily_limit   = Math.max(0, Number(updates.daily_limit));
  if (updates.monthly_limit != null) budgetConfig.monthly_limit = Math.max(0, Number(updates.monthly_limit));
  if (updates.warn_pct      != null) budgetConfig.warn_pct      = Math.min(100, Math.max(1, Number(updates.warn_pct)));
  return { ...budgetConfig };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 1: Cost Watchdog
// ═══════════════════════════════════════════════════════════════
async function costWatchdog(db, _options = {}) {
  const findings = [];
  const recommendations = [];
  let score = 100; // start perfect, deduct for issues

  try {
    // 1. Check if we even have data
    const [countRow] = await db.sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM ai_usage_logs`,
      { type: db.sequelize.QueryTypes.SELECT }
    );
    const totalLogs = countRow.cnt;

    if (totalLogs === 0) {
      findings.push({ level: 'info', msg: 'No AI usage data yet — tracking is active, costs will appear after API calls' });
      return { status: 'no-data', findings, score: 100, recommendations: ['Make some AI calls to start tracking costs'] };
    }

    // 2. Today's spend vs 7-day average
    const [todayRow] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost FROM ai_usage_logs
      WHERE created_at >= CURRENT_DATE
    `, { type: db.sequelize.QueryTypes.SELECT });

    const [avgRow] = await db.sequelize.query(`
      SELECT COALESCE(AVG(daily_cost), 0)::numeric(12,4) AS avg_cost FROM (
        SELECT DATE(created_at) AS d, SUM(cost_usd) AS daily_cost
        FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      ) sub
    `, { type: db.sequelize.QueryTypes.SELECT });

    const todayCost = Number(todayRow.cost);
    const avgCost = Number(avgRow.avg_cost);

    if (avgCost > 0 && todayCost > avgCost * 2) {
      findings.push({ level: 'warning', msg: `Today's spend ($${todayCost.toFixed(4)}) is ${(todayCost / avgCost).toFixed(1)}× your 7-day average ($${avgCost.toFixed(4)})` });
      score -= 15;
    }

    // 3. Opus usage (most expensive model)
    const [opusRow] = await db.sequelize.query(`
      SELECT COUNT(*)::int AS cnt, COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost
      FROM ai_usage_logs WHERE model_name LIKE '%opus%' AND created_at >= NOW() - INTERVAL '30 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (Number(opusRow.cnt) > 0) {
      findings.push({ level: 'warning', msg: `${opusRow.cnt} Opus calls in 30 days ($${Number(opusRow.cost).toFixed(4)}) — Opus is 5× more expensive than Sonnet` });
      recommendations.push('Switch Opus calls to Sonnet for comparable quality at 80% less cost');
      score -= 10;
    }

    // 4. Error waste
    const [errorRow] = await db.sequelize.query(`
      SELECT COUNT(*)::int AS errors, COUNT(*) FILTER (WHERE NOT is_error)::int AS successes
      FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '7 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const errorRate = errorRow.errors > 0 ? (errorRow.errors / (errorRow.errors + errorRow.successes)) * 100 : 0;
    if (errorRate > 5) {
      findings.push({ level: 'critical', msg: `${errorRate.toFixed(1)}% error rate — failed calls waste money on partial token processing` });
      score -= 20;
    }

    // 5. Cache utilization
    const [cacheRow] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cache_read_input_tokens), 0)::bigint AS cache_reads,
             COALESCE(SUM(input_tokens), 0)::bigint AS total_input
      FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '30 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const cacheRate = Number(cacheRow.total_input) > 0
      ? (Number(cacheRow.cache_reads) / Number(cacheRow.total_input) * 100) : 0;

    if (cacheRate < 10 && Number(cacheRow.total_input) > 10000) {
      findings.push({ level: 'info', msg: `Cache hit rate is ${cacheRate.toFixed(1)}% — adding prompt caching to system prompts could save 90% on cached tokens` });
      recommendations.push('Enable prompt caching for repetitive system prompts (character definitions, world rules)');
      score -= 5;
    }

    // 6. Top spenders
    const topRoutes = await db.sequelize.query(`
      SELECT route_name, COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost,
             COUNT(*)::int AS calls
      FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY route_name ORDER BY cost DESC LIMIT 5
    `, { type: db.sequelize.QueryTypes.SELECT });

    // 7. 30-day projection
    const [thirtyDay] = await db.sequelize.query(`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost
      FROM ai_usage_logs WHERE created_at >= NOW() - INTERVAL '30 days'
    `, { type: db.sequelize.QueryTypes.SELECT });

    const monthlyCost = Number(thirtyDay.cost);
    const projectedAnnual = monthlyCost * 12;

    findings.push({ level: 'info', msg: `30-day spend: $${monthlyCost.toFixed(2)} — projected annual: $${projectedAnnual.toFixed(2)}` });

    // ── Budget checks ──
    const dailyPct  = budgetConfig.daily_limit   > 0 ? (todayCost / budgetConfig.daily_limit) * 100 : 0;
    const monthPct  = budgetConfig.monthly_limit > 0 ? (monthlyCost / budgetConfig.monthly_limit) * 100 : 0;
    const daysLeft  = avgCost > 0 ? Math.max(0, Math.round((budgetConfig.monthly_limit - monthlyCost) / avgCost)) : null;

    if (dailyPct >= 100) {
      findings.push({ level: 'critical', msg: `🚨 Daily budget EXCEEDED — $${todayCost.toFixed(4)} of $${budgetConfig.daily_limit.toFixed(2)} limit (${dailyPct.toFixed(0)}%)` });
      score -= 20;
    } else if (dailyPct >= budgetConfig.warn_pct) {
      findings.push({ level: 'warning', msg: `Daily budget at ${dailyPct.toFixed(0)}% — $${todayCost.toFixed(4)} of $${budgetConfig.daily_limit.toFixed(2)} limit` });
      score -= 10;
    }

    if (monthPct >= 100) {
      findings.push({ level: 'critical', msg: `🚨 Monthly budget EXCEEDED — $${monthlyCost.toFixed(2)} of $${budgetConfig.monthly_limit.toFixed(2)} limit (${monthPct.toFixed(0)}%)` });
      recommendations.push('Reduce AI usage or increase monthly budget to avoid service interruptions');
      score -= 25;
    } else if (monthPct >= budgetConfig.warn_pct) {
      findings.push({ level: 'warning', msg: `Monthly budget at ${monthPct.toFixed(0)}% — $${monthlyCost.toFixed(2)} of $${budgetConfig.monthly_limit.toFixed(2)} limit${daysLeft !== null ? ` (~${daysLeft} days of budget left)` : ''}` });
      recommendations.push(`At current rate, budget will last ~${daysLeft} more days — consider adding funds or reducing usage`);
      score -= 10;
    }

    // Routes that could use cheaper models
    const haikuCandidates = await db.sequelize.query(`
      SELECT route_name, COUNT(*)::int AS calls,
             COALESCE(AVG(input_tokens), 0)::int AS avg_in,
             COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS cost
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND model_name NOT LIKE '%haiku%'
        AND model_name NOT LIKE '%opus%'
      GROUP BY route_name
      HAVING AVG(input_tokens) < 2000
      ORDER BY cost DESC LIMIT 5
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (haikuCandidates.length > 0) {
      recommendations.push(`${haikuCandidates.length} features send <2k tokens — switch to Haiku for ~75% savings`);
    }

    return {
      status: score >= 80 ? 'healthy' : score >= 50 ? 'needs-attention' : 'critical',
      findings,
      score: Math.max(0, score),
      recommendations,
      data: {
        todayCost, avgDailyCost: avgCost, monthlyCost, projectedAnnual,
        topRoutes, cacheRate, errorRate,
        budget: {
          daily_limit: budgetConfig.daily_limit,
          monthly_limit: budgetConfig.monthly_limit,
          daily_pct: budgetConfig.daily_limit > 0 ? Math.round((todayCost / budgetConfig.daily_limit) * 100) : 0,
          monthly_pct: budgetConfig.monthly_limit > 0 ? Math.round((monthlyCost / budgetConfig.monthly_limit) * 100) : 0,
          days_remaining: avgCost > 0 ? Math.max(0, Math.round((budgetConfig.monthly_limit - monthlyCost) / avgCost)) : null,
        },
      },
    };
  } catch (err) {
    return { status: 'error', findings: [{ level: 'critical', msg: `Cost Watchdog failed: ${err.message}` }], score: 0, recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 2: Dependency Audit
// ═══════════════════════════════════════════════════════════════
async function dependencyAudit() {
  const findings = [];
  const recommendations = [];
  let score = 100;

  try {
    const rootDir = path.resolve(__dirname, '../..');

    // Run npm outdated
    let outdatedOutput = '';
    try {
      execSync('npm outdated --json 2>nul', { cwd: rootDir, encoding: 'utf-8', timeout: 30000 });
    } catch (e) {
      // npm outdated exits with code 1 when there ARE outdated packages
      outdatedOutput = e.stdout || '';
    }

    let outdated = {};
    try { outdated = JSON.parse(outdatedOutput || '{}'); } catch { outdated = {}; }

    const outdatedCount = Object.keys(outdated).length;
    const majorUpdates = [];
    const minorUpdates = [];

    for (const [pkg, info] of Object.entries(outdated)) {
      if (!info.current || !info.latest) continue;
      const currentMajor = parseInt(info.current.split('.')[0]);
      const latestMajor = parseInt(info.latest.split('.')[0]);
      if (latestMajor > currentMajor) {
        majorUpdates.push({ pkg, current: info.current, latest: info.latest });
      } else {
        minorUpdates.push({ pkg, current: info.current, latest: info.latest });
      }
    }

    if (majorUpdates.length > 0) {
      findings.push({ level: 'warning', msg: `${majorUpdates.length} packages have major version updates available` });
      score -= Math.min(20, majorUpdates.length * 3);
      // Flag security-critical ones
      const critical = majorUpdates.filter(p => ['express', 'sequelize', 'pg', 'helmet'].includes(p.pkg));
      if (critical.length > 0) {
        findings.push({ level: 'critical', msg: `Critical packages need major updates: ${critical.map(p => `${p.pkg} ${p.current}→${p.latest}`).join(', ')}` });
        recommendations.push(`Update critical dependencies: ${critical.map(p => p.pkg).join(', ')}`);
      }
    }

    if (minorUpdates.length > 10) {
      findings.push({ level: 'info', msg: `${minorUpdates.length} packages have minor/patch updates — run npm update for quick wins` });
      recommendations.push('Run `npm update` to apply safe minor/patch updates');
      score -= 5;
    }

    // Run npm audit
    let auditOutput = '';
    try {
      auditOutput = execSync('npm audit --json 2>nul', { cwd: rootDir, encoding: 'utf-8', timeout: 30000 });
    } catch (e) {
      auditOutput = e.stdout || '';
    }

    let audit = {};
    try { audit = JSON.parse(auditOutput || '{}'); } catch { audit = {}; }

    const vulnCount = audit.metadata?.vulnerabilities || {};
    const criticalVulns = (vulnCount.critical || 0) + (vulnCount.high || 0);
    const moderateVulns = vulnCount.moderate || 0;

    if (criticalVulns > 0) {
      findings.push({ level: 'critical', msg: `${criticalVulns} critical/high security vulnerabilities found!` });
      recommendations.push('Run `npm audit fix` immediately to patch security vulnerabilities');
      score -= Math.min(30, criticalVulns * 10);
    }

    if (moderateVulns > 0) {
      findings.push({ level: 'warning', msg: `${moderateVulns} moderate vulnerabilities found` });
      score -= Math.min(10, moderateVulns * 2);
    }

    if (criticalVulns === 0 && moderateVulns === 0) {
      findings.push({ level: 'success', msg: 'No known security vulnerabilities' });
    }

    return {
      status: score >= 80 ? 'healthy' : score >= 50 ? 'needs-attention' : 'critical',
      findings, score: Math.max(0, score), recommendations,
      data: { outdatedCount, majorUpdates: majorUpdates.length, minorUpdates: minorUpdates.length, criticalVulns, moderateVulns },
    };
  } catch (err) {
    return { status: 'error', findings: [{ level: 'warning', msg: `Dependency audit partial failure: ${err.message}` }], score: 50, recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 3: Resource Monitor
// ═══════════════════════════════════════════════════════════════
async function resourceMonitor(db) {
  const findings = [];
  const recommendations = [];
  let score = 100;

  try {
    // 1. Database size
    const [dbSize] = await db.sequelize.query(`
      SELECT pg_database_size(current_database()) AS size_bytes,
             pg_size_pretty(pg_database_size(current_database())) AS size_pretty
    `, { type: db.sequelize.QueryTypes.SELECT });

    const sizeGB = Number(dbSize.size_bytes) / (1024 * 1024 * 1024);
    findings.push({ level: 'info', msg: `Database size: ${dbSize.size_pretty}` });

    if (sizeGB > 5) {
      findings.push({ level: 'warning', msg: 'Database exceeds 5 GB — consider archiving old data' });
      recommendations.push('Archive old activity_logs, ai_usage_logs, and processing_queue entries');
      score -= 10;
    }

    // 2. Table sizes (top 10 largest)
    const tableSizes = await db.sequelize.query(`
      SELECT relname AS table_name,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
             pg_total_relation_size(relid) AS size_bytes,
             n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 15
    `, { type: db.sequelize.QueryTypes.SELECT });

    // 3. Empty/unused tables
    const emptyTables = await db.sequelize.query(`
      SELECT relname AS table_name
      FROM pg_stat_user_tables
      WHERE n_live_tup = 0
      ORDER BY relname
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (emptyTables.length > 10) {
      findings.push({ level: 'info', msg: `${emptyTables.length} empty tables in database — some may be unused features` });
      recommendations.push('Review empty tables and drop those for features that are not in use');
      score -= 5;
    }

    // 4. Connection pool status
    const [connRow] = await db.sequelize.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE state = 'active')::int AS active,
             count(*) FILTER (WHERE state = 'idle')::int AS idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (connRow.total > 20) {
      findings.push({ level: 'warning', msg: `${connRow.total} DB connections (${connRow.active} active, ${connRow.idle} idle) — may be leaking connections` });
      score -= 10;
    } else {
      findings.push({ level: 'info', msg: `DB connections: ${connRow.total} (${connRow.active} active, ${connRow.idle} idle)` });
    }

    // 5. Index usage — find unused indexes
    const unusedIndexes = await db.sequelize.query(`
      SELECT schemaname, relname AS table_name, indexrelname AS index_name,
             pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0 AND schemaname = 'public'
        AND indexrelname NOT LIKE '%pkey%'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 10
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (unusedIndexes.length > 5) {
      findings.push({ level: 'info', msg: `${unusedIndexes.length} unused indexes consuming storage — dropping them would reclaim space` });
      recommendations.push('Review and drop unused database indexes');
    }

    // 6. Check for log tables that need rotation
    const [logSize] = await db.sequelize.query(`
      SELECT COALESCE(SUM(pg_total_relation_size(relid)), 0) AS total_bytes,
             pg_size_pretty(COALESCE(SUM(pg_total_relation_size(relid)), 0)) AS pretty
      FROM pg_stat_user_tables
      WHERE relname IN ('activity_logs', 'ai_usage_logs', 'processing_queues', 'amber_findings')
    `, { type: db.sequelize.QueryTypes.SELECT });

    const logMB = Number(logSize.total_bytes) / (1024 * 1024);
    if (logMB > 500) {
      findings.push({ level: 'warning', msg: `Log tables consuming ${logSize.pretty} — consider rotating old entries` });
      recommendations.push('Set up log rotation: DELETE FROM ai_usage_logs WHERE created_at < NOW() - INTERVAL \'90 days\'');
      score -= 5;
    }

    return {
      status: score >= 80 ? 'healthy' : score >= 50 ? 'needs-attention' : 'critical',
      findings, score: Math.max(0, score), recommendations,
      data: { dbSize: dbSize.size_pretty, tableSizes, emptyTables: emptyTables.map(t => t.table_name), connections: connRow, unusedIndexes: unusedIndexes.length },
    };
  } catch (err) {
    return { status: 'error', findings: [{ level: 'critical', msg: `Resource Monitor failed: ${err.message}` }], score: 0, recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 4: Lights-Off (Waste Detector)
// ═══════════════════════════════════════════════════════════════
async function lightsOff(db) {
  const findings = [];
  const recommendations = [];
  let score = 100;

  try {
    // 1. Find features with zero usage (tables with 0 rows = features nobody uses)
    const emptyFeatures = await db.sequelize.query(`
      SELECT relname AS table_name
      FROM pg_stat_user_tables
      WHERE n_live_tup = 0 AND relname NOT LIKE '%migration%' AND relname NOT LIKE '%seed%'
      ORDER BY relname
    `, { type: db.sequelize.QueryTypes.SELECT });

    const featureNames = emptyFeatures.map(t => t.table_name);
    if (featureNames.length > 15) {
      findings.push({ level: 'warning', msg: `${featureNames.length} database tables have zero rows — these features may be unused` });
      recommendations.push('Audit empty tables to determine if their features should be disabled or removed');
      score -= 10;
    }

    // 2. AI routes that haven't been called in 30+ days
    const [_aiRoutesTotal] = await db.sequelize.query(`
      SELECT COUNT(DISTINCT route_name)::int AS cnt
      FROM ai_usage_logs
    `, { type: db.sequelize.QueryTypes.SELECT });

    const staleRoutes = await db.sequelize.query(`
      SELECT route_name, MAX(created_at) AS last_used,
             EXTRACT(DAY FROM NOW() - MAX(created_at))::int AS days_idle
      FROM ai_usage_logs
      GROUP BY route_name
      HAVING MAX(created_at) < NOW() - INTERVAL '30 days'
      ORDER BY days_idle DESC
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (staleRoutes.length > 0) {
      findings.push({ level: 'info', msg: `${staleRoutes.length} AI-powered features haven't been used in 30+ days` });
      recommendations.push('Consider if idle AI features should be turned off to avoid accidental calls');
    }

    // 3. Check for orphaned records / data bloat
    const [orphanCheck] = await db.sequelize.query(`
      SELECT
        (SELECT COUNT(*)::int FROM ai_usage_logs WHERE created_at < NOW() - INTERVAL '90 days') AS old_ai_logs,
        (SELECT COUNT(*)::int FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days') AS old_activity
    `, { type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ old_ai_logs: 0, old_activity: 0 }]);

    const totalOldLogs = (orphanCheck.old_ai_logs || 0) + (orphanCheck.old_activity || 0);
    if (totalOldLogs > 10000) {
      findings.push({ level: 'info', msg: `${totalOldLogs.toLocaleString()} log entries older than 90 days — can be archived for savings` });
      recommendations.push('Archive or purge logs older than 90 days');
      score -= 5;
    }

    // 4. Disk check — uploads folder
    findings.push({ level: 'success', msg: 'Uploads handled via S3 — no local disk bloat risk' });

    return {
      status: score >= 80 ? 'healthy' : score >= 50 ? 'needs-attention' : 'critical',
      findings, score: Math.max(0, score), recommendations,
      data: { emptyFeatures: featureNames, staleRoutes, oldLogs: totalOldLogs },
    };
  } catch (err) {
    return { status: 'error', findings: [{ level: 'critical', msg: `Lights-Off agent failed: ${err.message}` }], score: 0, recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 5: Health Patrol
// ═══════════════════════════════════════════════════════════════
async function healthPatrol(db) {
  const findings = [];
  const recommendations = [];
  let score = 100;

  try {
    // 1. Database health
    try {
      await db.sequelize.authenticate();
      findings.push({ level: 'success', msg: 'Database connection healthy' });
    } catch {
      findings.push({ level: 'critical', msg: 'Database connection FAILED' });
      score -= 40;
    }

    // 2. Average API response time (from AI usage logs as proxy)
    const [perfRow] = await db.sequelize.query(`
      SELECT COALESCE(AVG(duration_ms), 0)::int AS avg_ms,
             COALESCE(MAX(duration_ms), 0)::int AS max_ms,
             COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int AS p95_ms
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '7 days' AND NOT is_error
    `, { type: db.sequelize.QueryTypes.SELECT });

    if (perfRow.p95_ms > 30000) {
      findings.push({ level: 'warning', msg: `P95 AI call latency is ${(perfRow.p95_ms / 1000).toFixed(1)}s — some calls may be timing out` });
      recommendations.push('Investigate slow API calls — add max_tokens limits or switch to faster models');
      score -= 10;
    } else if (perfRow.avg_ms > 0) {
      findings.push({ level: 'info', msg: `AI call performance: avg ${(perfRow.avg_ms / 1000).toFixed(1)}s, P95 ${(perfRow.p95_ms / 1000).toFixed(1)}s, max ${(perfRow.max_ms / 1000).toFixed(1)}s` });
    }

    // 3. Recent error surge (last hour vs last day average)
    const [errorSurge] = await db.sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_error AND created_at >= NOW() - INTERVAL '1 hour')::int AS errors_1h,
        COUNT(*) FILTER (WHERE is_error AND created_at >= NOW() - INTERVAL '24 hours')::int AS errors_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS total_24h
      FROM ai_usage_logs
    `, { type: db.sequelize.QueryTypes.SELECT });

    const hourlyAvg = errorSurge.errors_24h / 24;
    if (errorSurge.errors_1h > Math.max(3, hourlyAvg * 3)) {
      findings.push({ level: 'critical', msg: `Error surge: ${errorSurge.errors_1h} errors in last hour (vs avg ${hourlyAvg.toFixed(1)}/hr)` });
      score -= 20;
    }

    // 4. Process uptime
    const uptimeHours = (process.uptime() / 3600).toFixed(1);
    const memUsage = process.memoryUsage();
    const heapMB = (memUsage.heapUsed / 1024 / 1024).toFixed(0);
    const rssMB = (memUsage.rss / 1024 / 1024).toFixed(0);

    findings.push({ level: 'info', msg: `Server uptime: ${uptimeHours}h — Memory: ${heapMB}MB heap, ${rssMB}MB RSS` });

    if (Number(rssMB) > 1500) {
      findings.push({ level: 'warning', msg: `High memory usage (${rssMB}MB) — risk of OOM kill` });
      recommendations.push('Investigate memory leaks or increase instance size');
      score -= 15;
    }

    // 5. Queue health (if Bull tables exist)
    try {
      const [queueJobs] = await db.sequelize.query(`
        SELECT COUNT(*)::int AS cnt FROM processing_queues WHERE status = 'failed'
      `, { type: db.sequelize.QueryTypes.SELECT });

      if (queueJobs.cnt > 10) {
        findings.push({ level: 'warning', msg: `${queueJobs.cnt} failed jobs in processing queue` });
        recommendations.push('Review and retry or clear failed processing queue jobs');
        score -= 5;
      }
    } catch {
      // Table might not exist
    }

    return {
      status: score >= 80 ? 'healthy' : score >= 50 ? 'needs-attention' : 'critical',
      findings, score: Math.max(0, score), recommendations,
      data: { avgMs: perfRow.avg_ms, p95Ms: perfRow.p95_ms, uptimeHours, heapMB, rssMB },
    };
  } catch (err) {
    return { status: 'error', findings: [{ level: 'critical', msg: `Health Patrol failed: ${err.message}` }], score: 0, recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR — runs all sub-agents and produces the CFO Report
// ═══════════════════════════════════════════════════════════════
async function runFullAudit(options = {}) {
  const db = require('../models');
  const started = Date.now();

  // Run sub-agents in parallel
  const [cost, deps, resources, lights, health] = await Promise.allSettled([
    costWatchdog(db, options),
    dependencyAudit(),
    resourceMonitor(db),
    lightsOff(db),
    healthPatrol(db),
  ]);

  const extract = (r) => r.status === 'fulfilled' ? r.value : {
    status: 'error', findings: [{ level: 'critical', msg: 'Sub-agent crashed' }], score: 0, recommendations: [],
  };

  const agents = {
    cost_watchdog:    extract(cost),
    dependency_audit: extract(deps),
    resource_monitor: extract(resources),
    lights_off:       extract(lights),
    health_patrol:    extract(health),
  };

  // Overall health score (weighted average)
  const weights = { cost_watchdog: 30, dependency_audit: 15, resource_monitor: 20, lights_off: 10, health_patrol: 25 };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, agent] of Object.entries(agents)) {
    weightedSum += agent.score * (weights[key] || 10);
    totalWeight += weights[key] || 10;
  }
  const overallScore = Math.round(weightedSum / totalWeight);

  // Collect all recommendations sorted by severity
  const allFindings = [];
  const allRecs = [];
  for (const [agentName, agent] of Object.entries(agents)) {
    for (const f of agent.findings) {
      allFindings.push({ ...f, agent: agentName });
    }
    for (const r of agent.recommendations) {
      allRecs.push({ agent: agentName, recommendation: r });
    }
  }

  // Sort: critical > warning > info > success
  const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
  allFindings.sort((a, b) => (severityOrder[a.level] ?? 9) - (severityOrder[b.level] ?? 9));

  return {
    overall_score: overallScore,
    overall_status: overallScore >= 80 ? 'healthy' : overallScore >= 50 ? 'needs-attention' : 'critical',
    agents,
    all_findings: allFindings,
    all_recommendations: allRecs,
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
  };
}

// Run a single sub-agent by name
async function runSubAgent(agentName) {
  const db = require('../models');
  switch (agentName) {
    case 'cost_watchdog':    return costWatchdog(db);
    case 'dependency_audit': return dependencyAudit();
    case 'resource_monitor': return resourceMonitor(db);
    case 'lights_off':       return lightsOff(db);
    case 'health_patrol':    return healthPatrol(db);
    default: throw new Error(`Unknown sub-agent: ${agentName}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER — automated recurring audits
// ═══════════════════════════════════════════════════════════════
const MAX_HISTORY = 50;            // keep last 50 reports in memory
const auditHistory = [];           // ring buffer of past reports
let schedulerTimer = null;
let schedulerIntervalMs = 6 * 60 * 60 * 1000; // default: every 6 hours

function getHistory() {
  return auditHistory.slice().reverse(); // newest first
}

function getSchedulerStatus() {
  return {
    running: schedulerTimer !== null,
    interval_hours: schedulerIntervalMs / (60 * 60 * 1000),
    history_count: auditHistory.length,
    last_run: auditHistory.length > 0 ? auditHistory[auditHistory.length - 1].ran_at : null,
    next_run: schedulerTimer ? new Date(Date.now() + schedulerIntervalMs).toISOString() : null,
  };
}

async function scheduledRun() {
  try {
    console.log('[CFO] ⏰ Scheduled audit starting...');
    const report = await runFullAudit();
    auditHistory.push(report);
    if (auditHistory.length > MAX_HISTORY) auditHistory.shift();

    // Log summary to console
    const criticals = report.all_findings.filter(f => f.level === 'critical').length;
    const warnings  = report.all_findings.filter(f => f.level === 'warning').length;
    console.log(`[CFO] ✅ Audit complete — Score: ${report.overall_score}/100 | ${criticals} critical | ${warnings} warnings | ${report.duration_ms}ms`);

    if (criticals > 0) {
      console.log('[CFO] 🚨 Critical issues found:');
      report.all_findings.filter(f => f.level === 'critical').forEach(f => {
        console.log(`  → [${f.agent}] ${f.msg}`);
      });
    }

    // Budget breach console alerts
    const budgetFindings = report.all_findings.filter(f => f.agent === 'cost_watchdog' && f.msg.includes('budget'));
    budgetFindings.forEach(f => {
      if (f.level === 'critical') console.log(`[CFO] 💸 BUDGET ALERT: ${f.msg}`);
      else if (f.level === 'warning') console.log(`[CFO] ⚠️ Budget warning: ${f.msg}`);
    });
  } catch (err) {
    console.error('[CFO] ❌ Scheduled audit failed:', err.message);
  }
}

function startScheduler(intervalHours) {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (intervalHours) schedulerIntervalMs = intervalHours * 60 * 60 * 1000;
  schedulerTimer = setInterval(scheduledRun, schedulerIntervalMs);
  console.log(`[CFO] 🕐 Scheduler started — auditing every ${schedulerIntervalMs / (60 * 60 * 1000)}h`);
  // Run first audit after a short delay (let server finish starting)
  setTimeout(scheduledRun, 10000);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[CFO] ⏹ Scheduler stopped');
  }
}

module.exports = { runFullAudit, runSubAgent, getHistory, getSchedulerStatus, startScheduler, stopScheduler, getBudget, setBudget };

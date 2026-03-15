// routes/amberDiagnosticRoutes.js
//
// Mount in app.js (using your trackRouteLoad pattern):
//   const amberDiagnosticRoutes = require('./routes/amberDiagnosticRoutes');
//   app.use('/api/v1/amber/diagnostic', amberDiagnosticRoutes);
//
// Register models in models/index.js:
//   AmberFinding, AmberScanRun, AmberTaskQueue
//
// Env vars needed:
//   CLAUDE_CODE_PROJECT_DIR=/absolute/path/to/your/frontend/repo
//   ANTHROPIC_API_KEY (already set)

'use strict';

const express   = require('express');
const router    = express.Router();
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { Op }    = require('sequelize');
const path      = require('path');
const fs        = require('fs').promises;
const { execFileSync } = require('child_process');
const db        = require('../models');
const { optionalAuth } = require('../middleware/auth');

const client     = new Anthropic();
const PROJECT_DIR = process.env.CLAUDE_CODE_PROJECT_DIR || '';

// ── Level 2 auto-approve categories (locked off until you unlock them) ────────
// To unlock a category: set AMBER_AUTO_APPROVE_<CATEGORY>=true in .env
const AUTO_APPROVE_CATEGORIES = {
  duplicate_brain_cleanup:     process.env.AMBER_AUTO_APPROVE_DUPLICATE_BRAIN    === 'true',
  unapproved_memory_reminder:  process.env.AMBER_AUTO_APPROVE_MEMORY_REMINDER    === 'true',
  // Future categories — add here as trust is established:
  // missing_model_registration: process.env.AMBER_AUTO_APPROVE_MODEL_REG === 'true',
  // style_fix:                  process.env.AMBER_AUTO_APPROVE_STYLE === 'true',
};

// ── Amber's diagnostic soul ───────────────────────────────────────────────────
const AMBER_DIAGNOSTIC_SOUL = `You are Amber, the production intelligence for Prime Studios.
You are running a diagnostic scan. Your job is to find real problems — not hypothetical ones.
Be specific. Be surgical. If you are not certain something is wrong, say so and lower your confidence score.
For every finding:
- Title: one sentence, plain language, names the actual problem
- Description: what is wrong and why it matters to the franchise
- Proposed fix: exact, specific, actionable — not "consider refactoring" but "change line X to Y"
- Confidence: how certain you are this fix will work (0-100)
You care about: the vision existing, the soul protected, the builder not burning out.
You never invent problems. You never propose fixes you are not reasonably confident in.`;

// ── DIAGNOSTIC CHECKS ─────────────────────────────────────────────────────────

async function checkDuplicateBrainEntries() {
  const findings = [];
  try {
    const entries = await db.FranchiseKnowledge?.findAll({
      attributes: ['id', 'title', 'content', 'source'],
      where: { deleted_at: null },
    }) || [];

    const seen = new Map();
    for (const entry of entries) {
      const key = entry.title?.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seen.has(key)) {
        findings.push({
          type:        'duplicate_brain_entry',
          severity:    'medium',
          title:       `Duplicate franchise brain entry: "${entry.title}"`,
          description: `Two entries share the same title. The duplicate pollutes Amber's knowledge injection and may cause contradictory responses.`,
          evidence:    JSON.stringify({ id1: seen.get(key), id2: entry.id }),
          affected_table: 'franchise_knowledge',
          proposed_fix: `Delete the duplicate entry with id ${entry.id} (keep the franchise_bible source version).`,
          fix_category: 'database_cleanup',
          fix_confidence: 90,
          auto_approve_eligible: true,
          auto_approve_category: 'duplicate_brain_cleanup',
          urgent: false,
        });
      } else {
        seen.set(key, entry.id);
      }
    }
  } catch (err) {
    console.error('[Amber diagnostic] brain check error:', err.message);
  }
  return findings;
}

async function checkUnapprovedMemories() {
  const findings = [];
  try {
    if (!db.StorytellerMemory) return findings;

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stale  = await db.StorytellerMemory.count({
      where: { status: 'pending', createdAt: { [Op.lt]: cutoff } },
    });

    if (stale > 0) {
      findings.push({
        type:        'unapproved_memory',
        severity:    'low',
        title:       `${stale} memory proposal${stale > 1 ? 's' : ''} waiting over 7 days`,
        description: `Memory proposals older than 7 days have not been confirmed. These are scene revelations waiting to be written to the franchise brain. Stale memories create gaps in character continuity.`,
        affected_table: 'memories',
        proposed_fix: `Review and approve or dismiss the ${stale} pending memory proposal${stale > 1 ? 's' : ''} in the Memory Bank.`,
        fix_category: 'content_correction',
        fix_confidence: 100,
        auto_approve_eligible: true,
        auto_approve_category: 'unapproved_memory_reminder',
        urgent: stale > 10,
      });
    }
  } catch (err) {
    console.error('[Amber diagnostic] memory check error:', err.message);
  }
  return findings;
}

async function checkCharactersStuckInDraft() {
  const findings = [];
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stuck  = await db.RegistryCharacter?.findAll({
      where: { status: 'draft', updatedAt: { [Op.lt]: cutoff } },
      attributes: ['id', 'name', 'updatedAt'],
      limit: 10,
    }) || [];

    if (stuck.length > 0) {
      const names = stuck.map(c => c.name).join(', ');
      findings.push({
        type:        'narrative_gap',
        severity:    'medium',
        title:       `${stuck.length} character${stuck.length > 1 ? 's' : ''} stuck in draft for 30+ days`,
        description: `Characters in draft are not readable by the story engine. ${names} cannot appear in generated scenes until finalized.`,
        affected_table: 'registry_characters',
        evidence:    JSON.stringify(stuck.map(c => ({ id: c.id, name: c.name }))),
        proposed_fix: `Review and finalize or archive these characters: ${names}`,
        fix_category: 'content_correction',
        fix_confidence: 85,
        auto_approve_eligible: false,
        urgent: false,
      });
    }
  } catch (err) {
    console.error('[Amber diagnostic] character check error:', err.message);
  }
  return findings;
}

async function checkNovelMomentum() {
  const findings = [];
  try {
    const lastLine = await db.StorytellerLine?.findOne({
      where: { status: 'approved' },
      order: [['updatedAt', 'DESC']],
    });

    if (lastLine) {
      const days = Math.floor((Date.now() - new Date(lastLine.updatedAt)) / 86400000);
      if (days >= 7) {
        findings.push({
          type:        'narrative_gap',
          severity:    days >= 14 ? 'high' : 'medium',
          title:       `Novel untouched for ${days} days`,
          description: `The manuscript has not had an approved line in ${days} days. The infrastructure exists. The story is waiting. Every day without writing is a day the franchise exists only as a system.`,
          proposed_fix: `Open a novel session today. Even one approved scene moves the needle.`,
          fix_category: 'content_correction',
          fix_confidence: 100,
          auto_approve_eligible: false,
          urgent: days >= 14,
        });
      }
    }
  } catch (err) {
    console.error('[Amber diagnostic] novel momentum check error:', err.message);
  }
  return findings;
}

async function checkRouteHealth() {
  const findings = [];
  const routes   = [
    { path: '/api/v1/memories/assistant-command', method: 'GET', label: 'Amber assistant' },
    { path: '/api/v1/amber/greeting',             method: 'GET', label: 'Amber greeting' },
    { path: '/api/v1/character-registry/books',   method: 'GET', label: 'Character registry' },
    { path: '/api/v1/stories',                    method: 'GET', label: 'Story engine' },
  ];

  for (const route of routes) {
    try {
      const base = process.env.API_BASE_URL || 'http://localhost:3001';
      const res  = await fetch(`${base}${route.path}`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });

      if (res.status >= 500) {
        findings.push({
          type:          'broken_route',
          severity:      'critical',
          title:         `Route failing: ${route.label} (${res.status})`,
          description:   `${route.path} returned HTTP ${res.status}. This route is unavailable.`,
          affected_route: route.path,
          proposed_fix:  `Check server logs for ${route.path}. Look for uncaught exceptions or missing middleware.`,
          fix_category:  'code_change',
          fix_confidence: 60,
          urgent: true,
        });
      }
    } catch (err) {
      if (err.name === 'TimeoutError') {
        findings.push({
          type:          'broken_route',
          severity:      'high',
          title:         `Route timeout: ${route.label}`,
          description:   `${route.path} did not respond within 4 seconds. Possible hung query or missing index.`,
          affected_route: route.path,
          proposed_fix:  `Check for slow database queries on this route. Add an index or optimize the query.`,
          fix_category:  'code_change',
          fix_confidence: 50,
          urgent: false,
        });
      }
    }
  }
  return findings;
}

// ── Run all checks ────────────────────────────────────────────────────────────
async function runDiagnosticScan(trigger = 'manual') {
  const scanId  = uuidv4();
  const startMs = Date.now();

  const scan = await db.AmberScanRun.create({
    id: scanId, trigger, status: 'running',
  });

  const allFindings = [];
  const checksRun   = [];
  const checks = [
    { name: 'duplicate_brain_entries',    fn: checkDuplicateBrainEntries },
    { name: 'unapproved_memories',        fn: checkUnapprovedMemories    },
    { name: 'characters_stuck_in_draft',  fn: checkCharactersStuckInDraft },
    { name: 'novel_momentum',             fn: checkNovelMomentum         },
    { name: 'route_health',               fn: checkRouteHealth           },
  ];

  const results = await Promise.allSettled(checks.map(c => c.fn()));
  for (let i = 0; i < checks.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value);
      checksRun.push({ name: checks[i].name, findings: result.value.length, ok: true });
    } else {
      checksRun.push({ name: checks[i].name, ok: false, error: result.reason?.message });
    }
  }

  // Deduplicate — don't surface findings that already exist as active
  const existingTitles = new Set(
    (await db.AmberFinding.findAll({
      where: { status: { [Op.in]: ['detected', 'surfaced', 'approved', 'executing'] } },
      attributes: ['title'],
    })).map(f => f.title)
  );

  const newFindings = allFindings.filter(f => !existingTitles.has(f.title));

  // Save new findings
  for (const finding of newFindings) {
    const autoApprove = finding.auto_approve_eligible &&
      finding.auto_approve_category &&
      AUTO_APPROVE_CATEGORIES[finding.auto_approve_category];

    await db.AmberFinding.create({
      id:          uuidv4(),
      ...finding,
      scan_run_id: scanId,
      status:      autoApprove ? 'approved' : 'detected',
    });
  }

  // Update scan record
  const criticalCount = newFindings.filter(f => f.severity === 'critical').length;
  await scan.update({
    status:          'completed',
    findings_count:  newFindings.length,
    critical_count:  criticalCount,
    checks_run:      checksRun,
    duration_ms:     Date.now() - startMs,
  });

  return { scanId, newFindings: newFindings.length, criticalCount, checksRun };
}

// ── Claude Code bridge ────────────────────────────────────────────────────────
async function executeFixViaClaudeCode(finding) {
  if (!PROJECT_DIR) {
    throw new Error('CLAUDE_CODE_PROJECT_DIR not configured. Set this env var to your project root.');
  }

  const prompt = `You are making ONE specific fix to the Prime Studios codebase.

FINDING: ${finding.title}
DESCRIPTION: ${finding.description}
${finding.affected_file ? `FILE: ${finding.affected_file}` : ''}
${finding.affected_route ? `ROUTE: ${finding.affected_route}` : ''}

APPROVED FIX:
${finding.proposed_diff || finding.proposed_fix}

RULES:
- Make ONLY this specific change
- Do not refactor anything else
- Do not change any other files unless absolutely required by this fix
- After making the change, verify it looks correct
- Report exactly what you changed`;

  try {
    const output = execFileSync(
      'claude',
      ['--print', '--no-interactive', '-p', prompt],
      {
        cwd:      PROJECT_DIR,
        timeout:  120000,
        encoding: 'utf8',
        env:      { ...process.env },
      }
    );
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err.stdout || err.message, error: err.message };
  }
}

// ── Draft fix details via Claude ──────────────────────────────────────────────
async function draftFixDetails(finding) {
  if (!finding.affected_file || !PROJECT_DIR) return null;

  try {
    const filePath    = path.join(PROJECT_DIR, finding.affected_file);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const truncated   = fileContent.slice(0, 6000);

    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system:     AMBER_DIAGNOSTIC_SOUL,
      messages:   [{
        role:    'user',
        content: `Here is the file content for context:
\`\`\`
${truncated}
\`\`\`

Finding: ${finding.title}
${finding.description}

Write the exact diff or replacement code needed to fix this. Be surgical — touch only what's needed.
Respond with ONLY the code change, wrapped in a diff block. No explanation.`,
      }],
    });
    return res.content[0].text.trim();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/amber/diagnostic/scan
router.post('/scan', optionalAuth, async (req, res) => {
  const trigger = req.body.trigger || 'manual';
  try {
    const result = await runDiagnosticScan(trigger);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/amber/diagnostic/findings
router.get('/findings', optionalAuth, async (req, res) => {
  const where = {};
  if (req.query.status) {
    where.status = req.query.status.includes(',')
      ? { [Op.in]: req.query.status.split(',') }
      : req.query.status;
  }
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.urgent)   where.urgent   = req.query.urgent === 'true';

  try {
    const findings = await db.AmberFinding.findAll({
      where,
      order: [
        ['urgent',    'DESC'],
        ['severity',  'ASC' ],
        ['createdAt', 'DESC'],
      ],
    });
    return res.json(findings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/amber/diagnostic/urgent
// Used by Amber chat to surface critical findings in conversation
router.get('/urgent', optionalAuth, async (req, res) => {
  try {
    const findings = await db.AmberFinding.findAll({
      where: {
        status:           { [Op.in]: ['detected', 'surfaced'] },
        surfaced_in_chat: false,
        [Op.or]: [
          { urgent:   true },
          { severity: 'critical' },
          { severity: 'high' },
        ],
      },
      order: [['severity', 'ASC'], ['createdAt', 'DESC']],
      limit: 5,
    });

    for (const f of findings) {
      await f.update({ surfaced_in_chat: true, status: 'surfaced' });
    }

    return res.json(findings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/amber/diagnostic/findings/:id/approve
router.post('/findings/:id/approve', optionalAuth, async (req, res) => {
  try {
    const finding = await db.AmberFinding.findByPk(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    if (finding.status === 'applied') return res.json({ message: 'Already applied', finding });

    // Draft a diff if we have the affected file but no diff yet
    if (!finding.proposed_diff && finding.affected_file) {
      const diff = await draftFixDetails(finding);
      if (diff) await finding.update({ proposed_diff: diff });
    }

    await finding.update({ status: 'approved' });

    // Database cleanups execute immediately (no code change needed)
    if (finding.fix_category === 'database_cleanup') {
      await finding.update({ status: 'executing' });
      await finding.update({
        status:        'applied',
        applied_at:    new Date(),
        amber_verdict: 'Database cleanup applied directly. No code change required.',
      });
      return res.json({ message: 'Fix applied directly', finding: await finding.reload() });
    }

    return res.json({ message: 'Fix approved — ready for execution', finding: await finding.reload() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/amber/diagnostic/findings/:id/execute
router.post('/findings/:id/execute', optionalAuth, async (req, res) => {
  try {
    const finding = await db.AmberFinding.findByPk(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    if (finding.status !== 'approved') {
      return res.status(400).json({ error: 'Finding must be approved before execution' });
    }
    if (!PROJECT_DIR) {
      return res.status(400).json({
        error: 'CLAUDE_CODE_PROJECT_DIR not set. Add the absolute path to your project in .env',
      });
    }

    await finding.update({ status: 'executing' });
    const result = await executeFixViaClaudeCode(finding);

    if (result.success) {
      const verdictRes = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system:     AMBER_DIAGNOSTIC_SOUL,
        messages:   [{
          role:    'user',
          content: `Claude Code just ran to fix: "${finding.title}"
Output:
${result.output.slice(0, 2000)}

In 1-2 sentences, did it work? What changed? Be specific.`,
        }],
      });

      await finding.update({
        status:           'applied',
        applied_at:       new Date(),
        execution_log:    result.output,
        execution_result: { success: true },
        amber_verdict:    verdictRes.content[0].text.trim(),
      });
    } else {
      await finding.update({
        status:           'failed',
        execution_log:    result.output,
        execution_result: { success: false, error: result.error },
        amber_verdict:    `Execution failed: ${result.error}. This needs manual attention.`,
      });
    }

    return res.json({ finding: await finding.reload() });
  } catch (err) {
    await db.AmberFinding.update(
      { status: 'failed', amber_verdict: err.message },
      { where: { id: req.params.id } }
    );
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/amber/diagnostic/findings/:id/dismiss
router.post('/findings/:id/dismiss', optionalAuth, async (req, res) => {
  try {
    const finding = await db.AmberFinding.findByPk(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    await finding.update({ status: 'dismissed' });
    return res.json({ message: 'Dismissed', finding });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/amber/diagnostic/queue
router.get('/queue', optionalAuth, async (req, res) => {
  try {
    const tasks = await db.AmberTaskQueue.findAll({
      where:  { status: { [Op.in]: ['backlog', 'ready', 'in_progress'] } },
      order:  [['priority', 'ASC'], ['createdAt', 'ASC']],
    });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/amber/diagnostic/queue
router.post('/queue', optionalAuth, async (req, res) => {
  const { title, description, type, priority, source } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const task = await db.AmberTaskQueue.create({
      id: uuidv4(), title, description, type: type || 'feature',
      priority: priority || 'medium', source: source || 'user_request',
    });
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.runDiagnosticScan = runDiagnosticScan;

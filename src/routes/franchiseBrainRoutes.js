// routes/franchiseBrainRoutes.js
//
// Franchise Brain — story knowledge management + AI ingestion + guard
// Mount at /api/v1
//
// GET  /api/v1/franchise-brain/entries            — list knowledge entries (filter by category, status)
// POST /api/v1/franchise-brain/entries            — create a knowledge entry
// PATCH /api/v1/franchise-brain/entries/:id/activate — activate a pending entry
// PATCH /api/v1/franchise-brain/entries/:id/archive  — archive an entry
// POST /api/v1/franchise-brain/ingest-document    — AI extracts knowledge from pasted text
// POST /api/v1/franchise-brain/guard              — pre-generation franchise guard check
// GET  /api/v1/multi-product/all                  — list all multi-product content

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
// F-AUTH-1 Step 3 CP7: mixed Tier 1+4 within single file (per v2.31 §5.21,
// 3rd cumulative instance after worldStudio.js at CP3 + universe.js at CP6).
// Writes require authentication (Tier 1); GETs are public catalog reads with
// no req.user consumption (Tier 4). /multi-product/all also Tier 4 PUBLIC.
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const db = require('../models');
const { Op } = require('sequelize');

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// LIST ENTRIES
// ─────────────────────────────────────────────────────────────────────────────
// Scope (migration 20261004120000): ?scope=franchise|show lists one tier;
// ?show_id=N lists what that show's generators should see, the franchise
// tier plus that show's own entries.
const SCOPES = ['franchise', 'show'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isShowId = (v) => typeof v === 'string' && UUID_RE.test(v);
const scopeFields = ({ scope, show_id }) => {
  if (scope !== undefined && !SCOPES.includes(scope)) return { error: 'scope must be franchise or show' };
  const fields = {};
  if (scope !== undefined) fields.scope = scope;
  if (scope === 'franchise') fields.show_id = null;
  else if (show_id !== undefined) fields.show_id = show_id === null || show_id === '' ? null : show_id;
  if (fields.show_id !== undefined && fields.show_id !== null && !isShowId(fields.show_id)) return { error: 'show_id must be a show id (UUID)' };
  return { fields };
};

router.get('/franchise-brain/entries', optionalAuth, async (req, res) => {
  const { category, status, severity, scope, show_id } = req.query;
  try {
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (scope) {
      if (!SCOPES.includes(scope)) return res.status(400).json({ error: 'scope must be franchise or show' });
      where.scope = scope;
    }
    if (show_id) {
      if (!isShowId(show_id)) return res.status(400).json({ error: 'show_id must be a show id (UUID)' });
      where[Op.or] = [{ scope: 'franchise' }, { show_id }];
    }

    const entries = await db.FranchiseKnowledge.findAll({
      where,
      order: [['severity', 'ASC'], ['updated_at', 'DESC']],
    });

    return res.json({ entries, count: entries.length });
  } catch (err) {
    console.error('Franchise brain list error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED SHOW BRAIN — run all franchise knowledge seeders
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/seed', requireAuth, async (req, res) => {
  try {
    const { force = false } = req.body;
    const path = require('path');

    // Check if table exists first
    let existing = 0;
    try {
      existing = await db.FranchiseKnowledge.count();
    } catch (tableErr) {
      // Table doesn't exist — try to sync it
      try {
        await db.FranchiseKnowledge.sync();
        existing = 0;
      } catch (syncErr) {
        return res.status(500).json({ error: 'franchise_knowledge table could not be created: ' + syncErr.message });
      }
    }

    if (existing > 0 && !force) {
      return res.status(409).json({
        error: `Show Brain already has ${existing} entries. Pass force: true to re-seed.`,
        existing_count: existing,
      });
    }

    // If forcing, clear existing entries
    if (force && existing > 0) {
      await db.sequelize.query('DELETE FROM franchise_knowledge');
      console.log(`Cleared ${existing} existing franchise_knowledge rows`);
    }

    const seeders = [
      ['Cultural systems', '20260312000000-cultural-system-franchise-laws.js'],
      ['Influencer systems', '20260312100000-influencer-systems-franchise-laws.js'],
      ['World infrastructure', '20260312200000-world-infrastructure-franchise-laws.js'],
      ['Social timeline', '20260312300000-social-timeline-franchise-laws.js'],
      ['Social personality', '20260312400000-social-personality-franchise-laws.js'],
      ['Character life simulation', '20260312500000-character-life-simulation-franchise-laws.js'],
      ['Cultural memory', '20260312600000-cultural-memory-franchise-laws.js'],
      ['Character depth engine', '20260312700000-character-depth-engine-franchise-laws.js'],
      ['Show Brain (master)', '20260312800000-show-brain-franchise-laws.js'],
      ['Embodied life rules', '20260312900000-embodied-life-rules-franchise-laws.js'],
    ];

    let totalSeeded = 0;
    const results = [];
    for (const [name, file] of seeders) {
      try {
        const seederPath = path.join(__dirname, '../seeders', file);
        const seeder = require(seederPath);
        const queryInterface = db.sequelize.getQueryInterface();
        await seeder.up(queryInterface, db.Sequelize);
        const count = await db.FranchiseKnowledge.count();
        const _added = count - totalSeeded - (force ? 0 : existing);
        results.push({ name, status: 'ok' });
        totalSeeded = count - (force ? 0 : existing);
      } catch (seederErr) {
        console.warn(`Seeder "${name}" failed:`, seederErr.message);
        results.push({ name, status: 'failed', error: seederErr.message });
      }
    }

    // Activate any pending entries from seeders
    await db.sequelize.query(
      `UPDATE franchise_knowledge SET status = 'active' WHERE status = 'pending_review'`
    );

    const finalCount = await db.FranchiseKnowledge.count({ where: { status: 'active' } });
    return res.json({
      success: true,
      seeded: finalCount - (force ? 0 : existing),
      total: finalCount,
      seeders: results,
    });
  } catch (err) {
    console.error('Franchise brain seed error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ENTRY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/entries', requireAuth, async (req, res) => {
  const { title, content, category, severity, always_inject, applies_to, source_document, scope, show_id } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  const scoped = scopeFields({ scope: scope === undefined ? 'franchise' : scope, show_id });
  if (scoped.error) return res.status(400).json({ error: scoped.error });

  try {
    const entry = await db.FranchiseKnowledge.create({
      title: title.trim(),
      content: content.trim(),
      category: category || 'narrative',
      severity: severity || 'important',
      always_inject: always_inject || false,
      applies_to: applies_to || [],
      source_document: source_document || null,
      extracted_by: 'direct_entry',
      status: 'pending_review',
      scope: scoped.fields.scope,
      show_id: scoped.fields.show_id ?? null,
    });

    return res.json({ entry, message: 'Entry created — pending review' });
  } catch (err) {
    console.error('Franchise brain create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE ENTRY
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/franchise-brain/entries/:id/activate', requireAuth, async (req, res) => {
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await entry.update({ status: 'active' });
    return res.json({ entry, message: 'Entry activated' });
  } catch (err) {
    console.error('Franchise brain activate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BULK ACTIVATE ALL PENDING ENTRIES
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/activate-all', requireAuth, async (req, res) => {
  try {
    const [, count] = await db.sequelize.query(
      `UPDATE franchise_knowledge SET status = 'active', updated_at = NOW() WHERE status = 'pending_review'`
    );
    return res.json({ success: true, activated: count?.rowCount || 0, message: 'All pending entries activated' });
  } catch (err) {
    console.error('Franchise brain bulk activate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ENTRY — edit title, content, category, severity, always_inject, scope, show_id
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/franchise-brain/entries/:id', requireAuth, async (req, res) => {
  const { title, content, category, severity, always_inject, scope, show_id } = req.body;
  // Scope is the Brain's own classification, so a synced entry's scope is
  // editable here even though its words belong to the source page.
  const scoped = scopeFields({ scope, show_id });
  if (scoped.error) return res.status(400).json({ error: scoped.error });
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // A source owns what it synced (docs/BRAIN_OWNERSHIP.md): its words are
    // edited on the source page, never as a second copy here.
    if (entry.source_key && [title, content, category, severity].some((v) => v !== undefined)) {
      const { sourceLabelFor } = require('../services/brainSyncService');
      const managedBy = sourceLabelFor(entry.source_key) || 'its source page';
      return res.status(409).json({ error: `Managed by ${managedBy}. Edit it there, then review the Brain update.`, managed_by: managedBy });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;
    if (severity !== undefined) updates.severity = severity;
    if (always_inject !== undefined) updates.always_inject = always_inject;
    Object.assign(updates, scoped.fields);

    await entry.update(updates);
    return res.json({ entry, message: 'Entry updated' });
  } catch (err) {
    console.error('Franchise brain update error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ENTRY
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/franchise-brain/entries/:id', requireAuth, async (req, res) => {
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await entry.destroy();
    return res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Franchise brain delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE ENTRY
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/franchise-brain/entries/:id/archive', requireAuth, async (req, res) => {
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await entry.update({ status: 'archived' });
    return res.json({ entry, message: 'Entry archived' });
  } catch (err) {
    console.error('Franchise brain archive error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNARCHIVE ENTRY — restore archived entry back to active
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/franchise-brain/entries/:id/unarchive', requireAuth, async (req, res) => {
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status !== 'archived') return res.status(400).json({ error: 'Entry is not archived' });

    await entry.update({ status: 'active' });
    return res.json({ entry, message: 'Entry restored to active' });
  } catch (err) {
    console.error('Franchise brain unarchive error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AMBER ACTIVITY — summary of Amber's contributions + growth metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/franchise-brain/amber-activity', optionalAuth, async (req, res) => {
  try {
    // Entries Amber has pushed/created
    const amberEntries = await db.FranchiseKnowledge.findAll({
      where: {
        extracted_by: { [Op.in]: ['amber_push', 'amber_worlddev'] },
      },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    // Growth metrics: count by status for Amber entries
    const amberByStatus = {};
    for (const e of amberEntries) {
      amberByStatus[e.status] = (amberByStatus[e.status] || 0) + 1;
    }

    // Overall brain growth: count by category
    const allEntries = await db.FranchiseKnowledge.findAll({
      attributes: ['category', 'status'],
    });
    const byCategory = {};
    const byStatus = {};
    for (const e of allEntries) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    }

    // Most injected entries (most used knowledge)
    const mostInjected = await db.FranchiseKnowledge.findAll({
      where: { injection_count: { [Op.gt]: 0 } },
      order: [['injection_count', 'DESC']],
      limit: 10,
      attributes: ['id', 'title', 'category', 'injection_count', 'last_injected_at'],
    });

    // Recent activity (last 20 entries modified)
    const recentActivity = await db.FranchiseKnowledge.findAll({
      order: [['updated_at', 'DESC']],
      limit: 20,
      attributes: ['id', 'title', 'category', 'status', 'extracted_by', 'updated_at', 'created_at'],
    });

    return res.json({
      amber: {
        total_contributions: amberEntries.length,
        by_status: amberByStatus,
        recent_entries: amberEntries.slice(0, 10).map(e => ({
          id: e.id, title: e.title, category: e.category, status: e.status,
          extracted_by: e.extracted_by, created_at: e.created_at,
        })),
      },
      growth: {
        total_entries: allEntries.length,
        by_category: byCategory,
        by_status: byStatus,
      },
      most_injected: mostInjected,
      recent_activity: recentActivity,
    });
  } catch (err) {
    // If table/enum issue, return empty data instead of 500
    if (err.message?.includes('does not exist') || err.message?.includes('invalid input value')) {
      return res.json({ amber: { total_contributions: 0, by_status: {}, recent_entries: [] }, brain_growth: { total: 0, by_category: {}, by_status: {} }, most_injected: [], recent_activity: [] });
    }
    console.error('Amber activity error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INGEST DOCUMENT — AI extracts knowledge entries from pasted text
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/ingest-document', requireAuth, aiRateLimiter, async (req, res) => {
  const { document_text, source_name } = req.body;

  if (!document_text?.trim()) {
    return res.status(400).json({ error: 'document_text is required' });
  }

  // Limit input size to prevent abuse
  const trimmed = document_text.trim().slice(0, 50000);

  try {
    const prompt = `You are the Franchise Knowledge Extractor for Prime Studios (LalaVerse).

Read this document and extract discrete knowledge entries that the writing AI must know when generating scenes. Each entry should be a single fact, rule, decision, or character truth.

DOCUMENT:
${trimmed}

CATEGORIES (use exactly these values):
- character: facts about specific characters
- narrative: story structure or arc rules
- locked_decision: decisions already made that cannot be changed
- franchise_law: inviolable rules of the franchise
- technical: platform/build facts
- brand: brand voice, audience, or marketing rules
- world: world-building facts

SEVERITY:
- critical: violating this breaks the franchise
- important: should be followed but not catastrophic
- context: nice to know, enriches output

For each entry, provide:
- title: short label (max 100 chars)
- content: the full knowledge text
- category: one of the categories above
- severity: critical, important, or context
- always_inject: true if this should be injected into EVERY prompt

Respond ONLY in valid JSON:
{
  "entries": [
    { "title": "...", "content": "...", "category": "...", "severity": "...", "always_inject": false }
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: 'You extract franchise knowledge into structured entries. Respond ONLY in valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
    let parsed;
    try {
      const braceStart = raw.indexOf('{');
      const braceEnd = raw.lastIndexOf('}');
      parsed = JSON.parse(raw.substring(braceStart, braceEnd + 1));
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response', raw });
    }

    const created = [];
    for (const e of (parsed.entries || [])) {
      if (!e.title || !e.content) continue;
      const entry = await db.FranchiseKnowledge.create({
        title: String(e.title).slice(0, 200),
        content: String(e.content),
        category: e.category || 'narrative',
        severity: e.severity || 'important',
        always_inject: e.always_inject || false,
        source_document: source_name || 'Document Ingestion',
        extracted_by: 'document_ingestion',
        status: 'pending_review',
      });
      created.push(entry);
    }

    // Store the full document for the Documents tab
    if (db.BrainDocument) {
      try {
        await db.BrainDocument.create({
          source_name: source_name || 'Untitled Document',
          document_text: trimmed,
          entries_created: created.length,
          ingested_by: 'manual',
        });
      } catch (docErr) {
        console.error('Failed to store brain document:', docErr.message);
      }
    }

    return res.json({
      entries_created: created.length,
      entries: created,
      message: `Extracted ${created.length} entries — all pending review`,
    });
  } catch (err) {
    console.error('Franchise brain ingest error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS — list stored ingested documents
// ─────────────────────────────────────────────────────────────────────────────
router.get('/franchise-brain/documents', optionalAuth, async (req, res) => {
  try {
    if (!db.BrainDocument) {
      return res.json({ documents: [], message: 'BrainDocument model not available — run migration' });
    }
    const documents = await db.BrainDocument.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json({ documents, count: documents.length });
  } catch (err) {
    console.error('Brain documents list error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/franchise-brain/documents/:id', optionalAuth, async (req, res) => {
  try {
    if (!db.BrainDocument) {
      return res.status(404).json({ error: 'BrainDocument model not available' });
    }
    const doc = await db.BrainDocument.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: doc });
  } catch (err) {
    console.error('Brain document fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GUARD — pre-generation franchise check
//
// One result format (2026-10-04): { status, passed, warnings, rules_checked,
// message }, status one of 'passed' | 'issues' | 'check_failed'. A check
// that could not run (the AI's verdict unreadable) is 'check_failed' with
// passed false; it used to answer passed: true, so a screen showed a green
// pass for a check that never happened. warnings are { law, risk, suggestion }.
// ─────────────────────────────────────────────────────────────────────────────
const guardResult = (status, warnings, rules_checked, message) =>
  ({ status, passed: status === 'passed', warnings, rules_checked, message });

router.post('/franchise-brain/guard', requireAuth, async (req, res) => {
  const { scene_brief, characters_in_scene, scene_type, tone } = req.body;

  if (!scene_brief) {
    return res.status(400).json({ error: 'scene_brief is required' });
  }

  try {
    const laws = await db.FranchiseKnowledge.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { severity: 'critical' },
          { always_inject: true },
        ],
      },
    });

    if (laws.length === 0) {
      return res.json(guardResult('passed', [], 0, 'No active laws to check against'));
    }

    const guardPrompt = `You are the Pre-Generation Franchise Guard for Prime Studios.

SCENE BRIEF: ${scene_brief}
CHARACTERS: ${(characters_in_scene || []).join(', ')}
SCENE TYPE: ${scene_type || 'not specified'}
TONE: ${tone || 'not specified'}

FRANCHISE LAWS:
${laws.map(l => `[${l.severity.toUpperCase()}] ${l.title}\n${l.content}`).join('\n\n')}

Check this scene brief BEFORE generation. Flag anything in the brief that could lead the AI into a franchise violation.

Respond ONLY in valid JSON:
{
  "passed": true/false,
  "warnings": [
    { "law": "which law", "risk": "what could go wrong", "suggestion": "how to adjust the brief" }
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'You are the franchise guard. Respond ONLY in valid JSON.',
      messages: [{ role: 'user', content: guardPrompt }],
    });

    const raw = response.content[0].text.trim();
    let parsed;
    try {
      const braceStart = raw.indexOf('{');
      const braceEnd = raw.lastIndexOf('}');
      parsed = JSON.parse(raw.substring(braceStart, braceEnd + 1));
    } catch (parseErr) {
      console.error('Franchise guard: could not parse the verdict:', parseErr.message, raw.slice(0, 200));
      return res.json(guardResult('check_failed', [], laws.length, 'The guard could not read its own verdict. Check again.'));
    }

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => w && typeof w === 'object').map((w) => ({ law: String(w.law || 'Unnamed law'), risk: String(w.risk || ''), suggestion: String(w.suggestion || '') }))
      : [];
    const status = warnings.length > 0 || parsed.passed === false ? 'issues' : 'passed';
    const message = status === 'passed'
      ? `No franchise risk found against ${laws.length} ${laws.length === 1 ? 'rule' : 'rules'}`
      : warnings.length > 0 ? `${warnings.length} ${warnings.length === 1 ? 'risk' : 'risks'} found against ${laws.length} rules` : 'The guard flagged the brief without naming a rule';
    return res.json(guardResult(status, warnings, laws.length, message));
  } catch (err) {
    console.error('Franchise guard error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH PAGE CONTENT TO BRAIN — retired (Brain Update, docs/BRAIN_OWNERSHIP.md).
// POST /franchise-brain/push-from-page extracted a whole page with the AI and
// added every fact again on each push. Pages now sync by source key through
// routes/brainSyncRoutes.js, with no AI.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL MULTI-PRODUCT CONTENT (for WritingRhythm pipeline view)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/multi-product/all', optionalAuth, async (req, res) => {
  try {
    const content = await db.MultiProductContent.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json({ content, count: content.length });
  } catch (err) {
    console.error('Multi-product all error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BUILD KNOWLEDGE INJECTION — exported for assistant-command handler
// ─────────────────────────────────────────────────────────────────────────────
async function buildKnowledgeInjection() {
  try {
    // Get all critical + always_inject entries
    const entries = await db.FranchiseKnowledge.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { severity: 'critical' },
          { always_inject: true },
        ],
      },
      order: [['severity', 'ASC'], ['category', 'ASC']],
    });

    if (entries.length === 0) return '';

    // Update injection counts
    const ids = entries.map(e => e.id);
    await db.FranchiseKnowledge.update(
      {
        injection_count: db.sequelize.literal('injection_count + 1'),
        last_injected_at: new Date(),
      },
      { where: { id: { [Op.in]: ids } } }
    );

    const sections = entries.map(e =>
      `[${e.category.toUpperCase()} — ${e.severity}] ${e.title}\n${e.content}`
    );

    return '\n\nFRANCHISE KNOWLEDGE (active rules — never violate):\n' + sections.join('\n\n');
  } catch (err) {
    console.error('Knowledge injection build error:', err);
    return '';
  }
}

async function getTechContext() {
  try {
    const entries = await db.FranchiseTechKnowledge.findAll({
      where: { status: 'active' },
      order: [['category', 'ASC']],
      limit: 20,
    });
    if (entries.length === 0) return '';

    return '\n\nTECH KNOWLEDGE (deployed systems + build state):\n' +
      entries.map(e => `[${e.category.toUpperCase()}] ${e.title}: ${e.content}`).join('\n');
  } catch (err) {
    console.error('Tech context build error:', err);
    return '';
  }
}

module.exports = router;
module.exports.buildKnowledgeInjection = buildKnowledgeInjection;
module.exports.getTechContext = getTechContext;

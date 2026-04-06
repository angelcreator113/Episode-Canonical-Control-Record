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
const { optionalAuth, authenticateToken } = require('../middleware/auth');
const db = require('../models');
const { Op } = require('sequelize');

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// LIST ENTRIES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/franchise-brain/entries', optionalAuth, async (req, res) => {
  const { category, status, severity } = req.query;
  try {
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (severity) where.severity = severity;

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
router.post('/franchise-brain/seed', optionalAuth, async (req, res) => {
  try {
    const { force = false } = req.body;
    const path = require('path');

    // Check existing count
    const existing = await db.FranchiseKnowledge.count();
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
        const added = count - totalSeeded - (force ? 0 : existing);
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
router.post('/franchise-brain/entries', optionalAuth, async (req, res) => {
  const { title, content, category, severity, always_inject, applies_to, source_document } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'title and content are required' });
  }

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
router.patch('/franchise-brain/entries/:id/activate', optionalAuth, async (req, res) => {
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
router.post('/franchise-brain/activate-all', optionalAuth, async (req, res) => {
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
// UPDATE ENTRY — edit title, content, category, severity, always_inject
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/franchise-brain/entries/:id', optionalAuth, async (req, res) => {
  const { title, content, category, severity, always_inject } = req.body;
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category;
    if (severity !== undefined) updates.severity = severity;
    if (always_inject !== undefined) updates.always_inject = always_inject;

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
router.delete('/franchise-brain/entries/:id', optionalAuth, async (req, res) => {
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
router.patch('/franchise-brain/entries/:id/archive', optionalAuth, async (req, res) => {
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
router.patch('/franchise-brain/entries/:id/unarchive', optionalAuth, async (req, res) => {
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
    console.error('Amber activity error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INGEST DOCUMENT — AI extracts knowledge entries from pasted text
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/ingest-document', optionalAuth, async (req, res) => {
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
// ─────────────────────────────────────────────────────────────────────────────
router.post('/franchise-brain/guard', optionalAuth, async (req, res) => {
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
      return res.json({ passed: true, warnings: [], message: 'No active laws to check against' });
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
    } catch {
      return res.json({ passed: true, warnings: [], message: 'Guard parse failed — allowing through' });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Franchise guard error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH PAGE CONTENT TO BRAIN — doc page sends its data through ingest pipeline
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SOURCE_MAP = {
  cultural_calendar:          'cultural-system-v2.0',
  influencer_systems:         'influencer-systems-v1.0',
  world_infrastructure:       'world-infrastructure-v1.0',
  social_timeline:            'social-timeline-v1.0',
  social_personality:         'social-personality-v1.0',
  character_life_simulation:  'character-life-simulation-v1.0',
  cultural_memory:            'cultural-memory-v1.0',
  character_depth_engine:     'character-depth-engine-v1.0',
};

router.post('/franchise-brain/push-from-page', authenticateToken, async (req, res) => {
  const { page_name, page_data } = req.body;

  if (!page_name || !PAGE_SOURCE_MAP[page_name]) {
    return res.status(400).json({ error: 'Invalid or missing page_name' });
  }
  if (!page_data || typeof page_data !== 'object' || Object.keys(page_data).length === 0) {
    return res.status(400).json({ error: 'page_data is required and must be a non-empty object' });
  }

  const sourceDoc = PAGE_SOURCE_MAP[page_name];

  // Serialize the page data into readable text for the AI ingester
  let documentText = `SOURCE PAGE: ${page_name.replace(/_/g, ' ').toUpperCase()}\n\n`;
  for (const [key, items] of Object.entries(page_data)) {
    documentText += `=== ${key.replace(/_/g, ' ').toUpperCase()} ===\n`;
    if (Array.isArray(items)) {
      for (const item of items) {
        documentText += JSON.stringify(item, null, 2) + '\n\n';
      }
    } else {
      documentText += JSON.stringify(items, null, 2) + '\n\n';
    }
  }

  // Limit input size
  const trimmed = documentText.slice(0, 50000);

  try {
    const prompt = `You are the Franchise Knowledge Extractor for Prime Studios (LalaVerse).

Read this world-building page data and extract discrete knowledge entries that the writing AI must know when generating scenes. Each entry should be a single fact, rule, decision, or character truth.

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

    const client = new Anthropic();
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
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    const created = [];
    for (const e of (parsed.entries || [])) {
      if (!e.title || !e.content) continue;
      const entry = await db.FranchiseKnowledge.create({
        title: String(e.title).slice(0, 200),
        content: String(e.content),
        category: e.category || 'world',
        severity: e.severity || 'important',
        always_inject: e.always_inject || false,
        source_document: sourceDoc,
        source_version: sourceDoc.split('-v')[1] || '1.0',
        extracted_by: 'page_push',
        status: 'pending_review',
      });
      created.push(entry);
    }

    return res.json({
      entries_created: created.length,
      entries: created,
      message: `Pushed ${created.length} entries from ${page_name} — all pending review`,
    });
  } catch (err) {
    console.error('Push-from-page error:', err);
    return res.status(500).json({ error: err.message });
  }
});

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

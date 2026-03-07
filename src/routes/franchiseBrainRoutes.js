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
const { optionalAuth } = require('../middleware/auth');
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

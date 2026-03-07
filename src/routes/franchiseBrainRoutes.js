// routes/franchiseBrainRoutes.js
//
// POST   /api/v1/franchise-brain/ingest-document     — upload doc, Claude extracts decisions
// POST   /api/v1/franchise-brain/entries             — direct entry (type a decision now)
// GET    /api/v1/franchise-brain/entries             — list all entries with filters
// PATCH  /api/v1/franchise-brain/entries/:id         — edit an entry
// POST   /api/v1/franchise-brain/entries/:id/activate   — approve pending entry
// POST   /api/v1/franchise-brain/entries/:id/archive    — archive/supersede
// POST   /api/v1/franchise-brain/extract-conversation  — pull decisions from a chat transcript
// POST   /api/v1/franchise-brain/guard               — pre-generation franchise check
// GET    /api/v1/franchise-brain/inject              — get entries for a specific scene context

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');
const { Op } = require('sequelize');

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BUILDER — shared prompt for extraction
// ─────────────────────────────────────────────────────────────────────────────
const EXTRACTION_SYSTEM = `You are the knowledge extraction layer for Prime Studios — a literary production system for the LalaVerse franchise.

Your job: read source material and extract every decision, rule, character truth, or locked narrative choice as individual, searchable knowledge entries.

WHAT MAKES A GOOD KNOWLEDGE ENTRY:
- One decision per entry — not a paragraph of related decisions
- Written as a direct, active statement: "JustAWoman does X" not "It was decided that..."
- Specific enough to catch a violation — vague entries don't protect anything
- Includes what would constitute a violation

CATEGORIES:
- character: Who someone is — wound, voice, psychology, behavior
- narrative: Story rules — arc, structure, what happens when, scene logic
- locked_decision: Decisions that cannot be reversed — permanent franchise choices
- franchise_law: ABSOLUTE rules — would break the franchise if violated
- technical: System architecture, build decisions, route specs
- brand: Voice, audience name, aesthetic, tone, posting strategy
- world: LalaVerse universe rules, canon eligibility, world structure

SEVERITY:
- critical: Franchise-breaking if violated
- important: Character or story-breaking if violated
- context: Background color that informs generation quality

APPLIES_TO TAGS (use these exact strings when relevant):
JustAWoman, Lala, David, all_characters, all_scenes, all_generation,
book_1, book_2, series_2, consciousness_transfer, lala_seed,
marriage_scenes, paying_man_pressure, interior_reckoning, creator_study,
production_breakdown, david_mirror, career_echo, narrative_structure,
character_registry, world_characters, pnos

DO NOT extract:
- Technical implementation details (database column names, route paths)
- Things that are already obvious from context
- Duplicate entries for the same decision

Respond ONLY in valid JSON. No markdown. No backticks.`;

// ─────────────────────────────────────────────────────────────────────────────
// FRANCHISE GUARD — the immune system
// Reads a scene brief + the knowledge base, warns before generation fires
// ─────────────────────────────────────────────────────────────────────────────
async function runFranchiseGuard(sceneBrief, characterNames = [], sceneType = '') {
  // Always-inject entries — the six laws
  const alwaysInject = await db.FranchiseKnowledge.findAll({
    where: { always_inject: true, status: 'active' },
  });

  // Relevance-matched entries
  const allActive = await db.FranchiseKnowledge.findAll({
    where: { status: 'active', always_inject: false, severity: { [Op.in]: ['critical', 'important'] } },
    order: [['injection_count', 'ASC']],
    limit: 40,
  });

  // Score relevance against brief + characters + scene type
  const scored = allActive.map(entry => {
    const tags = entry.applies_to || [];
    let score = 0;
    characterNames.forEach(name => { if (tags.includes(name)) score += 3; });
    if (tags.includes(sceneType)) score += 2;
    if (tags.includes('all_scenes') || tags.includes('all_generation')) score += 1;
    const briefLower = sceneBrief.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    if (titleLower.split(' ').some(word => word.length > 4 && briefLower.includes(word))) score += 2;
    return { entry, score };
  });

  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(s => s.entry);

  const allEntries = [...alwaysInject, ...relevant];

  // Run the guard check
  const guardPrompt = `You are the Franchise Guard for Prime Studios. Read this scene brief and check it against the franchise knowledge base. Your job is to catch violations BEFORE generation fires.

SCENE BRIEF:
${sceneBrief}

CHARACTERS IN SCENE: ${characterNames.join(', ') || 'not specified'}
SCENE TYPE: ${sceneType || 'not specified'}

FRANCHISE KNOWLEDGE BASE — ACTIVE ENTRIES:
${allEntries.map((e, i) => `[${i + 1}] [${e.severity.toUpperCase()}] ${e.title}
${e.content}`).join('\n\n')}

CHECK FOR:
1. Does the brief ask for anything that violates a franchise law?
2. Does the brief contradict a locked character truth?
3. Does the scene type or emotional direction conflict with a narrative rule?
4. Is there anything in the brief that, if written as described, would break something in the long arc even if it seems fine in the moment?

Respond ONLY in valid JSON:
{
  "violations": [
    {
      "severity": "critical" | "important",
      "knowledge_entry_title": "which entry this violates",
      "what_in_brief": "the specific phrase or direction in the brief that triggers this",
      "why_it_matters": "what breaks in the franchise if this gets written",
      "suggested_correction": "how to rewrite this part of the brief to stay franchise-faithful"
    }
  ],
  "warnings": [
    {
      "knowledge_entry_title": "which entry is relevant",
      "note": "something to keep in mind while writing this scene — not a violation, just a flag"
    }
  ],
  "clear_to_generate": true or false,
  "injected_entries": [list of entry titles injected — for logging],
  "guard_note": "one sentence on the franchise health of this brief overall"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: 'You are the Franchise Guard for Prime Studios. You protect franchise integrity before generation fires. Be specific — vague warnings help nobody. Respond ONLY in valid JSON.',
    messages: [{ role: 'user', content: guardPrompt }],
  });

  const raw = response.content[0].text;
  let result;
  try {
    result = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    result = { violations: [], warnings: [], clear_to_generate: true, guard_note: 'Guard parse failed — proceeding', injected_entries: [] };
  }

  // Update injection counts
  const injectedIds = allEntries.map(e => e.id);
  if (injectedIds.length) {
    await db.FranchiseKnowledge.increment('injection_count', { where: { id: injectedIds } });
    await db.FranchiseKnowledge.update({ last_injected_at: new Date() }, { where: { id: injectedIds } });
  }

  return { result, injected: allEntries };
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE INJECTOR — used by story engine, scene proposer, character growth
// Returns formatted string to inject into generation system prompts
// ─────────────────────────────────────────────────────────────────────────────
async function buildKnowledgeInjection(characterNames = [], sceneType = '', sceneBrief = '') {
  const laws = await db.FranchiseKnowledge.findAll({
    where: { always_inject: true, status: 'active' },
    order: [['severity', 'ASC']],
  });

  const allActive = await db.FranchiseKnowledge.findAll({
    where: { status: 'active', always_inject: false },
    order: [['severity', 'ASC'], ['injection_count', 'ASC']],
    limit: 60,
  });

  const scored = allActive.map(entry => {
    const tags = entry.applies_to || [];
    let score = 0;
    characterNames.forEach(name => { if (tags.includes(name)) score += 3; });
    if (tags.includes(sceneType)) score += 2;
    const briefLower = sceneBrief.toLowerCase();
    const titleWords = entry.title.toLowerCase().split(' ').filter(w => w.length > 4);
    if (titleWords.some(w => briefLower.includes(w))) score += 2;
    if (tags.includes('all_scenes')) score += 1;
    return { entry, score };
  });

  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => s.entry);

  const allForInjection = [...laws, ...relevant];

  if (!allForInjection.length) return '';

  return `\n\nFRANCHISE KNOWLEDGE BASE — ACTIVE RULES:\n${allForInjection.map(e =>
    `[${e.severity.toUpperCase()}${e.always_inject ? ' · ABSOLUTE LAW' : ''}] ${e.title}\n${e.content}`
  ).join('\n\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: ingest-document
// Paste or upload document text — Claude extracts knowledge entries
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest-document', optionalAuth, async (req, res) => {
  const { document_text, source_document, source_version } = req.body;

  if (!document_text || !source_document) {
    return res.status(400).json({ error: 'document_text and source_document required' });
  }

  try {
    const extractPrompt = `Extract every franchise decision, character truth, narrative rule, and locked choice from this document as individual knowledge entries.

SOURCE: ${source_document} ${source_version || ''}

DOCUMENT TEXT:
${document_text}

Return a JSON object with this structure:
{
  "entries": [
    {
      "title": "Short label — max 80 characters",
      "content": "The full decision written as a direct active statement. Specific enough to catch a violation. Include what would constitute a violation.",
      "category": "character | narrative | locked_decision | franchise_law | technical | brand | world",
      "severity": "critical | important | context",
      "applies_to": ["array", "of", "tags", "from", "the", "approved", "list"],
      "always_inject": false
    }
  ],
  "extraction_summary": "How many entries extracted and what categories they fell into"
}

Extract as many distinct entries as the document contains. One decision per entry. Be thorough.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: extractPrompt }],
    });

    const raw = response.content[0].text;
    let extracted;
    try {
      extracted = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse extraction', raw });
    }

    // Save all as pending_review — author approves before active
    const created = await db.FranchiseKnowledge.bulkCreate(
      (extracted.entries || []).map(e => ({
        title: e.title,
        content: e.content,
        category: e.category || 'narrative',
        severity: e.severity || 'important',
        applies_to: e.applies_to || [],
        always_inject: false, // never auto-set always_inject from document ingestion
        source_document,
        source_version: source_version || null,
        extracted_by: 'document_ingestion',
        status: 'pending_review',
      }))
    );

    return res.json({
      ok: true,
      entries_extracted: created.length,
      summary: extracted.extraction_summary,
      message: `${created.length} entries extracted and queued for your review — none are active until you approve them`,
    });
  } catch (err) {
    console.error('Document ingestion error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: direct entry
// Type a decision now — active immediately
// ─────────────────────────────────────────────────────────────────────────────
router.post('/entries', optionalAuth, async (req, res) => {
  const { title, content, category, severity, applies_to, always_inject, source_document } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content required' });
  }

  try {
    const entry = await db.FranchiseKnowledge.create({
      title,
      content,
      category: category || 'narrative',
      severity: severity || 'important',
      applies_to: applies_to || [],
      always_inject: always_inject || false,
      source_document: source_document || 'direct',
      extracted_by: 'direct_entry',
      status: 'active', // direct entries go live immediately
    });

    return res.json({ ok: true, entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3: list entries
// ─────────────────────────────────────────────────────────────────────────────
router.get('/entries', optionalAuth, async (req, res) => {
  const { status, category, severity, always_inject, search } = req.query;
  try {
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (always_inject !== undefined) where.always_inject = always_inject === 'true';
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const entries = await db.FranchiseKnowledge.findAll({
      where,
      order: [
        ['always_inject', 'DESC'],
        ['severity', 'ASC'],
        ['category', 'ASC'],
        ['title', 'ASC'],
      ],
    });

    const counts = {
      total: entries.length,
      active: entries.filter(e => e.status === 'active').length,
      pending_review: entries.filter(e => e.status === 'pending_review').length,
      laws: entries.filter(e => e.always_inject).length,
    };

    return res.json({ entries, counts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: edit entry
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/entries/:id', optionalAuth, async (req, res) => {
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await entry.update(req.body);
    return res.json({ ok: true, entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 5: activate a pending entry
// ─────────────────────────────────────────────────────────────────────────────
router.post('/entries/:id/activate', optionalAuth, async (req, res) => {
  const { review_note } = req.body;
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await entry.update({ status: 'active', review_note: review_note || null });
    return res.json({ ok: true, entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 6: archive / supersede
// ─────────────────────────────────────────────────────────────────────────────
router.post('/entries/:id/archive', optionalAuth, async (req, res) => {
  const { superseded_by, review_note } = req.body;
  try {
    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await entry.update({
      status: superseded_by ? 'superseded' : 'archived',
      superseded_by: superseded_by || null,
      review_note: review_note || null,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 7: extract-conversation
// Paste a conversation transcript — Claude extracts decisions made
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extract-conversation', optionalAuth, async (req, res) => {
  const { conversation_text } = req.body;
  if (!conversation_text) return res.status(400).json({ error: 'conversation_text required' });

  try {
    const extractPrompt = `Extract every franchise decision, character truth, narrative rule, or locked choice made in this build conversation. Focus on decisions — not process, not questions, not options that were rejected.

CONVERSATION:
${conversation_text}

Return JSON:
{
  "entries": [
    {
      "title": "Short label",
      "content": "The decision as a direct statement",
      "category": "character | narrative | locked_decision | franchise_law | technical | brand | world",
      "severity": "critical | important | context",
      "applies_to": ["relevant", "tags"]
    }
  ],
  "decisions_found": number,
  "summary": "What was decided in this conversation"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: extractPrompt }],
    });

    const raw = response.content[0].text;
    let extracted;
    try {
      extracted = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Parse failed', raw });
    }

    const created = await db.FranchiseKnowledge.bulkCreate(
      (extracted.entries || []).map(e => ({
        title: e.title,
        content: e.content,
        category: e.category || 'narrative',
        severity: e.severity || 'important',
        applies_to: e.applies_to || [],
        always_inject: false,
        source_document: 'conversation',
        extracted_by: 'conversation_extraction',
        status: 'pending_review',
      }))
    );

    return res.json({
      ok: true,
      entries_extracted: created.length,
      decisions_found: extracted.decisions_found,
      summary: extracted.summary,
      message: `${created.length} decisions extracted — review and activate them in the Franchise Brain`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 8: franchise guard
// Run before any generation — checks brief against knowledge base
// ─────────────────────────────────────────────────────────────────────────────
router.post('/guard', optionalAuth, async (req, res) => {
  const { scene_brief, character_names = [], scene_type = '' } = req.body;
  if (!scene_brief) return res.status(400).json({ error: 'scene_brief required' });

  try {
    const { result, injected } = await runFranchiseGuard(scene_brief, character_names, scene_type);
    return res.json({
      ...result,
      entries_checked: injected.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 9: inject
// Get the formatted knowledge injection for a specific scene context
// Used internally by story engine — also exposed for testing
// ─────────────────────────────────────────────────────────────────────────────
router.get('/inject', optionalAuth, async (req, res) => {
  const { characters, scene_type, brief } = req.query;
  const characterNames = characters ? characters.split(',').map(c => c.trim()) : [];
  try {
    const injection = await buildKnowledgeInjection(characterNames, scene_type || '', brief || '');
    return res.json({ injection, character_count: characterNames.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Export router + functions for use in other routes
module.exports = router;
module.exports.runFranchiseGuard = runFranchiseGuard;
module.exports.buildKnowledgeInjection = buildKnowledgeInjection;

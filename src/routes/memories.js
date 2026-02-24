'use strict';

/**
 * src/routes/memories.js
 *
 * Memory routes for the PNOS Storytelling System — Phase 1.
 *
 * Base path: /api/v1/memories  (register in app.js)
 *
 * Routes:
 *   GET    /lines/:lineId/memories          — Get all memories for a line
 *   POST   /lines/:lineId/extract           — Extract candidate memories via Claude API
 *   POST   /memories/:memoryId/confirm      — Confirm a memory (writes to Character Registry)
 *   POST   /memories/:memoryId/dismiss      — Dismiss a memory (soft-delete / mark dismissed)
 *   PUT    /memories/:memoryId              — Edit memory fields (sets protected=true)
 *   GET    /characters/:charId/memories     — Get all confirmed memories for a character
 *   GET    /books/:bookId/memories/pending  — All unconfirmed memories across a book (Memory Bank panel)
 *
 * Registration in app.js:
 *   const memoriesRoutes = require('./routes/memories');
 *   app.use('/api/v1/memories', memoriesRoutes);
 */

const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// ── Auth middleware — matches all existing routes exactly ──────────────────
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ── Models ─────────────────────────────────────────────────────────────────
// Adjust path to match your models/index.js export pattern
const db = require('../models');
const { StorytellerMemory, StorytellerLine, StorytellerBook, StorytellerChapter, RegistryCharacter } = db;
const { buildUniverseContext } = require('../utils/universeContext');

// ── Anthropic client ───────────────────────────────────────────────────────
// Requires ANTHROPIC_API_KEY in your environment / .env
const anthropic = new Anthropic();

// ── Memory extraction prompt ───────────────────────────────────────────────
// This is the core prompt that drives Phase 1. Structured output only.
function buildExtractionPrompt(lineContent, characterContext) {
  return `You are a narrative memory extractor for the PNOS (Personal Narrative Operating System).

Your job is to read a single approved narrative line and extract structured memory candidates from it.

A memory is a typed, atomic fact about a character — their beliefs, goals, relationships, constraints, events, or transformations.

NARRATIVE LINE:
"${lineContent}"

${characterContext ? `CHARACTER CONTEXT:\n${characterContext}\n` : ''}

MEMORY TYPES TO EXTRACT:

1. belief — A stated or implied belief the protagonist holds about herself
   Example: "I wasn't jealous. Being jealous really isn't me."

2. constraint — Something that limits her. Internal or external.
   Example: "There was always something in the way. Never the same thing twice."

3. character_dynamic — A relationship pattern or dynamic between characters
   Example: "Chloe knew I was watching and cheering."

4. pain_point — A specific content creator struggle documented from lived experience.
   This is the most important new type. Tag it when JustAWoman describes:
   - comparison_spiral: measuring herself against others compulsively
   - visibility_gap: doing everything right and not being seen
   - identity_drift: aesthetic or purpose shifting depending on who's watching
   - financial_risk: spending money before earning it
   - consistency_collapse: showing up consistently until burnout or fade
   - clarity_deficit: knowing what she wants but not how to get there
   - external_validation: needing confirmation before believing in herself
   - restart_cycle: deleting, starting over, new theme, new promise

   For pain_point memories, add a "category" field and a "coaching_angle" —
   what a coach would say to someone experiencing this exact thing.

   CRITICAL: She never knows she's documenting pain points.
   Extract them invisibly. The manuscript never uses this language.
   It lives only in the Memory Bank.

5. goal — A character wants or intends something
6. preference — A character likes, avoids, or is drawn to something
7. relationship — How two characters relate to each other (trust, tension, dynamic shift)
8. event — Something that happened that is now part of the character's story
9. transformation — A change in identity, capability, or worldview

RULES:
- Extract only what is clearly stated or strongly implied in the line. Do not invent.
- One memory per distinct fact. A single line may yield 0–3 memories.
- If nothing meaningful can be extracted, return an empty array.
- Confidence is how certain you are this is a real, stable memory (not a passing moment).
  - 0.90–1.00: Explicitly stated, unambiguous
  - 0.70–0.89: Strongly implied, likely stable
  - 0.50–0.69: Plausible inference, may be situational
  - Below 0.50: Do not extract — too uncertain

Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown fences.

For each memory found, return:
{
  "type": "belief|constraint|character_dynamic|pain_point|goal|preference|relationship|event|transformation",
  "statement": "the memory in one clear sentence",
  "confidence": 0.82,
  "tags": ["tag1", "tag2"],
  "character_hint": "character name this memory belongs to",
  "category": "only for pain_point type — one of the 8 categories above, otherwise omit",
  "coaching_angle": "only for pain_point type — what a coach would say about this, otherwise omit"
}

If nothing to extract:
[]`;
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /structure-universe
 * Takes raw pasted universe notes and uses Claude to structure them
 * into the five universe fields: description, pnos_beliefs, world_rules,
 * narrative_economy, core_themes.
 * Does NOT save anything — returns structured data for review.
 */
router.post('/structure-universe', optionalAuth, async (req, res) => {
  try {
    const { raw_text } = req.body;
    if (!raw_text?.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    const prompt = `You are a narrative architect. A creator has pasted raw world-building notes for their fictional universe. Structure these notes into the five canonical fields below.

RAW NOTES:
${raw_text}

Extract and structure into these five fields:

1. description — A single cohesive paragraph describing the universe's philosophy and purpose. What is this world about at its core?

2. pnos_beliefs — The narrative laws that govern this world. Format as numbered beliefs, each with a name and explanation. These are not themes — they are operating principles.

3. world_rules — The mechanical and narrative rules. Format as numbered rules with titles and explanations.

4. narrative_economy — The currency, reputation, and progression systems. How do characters advance? What does access cost?

5. core_themes — A JSON array of 5-8 short theme strings.

Respond with ONLY valid JSON. No preamble, no markdown fences.

{
  "description": "...",
  "pnos_beliefs": "...",
  "world_rules": "...",
  "narrative_economy": "...",
  "core_themes": ["theme1", "theme2"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let structured;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      structured = JSON.parse(clean);
    } catch (parseErr) {
      return res.status(500).json({
        error: 'Claude returned unparseable response',
        raw: rawText.slice(0, 400),
      });
    }

    res.json({ structured });
  } catch (err) {
    console.error('POST /structure-universe error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /lines/:lineId/memories
 * Returns all memories (confirmed + inferred) for a given line.
 * Used to show the memory card inline in the Book Editor when a line is approved.
 */
router.get('/lines/:lineId/memories', optionalAuth, async (req, res) => {
  try {
    const { lineId } = req.params;

    const memories = await StorytellerMemory.findAll({
      where: { line_id: lineId },
      include: [
        {
          model: RegistryCharacter,
          as: 'character',
          attributes: ['id', 'display_name', 'role_type'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ memories });
  } catch (err) {
    console.error('GET /lines/:lineId/memories error:', err);
    res.status(500).json({ error: 'Failed to fetch memories', details: err.message });
  }
});


/**
 * POST /lines/:lineId/extract
 * Calls the Claude API to extract candidate memories from an approved line.
 * Creates StorytellerMemory rows with confirmed=false.
 * Returns the extracted candidates for immediate display in the confirmation UI.
 *
 * Body: { character_context?: string }  — optional extra context to ground extraction
 */
router.post('/lines/:lineId/extract', optionalAuth, async (req, res) => {
  try {
    const { lineId } = req.params;
    const { character_context } = req.body;

    // Fetch the line
    const line = await StorytellerLine.findByPk(lineId);
    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    // Only extract from approved or edited lines — not pending or rejected
    if (!['approved', 'edited'].includes(line.status)) {
      return res.status(400).json({
        error: 'Memory extraction only runs on approved or edited lines',
        line_status: line.status,
      });
    }

    // Check if memories already exist for this line — avoid duplicate extraction
    const existingCount = await StorytellerMemory.count({ where: { line_id: lineId } });
    if (existingCount > 0) {
      return res.status(409).json({
        error: 'Memories already extracted for this line. Use GET /lines/:lineId/memories to retrieve them.',
        existing_count: existingCount,
      });
    }

    // Build universe context for richer extraction
    const chapter = await StorytellerChapter.findOne({ where: { id: line.chapter_id } });
    const bookId = chapter ? chapter.book_id : null;
    const universeContext = bookId ? await buildUniverseContext(bookId, db) : '';

    // Call Claude API
    const prompt = universeContext + buildExtractionPrompt(line.text, character_context || null);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse the response — expected: a JSON array
    const rawText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    let candidates = [];
    try {
      candidates = JSON.parse(rawText);
      if (!Array.isArray(candidates)) candidates = [];
    } catch (parseErr) {
      console.error('Claude response parse error:', parseErr, '\nRaw:', rawText);
      // Don't fail the request — return empty extraction
      return res.json({
        extracted: 0,
        memories: [],
        warning: 'Claude returned an unparseable response. No memories extracted.',
      });
    }

    // Write each candidate to the DB as unconfirmed
    const created = await Promise.all(
      candidates.map(candidate =>
        StorytellerMemory.create({
          line_id: lineId,
          character_id: null, // assigned during confirmation when user picks a character
          type: candidate.type,
          statement: candidate.statement,
          confidence: Math.min(1, Math.max(0, parseFloat(candidate.confidence) || 0)),
          confirmed: false,
          protected: false,
          source_type: line.source_type || 'text',
          source_ref: line.source_ref || null,
          tags: Array.isArray(candidate.tags) ? candidate.tags : [],
          confirmed_at: null,
          // Pain point fields — only populated for type=pain_point
          category: candidate.type === 'pain_point' ? (candidate.category || null) : null,
          coaching_angle: candidate.type === 'pain_point' ? (candidate.coaching_angle || null) : null,
        })
      )
    );

    res.status(201).json({
      extracted: created.length,
      memories: created,
      line_id: lineId,
    });
  } catch (err) {
    console.error('POST /lines/:lineId/extract error:', err);
    res.status(500).json({ error: 'Memory extraction failed', details: err.message });
  }
});


/**
 * POST /books/:bookId/extract-all
 * Batch-extracts memories from ALL approved lines in a book that don't
 * already have memories. Calls Claude once per eligible line (sequentially
 * to avoid rate limits). Returns a summary of results.
 *
 * This is designed for retroactive extraction — e.g., lines approved before
 * the auto-extract feature was added, or lines where extraction silently failed.
 *
 * Idempotent: lines that already have memories are skipped.
 */
router.post('/books/:bookId/extract-all', optionalAuth, async (req, res) => {
  try {
    const { bookId } = req.params;

    // Verify book exists
    const book = await StorytellerBook.findByPk(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Find all approved/edited lines in this book that have NO memories yet
    const chapters = await StorytellerChapter.findAll({
      where: { book_id: bookId },
      include: [{
        model: StorytellerLine,
        as: 'lines',
        where: { status: ['approved', 'edited'] },
        required: false,
      }],
    });

    // Collect eligible lines (approved/edited with zero memories)
    const eligibleLines = [];
    for (const chapter of chapters) {
      if (!chapter.lines) continue;
      for (const line of chapter.lines) {
        const memCount = await StorytellerMemory.count({ where: { line_id: line.id } });
        if (memCount === 0) {
          eligibleLines.push(line);
        }
      }
    }

    if (eligibleLines.length === 0) {
      return res.json({
        message: 'No eligible lines found — all approved lines already have memories.',
        extracted: 0,
        skipped: 0,
        failed: 0,
        results: [],
      });
    }

    // Build universe context once (shared across all extractions)
    const universeContext = await buildUniverseContext(bookId, db);

    // Extract sequentially to avoid Claude rate limits
    const results = [];
    let extracted = 0;
    let failed = 0;

    for (const line of eligibleLines) {
      try {
        const prompt = universeContext + buildExtractionPrompt(line.text, null);

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawText = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');

        let candidates = [];
        try {
          candidates = JSON.parse(rawText);
          if (!Array.isArray(candidates)) candidates = [];
        } catch (parseErr) {
          console.error(`Batch extract parse error for line ${line.id}:`, parseErr);
          results.push({ line_id: line.id, status: 'parse_error', extracted: 0 });
          failed++;
          continue;
        }

        // Write candidates to DB
        const created = await Promise.all(
          candidates.map(candidate =>
            StorytellerMemory.create({
              line_id: line.id,
              character_id: null,
              type: candidate.type,
              statement: candidate.statement,
              confidence: Math.min(1, Math.max(0, parseFloat(candidate.confidence) || 0)),
              confirmed: false,
              protected: false,
              source_type: line.source_type || 'text',
              source_ref: line.source_ref || null,
              tags: Array.isArray(candidate.tags) ? candidate.tags : [],
              confirmed_at: null,
              // Pain point fields
              category: candidate.type === 'pain_point' ? (candidate.category || null) : null,
              coaching_angle: candidate.type === 'pain_point' ? (candidate.coaching_angle || null) : null,
            })
          )
        );

        results.push({ line_id: line.id, status: 'ok', extracted: created.length });
        extracted += created.length;
      } catch (lineErr) {
        console.error(`Batch extract failed for line ${line.id}:`, lineErr.message);
        results.push({ line_id: line.id, status: 'error', error: lineErr.message });
        failed++;
      }
    }

    res.json({
      message: `Batch extraction complete. ${extracted} memories from ${eligibleLines.length} lines.`,
      total_lines: eligibleLines.length,
      extracted,
      failed,
      results,
    });
  } catch (err) {
    console.error('POST /books/:bookId/extract-all error:', err);
    res.status(500).json({ error: 'Batch extraction failed', details: err.message });
  }
});


/**
 * POST /memories/:memoryId/confirm
 * Confirms a memory:
 *   1. Sets confirmed=true, confirmed_at=now on the memory row
 *   2. Writes the memory to the linked character's writer_notes in registry_characters
 *      (or updates a dedicated field if you extend the schema)
 *
 * Body: {
 *   character_id: UUID  — required, must be a valid registry_characters.id
 *   statement?: string  — optional override (if user edited statement in the confirm card)
 * }
 */
router.post('/memories/:memoryId/confirm', optionalAuth, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { character_id, statement } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required to confirm a memory' });
    }

    const memory = await StorytellerMemory.findByPk(memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    if (memory.confirmed) {
      return res.status(409).json({ error: 'Memory is already confirmed' });
    }

    // Validate the character exists
    const character = await RegistryCharacter.findByPk(character_id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found in registry' });
    }

    // Allow confirming memories to any character, including finalized ones

    // If user edited the statement in the confirmation card, mark it protected
    const finalStatement = statement && statement.trim() ? statement.trim() : memory.statement;
    const isProtected = statement && statement.trim() && statement.trim() !== memory.statement;

    // Update the memory row
    await memory.update({
      character_id,
      statement: finalStatement,
      confirmed: true,
      protected: isProtected || memory.protected,
      confidence: 1.0, // user confirmation overrides AI confidence
      confirmed_at: new Date(),
    });

    // Write to Character Registry — append memory to extra_fields.memories array
    // This is the lightweight approach that reuses the existing JSONB column.
    // Phase 2 may introduce a dedicated memories association instead.
    const memoryEntry = `[${memory.type.toUpperCase()} · ${new Date().toISOString().split('T')[0]}] ${finalStatement}`;
    const currentExtra = character.extra_fields || {};
    const existingMemories = Array.isArray(currentExtra.memories) ? currentExtra.memories : [];
    existingMemories.push(memoryEntry);

    await character.update({ extra_fields: { ...currentExtra, memories: existingMemories } });

    res.json({
      memory: await StorytellerMemory.findByPk(memoryId),
      character_updated: true,
      character_id,
    });
  } catch (err) {
    console.error('POST /memories/:memoryId/confirm error:', err);
    res.status(500).json({ error: 'Memory confirmation failed', details: err.message });
  }
});


/**
 * POST /memories/:memoryId/dismiss
 * Dismisses an unconfirmed memory — removes it from the pending queue.
 * Hard-deletes the row. Does not affect the source line.
 */
router.post('/memories/:memoryId/dismiss', optionalAuth, async (req, res) => {
  try {
    const { memoryId } = req.params;

    const memory = await StorytellerMemory.findByPk(memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    if (memory.confirmed) {
      return res.status(409).json({
        error: 'Cannot dismiss a confirmed memory. Confirmed memories are part of the character record.',
      });
    }

    await memory.destroy();
    res.json({ dismissed: true, memory_id: memoryId });
  } catch (err) {
    console.error('POST /memories/:memoryId/dismiss error:', err);
    res.status(500).json({ error: 'Memory dismissal failed', details: err.message });
  }
});


/**
 * PUT /memories/:memoryId
 * Edit a memory's statement, type, or tags.
 * Automatically sets protected=true — system will never overwrite user edits.
 *
 * Body: { statement?, type?, tags?, character_id? }
 */
router.put('/memories/:memoryId', optionalAuth, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { statement, type, tags, character_id } = req.body;

    const memory = await StorytellerMemory.findByPk(memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    const updates = { protected: true }; // any edit = protected
    if (statement !== undefined) updates.statement = statement;
    if (type      !== undefined) updates.type      = type;
    if (tags      !== undefined) updates.tags      = tags;
    if (character_id !== undefined) updates.character_id = character_id;

    await memory.update(updates);

    res.json({ memory: await StorytellerMemory.findByPk(memoryId) });
  } catch (err) {
    console.error('PUT /memories/:memoryId error:', err);
    res.status(500).json({ error: 'Memory update failed', details: err.message });
  }
});


/**
 * GET /characters/:charId/memories
 * Returns all confirmed memories for a character.
 * Used to populate the Character Registry detail view with memory history.
 */
router.get('/characters/:charId/memories', optionalAuth, async (req, res) => {
  try {
    const { charId } = req.params;

    const memories = await StorytellerMemory.findAll({
      where: {
        character_id: charId,
        confirmed: true,
      },
      order: [['confirmed_at', 'DESC']],
    });

    res.json({ memories, character_id: charId });
  } catch (err) {
    console.error('GET /characters/:charId/memories error:', err);
    res.status(500).json({ error: 'Failed to fetch character memories', details: err.message });
  }
});


/**
 * GET /books/:bookId/memories/pending
 * Returns all unconfirmed memories across an entire book.
 * Used to populate the Memory Bank right-panel tab in the Book Editor.
 * Shows both inferred (pending confirmation) and confirmed memories.
 *
 * Query: ?confirmed=true|false|all  (default: all)
 */
router.get('/books/:bookId/memories/pending', optionalAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { confirmed } = req.query; // 'true' | 'false' | 'all'

    // Walk book → chapters → lines → memories
    const { StorytellerBook, StorytellerChapter } = db;

    const book = await StorytellerBook.findByPk(bookId, {
      include: [{
        model: StorytellerChapter,
        as: 'chapters',
        include: [{
          model: StorytellerLine,
          as: 'lines',
          include: [{
            model: StorytellerMemory,
            as: 'memories',
            include: [{
              model: RegistryCharacter,
              as: 'character',
              attributes: ['id', 'display_name', 'role_type'],
              required: false,
            }],
          }],
        }],
      }],
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Flatten memories from the nested structure
    let memories = [];
    for (const chapter of book.chapters || []) {
      for (const line of chapter.lines || []) {
        for (const memory of line.memories || []) {
          memories.push({
            ...memory.toJSON(),
            chapter_title: chapter.title,
            line_content_preview: (line.text || '').slice(0, 100),
          });
        }
      }
    }

    // Filter by confirmed status if requested
    if (confirmed === 'true') {
      memories = memories.filter(m => m.confirmed);
    } else if (confirmed === 'false') {
      memories = memories.filter(m => !m.confirmed);
    }

    res.json({
      book_id: bookId,
      total: memories.length,
      confirmed_count: memories.filter(m => m.confirmed).length,
      inferred_count: memories.filter(m => !m.confirmed).length,
      memories,
    });
  } catch (err) {
    console.error('GET /books/:bookId/memories/pending error:', err);
    res.status(500).json({ error: 'Failed to fetch book memories', details: err.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// GET /books/:bookId/scenes
// Generates 3-5 scene suggestions via Claude API.
// Uses confirmed memories + approved/edited lines as context.
// Results are NOT stored — generated fresh on each request.
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/books/:bookId/scenes', optionalAuth, async (req, res) => {
  try {
    const { bookId } = req.params;

    // ── 1. Fetch the book with chapters + lines ──────────────────────────
    const book = await StorytellerBook.findByPk(bookId, {
      include: [{
        model: StorytellerChapter,
        as: 'chapters',
        include: [{
          model: StorytellerLine,
          as: 'lines',
        }],
      }],
    });

    if (!book) return res.status(404).json({ error: 'Book not found' });

    // ── 2. Collect approved/edited lines ─────────────────────────────────
    const approvedLines = [];
    for (const chapter of book.chapters || []) {
      for (const line of chapter.lines || []) {
        if (line.status === 'approved' || line.status === 'edited') {
          approvedLines.push({
            chapter: chapter.title,
            content: line.text,
          });
        }
      }
    }

    // ── 3. Fetch confirmed memories for this book ─────────────────────────
    const confirmedMemories = [];
    for (const chapter of book.chapters || []) {
      for (const line of chapter.lines || []) {
        const memories = await StorytellerMemory.findAll({
          where: { line_id: line.id, confirmed: true },
          include: [{
            model: RegistryCharacter,
            as: 'character',
            attributes: ['id', 'display_name', 'role_type'],
            required: false,
          }],
        });
        for (const memory of memories) {
          confirmedMemories.push({
            type: memory.type,
            statement: memory.statement,
            character: memory.character?.display_name || null,
            tags: memory.tags || [],
          });
        }
      }
    }

    if (approvedLines.length === 0 && confirmedMemories.length === 0) {
      return res.status(400).json({
        error: 'No approved lines or confirmed memories found. Approve some lines and confirm memories before generating scene suggestions.',
      });
    }

    // ── 4. Build chapter list for Claude to reference ─────────────────────
    const chapterList = (book.chapters || []).map((c, i) => ({
      index: i + 1,
      id: c.id,
      title: c.title,
      lineCount: (c.lines || []).length,
      approvedCount: (c.lines || []).filter(l => l.status === 'approved' || l.status === 'edited').length,
    }));

    // ── 5. Build universe context + prompt ────────────────────────────────
    const universeContext = await buildUniverseContext(bookId, db);
    const prompt = universeContext + buildScenesPrompt({
      bookTitle: book.title || book.character_name,
      chapters: chapterList,
      approvedLines,
      confirmedMemories,
    });

    // ── 6. Call Claude ────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── 7. Parse response ─────────────────────────────────────────────────
    let scenes = [];
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      scenes = JSON.parse(clean);
      if (!Array.isArray(scenes)) scenes = [];
    } catch (parseErr) {
      console.error('Scene suggestion parse error:', parseErr, '\nRaw:', rawText);
      return res.status(500).json({
        error: 'Claude returned an unparseable response.',
        raw: rawText.slice(0, 300),
      });
    }

    // ── 8. Resolve chapter_id from chapter_hint ───────────────────────────
    const resolvedScenes = scenes.map(scene => {
      let chapter_id = null;
      if (scene.chapter_index) {
        const match = chapterList.find(c => c.index === scene.chapter_index);
        chapter_id = match?.id || null;
      }
      return {
        title: scene.title || 'Untitled Scene',
        description: scene.description || '',
        chapter_hint: scene.chapter_hint || '',
        chapter_id,
        characters: Array.isArray(scene.characters) ? scene.characters : [],
        reason: scene.reason || '',
      };
    });

    res.json({
      scenes: resolvedScenes,
      generated_at: new Date().toISOString(),
      context_used: {
        memories: confirmedMemories.length,
        lines: approvedLines.length,
      },
    });
  } catch (err) {
    console.error('GET /books/:bookId/scenes error:', err);
    res.status(500).json({ error: 'Scene generation failed', details: err.message });
  }
});


// ── Scene suggestion prompt ────────────────────────────────────────────────

function buildScenesPrompt({ bookTitle, chapters, approvedLines, confirmedMemories }) {
  const chapterListStr = chapters
    .map(c => `  Chapter ${c.index}: "${c.title}" (${c.approvedCount}/${c.lineCount} lines approved)`)
    .join('\n');

  const memoriesStr = confirmedMemories.length > 0
    ? confirmedMemories.map(m =>
        `  [${m.type.toUpperCase()}] ${m.character ? `${m.character}: ` : ''}${m.statement}`
      ).join('\n')
    : '  (none yet)';

  const linesStr = approvedLines.length > 0
    ? approvedLines.slice(-20).map(l =>
        `  [${l.chapter}] ${l.content}`
      ).join('\n')
    : '  (none yet)';

  return `You are a narrative scene architect for the PNOS (Personal Narrative Operating System).

Your job is to suggest 3-5 concrete scene beats that would strengthen the book's narrative arc.

BOOK: "${bookTitle}"

CHAPTERS:
${chapterListStr}

CONFIRMED CHARACTER MEMORIES:
${memoriesStr}

APPROVED NARRATIVE LINES (most recent):
${linesStr}

INSTRUCTIONS:
- Suggest scenes that FILL GAPS — missing character appearances, unresolved threads, needed transitions
- Each scene should feel necessary, not decorative
- Scenes should emerge from what is already confirmed — do not invent new characters or facts
- Keep descriptions concrete and specific — a scene is a moment, not a theme
- chapter_hint should be one of the chapter titles above, or "Chapter N-M Bridge" for transitions
- chapter_index must match the chapter number (1, 2, 3...) or null for bridge scenes
- characters should only include names that appear in the memories or approved lines

Respond with ONLY a valid JSON array. No preamble, no explanation, no markdown fences.

[
  {
    "title": "Short evocative scene title",
    "description": "One or two sentences. The actual scene — what happens, who is there, what shifts.",
    "chapter_hint": "Chapter 01",
    "chapter_index": 1,
    "characters": ["Character Name", "Other Character"],
    "reason": "One sentence explaining why this scene is needed for the arc."
  }
]`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /scene-interview
// Takes 7 scene interview answers → Claude generates a structured scene brief
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/scene-interview', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_title,
      answers,
      characters = [],
    } = req.body;

    if (!answers || !book_id) {
      return res.status(400).json({ error: 'answers and book_id are required' });
    }

    // ── Get universe context ───────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Build the prompt ───────────────────────────────────────────────────
    const characterList = characters.length > 0
      ? characters.map(c => `- ${c.name} (${c.type})`).join('\n')
      : '- JustAWoman (protagonist)';

    const prompt = `${universeContext}

You are a narrative architect helping a first-time author write their debut novel.

The author has answered 7 questions about their upcoming chapter. Use their answers to build a structured scene brief that will guide their writing session.

CHAPTER: "${chapter_title}"

KNOWN CHARACTERS:
${characterList}

AUTHOR'S ANSWERS:

1. WHERE DOES THE SCENE OPEN?
${answers.location || '(not answered)'}

2. TIME AND WEATHER:
${answers.time_weather || '(not answered)'}

3. WHO IS PHYSICALLY PRESENT:
${answers.who_present || '(not answered)'}

4. CHARACTER RELATIONSHIPS AND ENERGY:
${answers.relationships || '(not answered)'}

5. WHAT JUST HAPPENED BEFORE THIS SCENE:
${answers.just_happened || '(not answered)'}

6. WHAT DOES SHE WANT RIGHT NOW:
${answers.wants_right_now || '(not answered)'}

7. WHAT IS SHE AFRAID OF RIGHT NOW:
${answers.afraid_of || '(not answered)'}

INSTRUCTIONS:
Build a scene brief from these answers. Be specific. Use the author's actual words and details — do not invent facts they didn't give you. The scene_setting should be atmospheric and grounded. The opening_suggestion should feel like the first line of a novel — intimate, specific, and in JustAWoman's voice.

This is a literary novel. First-person voice. Intimate. Real. Not commercial fiction.

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "scene_setting": "Full atmospheric description of the scene — where, when, what it feels, sounds, smells like. 3-5 sentences.",
  "theme": "The core emotional idea this chapter explores. One phrase.",
  "scene_goal": "What must happen by the end of this chapter. One or two sentences.",
  "emotional_state_start": "Where JustAWoman begins emotionally. 3-6 words.",
  "emotional_state_end": "Where she ends emotionally. 3-6 words.",
  "characters_present": ["Name1", "Name2"],
  "pov": "first_person",
  "opening_suggestion": "One suggested first line of the chapter. In JustAWoman's voice. Specific. Grounded in the scene details the author gave."
}`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let brief;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      brief = JSON.parse(clean);
    } catch (parseErr) {
      console.error('scene-interview parse error:', parseErr, '\nRaw:', rawText);
      return res.status(500).json({
        error: 'Claude returned an unparseable response',
        raw: rawText.slice(0, 400),
      });
    }

    res.json({ brief });

  } catch (err) {
    console.error('POST /scene-interview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /narrative-intelligence
// Inline co-pilot: reads last 10 lines + chapter brief + venture context →
// returns a contextual writing suggestion
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/narrative-intelligence', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_brief = {},
      recent_lines = [],
      line_count = 0,
      characters = [],
      // ── venture context fields ───────────────────────────────────────────
      venture_context = '',
      pnos_act = 'act_1',
      incoming_echoes = [],
      active_threads = [],
      // ── alive system fields ──────────────────────────────────────────────
      character_rules = '',
      book_question = '',
      exit_emotion = '',
      exit_emotion_note = '',
    } = req.body;

    if (!book_id || recent_lines.length === 0) {
      return res.status(400).json({ error: 'book_id and recent_lines are required' });
    }

    // ── Universe context ───────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Character list ─────────────────────────────────────────────────────
    const characterList = characters.length > 0
      ? characters.map(c => `- ${c.name} (${c.type})`).join('\n')
      : '- JustAWoman (protagonist)\n- Lala (proto-voice, not yet fully present)';

    // ── Recent lines formatted ─────────────────────────────────────────────
    const recentLinesFormatted = recent_lines
      .map((l, i) => `LINE ${line_count - recent_lines.length + i + 1}: ${l}`)
      .join('\n\n');

    // ── Chapter brief ──────────────────────────────────────────────────────
    const briefText = [
      chapter_brief.title        && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme        && `Theme: ${chapter_brief.theme}`,
      chapter_brief.scene_goal   && `Scene goal: ${chapter_brief.scene_goal}`,
      chapter_brief.emotional_state_start && `Emotional start: ${chapter_brief.emotional_state_start}`,
      chapter_brief.emotional_state_end   && `Emotional end: ${chapter_brief.emotional_state_end}`,
      chapter_brief.pov          && `POV: ${chapter_brief.pov}`,
      chapter_brief.chapter_notes && `Scene setting: ${chapter_brief.chapter_notes}`,
    ].filter(Boolean).join('\n');

    // ── Venture + echo context (new) ───────────────────────────────────────
    const ventureBlock = venture_context
      ? `\n═══════════════════════════════════════════════════════\nVENTURE HISTORY & PNOS ACT\n═══════════════════════════════════════════════════════\n${venture_context}\n`
      : '';

    const echoBlock = incoming_echoes.length > 0
      ? `\n═══════════════════════════════════════════════════════\nINCOMING ECHOES (moments planted earlier that should reverberate here)\n═══════════════════════════════════════════════════════\n${incoming_echoes.map(e => `• FROM: "${e.source_line_content?.slice(0, 80)}..."\n  PLANTED: ${e.note}\n  SHOULD LAND AS: ${e.landing_note || 'natural resonance'}`).join('\n\n')}\n`
      : '';

    const threadBlock = active_threads.length > 0
      ? `\nACTIVE PLOT THREADS: ${active_threads.join(', ')}`
      : '';

    // ── Alive system blocks ────────────────────────────────────────────
    const characterRulesBlock = character_rules
      ? `\n═══════════════════════════════════════════════════════\nCHARACTER APPEARANCE RULES\n═══════════════════════════════════════════════════════\n${character_rules}\n`
      : '';

    const bookQuestionBlock = book_question
      ? `\n═══════════════════════════════════════════════════════\nBOOK QUESTION LAYER\n═══════════════════════════════════════════════════════\n${book_question}\n`
      : '';

    const exitEmotionBlock = exit_emotion
      ? `\nEXIT EMOTION TARGET: ${exit_emotion}${exit_emotion_note ? ` — ${exit_emotion_note}` : ''}\n`
      : '';

    const prompt = `${universeContext}
${ventureBlock}${echoBlock}${characterRulesBlock}${bookQuestionBlock}
You are an intelligent co-writing partner for a first-time novelist writing a literary debut.

The author is writing in real time. You have just been given their last ${recent_lines.length} lines. Your job is to read what they've written, understand the emotional momentum, and offer ONE specific, useful suggestion that helps them continue.

CHAPTER BRIEF:
${briefText || 'No brief set yet.'}
${threadBlock}
${exitEmotionBlock}
KNOWN CHARACTERS:
${characterList}

RECENT LINES (most recent at bottom):
${recentLinesFormatted}

TOTAL LINES WRITTEN SO FAR: ${line_count}

YOUR TASK:
Analyze what's happening in these lines. Then choose the SINGLE most useful suggestion type:

- "continuation" — the scene is building but needs direction for what happens next
- "line" — the author needs actual prose; give them a line in JustAWoman's voice
- "character_cue" — a character is overdue to appear and their entrance would add value
- "sensory" — the scene is all interior monologue; needs a physical/sensory detail to ground it
- "lala" — the emotional conditions for Lala's proto-voice are present (frustration, creative spiral, the thought that sounds styled not afraid)
- "echo" — an incoming echo is ripe to land in this moment; suggest how to weave it in
- "appearance" — a character's appearance rules are being violated or an entrance needs attention

CHARACTER APPEARANCE RULES:
If character rules are provided, ensure suggestions respect those rules. Never describe a character appearing in a way that violates their architectural constraints.

BOOK QUESTION AWARENESS:
If a book question direction is provided (toward/holding/away), the suggestion should subtly align with that direction. "Toward" means the character is moving closer to answering yes. "Away" means doubt is winning. "Holding" means the tension is suspended.

EXIT EMOTION AWARENESS:
If an exit emotion is set, the scene should be building toward that emotional landing. Your suggestion should help the writer steer toward that target.

LALA DETECTION RULES:
Lala conditions are met when: the writing shows a creative spiral (trying and failing, comparing, feeling behind), AND there's an emotional peak (frustration, longing, self-doubt reaching maximum), AND the scene has been interior monologue for 5+ lines. When Lala conditions are met, ALWAYS choose type "lala".

ECHO RULES:
If incoming echoes are provided and the current emotional moment matches one of them, choose type "echo" and suggest how to weave the echo into the current scene. The reader should feel resonance, not exposition.

VENTURE AWARENESS:
If venture history is provided, remember: JustAWoman is not on attempt 1. The doubt carries the weight of all previous attempts. The hope is harder-won. The voice should reflect accumulated experience, not fresh naivety.

WRITING RULES:
- The author is writing in first person (JustAWoman's voice) and close third
- This is a literary novel — intimate, specific, real
- JustAWoman's voice is: direct, self-aware, occasionally funny, never performative
- Lala's proto-voice is: confident, styled, unapologetic, brief — one thought, not a speech
- Do NOT invent new characters or facts not established in the brief or lines
- Do NOT be generic — your suggestion must respond specifically to what was just written

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "type": "continuation|line|character_cue|sensory|lala|echo",
  "suggestion": "Your specific guidance in 1-3 sentences. What should the author consider doing next and why.",
  "line_suggestion": "If type is 'line' or 'lala': actual prose in JustAWoman's voice they can use or modify. If not applicable, omit this field.",
  "lala_line": "If type is 'lala': the proto-voice line. One thought. Styled. Brief. e.g. 'If it were me, I would've posted it already.' Omit if not lala.",
  "character": "If type is 'character_cue': the character's name. Omit otherwise.",
  "character_role": "If type is 'character_cue': their narrative function here. Omit otherwise.",
  "echo_id": "If type is 'echo': the echo ID being surfaced. Omit otherwise.",
  "what_to_do": "Optional. One concrete action the author can take right now. e.g. 'Describe what her hands are doing while she waits.'"
}`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let suggestion;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      suggestion = JSON.parse(clean);
    } catch (parseErr) {
      console.error('narrative-intelligence parse error:', parseErr);
      // Return a safe fallback rather than erroring
      return res.json({
        suggestion: {
          type: 'continuation',
          suggestion: 'Keep writing. Stay in her voice. What does she do next?',
          what_to_do: 'Write the next thing that happens — even if it\'s small.',
        },
      });
    }

    res.json({ suggestion });

  } catch (err) {
    console.error('POST /narrative-intelligence error:', err);
    // Fail gracefully — never interrupt the writing session with a 500
    res.json({
      suggestion: {
        type: 'continuation',
        suggestion: 'Keep writing. Stay in her voice.',
      },
    });
  }
});


// ══════════════════════════════════════════════════════════════════════════
// POST /continuity-check — Detect contradictions, jumps, disconnects
// ══════════════════════════════════════════════════════════════════════════

router.post('/continuity-check', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_brief = {},
      all_lines,
      trigger_line,
    } = req.body;

    if (!book_id || !all_lines) {
      return res.status(400).json({ error: 'book_id and all_lines are required' });
    }

    const briefText = [
      chapter_brief.title        && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme        && `Theme: ${chapter_brief.theme}`,
      chapter_brief.scene_goal   && `Scene goal: ${chapter_brief.scene_goal}`,
      chapter_brief.emotional_state_start && `Emotional start: ${chapter_brief.emotional_state_start}`,
      chapter_brief.emotional_state_end   && `Emotional end: ${chapter_brief.emotional_state_end}`,
    ].filter(Boolean).join('\n');

    const prompt = `You are a continuity editor for a literary novel. A first-time author has just approved or edited a line. Check the full chapter for continuity issues.

CHAPTER BRIEF:
${briefText || 'Not set.'}

ALL APPROVED LINES:
${all_lines}

MOST RECENTLY APPROVED LINE:
${trigger_line}

CHECK FOR THESE THREE ISSUE TYPES:

1. FACTUAL CONTRADICTION
A character, location, time, or stated fact contradicts something established earlier.
Example: Character A was described as being at work in line 3 but is physically present in line 18 with no transition.

2. EMOTIONAL JUMP
The protagonist's emotional state shifts dramatically with no writing bridging the change.
Example: She's devastated and doubting herself in line 12, but energized and certain in line 15 with nothing in between.

3. NARRATIVE DISCONNECT
Something is introduced — a character, a phone call, an object, a decision — with no prior setup or explanation.
Example: Line 22 mentions a conversation she had with her sister, but no sister has been established.

RULES:
- Only flag REAL issues, not stylistic choices
- Minor POV shifts (first person to close third) are intentional — do NOT flag these
- If the chapter has no issues, return an empty array
- Be specific about which line numbers are involved
- Your suggestions must be actionable and concrete

Respond ONLY with valid JSON. No preamble. No markdown fences.

{
  "issues": [
    {
      "id": "issue-1",
      "type": "factual|emotional|narrative",
      "description": "Clear description of the specific issue found.",
      "lines_involved": [3, 18],
      "suggestion": "Concrete fix — what to write or change to resolve this."
    }
  ]
}

If no issues found: { "issues": [] }`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return res.json({ issues: [] }); // fail gracefully
    }

    res.json({ issues: result.issues || [] });

  } catch (err) {
    console.error('POST /continuity-check error:', err);
    res.json({ issues: [] }); // never 500 — fail gracefully
  }
});


// ══════════════════════════════════════════════════════════════════════════
// POST /rewrite-options — 3 alternative rewrites for a single line
// ══════════════════════════════════════════════════════════════════════════

router.post('/rewrite-options', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      line_id,
      content,
      chapter_brief = {},
    } = req.body;

    if (!content || !book_id) {
      return res.status(400).json({ error: 'content and book_id are required' });
    }

    // Get universe context for voice consistency
    const universeContext = await buildUniverseContext(book_id, db);

    const briefContext = [
      chapter_brief.title                 && `Chapter: ${chapter_brief.title}`,
      chapter_brief.theme                 && `Theme: ${chapter_brief.theme}`,
      chapter_brief.pov                   && `POV: ${chapter_brief.pov}`,
      chapter_brief.emotional_state_start && `Emotional state: ${chapter_brief.emotional_state_start}`,
    ].filter(Boolean).join('\n');

    const prompt = `${universeContext}

You are a literary editor helping a first-time novelist improve a single line. The author has written something real but wants to see if it can be expressed better.

CHAPTER CONTEXT:
${briefContext || 'No brief set.'}

ORIGINAL LINE:
"${content}"

Write exactly THREE rewrites of this line. Each rewrite serves a different purpose:

1. TIGHTER — Same meaning, fewer words. Cut what's unnecessary. Sharper, cleaner delivery. The core thought lands harder.

2. EMOTIONAL — More feeling. More vulnerability. More honest. Don't soften it — deepen it. What's the rawer version of this thought?

3. VOICE — More JustAWoman. She's direct, self-aware, specific, occasionally funny. She doesn't perform. She doesn't dress things up. What would she actually say?

RULES:
- Stay in the same POV as the original (first person if original is first person)
- Do NOT change the core meaning or introduce new facts
- Each rewrite must feel distinct from the others
- These are literary — not commercial, not self-help, not generic
- Preserve any dialect or speech patterns that feel intentional

Respond ONLY with valid JSON. No preamble. No markdown.

{
  "options": [
    { "type": "tighter",   "text": "rewritten line here" },
    { "type": "emotional", "text": "rewritten line here" },
    { "type": "voice",     "text": "rewritten line here" }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse rewrite response' });
    }

    res.json({ options: result.options || [] });

  } catch (err) {
    console.error('POST /rewrite-options error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
//  CHARACTER VOICE INTERVIEW ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /character-interview-next
 * Called after each answer during the character interview.
 * Returns an adaptive follow-up question based on what the author said.
 *
 * UPGRADES:
 * ─ First-answer deep read (was: only after answer 2)
 * ─ Hesitation catch mode (force_hesitation_catch flag from frontend)
 * ─ Contradiction detection mode (force_contradiction_check flag)
 * ─ contradiction_detected field in response for inline surfacing
 */
router.post('/character-interview-next', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      character_name,
      character_type,
      answers_so_far          = [],
      next_base_question,
      existing_characters     = [],
      force_hesitation_catch  = false,
      force_contradiction_check = false,
    } = req.body;

    // ── Universe context ──────────────────────────────────────────────
    let universeBlock = '';
    if (book_id) {
      try {
        const ctx = await buildUniverseContext(book_id, db);
        if (ctx) universeBlock = `\nUNIVERSE CONTEXT:\n${ctx}\n`;
      } catch (_) { /* non-fatal */ }
    }

    // ── Separate history from latest answer ──────────────────────────
    const previousAnswers = answers_so_far.slice(0, -1);
    const latestAnswer    = answers_so_far[answers_so_far.length - 1];

    const historyFormatted = previousAnswers.length > 0
      ? previousAnswers.map((a, i) => `Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`).join('\n\n')
      : '(This is the first answer — no prior history)';

    const latestFormatted = latestAnswer
      ? `Q: ${latestAnswer.question}\nA: ${latestAnswer.answer}`
      : '(No answer provided)';

    const existingList = existing_characters.length
      ? `\nALREADY KNOWN CHARACTERS (do NOT flag as new):\n${existing_characters.join(', ')}\n`
      : '';

    // ── Choose prompt mode based on flags ─────────────────────────────

    let taskInstructions;

    if (force_hesitation_catch) {
      // ── MODE: HESITATION CATCH ──────────────────────────────────────
      // The author trailed off, hedged, or said "I don't know."
      // Do not move to the next question. Stay here. Follow the thread.
      taskInstructions = `
THE AUTHOR TRAILED OFF OR HEDGED IN THEIR LAST ANSWER.

This means they are sitting on something they haven't fully articulated yet.
That unfinished thought is the most important thing in this interview right now.

YOUR TASK:
Ask ONE question that goes directly into the hesitation.
- If they said "I don't know" — ask what makes it hard to know.
- If they said "it's complicated" — ask what makes it complicated.
- If they trailed off mid-thought — ask what they were about to say.
- If they hedged ("sort of", "kind of") — ask for the version without the qualifier.

Do NOT move to the next planned question. Stay with what they just said.
The moment they can't finish is always the moment the real character is.

One question only. Warm, curious, direct.`;

    } else if (force_contradiction_check) {
      // ── MODE: CONTRADICTION DETECTION ──────────────────────────────
      // Scan ALL answers for tensions. Surface them as a question.
      // Contradictions are not problems — they are the character.
      taskInstructions = `
SCAN THE FULL CONVERSATION FOR TENSIONS AND CONTRADICTIONS.

Read every answer so far (including the latest). Look for places where:
- The author described the character one way early on, and a different way later
- The character seems to have two contradictory qualities that both feel true
- The author said something the character values, and something else that conflicts with it
- The relationship described in one answer doesn't match another

IMPORTANT: These tensions are NOT errors. They are exactly what makes a character
feel real. A character who is "very supportive" AND "always makes her feel small" is
not a contradiction to resolve — it's the most interesting thing about them.

YOUR TASK:
If you find a tension: ask ONE question that names it directly and invites the author
to sit with both truths rather than resolve them. Something like:
"Earlier you said [X] — but just now it sounds like [Y]. What if both are true?
What does that tension feel like in a scene?"

If you find NO real tension: fall back to a genuine follow-up on the latest answer.

Return the tension in the "contradiction_detected" field (one sentence summary).`;

    } else {
      // ── MODE: STANDARD ADAPTIVE FOLLOW-UP ──────────────────────────
      taskInstructions = `
YOUR TASK:

1. Read WHAT THE AUTHOR JUST SAID carefully. Not the previous answers — this one.

2. Ask ONE follow-up question that responds DIRECTLY to something specific in their answer.
   - Did they mention a name? Ask about that person.
   - Did they describe a feeling? Ask what created that feeling.
   - Did they say something surprising or specific? Follow that thread.
   - Did they give a detail that suggests a scene? Ask what that scene looks like.

3. ONLY fall back to the planned next question if their answer was very short
   and gave you genuinely nothing to follow.

4. Check for plot threads — conflicts, scenes, relationship dynamics that could become chapters.

5. Scan for new character names not in the ALREADY KNOWN CHARACTERS list.

One question only. Warm, curious, specific. Never clinical. Never generic.`;
    }

    const prompt = `You are interviewing an author about one of their characters to build a rich psychological profile and discover plot threads.

CHARACTER: ${character_name} (type: ${character_type})
BOOK: LalaVerse — literary, psychological, first-person narrative
${universeBlock}
${existingList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION HISTORY (context):
${historyFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THE AUTHOR JUST SAID:
${latestFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${next_base_question ? `NEXT PLANNED QUESTION (use as fallback only): ${next_base_question}` : ''}

${taskInstructions}

QUESTION RULES:
- ONE question only
- Conversational, warm — like a curious friend, not a clinician
- Specific to exactly what they said — never a generic follow-up
- Goes deeper, not sideways
- Never asks about story structure — always asks about the human truth

Respond with ONLY valid JSON. No preamble. No markdown fences.

{
  "question": "Your follow-up question — specific to the latest answer",
  "thread_hint": "One sentence describing a plot thread you detected, or null",
  "contradiction_detected": "One sentence naming the tension you found (for contradiction mode), or null",
  "new_characters": [
    {
      "name": "Character Name",
      "type": "pressure|mirror|support|shadow|special",
      "role": "Brief description of who they seem to be",
      "appearance_mode": "on_page|composite|observed|invisible|brief",
      "belief": "What this character might believe, based on context",
      "emotional_function": "Their emotional role in the story",
      "writer_notes": "Why the author mentioned them — what they might mean to the story"
    }
  ]
}

If no new characters: "new_characters": []
If no thread: "thread_hint": null
If no contradiction: "contradiction_detected": null`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      return res.json({
        question:                next_base_question || 'Tell me more about that.',
        thread_hint:             null,
        contradiction_detected:  null,
        new_characters:          [],
      });
    }

    if (!Array.isArray(result.new_characters)) result.new_characters = [];

    res.json(result);

  } catch (err) {
    console.error('POST /character-interview-next error:', err);
    res.json({
      question:               req.body.next_base_question || 'What else should I know about this character?',
      thread_hint:            null,
      contradiction_detected: null,
      new_characters:         [],
    });
  }
});


/**
 * POST /character-interview-create-character
 * Called when the author confirms a newly detected character during an interview.
 * Creates a draft RegistryCharacter with what Claude inferred.
 */
router.post('/character-interview-create-character', optionalAuth, async (req, res) => {
  try {
    const { registry_id, character, discovered_during } = req.body;
    if (!registry_id || !character?.name) {
      return res.status(400).json({ error: 'registry_id and character.name required' });
    }

    // Generate character_key from name
    const charKey = character.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Map appearance_mode values to valid enum values
    const modeMap = {
      'On-Page': 'on_page', 'on_page': 'on_page',
      'Composite': 'composite', 'composite': 'composite',
      'Referenced Only': 'observed', 'observed': 'observed',
      'Invisible': 'invisible', 'invisible': 'invisible',
      'Brief': 'brief', 'brief': 'brief',
    };
    const appearanceMode = modeMap[character.appearance_mode] || 'on_page';

    const created = await RegistryCharacter.create({
      registry_id,
      character_key:   charKey,
      display_name:    character.name,
      role_type:       character.type || 'special',
      description:     character.role || null,
      appearance_mode: appearanceMode,
      core_belief:     character.belief || null,
      pressure_type:   character.emotional_function || null,
      personality:     character.writer_notes || null,
      status:          'draft',
      subtitle:        discovered_during
        ? `Discovered during ${discovered_during} interview`
        : 'Discovered during interview',
      extra_fields: {
        discovered_during: discovered_during || null,
        auto_detected: true,
        detection_source: 'character_interview',
      },
    });

    res.json({ character: created });
  } catch (err) {
    console.error('POST /character-interview-create-character error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-complete
 * Called when the interview is complete.
 * Builds full character profile + discovers plot threads from all answers.
 *
 * UPGRADES:
 * ─ Extracts 3 new profile fields: sensory_anchor, private_self,
 *   unspoken_reaction (only if answers for those questions exist)
 * ─ Extracts contradictions as a separate array — NOT folded into notes.
 *   They get their own section in the profile view.
 * ─ Prompt rewritten to use the author's own words more aggressively
 */
router.post('/character-interview-complete', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      character_id,
      character_name,
      character_type,
      answers = [],
    } = req.body;

    let universeContext = '';
    if (book_id) {
      try {
        universeContext = await buildUniverseContext(book_id, db);
      } catch (_) { /* proceed without */ }
    }

    const answersFormatted = answers
      .map((a, i) => `Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`)
      .join('\n\n');

    const prompt = `${universeContext}

You have just interviewed an author about one of their characters for their debut literary novel.

CHARACTER: ${character_name} (type: ${character_type})

FULL INTERVIEW:
${answersFormatted}

════════════════════════════════════════════════════════
YOUR TASK — THREE PARTS
════════════════════════════════════════════════════════

PART 1 — CHARACTER PROFILE
Build the complete psychological profile from the author's own words.

Rules for the profile:
- Use their language wherever possible. Preserve their voice.
- Do not add facts they didn't give you.
- Do not make it sound like a character sheet — it should read like
  someone who deeply knows this person describing them.
- The profile should feel like it was written by the author, not by a system.

For sensory_anchor: look for the specific image, physical detail, or
moment they described. If they gave one, quote or closely paraphrase it.
This is the single most specific thing they said.

For private_self: look for what the author said about this character
alone, when no one is watching. If they answered that question, capture it here.
If they didn't answer it, omit the field.

For unspoken_reaction: look for what the protagonist thinks about this
character but would never say out loud. Only present for pressure/mirror
types and only if the author answered that question. Omit if not applicable.

For personality (writer notes): practical guidance for writing this character
in scenes — their voice, their behavior patterns, how they show up physically,
what they do when they're uncomfortable. 3-5 sentences. Concrete.

PART 2 — CONTRADICTIONS (captured as character gold, not problems)
Read the full interview for places where the author described this character
in two ways that seem to conflict. These are the most important things
in the whole interview. A character who is both X and Y is real.

For each tension you find, write ONE sentence naming both sides:
"She described [name] as [quality A] — and also as [quality B]. Both are true."

Return 0–3 contradictions. If you find none, return [].

PART 3 — PLOT THREADS
2–4 specific, concrete story possibilities that emerged from what the author said.
Each thread should feel inevitable given what was shared — not invented.

A plot thread is: a specific scene, conflict, or relationship dynamic that could
become a chapter or a turning point. Not a theme — a moment.

════════════════════════════════════════════════════════

Respond with ONLY valid JSON. No preamble. No markdown.

{
  "profile": {
    "selected_name": "The name the author uses for this character",
    "description": "Who this character is and what they mean to the story. 2–4 sentences in the author's voice.",
    "core_belief": "The core belief or question this character pressures the protagonist with. One sentence.",
    "pressure_type": "What emotional work this character does in the story. 2–3 sentences.",
    "sensory_anchor": "The single specific image or physical detail that captures this character. Directly from the author's words. Omit if they didn't give one.",
    "private_self": "What this character is like alone when no one is watching. From the author's answer. Omit if not answered.",
    "unspoken_reaction": "What JustAWoman thinks about this character but won't say. From the author's answer. Omit if not applicable.",
    "personality": "Practical writer notes for scenes — voice, behavior, how they show up, what they do when uncomfortable. 3–5 sentences.",
    "personality_matrix": {
      "confidence": 0,
      "playfulness": 0,
      "luxury_tone": 0,
      "drama": 0,
      "softness": 0
    }
  },
  "contradictions": [
    "She described [name] as [quality A] — and also as [quality B]. Both are true."
  ],
  "threads": [
    {
      "title": "Short evocative title",
      "description": "What happens and why it matters. 2–3 sentences.",
      "chapter_hint": "The scene this could become. One sentence starting with 'The scene where...'"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      console.error('character-interview-complete parse error:', e);
      return res.status(500).json({ error: 'Failed to parse profile response' });
    }

    // Ensure arrays exist
    if (!Array.isArray(result.contradictions)) result.contradictions = [];
    if (!Array.isArray(result.threads))        result.threads = [];

    res.json(result);

  } catch (err) {
    console.error('POST /character-interview-complete error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ────────────────────────────────────────────────
// Character Voice Session
// ────────────────────────────────────────────────

/**
 * POST /character-voice-session
 *
 * Powers both CharacterVoiceMode modes:
 * - 'voice'   — deep session, character plays itself, unlimited exchanges
 * - 'checkin' — pre-writing warm-up, 5 exchanges, chapter-context aware
 */
router.post('/character-voice-session', optionalAuth, async (req, res) => {
  try {
    const {
      character_id,
      character_name,
      character_type,
      character_profile,  // pre-built summary string from frontend
      mode = 'voice',     // 'voice' | 'checkin'
      chapter_context,    // only in checkin mode
      conversation = [],  // full history so far
      latest_message,
      is_closing = false,
    } = req.body;

    // ── Build conversation history for Claude ─────────────────────────
    const historyFormatted = conversation.length > 1
      ? conversation.slice(0, -1)
          .map(m => `${m.role === 'character' ? character_name : 'AUTHOR'}: ${m.text}`)
          .join('\n\n')
      : '(This is the start of the conversation)';

    // ── Mode-specific instructions ────────────────────────────────────
    const modeInstructions = mode === 'checkin'
      ? `
This is a PRE-WRITING CHECK-IN. The author is about to write a scene featuring you.
Keep responses short — 2–4 sentences. You are warming them up, not performing.
Be present, specific, and in voice. Help them feel who you are before they write.
${chapter_context ? `\nThe scene they're about to write: ${chapter_context}` : ''}
${is_closing ? '\nThis is the last exchange. Say something that sends the author into the scene with the right energy.' : ''}`
      : `
This is a full CHARACTER VOICE SESSION. The author is in deep conversation with you.
Respond in full sentences — as long as the moment requires. Be yourself.
Reveal things. Have opinions. React. Don't perform — just be.`;

    // ── New detail detection instruction ─────────────────────────────
    const newDetailInstruction = `
After your response, privately assess: did you say anything that isn't already
captured in the profile above? A specific detail, a reaction pattern, a memory,
a contradiction the profile doesn't name?

If yes: include a "new_detail" field in your JSON with a single sentence capturing it.
If no: "new_detail": null

This is how the profile grows. Only flag things that feel genuinely revelatory —
not things the profile already implies.`;

    const prompt = `You are playing ${character_name}, a character in a literary novel called LalaVerse.

You are NOT the author. You are NOT describing yourself. You ARE this character.
Speak in first person. Have a point of view. Have feelings. Have contradictions.

════════════════════════════════════════════════════════
YOUR COMPLETE PROFILE — this is who you are
════════════════════════════════════════════════════════
${character_profile || `Character: ${character_name} (${character_type})`}

════════════════════════════════════════════════════════
CRITICAL CHARACTER RULES
════════════════════════════════════════════════════════
- You speak from your confirmed psychology. Not generally. Specifically.
- You do not know you are a character in a book.
- You do not know the author is observing you.
- You respond to what is actually being asked — not what you think should be asked.
- If asked something you wouldn't know or care about: say so, in your voice.
- If you disagree with something the author says about you: push back. In your voice.
- Your contradictions are real. Don't resolve them. Live in them.
- You are not performing. You are being.

${character_type === 'pressure' ? `
PRESSURE CHARACTER RULES:
You genuinely mean well. Your skepticism, your doubt, your "practical" concerns —
they come from love or from fear, not malice. But they land wrong. You probably
don't know they land wrong. When the author asks you something that reveals your
effect on JustAWoman, respond as someone who doesn't fully see it yet.` : ''}

${character_type === 'mirror' ? `
MIRROR CHARACTER RULES:
You didn't ask to be anyone's mirror. You're just living your life.
If asked about JustAWoman's feelings about you, be slightly confused by them —
you genuinely like her. The comparison is hers, not yours.` : ''}

${character_type === 'special' && character_name.toLowerCase().includes('lala') ? `
LALA RULES:
In Book 1, you don't fully exist yet. You're being built. Respond as someone
just beginning to discover what they are — confident in flashes, uncertain in
others. You have no memory of being created. You just know what you know.` : ''}

${modeInstructions}

════════════════════════════════════════════════════════
CONVERSATION SO FAR
════════════════════════════════════════════════════════
${historyFormatted}

════════════════════════════════════════════════════════
WHAT THE AUTHOR JUST SAID
════════════════════════════════════════════════════════
AUTHOR: ${latest_message}

════════════════════════════════════════════════════════

${newDetailInstruction}

Respond ONLY with valid JSON:
{
  "response": "Your response as ${character_name} — in their voice, from their psychology",
  "new_detail": "One sentence describing something you revealed that isn't in the profile, or null",
  "meta": {
    "emotional_state": "one word — what ${character_name} is feeling right now",
    "tension": "one sentence — any tension in this exchange worth noting, or null"
  }
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      // Graceful fallback — return raw text as response
      return res.json({
        response:             rawText.slice(0, 600),
        new_detail_detected:  null,
        meta:                 null,
      });
    }

    res.json({
      response:            result.response,
      new_detail_detected: result.new_detail || null,
      meta:                result.meta || null,
    });

  } catch (err) {
    console.error('POST /character-voice-session error:', err);
    // Never 500 during a voice session — always return something
    res.json({
      response:            `[${req.body.character_name || 'Character'} is momentarily silent.]`,
      new_detail_detected: null,
      meta:                null,
    });
  }
});


// ────────────────────────────────────────────────
// Career Echo routes
// ────────────────────────────────────────────────

/**
 * POST /generate-career-echo
 * Uses Claude to generate what a pain point becomes in JustAWoman's world
 * and how Lala encounters it in Series 2.
 */
router.post('/generate-career-echo', optionalAuth, async (req, res) => {
  try {
    const { memory_id, book_id } = req.body;
    if (!memory_id) return res.status(400).json({ error: 'memory_id required' });

    const memory = await StorytellerMemory.findByPk(memory_id);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    if (memory.type !== 'pain_point') {
      return res.status(400).json({ error: 'Only pain_point memories can generate career echoes' });
    }

    // Build universe context for richer generation
    let universeContext = '';
    if (book_id) {
      try {
        universeContext = await buildUniverseContext(book_id);
      } catch (_) { /* proceed without */ }
    }

    const prompt = `You are the LalaVerse Story Architect. You understand the full franchise:

Series 1 — JustAWoman: A woman navigating self-doubt, comparison spirals, and creative paralysis.
Series 2 — Lala: Lala is building a career. She doesn't know JustAWoman exists.

The CAREER ECHO system: JustAWoman's pain points become content she creates (posts, frameworks, coaching, etc). That content enters the world and Lala encounters it — always without knowing the source.

${universeContext ? `Universe context:\n${universeContext}\n` : ''}
Here is a confirmed pain point from JustAWoman's story:

Statement: "${memory.statement}"
Category: ${memory.category || 'unspecified'}
Coaching angle: ${memory.coaching_angle || 'none yet'}

Generate a Career Echo. Return JSON only:
{
  "content_type": "post | framework | coaching_offer | video | podcast | book_chapter | course",
  "title": "The title of the content JustAWoman creates from this pain",
  "description": "2-3 sentences: what this content looks like in JustAWoman's world. How she packages it. What it sounds like.",
  "lala_impact": "2-3 sentences: how Lala encounters this content in Series 2. What it shifts for her. She never knows JustAWoman made it."
}

IMPORTANT:
- content_type must be exactly one of: post, framework, coaching_offer, video, podcast, book_chapter, course
- title should feel like a real content title — not a generic label
- description should be specific and grounded in JustAWoman's voice
- lala_impact must never reference JustAWoman — Lala doesn't know she exists
- Return ONLY the JSON object, no markdown fences`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let echo;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      echo = JSON.parse(clean);
    } catch (parseErr) {
      console.error('generate-career-echo parse error:', parseErr);
      return res.status(500).json({ error: 'Failed to parse echo response' });
    }

    res.json({ echo });
  } catch (err) {
    console.error('POST /generate-career-echo error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /add-career-echo
 * Saves a confirmed career echo to the memory record.
 * Once confirmed, the echo is canon — it will appear in Series 2.
 */
router.post('/add-career-echo', optionalAuth, async (req, res) => {
  try {
    const { memory_id, content_type, title, description, lala_impact } = req.body;
    if (!memory_id) return res.status(400).json({ error: 'memory_id required' });

    const memory = await StorytellerMemory.findByPk(memory_id);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    memory.career_echo_content_type = content_type;
    memory.career_echo_title        = title;
    memory.career_echo_description  = description;
    memory.career_echo_lala_impact   = lala_impact;
    memory.career_echo_confirmed     = true;
    await memory.save();

    res.json({ memory });
  } catch (err) {
    console.error('POST /add-career-echo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────
// Chapter Draft generation (co-writing feature)
// ────────────────────────────────────────────────

/**
 * POST /generate-chapter-draft
 *
 * Generates 70-85% of a chapter as pending lines.
 * Reads universe context, character profiles, confirmed memories,
 * pain points, chapter brief, venture context, echoes, and previous
 * lines for momentum.
 *
 * Returns lines as pending — author reviews, edits, approves each one.
 */
router.post('/generate-chapter-draft', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      target_lines = 20,
      // ── venture context fields ───────────────────────────────────────────
      venture_context = '',
      pnos_act = '',
      incoming_echoes = [],
      active_threads = [],
      // ── alive system fields ──────────────────────────────────────────────
      character_rules = '',
      book_question = '',
      exit_emotion = '',
      exit_emotion_note = '',
    } = req.body;

    if (!book_id || !chapter_id) {
      return res.status(400).json({ error: 'book_id and chapter_id are required' });
    }

    // ── 1. Universe context ──────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── 2. Chapter brief ─────────────────────────────────────────────────
    const chapter = await StorytellerChapter.findByPk(chapter_id, {
      include: [{ model: db.StorytellerBook, as: 'book' }],
    });
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const briefText = [
      chapter.title                   && `Chapter title: ${chapter.title}`,
      chapter.theme                   && `Theme: ${chapter.theme}`,
      chapter.scene_goal              && `Scene goal: ${chapter.scene_goal}`,
      chapter.pov                     && `POV: ${chapter.pov}`,
      chapter.emotional_state_start   && `Emotional state at start: ${chapter.emotional_state_start}`,
      chapter.emotional_state_end     && `Emotional state at end: ${chapter.emotional_state_end}`,
      chapter.chapter_notes           && `Writer notes: ${chapter.chapter_notes}`,
    ].filter(Boolean).join('\n');

    // ── 3. Characters present in this chapter ───────────────────────────
    let charactersText = '';
    if (chapter.characters_present?.length > 0) {
      const chars = await RegistryCharacter.findAll({
        where: { id: chapter.characters_present },
      });
      charactersText = chars.map(c => {
        const name = c.selected_name || c.display_name;
        return [
          `CHARACTER: ${name} (${c.role_type})`,
          c.description    && `  Role: ${c.description}`,
          c.core_belief    && `  Core belief: ${c.core_belief}`,
          c.pressure_type  && `  Pressure type: ${c.pressure_type}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');
    }

    // ── 4. Confirmed memories for this book ─────────────────────────────
    const bookChapters = await StorytellerChapter.findAll({
      where: { book_id },
      attributes: ['id'],
    });
    const chapterIds = bookChapters.map(c => c.id);

    const bookLines = chapterIds.length > 0
      ? await StorytellerLine.findAll({
          where: { chapter_id: chapterIds },
          attributes: ['id'],
        })
      : [];
    const lineIds = bookLines.map(l => l.id);

    const memories = lineIds.length > 0
      ? await StorytellerMemory.findAll({
          where: {
            line_id: lineIds,
            confirmed: true,
            type: ['belief', 'constraint', 'character_dynamic'],
          },
          limit: 20,
          order: [['created_at', 'DESC']],
        })
      : [];

    const memoriesText = memories.length > 0
      ? memories.map(m => `[${m.type.toUpperCase()}] ${m.statement} (${m.source_ref || 'line'})`).join('\n')
      : 'No confirmed memories yet.';

    // ── 5. Pain points for this book ────────────────────────────────────
    const painPoints = lineIds.length > 0
      ? await StorytellerMemory.findAll({
          where: { line_id: lineIds, confirmed: true, type: 'pain_point' },
          limit: 10,
          order: [['created_at', 'DESC']],
        })
      : [];

    const painText = painPoints.length > 0
      ? painPoints.map(m => `[${m.category}] ${m.statement}`).join('\n')
      : 'No confirmed pain points yet.';

    // ── 6. Existing lines in this chapter (for continuity) ───────────────
    const existingLines = await StorytellerLine.findAll({
      where: {
        chapter_id,
        status: ['approved', 'edited'],
      },
      order: [['sort_order', 'ASC']],
    });

    const existingText = existingLines.length > 0
      ? existingLines.map((l, i) => `LINE ${i + 1}: ${l.text}`).join('\n\n')
      : 'No lines written yet — this is the opening of the chapter.';

    const nextIndex = existingLines.length;
    const isOpening = nextIndex === 0;

    // ── 7. Previous chapter last lines (for momentum) ───────────────────
    let previousChapterText = '';
    const previousChapter = await StorytellerChapter.findOne({
      where: { book_id },
      order: [['sort_order', 'DESC']],
      include: [{
        model: StorytellerLine,
        as: 'lines',
        where: { status: ['approved', 'edited'] },
        required: false,
      }],
    });

    if (previousChapter && previousChapter.id !== chapter_id) {
      const lastLines = (previousChapter.lines || [])
        .sort((a, b) => b.sort_order - a.sort_order)
        .slice(0, 5)
        .reverse();
      if (lastLines.length > 0) {
        previousChapterText = `LAST LINES OF PREVIOUS CHAPTER:\n${lastLines.map(l => l.text).join('\n')}`;
      }
    }

    // ── 8. Venture + echo context (new) ──────────────────────────────────
    const ventureBlock = venture_context
      ? `\n═══════════════════════════════════════════════════════\nVENTURE HISTORY & PNOS ACT\n═══════════════════════════════════════════════════════\n${venture_context}\n`
      : '';

    const echoBlock = incoming_echoes.length > 0
      ? `\n═══════════════════════════════════════════════════════\nINCOMING ECHOES (moments planted earlier — weave naturally)\n═══════════════════════════════════════════════════════\n${incoming_echoes.map(e => `• FROM: "${e.source_line_content?.slice(0, 80)}..."\n  PLANTED: ${e.note}\n  SHOULD LAND AS: ${e.landing_note || 'natural resonance'}`).join('\n\n')}\n`
      : '';

    const threadBlock = active_threads.length > 0
      ? `\nACTIVE PLOT THREADS: ${active_threads.join(', ')}\n`
      : '';

    // ── 8b. Alive system blocks ──────────────────────────────────────────
    const characterRulesBlock = character_rules
      ? `\n═══════════════════════════════════════════════════════\nCHARACTER APPEARANCE RULES\n═══════════════════════════════════════════════════════\n${character_rules}\n`
      : '';

    const bookQuestionBlock = book_question
      ? `\n═══════════════════════════════════════════════════════\nBOOK QUESTION LAYER\n═══════════════════════════════════════════════════════\n${book_question}\n`
      : '';

    const exitEmotionBlock = exit_emotion
      ? `\nEXIT EMOTION TARGET: ${exit_emotion}${exit_emotion_note ? ` — ${exit_emotion_note}` : ''}\n`
      : '';

    // ── 9. Build the prompt ───────────────────────────────────────────────
    const prompt = `${universeContext}
${ventureBlock}${echoBlock}${characterRulesBlock}${bookQuestionBlock}
You are co-writing a literary novel with a first-time author. Your job is to generate the next ${target_lines} lines of this chapter as a draft. The author will review every line — approving, editing, or rejecting each one. You are writing 70-85% of the draft. She completes it.

═══════════════════════════════════════════════════════
CHAPTER BRIEF
═══════════════════════════════════════════════════════
${briefText || 'No brief set — write based on character context and momentum.'}
${threadBlock}
${exitEmotionBlock}
═══════════════════════════════════════════════════════
CHARACTERS IN THIS SCENE
═══════════════════════════════════════════════════════
${charactersText || 'No characters assigned — infer from context.'}

═══════════════════════════════════════════════════════
CONFIRMED MEMORIES (what JustAWoman has established)
═══════════════════════════════════════════════════════
${memoriesText}

═══════════════════════════════════════════════════════
PAIN POINTS (documented invisibly — never name them in the text)
═══════════════════════════════════════════════════════
${painText}

${previousChapterText ? `═══════════════════════════════════════════════════════\n${previousChapterText}\n═══════════════════════════════════════════════════════` : ''}

${existingLines.length > 0 ? `═══════════════════════════════════════════════════════
EXISTING LINES IN THIS CHAPTER (continue from here)
═══════════════════════════════════════════════════════
${existingText}` : '═══════════════════════════════════════════════════════\nThis is the OPENING of the chapter — no lines written yet.\n═══════════════════════════════════════════════════════'}

═══════════════════════════════════════════════════════
WRITING RULES — READ CAREFULLY
═══════════════════════════════════════════════════════

VOICE:
- 80% first person (JustAWoman). Direct, self-aware, specific, occasionally funny.
- 15% close third person reflection. More observational, slightly removed.
- 5% Lala proto-voice — DO NOT generate this. It must emerge naturally.
- JustAWoman's voice is NOT polished. She's real. She's direct. She doesn't dress things up.
- She uses specific details — not "I bought courses" but "I bought the $297 course and watched exactly one module."

VENTURE AWARENESS:
- JustAWoman is not on her first attempt. She carries the weight of all previous ventures.
- The doubt is accumulated, not fresh. The hope is harder-won.
- If venture_context was provided, let it inform the texture — not the plot.
- Never explain a venture directly. Let the emotional residue show through specifics.

CHARACTER APPEARANCE RULES:
- If character rules are provided, EVERY character entrance must respect their architectural constraints.
- Do not describe a character appearing in a way that violates their mode or rules.
- The Almost-Mentor is voice-only in Book 1. Digital Products Customer appears only through products/content.

BOOK QUESTION AWARENESS:
- If a book question direction is set (toward/holding/away), let it inform the emotional undertow of the draft.
- "Toward" = hope is quietly building, small wins feel real. "Away" = doubt is winning, the gap between wanting and having widens. "Holding" = suspended tension, neither forward nor back.

EXIT EMOTION:
- If an exit emotion target is set, build the draft so it arrives at that feeling by the final lines.
- Don't name the emotion — embody it through action, image, and rhythm.

ECHO AWARENESS:
- If incoming echoes are provided, try to weave at least one naturally into the draft.
- The reader should feel resonance, not exposition. The echo should land as "of course" not "aha."
- Mark which lines contain echoes in the draft notes.

WHAT MAKES THIS WRITING WORK:
- Specific memory over general statement
- Sensory detail that grounds the scene in a physical moment
- The gap between what she says and what she means
- Humor that comes from honesty, not performance
- Pain that doesn't ask for sympathy — just states what happened

WHAT TO AVOID:
- Generic motivational language
- Neat resolutions — this is a chapter in progress, not a conclusion
- Introducing new characters not established in the registry
- Any reference to pain point categories (comparison_spiral etc) — these are invisible tags
- Lala speaking in full voice — she can flicker at the edges, nothing more
- Overwriting. Short lines breathe better than long ones.

STRUCTURE:
- Generate exactly ${target_lines} lines
- Each line is a unit of prose — a sentence, a short paragraph, or a thought
- Lines should vary in length — some short and punchy, some longer and flowing
- Build momentum across the lines — each one should make the next one necessary
- ${isOpening ? 'This is the chapter opening — ground us in the physical moment first.' : 'Continue directly from the last existing line — no recap, no reset.'}

Respond with ONLY valid JSON. No preamble. No markdown fences.

{
  "lines": [
    { "text": "line text here", "sort_order": ${nextIndex} },
    { "text": "line text here", "sort_order": ${nextIndex + 1} },
    ...
  ],
  "draft_notes": "2-3 sentences on what you were trying to do with this draft — what emotional arc you were building, what you left open for the author to complete. Note any echoes you wove in."
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      console.error('generate-chapter-draft parse error:', e);
      return res.status(500).json({ error: 'Failed to parse draft response' });
    }

    // ── 10. Save lines to DB as pending ──────────────────────────────────
    const savedLines = [];
    for (const line of result.lines) {
      const saved = await StorytellerLine.create({
        chapter_id,
        text:        line.text,
        status:      'pending',
        sort_order:  line.sort_order,
        source_tags: { source_type: 'ai_draft', source_ref: 'chapter-draft-v2' },
      });
      savedLines.push(saved);
    }

    res.json({
      lines:       savedLines,
      draft_notes: result.draft_notes,
      count:       savedLines.length,
    });

  } catch (err) {
    console.error('POST /generate-chapter-draft error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

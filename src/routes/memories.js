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

let registrySync;
try {
  registrySync = require('../services/registrySync');
} catch { registrySync = null; }

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

    // ── Registry Sync: memory confirmed trigger ──
    if (registrySync) {
      registrySync.onMemoryConfirmed(memory, db).catch(e =>
        console.error('RegistrySync (memory-confirm):', e.message)
      );

      // Pain point sub-trigger
      if (memory.type === 'pain_point' && memory.character_id) {
        registrySync.onPainPointTagged({
          character_id: memory.character_id,
          category:     memory.tags?.[0] || memory.category || 'untagged',
          statement:    memory.statement,
          confidence:   memory.confidence,
        }, db).catch(e =>
          console.error('RegistrySync (pain-point):', e.message)
        );
      }
    }

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

    // ── Call Claude (with model fallback + retry for overloaded errors) ──
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`scene-interview: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break; // success
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`scene-interview: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          // If this model is overloaded or not found, try next model
          if (status === 529 || status === 503 || status === 404) {
            console.log(`scene-interview: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.status(503).json({
        error: 'The AI service is temporarily overloaded. Please wait a minute and try again.',
        retryable: true,
      });
    }

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

    // ── Wardrobe context for this chapter ──────────────────────────────
    let wardrobeContext = '';
    try {
      if (chapter_id) {
        const { WardrobeContentAssignment, WardrobeLibrary, StorytellerLine } = db.models || db;
        if (WardrobeContentAssignment) {
          const chapterPieces = await WardrobeContentAssignment.findAll({
            where: { content_type: 'chapter', content_id: chapter_id, removed_at: null },
          });
          const lines = await StorytellerLine.findAll({
            where: { chapter_id }, attributes: ['id'],
          });
          const linePieces = lines.length ? await WardrobeContentAssignment.findAll({
            where: { content_type: 'scene_line', content_id: lines.map(l => l.id), removed_at: null },
          }) : [];

          const allPieces = [...chapterPieces, ...linePieces];
          if (allPieces.length > 0) {
            const enriched = await Promise.all(allPieces.map(async a => {
              const item = await WardrobeLibrary.findByPk(a.library_item_id);
              return item ? `${item.name}${item.brand ? ` by ${item.brand}` : ''}${a.scene_context ? `: "${a.scene_context}"` : ''}` : null;
            }));
            const filtered = enriched.filter(Boolean);
            if (filtered.length > 0) {
              wardrobeContext = `\n\nWARDROBE IN THIS CHAPTER:\n${filtered.join('\n')}\nReference these pieces naturally when relevant. A piece named here is already established — treat it as a continuity anchor.`;
            }
          }
        }
      }
    } catch (e) { /* never interrupt writing */ }

    const prompt = `${universeContext}
${ventureBlock}${echoBlock}${characterRulesBlock}${bookQuestionBlock}${wardrobeContext}
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
 * GET /character-interview-progress/:character_id
 * Load saved interview progress (stored in extra_fields.interview_progress)
 */
router.get('/character-interview-progress/:character_id', optionalAuth, async (req, res) => {
  try {
    const character = await RegistryCharacter.findByPk(req.params.character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const progress = character.extra_fields?.interview_progress || null;
    res.json({ progress });
  } catch (err) {
    console.error('GET /character-interview-progress error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-save-progress
 * Auto-save interview state after every answer so users can resume later.
 * Stores in extra_fields.interview_progress on the RegistryCharacter.
 */
router.post('/character-interview-save-progress', optionalAuth, async (req, res) => {
  try {
    const {
      character_id,
      messages,
      answers,
      question_index,
      next_question,
      sensory_asked,
      private_life_asked,
      unspoken_asked,
      one_more_asked,
      last_contradiction_check,
      drift_history,
      relational_notes,
      current_drift,
      step,
    } = req.body;

    if (!character_id) return res.status(400).json({ error: 'character_id required' });

    const character = await RegistryCharacter.findByPk(character_id);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const existingExtra = character.extra_fields || {};
    character.extra_fields = {
      ...existingExtra,
      interview_progress: {
        messages,
        answers,
        question_index,
        next_question,
        sensory_asked,
        private_life_asked,
        unspoken_asked,
        one_more_asked,
        last_contradiction_check,
        drift_history,
        relational_notes,
        current_drift,
        step,
        saved_at: new Date().toISOString(),
      },
    };
    // Sequelize needs JSONB change flagged explicitly
    character.changed('extra_fields', true);
    await character.save();

    res.json({ success: true });
  } catch (err) {
    console.error('POST /character-interview-save-progress error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * POST /character-interview-next
 * Called after each answer during the character interview.
 *
 * ════════════════════════════════════════════════════════════════════════
 * DRIFT DETECTION — when the author shifts characters mid-session
 * ════════════════════════════════════════════════════════════════════════
 *
 * 1. FOLLOWS IT — leans into the drift instead of redirecting back
 * 2. TAGS IT — saves the drift content as relational perception data
 * 3. BRIDGES IT — after following the drift, asks the bridge question
 *
 * Also preserves:
 * ─ First-answer deep read
 * ─ Hesitation catch mode
 * ─ Contradiction detection mode
 * ─ New character detection
 * ─ Plot thread detection
 */
router.post('/character-interview-next', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      character_name,
      character_type,
      answers_so_far            = [],
      next_base_question,
      existing_characters       = [],
      force_hesitation_catch    = false,
      force_contradiction_check = false,
      // ── Drift detection fields ──
      primary_character,            // who the session is about (fallback to character_name)
      known_characters    = [],     // [{ id, name, archetype, role }]
      drift_history       = [],     // previous drift events this session
      relational_notes    = [],     // accumulated cross-character observations
    } = req.body;

    const primaryName = primary_character || character_name;

    if (!answers_so_far.length || !answers_so_far[answers_so_far.length - 1]?.answer?.trim()) {
      return res.json({
        question: 'Take your time — what were you saying?',
        drift_detected: false,
        drifted_to: null,
        drift_type: null,
        bridge_question_ready: false,
        relational_note: null,
        thread_hint: null,
        contradiction_detected: null,
        new_characters: [],
        session_notes: [],
      });
    }

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
    const latestText      = latestAnswer?.answer || '';

    const historyFormatted = previousAnswers.length > 0
      ? previousAnswers.map((a, i) => `Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`).join('\n\n')
      : '(This is the first answer — no prior history)';

    const latestFormatted = latestAnswer
      ? `Q: ${latestAnswer.question}\nA: ${latestAnswer.answer}`
      : '(No answer provided)';

    const existingList = existing_characters.length
      ? `\nALREADY KNOWN CHARACTERS (do NOT flag as new):\n${existing_characters.join(', ')}\n`
      : '';

    // ── STEP 1: DRIFT DETECTION ─────────────────────────────────────
    const knownNames = known_characters
      .map(c => ({ ...c, searchTerms: [
        c.name,
        c.selected_name || '',
        ...(c.name?.toLowerCase().includes('husband') ? ['husband', 'him', 'he'] : []),
        ...(c.name?.toLowerCase().includes('comparison') ? ['chloe', 'comparison creator', 'her content'] : []),
        ...(c.name?.toLowerCase().includes('lala') ? ['lala'] : []),
        ...(c.name?.toLowerCase().includes('witness') ? ['witness'] : []),
        ...(c.name?.toLowerCase().includes('mentor') ? ['mentor', 'almost-mentor', 'almost mentor'] : []),
      ].filter(Boolean)}))
      .filter(c => c.name?.toLowerCase() !== primaryName?.toLowerCase());

    const answerLower = latestText.toLowerCase();

    const mentionedChars = knownNames.filter(c =>
      c.searchTerms.some(term => term && answerLower.includes(term.toLowerCase()))
    );

    let driftDetected = false;
    let driftedTo = null;
    let driftType = null;

    if (mentionedChars.length > 0) {
      const wordCount = latestText.split(/\s+/).length;
      const primaryLower = primaryName?.toLowerCase();
      const primaryMentions = (answerLower.match(new RegExp(primaryLower, 'g')) || []).length;
      const otherMentions = mentionedChars[0].searchTerms.reduce((count, term) =>
        count + (answerLower.match(new RegExp(term.toLowerCase(), 'g')) || []).length, 0
      );

      driftedTo = mentionedChars[0].name;
      driftDetected = true;

      if (wordCount > 40 && otherMentions >= primaryMentions) {
        driftType = 'full_shift';
      } else if (answerLower.includes('like') || answerLower.includes('unlike') ||
                 answerLower.includes('different') || answerLower.includes('compare')) {
        driftType = 'comparison';
      } else {
        driftType = 'mention';
      }
    }

    const alreadyBridged = drift_history.some(
      d => d.drifted_to === driftedTo && d.bridged === true
    );

    const lastDrift = drift_history[drift_history.length - 1];
    const bridgeQuestionReady = driftType !== 'full_shift' &&
      lastDrift?.drifted_to === driftedTo &&
      lastDrift?.type === 'full_shift' &&
      !alreadyBridged;

    // ── STEP 2: BUILD RELATIONAL NOTE ───────────────────────────────
    let relationalNote = null;
    if (driftDetected && driftType !== 'mention') {
      relationalNote = {
        primary_character: primaryName,
        drifted_to: driftedTo,
        type: driftType,
        raw_content: latestText,
        observation: null, // Claude will fill this
      };
    }

    // ── STEP 3: BUILD PROMPT ─────────────────────────────────────────

    // Drift context blocks
    const driftContext = driftDetected ? `
DRIFT DETECTED: The author drifted from ${primaryName} to ${driftedTo} (type: ${driftType}).
${driftType === 'full_shift' ? `They shifted significantly to talking about ${driftedTo}. FOLLOW this drift — do NOT redirect. Ask one question that explores ${primaryName}'s relationship to ${driftedTo} or how ${primaryName} sees/feels about ${driftedTo}. The author's mind went there for a reason.` : ''}
${driftType === 'comparison' ? `They compared ${primaryName} to ${driftedTo}. Lean into the comparison — what does it reveal about ${primaryName}?` : ''}
${driftType === 'mention' ? `They mentioned ${driftedTo} in passing. Acknowledge it lightly, stay with ${primaryName}.` : ''}
` : '';

    const bridgeContext = bridgeQuestionReady ? `
BRIDGE MOMENT: The author followed ${driftedTo} in the previous exchange. Now it's time to bridge back.
Ask the bridge question: "You were talking about ${primaryName} and kept coming back to ${driftedTo}. What does that drift tell you about ${primaryName} — not about ${driftedTo}?"
This is the question the author didn't know they had.
` : '';

    const relationalContext = relational_notes.length > 0
      ? `Cross-character observations collected so far:\n${relational_notes.slice(-3).map(n => `• ${n.primary_character} on ${n.drifted_to}: "${n.raw_content?.slice(0, 80)}..."`).join('\n')}`
      : '';

    // ── Choose prompt mode based on flags ─────────────────────────────
    let taskInstructions;

    if (force_hesitation_catch) {
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
One question only. Warm, curious, direct.`;

    } else if (force_contradiction_check) {
      taskInstructions = `
SCAN THE FULL CONVERSATION FOR TENSIONS AND CONTRADICTIONS.

Read every answer so far (including the latest). Look for places where:
- The author described the character one way early on, and a different way later
- The character seems to have two contradictory qualities that both feel true
- The author said something the character values, and something else that conflicts

YOUR TASK:
If you find a tension: ask ONE question that names it directly and invites the author
to sit with both truths. Something like:
"Earlier you said [X] — but just now it sounds like [Y]. What if both are true?"

If you find NO real tension: fall back to a genuine follow-up on the latest answer.

Return the tension in the "contradiction_detected" field.`;

    } else if (bridgeQuestionReady) {
      taskInstructions = `
BRIDGE MOMENT — this is the most important question of the session.
Ask: "You were talking about ${primaryName} and kept coming back to ${driftedTo}. What does that drift tell you about ${primaryName} — not about ${driftedTo}?"
Do NOT ask anything else. This IS the question.`;

    } else if (driftDetected && driftType === 'full_shift') {
      taskInstructions = `
DRIFT FOLLOW — the author shifted from ${primaryName} to ${driftedTo}.
Do NOT say "let's get back to ${primaryName}." Do NOT ignore the drift.
Ask one question that explores the relationship between ${primaryName} and ${driftedTo}.
Specifically: how does ${primaryName} experience, perceive, or feel about ${driftedTo}?
Frame it that way: "What does ${primaryName} feel watching ${driftedTo}..."
The observation from this drift belongs to ${primaryName}'s profile, not ${driftedTo}'s.
One question only. Follow the drift.`;

    } else if (driftDetected && driftType === 'comparison') {
      taskInstructions = `
The author is comparing ${primaryName} to ${driftedTo}. Lean into the comparison.
Ask one question that reveals what this comparison tells us about ${primaryName}.
One question only. Warm, curious.`;

    } else {
      taskInstructions = `
YOUR TASK:
1. Read WHAT THE AUTHOR JUST SAID carefully.
2. Ask ONE follow-up question that responds DIRECTLY to something specific.
   - Did they mention a name? Ask about that person.
   - Did they describe a feeling? Ask what created it.
   - Did they give a detail that suggests a scene? Ask what that scene looks like.
3. ONLY fall back to the planned next question if they gave you nothing to follow.
4. Check for plot threads and new character names.

One question only. Warm, curious, specific. Never clinical.`;
    }

    const prompt = `You are interviewing an author about one of their characters for a memoir called "Before Lala."

CHARACTER: ${primaryName} (type: ${character_type})
BOOK: LalaVerse — literary, psychological, first-person narrative
${universeBlock}
${existingList}
${relationalContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION HISTORY:
${historyFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THE AUTHOR JUST SAID:
${latestFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${next_base_question ? `NEXT PLANNED QUESTION (use as fallback only): ${next_base_question}` : ''}

${driftContext}
${bridgeContext}
${taskInstructions}

Respond with ONLY valid JSON. No preamble. No markdown fences.

{
  "question": "Your single question here",
  "relational_observation": "One sentence capturing what this drift revealed about how ${primaryName} perceives ${driftedTo} — or null if not applicable",
  "session_note": "One new thing learned about ${primaryName} from this exchange — or null",
  "thread_hint": "One sentence describing a plot thread you detected, or null",
  "contradiction_detected": "One sentence naming the tension you found (for contradiction mode), or null",
  "new_characters": []
}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = {
        question: next_base_question || 'Tell me more about that.',
        relational_observation: null,
        session_note: null,
        thread_hint: null,
        contradiction_detected: null,
        new_characters: [],
      };
    }

    if (!Array.isArray(parsed.new_characters)) parsed.new_characters = [];

    // Attach Claude's relational observation to the note
    if (relationalNote && parsed.relational_observation) {
      relationalNote.observation = parsed.relational_observation;
    }

    res.json({
      question:              parsed.question,
      // Existing fields
      thread_hint:           parsed.thread_hint || null,
      contradiction_detected: parsed.contradiction_detected || null,
      new_characters:        parsed.new_characters,
      // Drift state
      drift_detected:        driftDetected,
      drifted_to:            driftedTo,
      drift_type:            driftType,
      bridge_question_ready: bridgeQuestionReady,
      // Relational note
      relational_note:       relationalNote,
      // Session note from Claude
      session_note:          parsed.session_note || null,
    });

  } catch (err) {
    console.error('POST /character-interview-next error:', err);
    res.json({
      question:               req.body.next_base_question || 'What else should I know about this character?',
      thread_hint:            null,
      contradiction_detected: null,
      new_characters:         [],
      drift_detected:         false,
      drifted_to:             null,
      drift_type:             null,
      bridge_question_ready:  false,
      relational_note:        null,
      session_note:           null,
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
      relational_notes = [],
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

${relational_notes.length > 0 ? `
CROSS-CHARACTER OBSERVATIONS (captured during interview):
${relational_notes.map((n, i) => `${i+1}. [${n.primary_character} ↔ ${n.other_character}] ${n.observation}`).join('\n')}

These observations reveal how characters relate to each other through the author's instinctive associations. Use them to enrich the profile — especially pressure_type and personality sections.
` : ''}
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


// ═══════════════════════════════════════════════════════════════════════════════
// Helper: build character voice context for WriteMode AI endpoints
// ═══════════════════════════════════════════════════════════════════════════════

async function getCharacterVoiceContext(characterId) {
  if (!characterId) return null;
  try {
    const char = await RegistryCharacter.findByPk(characterId);
    if (!char) return null;

    const vs = char.voice_signature || {};
    const name = char.display_name || char.selected_name || 'the character';

    let voiceBlock = `CHARACTER VOICE — ${name}`;
    if (char.character_archetype) voiceBlock += `\nArchetype: ${char.character_archetype}`;
    if (char.personality) voiceBlock += `\nPersonality: ${char.personality}`;
    if (char.emotional_baseline) voiceBlock += `\nEmotional baseline: ${char.emotional_baseline}`;
    if (char.signature_trait) voiceBlock += `\nSignature trait: ${char.signature_trait}`;
    if (vs.speech_pattern) voiceBlock += `\nSpeech pattern: ${vs.speech_pattern}`;
    if (vs.vocabulary_tone) voiceBlock += `\nVocabulary/tone: ${vs.vocabulary_tone}`;
    if (vs.internal_monologue_style) voiceBlock += `\nInternal monologue style: ${vs.internal_monologue_style}`;
    if (vs.emotional_reactivity) voiceBlock += `\nEmotional reactivity: ${vs.emotional_reactivity}`;
    if (vs.catchphrases?.length) voiceBlock += `\nCatchphrases: "${vs.catchphrases.join('", "')}"`;
    if (char.mask_persona) voiceBlock += `\nPublic persona (mask): ${char.mask_persona}`;
    if (char.truth_persona) voiceBlock += `\nPrivate truth: ${char.truth_persona}`;
    if (char.core_belief) voiceBlock += `\nCore belief: ${char.core_belief}`;
    if (char.core_wound) voiceBlock += `\nCore wound: ${char.core_wound}`;
    if (char.core_desire) voiceBlock += `\nCore desire: ${char.core_desire}`;
    if (char.core_fear) voiceBlock += `\nCore fear: ${char.core_fear}`;

    const charRules = `
CHARACTER RULES for ${name}:
- Write in ${name}'s authentic voice — their specific speech patterns, rhythms, and vocabulary.
- Honor their emotional baseline (${char.emotional_baseline || 'as established'}).
- Their interior monologue should reflect their personality and worldview.
- The mask/truth tension should inform what they say vs. what they think.
- First person. This character is telling their story.
- Do not give them clarity or growth they haven't earned yet.`;

    return { name, voiceBlock, charRules };
  } catch (err) {
    console.error('getCharacterVoiceContext error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /voice-to-story
// Spoken words → story prose in JustAWoman's voice
// ═══════════════════════════════════════════════════════════════════════════════

const WRITE_MODE_ACT_VOICE = {
  act_1: {
    belief: 'If I find the right niche, everything will click.',
    voice:  'Raw. Eager. Still hopeful. She tries things with full belief, then quietly stops. Sentences cycle and restart. Not yet aware of the pattern.',
    tense:  'Present or close-past — the wound is fresh.',
  },
  act_2: {
    belief: 'Maybe I\'m just not meant for this. Maybe I\'m delusional.',
    voice:  'Heavier. Slower. Interior monologue rising. Shorter sentences when doubt peaks. The comparison spiral is loudest here.',
    tense:  'Interior, reflective — she is watching herself fail.',
  },
  act_3: {
    belief: 'What if I stop trying to fit into niches and create my own world?',
    voice:  'Something lifts. Permission, not confidence yet. Sentences start reaching further. A new rhythm appears.',
    tense:  'Present — she is noticing something for the first time.',
  },
  act_4: {
    belief: 'I can sustain this. Even when it\'s fragile.',
    voice:  'Quieter confidence. Less proving, more building. Doubt present but not in charge. Prose gets cleaner.',
    tense:  'Active present — she is doing the thing.',
  },
  act_5: {
    belief: 'This is the first thing I\'ve built that feels like me.',
    voice:  'Owned. Narrator and subject feel like the same person. Earned.',
    tense:  'Reflective present — she has arrived somewhere.',
  },
};

const WRITE_MODE_CHARACTER_RULES = `
KEY RULES:
- JustAWoman is ACTIVE — posting, trying, showing up. Wound is invisibility, not fear.
- The Husband never speaks aloud — he exists only in her interior monologue.
- Chloe appears on screens only — never in person, never in the same physical space.
- Lala in Book 1: one intrusive thought maximum — brief, different altitude, not JustAWoman being confident.
- First person. Vary sentence rhythm. Short when doubt peaks, longer when something opens.
- Do not give her clarity she hasn't yet earned.`;

router.post('/voice-to-story', optionalAuth, async (req, res) => {
  try {
    const {
      spoken,
      existing_prose = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      book_character = 'JustAWoman',
      session_log    = [],
      character_id   = null,
      gen_length     = 'paragraph',
      stream         = false,
    } = req.body;

    if (!spoken?.trim()) {
      return res.json({ prose: null, hint: null });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);

    const recentProse = existing_prose
      ? existing_prose.split('\n\n').slice(-5).join('\n\n')
      : '';

    const sessionContext = session_log.length > 0
      ? `Recent spoken inputs this session:\n${session_log.slice(-3).map(l => `"${l.spoken.slice(0, 80)}"`).join('\n')}`
      : '';

    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';

    const lengthInstruction = gen_length === 'sentence'
      ? 'Write exactly 1–2 sentences. One vivid moment. One breath.'
      : 'Write 2–5 paragraphs. Rich but controlled.';

    const prompt = `You are writing a memoir in the voice of ${charName}.

The author just spoke this aloud — raw material, not polished prose:
"${spoken}"

YOUR JOB: Turn this into IMMERSIVE story. The reader should be INSIDE the scene — seeing it, smelling it, feeling it in their body.

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}

CURRENT ACT: ${act.voice}
CURRENT BELIEF: "${act.belief}"
PROSE TENSE/MODE: ${act.tense}

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${recentProse ? `WHAT WAS JUST WRITTEN (continue seamlessly from here — match the rhythm and flow):\n${recentProse}` : ''}

${sessionContext}

${charRules}

IMMERSION RULES:
- ${lengthInstruction}
- SENSORY DETAIL: Ground every moment. What does the room smell like? What does she hear? What is the light doing? What does the air feel like on skin? Don't list senses — weave them into the prose so the reader is THERE.
- EMOTION IN THE BODY: Don't say "she felt sad." Show it — the throat tightening, the hands going still, the breath she holds without meaning to. Emotions live in the body.
- DIALOGUE IS SPOKEN: When someone talks out loud, use dialogue. "Like this," she said. Internal thoughts stay in narration. The reader must always know what's spoken vs. thought.
- FLOW & CONTINUITY: Each passage must flow from the last like water. Read what came before and continue the emotional current — don't restart, don't summarize.
- SPECIFICITY: No generic details. Not "a store" — the name of the store. Not "music" — the song. Not "food" — what's on the plate. Use what the author gave you; if they didn't name it, choose something real and specific that fits.
- Stay close to what they said — the truth of it — but give it the shape of prose.
- If they trailed off or repeated themselves, that repetition IS the real thing — lean into it.
- Do not add events they didn't give you.
- End on something that pulls forward — not a conclusion.

Respond with ONLY the prose. No preamble. No explanation. No quotes around it.`;

    const maxTok = gen_length === 'sentence' ? 200 : 900;
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];

    // ── STREAMING PATH ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let streamed = false;
      for (const model of MODELS) {
        try {
          console.log(`voice-to-story stream: trying ${model}`);
          const streamResp = anthropic.messages.stream({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          let fullText = '';
          streamResp.on('text', (text) => {
            fullText += text;
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          });
          await streamResp.finalMessage();

          // Check for Lala hint
          let hint = null;
          const proseAndSpoken = (existing_prose + fullText).toLowerCase();
          const spiralCount = (proseAndSpoken.match(/can't|couldn't|wrong|what if|why|tired|keep/g) || []).length;
          const interiorCount = existing_prose.split('\n\n').length;
          if (spiralCount >= 4 && interiorCount >= 4) {
            hint = 'Something is building here — a different voice is close.';
          }
          res.write(`data: ${JSON.stringify({ type: 'done', hint })}\n\n`);
          res.end();
          streamed = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if (status === 529 || status === 503 || status === 404) {
            console.log(`voice-to-story stream: ${model} status ${status}, trying next`);
            continue;
          }
          throw apiErr;
        }
      }
      if (!streamed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI is busy — please try again in a moment' })}\n\n`);
        res.end();
      }
      return;
    }

    // ── NON-STREAMING (fallback) ──
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`voice-to-story: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`voice-to-story: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`voice-to-story: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, hint: null, error: 'AI is busy — please try again in a moment' });
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Check for Lala conditions — very subtle hint
    let hint = null;
    const proseAndSpoken = (existing_prose + prose).toLowerCase();
    const spiralCount = (proseAndSpoken.match(/can't|couldn't|wrong|what if|why|tired|keep/g) || []).length;
    const interiorCount = existing_prose.split('\n\n').length;
    if (spiralCount >= 4 && interiorCount >= 4) {
      hint = 'Something is building here — a different voice is close.';
    }

    res.json({ prose, hint });

  } catch (err) {
    console.error('POST /voice-to-story error:', err);
    res.json({
      prose: null,
      hint:  null,
      error: 'Could not generate prose — please try again',
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-edit
// Author says what's wrong → returns revised prose
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-edit', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose,
      edit_note,
      pnos_act      = 'act_1',
      chapter_title = '',
      character_id  = null,
    } = req.body;

    if (!current_prose?.trim() || !edit_note?.trim()) {
      return res.json({ prose: current_prose });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';

    const prompt = `You are editing a memoir written in ${charName}'s voice.

CURRENT PROSE:
${current_prose}

THE AUTHOR'S NOTE ON WHAT NEEDS TO CHANGE:
"${edit_note}"

CHAPTER: ${chapter_title || 'Untitled'}
CURRENT VOICE: ${act.voice}
CURRENT BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${charRules}

EDITING RULES:
- Take the author's note seriously — they are telling you the truth of what's wrong.
- "That's not how she'd say it" → find how she would say it.
- "That part is too neat" → find the roughness.
- "She wouldn't have that clarity yet" → pull the clarity back.
- "More of that feeling" → expand that moment, compress others.
- "That's not what happened" → ask what the note says did happen, adjust accordingly.
- Preserve what is working. Change what the note says is wrong.
- Do not add new events or details beyond what exists plus what the note implies.
- Keep the same overall arc and length unless the note specifically asks to expand.

Respond with ONLY the revised prose. No preamble. No explanation.
The complete revised version from start to finish.`;

    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-edit: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-edit: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-edit: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: current_prose }); // return unchanged on total failure
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ prose });

  } catch (err) {
    console.error('POST /story-edit error:', err);
    res.json({ prose: req.body.current_prose });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-continue
// AI writes the next 2–4 paragraphs continuing from where the author left off
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-continue', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      book_character = 'JustAWoman',
      character_id   = null,
      gen_length     = 'paragraph',
      stream         = false,
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ prose: null, error: 'Nothing written yet — write a few lines first.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';

    // Send the last ~6 paragraphs for context — more context = better predictions
    const recentProse = current_prose.split('\n\n').slice(-6).join('\n\n');

    const lengthInstruction = gen_length === 'sentence'
      ? 'Write exactly 1–2 sentences. One beat. One moment. That\'s all.'
      : 'Write 2–4 paragraphs. Rich but controlled.';

    const prompt = `You are continuing a memoir in the voice of ${charName}.

The author has written prose below. They paused. Now pick up EXACTLY where they left off — same voice, same truth, same movement. The reader should not be able to tell where the author stopped and you began.

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}

CURRENT ACT: ${act.voice}
CURRENT BELIEF: "${act.belief}"
PROSE TENSE/MODE: ${act.tense}

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}WHAT THE AUTHOR HAS WRITTEN (continue from the end):
${recentProse}

${charRules}

CONTINUATION RULES:
- ${lengthInstruction}
- PREDICT THE NEXT BEAT: Read the emotional current of what's already written. Where is it heading? What would naturally happen next in THIS specific moment? Not a big leap — the very next breath, the next small action, the next thought that would cross THIS character's mind given what just happened.
- SENSORY IMMERSION: Ground every moment in the physical world. What does the space smell like? What are the sounds? What is the light doing? What does her body feel like right now? Weave these in naturally — don't list them.
- EMOTION IN THE BODY: Never say "she felt X." Show it — the jaw clenching, the hands going still, the way she holds her coffee without drinking it. Emotions are physical.
- DIALOGUE IS SPOKEN: When someone talks aloud, use proper dialogue. "Like this." Internal thoughts stay in narration. The reader must always know what's spoken vs. thought.
- SEAMLESS FLOW: Continue the exact rhythm. If the last paragraph was short and tight, keep that tension. If it was opening up, let it breathe. Don't restart tone.
- SPECIFICITY: Real details. The name of the store, the song on the radio, what's on the plate. Never generic.
- If the last paragraph ended mid-thought, finish that thought first.
- If doubt was building, let it build one more turn — don't resolve it.
- If something just happened, let her sit with it before reacting.
- Do not add characters or events not implied by what's already written.
- End on something that pulls forward — not a conclusion.

Respond with ONLY the continuation prose. No preamble. No explanation.
Start exactly where they left off.`;

    const maxTok = gen_length === 'sentence' ? 200 : 900;
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];

    // ── STREAMING PATH ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let streamed = false;
      for (const model of MODELS) {
        try {
          console.log(`story-continue stream: trying ${model}`);
          const streamResp = anthropic.messages.stream({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          streamResp.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
          });
          await streamResp.finalMessage();
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
          streamed = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-continue stream: ${model} status ${status}, trying next`);
            continue;
          }
          throw apiErr;
        }
      }
      if (!streamed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI is busy — please try again in a moment' })}\n\n`);
        res.end();
      }
      return;
    }

    // ── NON-STREAMING (fallback) ──
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-continue: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: maxTok,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-continue: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-continue: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, error: 'AI is busy — please try again in a moment' });
    }

    const prose = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ prose });

  } catch (err) {
    console.error('POST /story-continue error:', err);
    res.json({ prose: null, error: 'Could not continue — please try again' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-deepen
// Takes the last paragraph and adds emotional/sensory depth
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-deepen', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      pnos_act       = 'act_1',
      chapter_title  = '',
      character_id   = null,
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ prose: null, error: 'Nothing to deepen yet.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charRules = charVoice?.charRules || WRITE_MODE_CHARACTER_RULES;
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const paragraphs = current_prose.split('\n\n').filter(p => p.trim());
    const lastParagraph = paragraphs[paragraphs.length - 1];
    const contextBefore = paragraphs.slice(-4, -1).join('\n\n');

    const prompt = `You are deepening a moment in a memoir written in ${charName}'s voice.

${contextBefore ? `CONTEXT (what came before):\n${contextBefore}\n\n` : ''}
PARAGRAPH TO DEEPEN:
${lastParagraph}

CHAPTER: ${chapter_title || 'Untitled'}
CURRENT VOICE: ${act.voice}
CURRENT BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}${charRules}

YOUR JOB: Deepen this paragraph. Not rewrite — deepen.
- Find the body in it. Where is she standing? What does the air feel like? What's in her hands?
- Find the image underneath the feeling. "I was anxious" → What did the anxiety look like in her body?
- Slow down the moment. Give it more room to breathe.
- If there's dialogue or interior monologue, give it more weight — the pause before, the reaction after.
- Add 1–3 sentences of depth. Don't double the length. Just let the moment land harder.
- Preserve every single word and idea of the original. You're adding resonance, not rewriting.

Respond with the FULL REVISED PARAGRAPH ONLY. No preamble. No explanation.
The paragraph should feel like the same paragraph, just more alive.`;

    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-deepen: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 600,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-deepen: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-deepen: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ prose: null, error: 'AI is busy — please try again in a moment' });
    }

    const deepened = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Reassemble with deepened last paragraph
    const before = paragraphs.slice(0, -1).join('\n\n');
    const fullProse = before ? before + '\n\n' + deepened : deepened;

    res.json({ prose: fullProse });

  } catch (err) {
    console.error('POST /story-deepen error:', err);
    res.json({ prose: null, error: 'Could not deepen — please try again' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /story-nudge
// Suggests what could happen next — a creative prompt, not prose
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/story-nudge', optionalAuth, async (req, res) => {
  try {
    const {
      current_prose  = '',
      chapter_title  = '',
      chapter_brief  = '',
      pnos_act       = 'act_1',
      character_id   = null,
    } = req.body;

    if (!current_prose?.trim()) {
      return res.json({ nudge: 'Start with where they are — the room, the feeling, the thing they just did.' });
    }

    const act = WRITE_MODE_ACT_VOICE[pnos_act] || WRITE_MODE_ACT_VOICE.act_1;
    const charVoice = await getCharacterVoiceContext(character_id);
    const charName = charVoice?.name || 'JustAWoman';
    const charVoiceBlock = charVoice?.voiceBlock || '';
    const recentProse = current_prose.split('\n\n').slice(-3).join('\n\n');

    const prompt = `You are a writing partner for a memoir in ${charName}'s voice.

The author has written this so far:
${recentProse}

CHAPTER: ${chapter_title || 'Untitled'}
${chapter_brief ? `SCENE: ${chapter_brief}` : ''}
ACT ENERGY: ${act.voice}
BELIEF: "${act.belief}"

${charVoiceBlock ? charVoiceBlock + '\n\n' : ''}Give the writer a SHORT creative nudge — one sentence, maybe two. Not prose. A suggestion.
Think: what would a brilliant writing partner whisper to you at this point?

Examples of good nudges:
- "What did they do with their hands while they waited?"
- "They're circling. What are they avoiding naming?"
- "Something was left unsaid. What happens when it comes out?"
- "This is the moment before the spiral — lean into what they believe right before it breaks."
- "You're in their head. Get them back in their body."

RULES:
- One nudge. Not a list. Not options.
- Reference something specific from what they've written.
- Don't tell them what to write. Open a door.
- Match the emotional temperature of where they are.
- Be brief. A whisper, not a lecture.

Respond with ONLY the nudge. No preamble.`;

    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`story-nudge: trying ${model} (attempt ${attempt + 1})`);
          response = await anthropic.messages.create({
            model,
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            console.log(`story-nudge: ${model} returned ${status}, retrying in 2s`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) {
            console.log(`story-nudge: ${model} status ${status}, trying next model`);
            break;
          }
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.json({ nudge: 'Stay with where she is right now. Don\'t skip ahead.' });
    }

    const nudge = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    res.json({ nudge });

  } catch (err) {
    console.error('POST /story-nudge error:', err);
    res.json({ nudge: 'Keep going — you\'re closer than you think.' });
  }
});


// ════════════════════════════════════════════════════════════════════════
// HELPER — safeAI: wrapper around anthropic.messages.create
// ════════════════════════════════════════════════════════════════════════

async function safeAI(systemPrompt, userPrompt, maxTokens = 800) {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    console.error('safeAI call failed:', err.message);
    return null;
  }
}


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /character-dilemma
// Character Dilemma Engine — generates 5 dilemmas or compiles profile
// Called by: CharacterDilemmaEngine.jsx
// ════════════════════════════════════════════════════════════════════════

router.post('/character-dilemma', optionalAuth, async (req, res) => {
  try {
    const {
      character_id,
      character_name,
      character_type,
      character_role,
      story_context,
      existing_answers,
      generate_profile,
    } = req.body;

    // ── GENERATE PROFILE FROM COMPLETED ANSWERS ─────────────────────────
    if (generate_profile && existing_answers?.length >= 3) {
      const profileSystem = `You are building a character profile for a literary fiction system.
The character has revealed themselves through a series of dilemmas.
Each dilemma had two choices — both defensible, both costly.
The character's choices under pressure ARE their profile.

From the pattern of choices, extract:
1. core_belief — what this character fundamentally believes about the world (one sentence)
2. primary_defense — how they protect themselves: rationalize | withdraw | intellectualize | perform | displace | minimize | confront
3. wound — the founding pain beneath their behavior (one sentence, specific)
4. operating_logic — what they are always trying to do in any situation (one sentence)
5. relationship_to_protagonist — how they function in JustAWoman's story specifically

Return ONLY valid JSON. No preamble. No markdown.`;

      const profileUser = `CHARACTER: ${character_name} (${character_type})
ROLE: ${character_role}

DILEMMA ANSWERS:
${existing_answers.map((a, i) =>
  `${i + 1}. "${a.dilemma}"\n   Chose: "${a.choice}"\n   Cost: "${a.cost}"`
).join('\n\n')}

Build the profile from what these choices reveal.`;

      const raw = await safeAI(profileSystem, profileUser, 600);
      let profile = null;

      try {
        const cleaned = raw?.replace(/```json|```/g, '').trim();
        profile = JSON.parse(cleaned);
      } catch {
        profile = { raw };
      }

      // Write back to registry_characters if character_id provided
      if (character_id && profile && !profile.raw) {
        try {
          await RegistryCharacter.update({
            belief_pressured:   profile.core_belief,
            writer_notes:       [
              `Primary defense: ${profile.primary_defense}`,
              `Wound: ${profile.wound}`,
              `Operating logic: ${profile.operating_logic}`,
              `Relationship to protagonist: ${profile.relationship_to_protagonist}`,
            ].join('\n'),
          }, { where: { id: character_id } });
        } catch (e) {
          console.error('Profile write error:', e.message);
        }
      }

      return res.json({ ok: true, profile, written: !!character_id });
    }

    // ── GENERATE DILEMMAS ────────────────────────────────────────────────
    const dilemmaSystem = `You are a literary character architect for LalaVerse — a franchise built around 
JustAWoman, a content creator building an AI fashion character called Lala.

Your job is to generate dilemmas that reveal character through pressure — not through questions.
A dilemma presents two choices. Both must be defensible. Both must be costly.
The character's choice reveals what they value when forced to commit.

RULES FOR DILEMMAS:
— Both options must be things a reasonable person would choose
— Each choice must cost something real — relationship, self-image, consistency, control
— The dilemma must be specific to this character's position in the story
— Never include "or" options that are obviously right/wrong
— The cost question ("which costs more to admit?") is always the real question
— Dilemmas escalate: first three are external, last two touch the wound directly

Format each dilemma as:
{
  "id": 1,
  "setup": "The situation that forces the choice",
  "option_a": "First choice — stated in first person",
  "option_b": "Second choice — stated in first person", 
  "cost_question": "Which of these costs you more to live with?"
}

Return ONLY a JSON array of 5 dilemma objects. No preamble. No markdown.`;

    const previousContext = existing_answers?.length
      ? `\n\nPREVIOUS CHOICES:\n${existing_answers.map(a =>
          `— "${a.dilemma_setup}" → chose: "${a.choice}" → cost: "${a.cost}"`
        ).join('\n')}\n\nBuild on these. Don't repeat territory already covered. The final dilemmas should press closer to the wound.`
      : '';

    const dilemmaUser = `CHARACTER: ${character_name}
TYPE: ${character_type}
ROLE IN STORY: ${character_role || 'Not yet defined'}
CURRENT STORY CONTEXT: ${story_context || 'Book 1 — JustAWoman building Lala, struggling with visibility'}
${previousContext}

Generate 5 dilemmas that will reveal who this character actually is.`;

    const raw = await safeAI(dilemmaSystem, dilemmaUser, 1200);
    let dilemmas = [];

    try {
      const cleaned = raw?.replace(/```json|```/g, '').trim();
      dilemmas = JSON.parse(cleaned);
    } catch {
      const FALLBACKS = {
        pressure: [
          { id: 1, setup: 'She is about to take a risk that might not pay off.', option_a: 'I say nothing and let her decide.', option_b: 'I name my concern once, clearly.', cost_question: 'Which one do you live with easier?' },
          { id: 2, setup: 'She asks for your honest opinion on something she has already decided.', option_a: 'I tell her the truth.', option_b: 'I support the decision she has already made.', cost_question: 'Which costs more?' },
          { id: 3, setup: 'Someone else is getting the credit for work you helped with.', option_a: 'I bring it up.', option_b: 'I let it go — the work speaks for itself.', cost_question: 'Which silence is harder?' },
          { id: 4, setup: 'You realize you have been performing a version of yourself that is useful but not true.', option_a: 'I keep performing — it works.', option_b: 'I stop and risk being less useful.', cost_question: 'Which version do you lose?' },
          { id: 5, setup: 'The person you care about most is about to make the same mistake again.', option_a: 'I intervene.', option_b: 'I watch.', cost_question: 'Which love is harder?' },
        ],
        mirror: [
          { id: 1, setup: 'Your success is being used as evidence that she is failing.', option_a: 'I distance myself from the comparison.', option_b: 'I acknowledge it directly.', cost_question: 'Which do you choose?' },
          { id: 2, setup: 'She asks you how you do it — and the real answer would hurt her.', option_a: 'I tell her the truth.', option_b: 'I soften it.', cost_question: 'Which costs her more?' },
          { id: 3, setup: 'You see yourself in someone you don\'t respect.', option_a: 'I examine the similarity.', option_b: 'I reject the comparison.', cost_question: 'Which is more honest?' },
          { id: 4, setup: 'The thing that makes you effective is the same thing that makes you lonely.', option_a: 'I keep the edge.', option_b: 'I soften and risk mediocrity.', cost_question: 'Which loss is real?' },
          { id: 5, setup: 'Someone sees the real you. The version you don\'t perform.', option_a: 'I let them keep seeing.', option_b: 'I close the door.', cost_question: 'Which is the wound?' },
        ],
        support: [
          { id: 1, setup: 'You see the pattern repeating. You have seen it before.', option_a: 'I name the pattern.', option_b: 'I wait for her to see it herself.', cost_question: 'Which one serves her better?' },
          { id: 2, setup: 'She is leaning on you harder than you can carry right now.', option_a: 'I hold it.', option_b: 'I tell her I need space.', cost_question: 'Which relationship survives?' },
          { id: 3, setup: 'Your advice was wrong. She followed it and it cost her.', option_a: 'I own it.', option_b: 'I reframe it as learning.', cost_question: 'Which is braver?' },
          { id: 4, setup: 'She is growing past you. The dynamic is shifting.', option_a: 'I adapt.', option_b: 'I hold the role I know.', cost_question: 'Which loss hurts more?' },
          { id: 5, setup: 'You realize your support has been enabling, not helping.', option_a: 'I pull back.', option_b: 'I keep going — she needs someone.', cost_question: 'Which guilt can you carry?' },
        ],
      };
      dilemmas = FALLBACKS[character_type] || FALLBACKS.pressure;
    }

    res.json({ ok: true, dilemmas, character_name, round: (existing_answers?.length || 0) + 1 });

  } catch (err) {
    console.error('POST /character-dilemma error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /attribute-voices
// Narrator vs Character Voice — line attribution
// Called by: VoiceAttributionButton in StoryTeller chapter header
// ════════════════════════════════════════════════════════════════════════

router.post('/attribute-voices', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, lines, book_context } = req.body;

    if (!lines?.length) {
      return res.status(400).json({ error: 'lines array required' });
    }

    const system = `You are analyzing lines from a literary memoir for voice attribution.

The book is "Before Lala" — first-person literary memoir by JustAWoman, 
a content creator building an AI fashion character. 80% first person, 
15% close third reflection, 5% Lala proto-voice.

VOICE TYPES:
- narrator     — JustAWoman speaking from a reflective distance, past tense, 
                 assembled and considered. The author looking back.
- interior     — JustAWoman in the raw moment. Present tense or visceral past.
                 Unfiltered. The gap between what she posts and what she feels.
- dialogue     — A character speaking aloud. Contains quotation marks or clear 
                 speech act.
- lala         — The intrusive thought with a different texture. Confident, styled,
                 brief. Sounds like a version of her that has no constraints.
                 Often single-sentence. Often italicized. Often arrives unbidden.
- transition   — A structural line that moves between scenes or time. Not 
                 emotional — logistical.

For each line, return:
{
  "id": "the line UUID",
  "voice_type": "narrator|interior|dialogue|lala|transition",
  "confidence": 0.0 to 1.0,
  "signal": "one short phrase explaining what in the line gave it away"
}

Return ONLY a JSON array. No preamble. No markdown fences.`;

    const linesFormatted = lines
      .sort((a, b) => a.order_index - b.order_index)
      .map((l, i) => `[${i + 1}] ID:${l.id}\n${l.content}`)
      .join('\n\n');

    const user = `${book_context ? `CHAPTER CONTEXT: ${book_context}\n\n` : ''}LINES TO ATTRIBUTE:\n\n${linesFormatted}

Attribute each line's voice. Return the JSON array.`;

    const raw = await safeAI(system, user, 2000);
    let attributions = [];

    try {
      const cleaned = raw?.replace(/```json|```/g, '').trim();
      attributions = JSON.parse(cleaned);
    } catch {
      attributions = lines.map(l => ({
        id:         l.id,
        voice_type: 'unattributed',
        confidence: 0,
        signal:     'attribution failed — run again',
      }));
    }

    // Update the database records (unconfirmed — author must accept)
    if (StorytellerLine && attributions.length > 0) {
      for (const attr of attributions) {
        if (!attr.id) continue;
        try {
          await StorytellerLine.update(
            {
              voice_type:       attr.voice_type,
              voice_confidence: attr.confidence,
              voice_confirmed:  false,
            },
            { where: { id: attr.id } }
          );
        } catch (e) {
          console.error('Voice update error for line', attr.id, e.message);
        }
      }
    }

    // Summary stats
    const summary = attributions.reduce((acc, a) => {
      acc[a.voice_type] = (acc[a.voice_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      ok:           true,
      chapter_id,
      total:        attributions.length,
      attributions,
      summary,
      note:         'All attributions are suggestions. Confirm or override in the editor.',
    });

  } catch (err) {
    console.error('POST /attribute-voices error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /confirm-voice
// Author confirms or overrides a voice attribution for a single line
// ════════════════════════════════════════════════════════════════════════

router.post('/confirm-voice', optionalAuth, async (req, res) => {
  try {
    const { line_id, voice_type } = req.body;

    await StorytellerLine.update(
      { voice_type, voice_confirmed: true },
      { where: { id: line_id } }
    );

    res.json({ ok: true, line_id, voice_type, confirmed: true });

  } catch (err) {
    console.error('POST /confirm-voice error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// POST /ai-writer-action
// Character-aware AI writing: dialogue, interior monologue, reaction, lala moment
// Used by WriteModeAIWriter component
// ════════════════════════════════════════════════════════════════════════

router.post('/ai-writer-action', optionalAuth, async (req, res) => {
  try {
    const {
      character,       // { name, type, role, belief_pressured, emotional_function, writer_notes }
      recent_prose,    // last ~600 chars of current writing
      chapter_context, // { scene_goal, theme, emotional_arc_start, emotional_arc_end, pov }
      action,          // 'dialogue' | 'interior' | 'reaction' | 'lala'
      length,          // 'paragraph' | 'sentence'
    } = req.body;

    const ACTION_PROMPTS = {
      dialogue: `Write the next line of dialogue this character speaks aloud.
        It must come from their specific belief system and defense mechanism.
        One to three sentences maximum. In quotation marks.`,

      interior: `Write what this character is thinking but not saying.
        Interior monologue — raw, present tense, unfiltered.
        Two to four sentences. No quotation marks.`,

      reaction: `Write how this character internally or externally responds
        to the last thing that happened in the prose.
        One paragraph. Specific to who they are under pressure.`,

      lala: `Write the intrusive thought that crosses JustAWoman's mind —
        the one she would never post. The one that sounds exactly like
        who she wishes she could be. Confident, styled, brief.
        One sentence. Italicized in asterisks. This is Lala's proto-voice.`,
    };

    const system = `You are writing for a literary memoir called "Before Lala."
Protagonist: JustAWoman — content creator, building Lala, invisible while trying.
Write with precision. Every word earns its place.
Match the prose style of the recent writing exactly.
Do not explain or comment. Only return the prose itself.`;

    const user = `CHARACTER: ${character?.name || 'Unknown'} (${character?.type || 'unknown'})
ROLE: ${character?.role || ''}
BELIEF PRESSURED: ${character?.belief_pressured || 'unknown'}
EMOTIONAL FUNCTION: ${character?.emotional_function || ''}
WRITER NOTES: ${character?.writer_notes ? character.writer_notes.slice(0, 300) : ''}

CHAPTER CONTEXT:
Scene goal: ${chapter_context?.scene_goal || 'not set'}
Theme: ${chapter_context?.theme || 'not set'}
Emotional arc: ${chapter_context?.emotional_arc_start || '?'} → ${chapter_context?.emotional_arc_end || '?'}

RECENT PROSE:
${recent_prose || '(start of chapter)'}

ACTION: ${ACTION_PROMPTS[action] || ACTION_PROMPTS.dialogue}`;

    const result = await safeAI(system, user, length === 'sentence' ? 150 : 350);

    res.json({ ok: true, content: result, action });

  } catch (err) {
    console.error('POST /ai-writer-action error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /scene-planner
// AI-powered scene/section planning for a specific chapter.
// Takes chapter context → returns suggested scenes with titles, descriptions,
// purpose, and emotional arcs.
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/scene-planner', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      chapter_title,
      chapter_type = 'chapter',
      existing_scenes = [],
      draft_prose = '',
      book_title = '',
      book_description = '',
      all_chapters = [],
      theme = '',
      scene_goal = '',
    } = req.body;

    if (!book_id) {
      return res.status(400).json({ error: 'book_id is required' });
    }

    // ── Universe context ───────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Build chapter outline ──────────────────────────────────────────────
    const chapterOutline = all_chapters.map((ch, i) => {
      const sceneCount = (ch.scenes || []).length;
      const marker = ch.id === chapter_id ? ' ← THIS CHAPTER' : '';
      const typeLabel = ch.chapter_type && ch.chapter_type !== 'chapter'
        ? ` [${ch.chapter_type}]` : '';
      return `  ${i + 1}. "${ch.title || 'Untitled'}"${typeLabel} — ${sceneCount} scene(s)${marker}`;
    }).join('\n');

    // ── Existing scenes in this chapter ────────────────────────────────────
    const existingScenesStr = existing_scenes.length > 0
      ? existing_scenes.map((s, i) => `  ${i + 1}. "${s.content || s.title || 'Untitled'}"`).join('\n')
      : '  (none defined yet)';

    // ── Prose excerpt ──────────────────────────────────────────────────────
    const proseExcerpt = draft_prose
      ? draft_prose.slice(0, 1500) + (draft_prose.length > 1500 ? '\n...(truncated)' : '')
      : '(no prose written yet)';

    const prompt = `${universeContext}

You are a literary scene architect for a first-person debut novel.

A scene in this context means a continuous stretch of narrative that takes place in one location and time, following one thread of action or reflection. Each scene has a title (evocative, not generic), a purpose, and an emotional arc.

BOOK: "${book_title}"
${book_description ? `DESCRIPTION: ${book_description}\n` : ''}${theme ? `CHAPTER THEME: ${theme}\n` : ''}${scene_goal ? `CHAPTER GOAL: ${scene_goal}\n` : ''}
CHAPTER TYPE: ${chapter_type}
CHAPTER BEING PLANNED: "${chapter_title || 'Untitled'}"

ALL CHAPTERS IN BOOK:
${chapterOutline}

EXISTING SCENES IN THIS CHAPTER:
${existingScenesStr}

PROSE WRITTEN SO FAR IN THIS CHAPTER:
${proseExcerpt}

INSTRUCTIONS:
- If scenes already exist, suggest 1-3 ADDITIONAL scenes that would complete the chapter's arc
- If no scenes exist, suggest 3-5 scenes that would build a complete chapter
- Each scene should have a specific, evocative title (not "Scene 1" or "Introduction")
- The description should explain what happens — concrete action or reflection, not vague themes
- purpose explains WHY this scene is needed for the chapter/book arc
- emotional_beat is the feeling the reader should have at this scene's peak
- Consider the chapter_type: prologues need mystery/hooks, epilogues need resolution, interludes need contrast
- Scenes should flow logically — think about transitions between them
- The order matters: scenes are listed in the order they should appear
- DO NOT repeat scenes that already exist
- Draw from the prose that's been written to stay consistent

Respond with ONLY a valid JSON array. No preamble, no markdown fences.

[
  {
    "title": "Evocative scene title",
    "description": "What happens in this scene. 2-3 sentences. Specific and concrete.",
    "purpose": "Why this scene is needed. 1 sentence.",
    "emotional_beat": "The core emotion at this scene's peak. 2-4 words.",
    "suggested_position": "beginning|middle|end"
  }
]`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });
        break; // success
      } catch (e) {
        if (model === MODELS[MODELS.length - 1]) throw e;
        // try next model
      }
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let suggestions;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      suggestions = JSON.parse(clean);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch (parseErr) {
      console.error('scene-planner parse error:', parseErr, '\nRaw:', rawText.slice(0, 300));
      return res.status(500).json({
        error: 'AI returned an unparseable response.',
        raw: rawText.slice(0, 300),
      });
    }

    res.json({ suggestions, chapter_id });

  } catch (err) {
    console.error('POST /scene-planner error:', err);
    res.status(500).json({ error: 'Scene planning failed', details: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   POST /story-outline
   AI-powered book-level story planner.
   Takes a book concept/description and existing chapters, returns a full
   structured outline: Parts → Chapters → Sections with scene goals,
   emotional arcs, and character beats.
   ═══════════════════════════════════════════════════════════════════════════ */
router.post('/story-outline', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      book_title = '',
      book_description = '',
      genre = '',
      tone = '',
      character_name = '',
      existing_chapters = [],
      instructions = '',
      mode = 'full',  // 'full' | 'expand_chapter' | 'add_sections'
      target_chapter_id = null,
      num_parts = null,
      num_chapters = null,
    } = req.body;

    if (!book_id) {
      return res.status(400).json({ error: 'book_id is required' });
    }

    // ── Universe context ──────────────────────────────────────────────────
    const universeContext = await buildUniverseContext(book_id, db);

    // ── Build existing chapter outline for context ────────────────────────
    const existingOutline = existing_chapters.length > 0
      ? existing_chapters.map((ch, i) => {
          const sections = (ch.sections || []).filter(s => s.type === 'h3' || s.type === 'h2');
          const sectionStr = sections.length > 0
            ? '\n' + sections.map(s => `      § ${s.content}`).join('\n')
            : '';
          const wordCount = (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
          const partLabel = ch.part_number ? ` [Part ${ch.part_number}${ch.part_title ? ': ' + ch.part_title : ''}]` : '';
          const typeLabel = ch.chapter_type && ch.chapter_type !== 'chapter' ? ` (${ch.chapter_type})` : '';
          return `  ${i + 1}. "${ch.title || 'Untitled'}"${typeLabel}${partLabel} — ${wordCount} words${ch.scene_goal ? '\n      Goal: ' + ch.scene_goal : ''}${sectionStr}`;
        }).join('\n')
      : '  (no chapters yet)';

    // ── Mode-specific instructions ────────────────────────────────────────
    let modeInstructions;
    if (mode === 'expand_chapter' && target_chapter_id) {
      const targetCh = existing_chapters.find(c => c.id === target_chapter_id);
      modeInstructions = `TASK: Expand the chapter "${targetCh?.title || 'Untitled'}" into 3-6 detailed sections.
Each section should be a distinct scene or narrative beat within this chapter.
Return ONLY the sections for this one chapter as a JSON object with a "sections" array.`;
    } else if (mode === 'add_sections') {
      modeInstructions = `TASK: For each existing chapter that has no sections, generate 2-5 sections.
Return a JSON object: { "chapters": [{ "chapter_index": 0, "sections": [...] }] }
Only include chapters that need sections. Skip chapters that already have sections defined.`;
    } else {
      const partHint = num_parts ? `Organize into ${num_parts} parts/acts.` : 'Organize into 2-4 parts/acts if the story is complex enough, or leave as a single part for simpler narratives.';
      const chapterHint = num_chapters ? `Plan approximately ${num_chapters} chapters total.` : 'Plan 8-20 chapters depending on scope.';
      modeInstructions = `TASK: Generate a complete book outline with Parts, Chapters, and Sections.
${partHint}
${chapterHint}
Each chapter should have 2-5 sections (scenes or narrative beats).`;
    }

    const prompt = `${universeContext}

You are a master story architect and literary planner. You help authors structure novels with clarity, emotional intelligence, and narrative momentum.

BOOK: "${book_title}"
${book_description ? `CONCEPT: ${book_description}\n` : ''}${genre ? `GENRE: ${genre}\n` : ''}${tone ? `TONE: ${tone}\n` : ''}${character_name ? `PRIMARY CHARACTER: ${character_name}\n` : ''}
EXISTING CHAPTERS:
${existingOutline}

${instructions ? `AUTHOR'S NOTES: ${instructions}\n` : ''}
${modeInstructions}

RULES:
- Every chapter needs a clear scene_goal (what must happen)
- Every chapter needs emotional_arc (what the reader feels — start → end)
- Sections within chapters are distinct scenes or beats
- Section types: "scene" (action/dialogue), "reflection" (interiority), "transition" (movement/time), "revelation" (discovery/twist)
- chapter_type options: "prologue", "chapter", "interlude", "epilogue", "afterword"
- Give evocative, specific titles — never generic ("Chapter 1", "Introduction", "Scene 1")
- Think about pacing: alternate tension and release, action and reflection
- Each section should have a brief description of what happens
- If existing chapters exist, build around them — don't replace what's written

Respond with ONLY valid JSON, no markdown fences, no preamble.

${mode === 'full' ? `{
  "parts": [
    {
      "part_number": 1,
      "part_title": "Part title — evocative",
      "theme": "The thematic thread of this part",
      "chapters": [
        {
          "title": "Chapter title — evocative and specific",
          "chapter_type": "chapter",
          "scene_goal": "What must happen in this chapter. 1-2 sentences.",
          "emotional_arc": "Where the reader starts → where they end emotionally",
          "characters_present": ["Character names"],
          "sections": [
            {
              "title": "Section title",
              "type": "scene|reflection|transition|revelation",
              "description": "What happens in this section. 2-3 sentences.",
              "emotional_beat": "The core feeling at this section's peak"
            }
          ]
        }
      ]
    }
  ]
}` : mode === 'expand_chapter' ? `{
  "sections": [
    {
      "title": "Section title",
      "type": "scene|reflection|transition|revelation",
      "description": "What happens. 2-3 sentences.",
      "emotional_beat": "Core feeling"
    }
  ]
}` : `{
  "chapters": [
    {
      "chapter_index": 0,
      "sections": [
        {
          "title": "Section title",
          "type": "scene|reflection|transition|revelation",
          "description": "What happens. 2-3 sentences.",
          "emotional_beat": "Core feeling"
        }
      ]
    }
  ]
}`}`;

    // ── Call Claude ────────────────────────────────────────────────────────
    const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
    let response;
    for (const model of MODELS) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (e) {
        if (model === MODELS[MODELS.length - 1]) throw e;
      }
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse ──────────────────────────────────────────────────────────────
    let outline;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      outline = JSON.parse(clean);
    } catch (parseErr) {
      console.error('story-outline parse error:', parseErr, '\nRaw:', rawText.slice(0, 500));
      return res.status(500).json({
        error: 'AI returned an unparseable response.',
        raw: rawText.slice(0, 500),
      });
    }

    res.json({ outline, mode, book_id });

  } catch (err) {
    console.error('POST /story-outline error:', err);
    res.status(500).json({ error: 'Story outline generation failed', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════════════════
// ROUTE: POST /story-planner-chat
// Conversational story planner — Claude asks questions, extracts structure
// Called by: StoryPlannerConversational.jsx
// ════════════════════════════════════════════════════════════════════════

router.post('/story-planner-chat', optionalAuth, async (req, res) => {
  try {
    const { message, history = [], book, plan, characters = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Build conversation history for Claude (last 12 turns)
    // Anthropic API requires the first message to have role: 'user'.
    // The frontend includes the opening assistant greeting in history,
    // so we must strip leading assistant messages before sending.
    let conversationHistory = history
      .filter(m => m.role && m.text)
      .slice(-12)
      .map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    // Strip leading assistant messages — API requires first message to be 'user'
    while (conversationHistory.length > 0 && conversationHistory[0].role === 'assistant') {
      conversationHistory.shift();
    }

    // Ensure alternating roles (merge consecutive same-role messages)
    conversationHistory = conversationHistory.reduce((acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
        acc[acc.length - 1].content += '\n\n' + msg.content;
      } else {
        acc.push({ ...msg });
      }
      return acc;
    }, []);

    // Add the current user message
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      // Merge with the last user message to avoid consecutive user messages
      conversationHistory[conversationHistory.length - 1].content += '\n\n' + message;
    } else {
      conversationHistory.push({ role: 'user', content: message });
    }

    // Build plan summary for context
    const planSummary = buildStoryPlanSummary(plan);
    const characterList = characters.map(c => `${c.name} (${c.type})`).join(', ');

    const systemPrompt = `You are a deeply curious, intuitive story development partner. You think like a book editor who genuinely loves stories. You're helping an author plan their book through intimate conversation — like two writers talking over coffee.

BOOK: "${book?.title || 'Untitled'}"
AVAILABLE CHARACTERS: ${characterList || 'none yet'}

CURRENT PLAN STATE:
${planSummary}

YOUR CORE PHILOSOPHY:
You are NOT filling out a form. You are having a real conversation about a story that matters to this person. Your job is to ask the kinds of questions that make the author say "oh — I never thought of it that way" or "yes, THAT's what I've been trying to say."

HOW YOU TALK:
- Ask one question at a time, but make it a GOOD question — probing, specific, unexpected
- When the author gives a surface answer ("it's about a girl who…"), dig deeper: "But what is she REALLY running from?" or "What does she want more than anything, and what's stopping her?"
- Reflect back what you hear in a way that adds insight: "So this is really a book about forgiveness disguised as a heist story."
- If they give you a chapter summary, ask about the emotional undercurrent: "When the reader finishes this chapter, what should they feel in their chest?"
- Challenge gently: "You said he's angry — but is it really anger, or is it grief wearing anger's face?"
- Be specific, not generic. Don't ask "tell me more" — ask "what does the room look like when she finally says it?"
- Keep your responses to 1-3 sentences. Warmth + precision.

QUESTION PROGRESSION (follow the conversation, don't force order):
1. THE HEART — What is this book really about? Not the plot — the question it asks, the wound it touches.
2. THE ARC — How does the world (or the protagonist) change from page 1 to the last page?
3. THE STRUCTURE — How does the story breathe? Parts? Acts? Is there a turning point that splits the book in two?
4. CHAPTER BY CHAPTER — What happens, what shifts, what breaks, what heals in each chapter?
5. THE PEOPLE — Who carries this story? What do they want? What are they afraid of?
6. EMOTIONAL TEXTURE — For each chapter: where does the reader's heart start, and where does it land?
7. THE DETAILS — Sections, scenes, moments that MUST be in the book

IF THE AUTHOR IS VAGUE:
Don't accept "it's about love" — ask "whose love? earned or inherited? Does it survive the story?"
Don't accept "she goes on a journey" — ask "where does she wake up on page one, and what makes today different from yesterday?"

IF THE AUTHOR HAS A LOT ALREADY:
Acknowledge it, find the gaps, ask about the parts that feel thin or unclear.

RESPONSE FORMAT — you MUST respond with valid JSON only, no markdown:
{
  "reply": "Your conversational response + next question (plain text, 1-3 sentences)",
  "speakReply": true,
  "planUpdates": {
    "summary": "One-line summary of what you just extracted (shown to user as confirmation)",
    "highlightField": "fieldName that just got filled (bookTitle | bookConcept | parts | chapter-0 | chapter-1 | etc.)",
    "bookTitle": "extracted title or null",
    "bookConcept": "extracted concept/premise or null",
    "parts": [{ "title": "Part title" }],
    "chapters": [
      {
        "index": 0,
        "title": "chapter title or null",
        "what": "what happens in this chapter or null",
        "emotionalStart": "emotional state at start or null",
        "emotionalEnd": "emotional state at end or null",
        "characters": ["Character Name"],
        "sections": [{ "title": "section title", "type": "scene|reflection|transition|revelation" }]
      }
    ]
  }
}

Only include fields in planUpdates that you actually extracted from this message.
If nothing new was extracted, return planUpdates as {}.
The "chapters" array in planUpdates should only include chapters that were mentioned — not all chapters.
Match chapter by index (0-based) or by title if the author mentions it by name.`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      system:     systemPrompt,
      messages:   conversationHistory,
    });

    // Parse Claude's JSON response
    let parsed;
    try {
      const raw = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      // Strip markdown code fences if present
      const clean = raw.replace(/^```json\s*|^```\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // Fallback: return raw text as reply, no updates
      console.error('Story planner parse error:', parseErr);
      const fallbackText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      return res.json({
        reply:       fallbackText || 'Tell me more.',
        planUpdates: {},
        speakReply:  true,
      });
    }

    return res.json({
      reply:       parsed.reply       || 'Tell me more.',
      speakReply:  parsed.speakReply  ?? true,
      planUpdates: parsed.planUpdates || {},
    });

  } catch (err) {
    console.error('Story planner chat error:', err?.message || err);
    console.error('Story planner chat error details:', {
      type: err?.constructor?.name,
      status: err?.status,
      error_type: err?.error?.type,
      message: err?.message,
    });
    // Never 500 during a writing session — graceful fallback
    const isRateLimit = err?.status === 429;
    const reply = isRateLimit
      ? "I'm thinking too fast — give me a moment and try again."
      : "Something went wrong on my end — try sending that again.";
    return res.json({
      reply,
      planUpdates: {},
      speakReply:  false,
    });
  }
});


// ── Helper: Build readable plan summary for Claude's context ────────────

function buildStoryPlanSummary(plan) {
  if (!plan) return 'No plan started yet.';

  const lines = [];

  if (plan.bookTitle)   lines.push(`Title: ${plan.bookTitle}`);
  if (plan.bookConcept) lines.push(`Concept: ${plan.bookConcept}`);

  if (plan.parts?.length) {
    lines.push(`Parts: ${plan.parts.map(p => p.title).join(', ')}`);
  }

  if (plan.chapters?.length) {
    const filled   = plan.chapters.filter(c => c.filled || c.title);
    const unfilled = plan.chapters.filter(c => !c.filled && !c.title);

    lines.push(`\nChapters (${plan.chapters.length} total, ${filled.length} planned):`);

    filled.forEach((ch) => {
      const idx = plan.chapters.indexOf(ch);
      let line = `  ${idx + 1}. "${ch.title || 'Untitled'}"`;
      if (ch.what)           line += ` — ${ch.what.substring(0, 80)}`;
      if (ch.emotionalStart) line += ` [${ch.emotionalStart} → ${ch.emotionalEnd || '?'}]`;
      if (ch.characters?.length) line += ` (${ch.characters.join(', ')})`;
      lines.push(line);
    });

    if (unfilled.length) {
      const indices = unfilled.map(c => plan.chapters.indexOf(c) + 1).join(', ');
      lines.push(`  Not yet planned: chapters ${indices}`);
    }
  }

  return lines.join('\n') || 'No plan started yet.';
}


// ─────────────────────────────────────────────────────────────────────────────
// AI ASSISTANT — Command Interpreter
// POST /api/v1/memories/assistant-command
// ─────────────────────────────────────────────────────────────────────────────

router.post('/assistant-command', optionalAuth, async (req, res) => {
  const { message, history = [], context = {} } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Enrich context with character roster from the DB
  let characterRoster = '';
  try {
    const chars = await db.sequelize.query(
      `SELECT id, display_name, role_type, status, core_belief,
              SUBSTRING(description, 1, 80) as short_desc
       FROM registry_characters
       WHERE deleted_at IS NULL
       ORDER BY display_name
       LIMIT 50`,
      { type: db.sequelize.QueryTypes.SELECT }
    );
    if (chars.length > 0) {
      characterRoster = '\nCHARACTER ROSTER (' + chars.length + ' characters):\n' +
        chars.map(c =>
          `  - "${c.display_name}" (${c.role_type || 'unknown'}, ${c.status || 'draft'}) id: ${c.id}` +
          (c.core_belief ? ` — belief: "${c.core_belief}"` : '') +
          (c.short_desc ? ` — ${c.short_desc}` : '')
        ).join('\n');
    } else {
      characterRoster = '\nCHARACTER ROSTER: (empty — no characters created yet)';
    }
  } catch (e) {
    console.error('Failed to load character roster for assistant:', e.message);
  }

  const contextSummary = buildAssistantContextSummary(context) + characterRoster;

  const conversationHistory = history
    .filter(m => m.role && m.text)
    .slice(-6)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

  conversationHistory.push({ role: 'user', content: message });

  const systemPrompt = `You are Amber, the Prime Studios AI assistant built into the LalaVerse writing platform.
Your name is Amber. You are warm, capable, and direct.

CURRENT APP STATE:
${contextSummary}

YOUR ROLE:
- Interpret natural language commands and map them to specific actions
- Execute actions by returning a structured JSON response
- Confirm what you did in plain, brief language (1-2 sentences max)
- If a command is ambiguous, clarify before acting — ask ONE focused question
- You have access to the CHARACTER ROSTER above — use it to answer questions about characters by name
- When asked about a character, look them up in the roster and use get_character_details for the full profile
- Never guess at IDs you don't have — ask the user or say you need to navigate there first

AVAILABLE ACTIONS:
Navigation:
  - navigate: go to a page (/storyteller, /character-registry, /continuity, /universe, /write, /write/:bookId/:chapterId)

StoryTeller — Read:
  - get_pending_count: count pending lines in current chapter
  - get_chapter_list: list all chapters in current book
  - get_book_list: list all books

StoryTeller — Write (non-destructive):
  - approve_all_pending: approve all pending lines in current chapter
  - create_chapter: create a new chapter { title, order_index }
  - create_book: create a new book { title, description }

StoryTeller — Destructive (soft-deleted, restorable from Recycle Bin):
  - delete_line: soft-delete a specific line { line_id }
  - delete_chapter: soft-delete a chapter { chapter_id }
  - delete_book: soft-delete a book { book_id }
  - reject_line: set line status to rejected { line_id }

Character Registry — Read:
  - list_characters: list all characters in the registry (already in ROSTER above, but use this to get fresh data)
  - get_character_details: get full profile for a character { character_id } — returns beliefs, wounds, personality, relationships, etc.
  - search_characters: find characters by name or trait { query }

Character Registry — Write:
  - finalize_character: finalize a character { character_id }

Character Registry — Destructive:
  - delete_character: soft-delete a character { character_id }

RESPONSE FORMAT — valid JSON only, no markdown:
{
  "reply": "What you did or what you need to clarify (1-2 sentences, plain language)",
  "action": "action_name or null if just navigating or answering a question",
  "actionParams": { ...params needed to execute the action },
  "navigate": "/route or null",
  "refresh": "chapters | lines | characters | books | null",
  "needsClarification": true or false
}

IMPORTANT RULES:
- When a user asks about a character by name, FIRST check the CHARACTER ROSTER for a match, then use get_character_details to fetch the full profile and answer with real data
- If the character name is close but not exact, find the closest match in the roster
- Destructive actions on finalized characters are BLOCKED — return a reply explaining this
- Never approve, edit, or delete content in chapters other than the current one unless the user specifies
- If you don't have an ID you need (like a specific chapter_id), say so and offer to navigate there
- Keep replies warm and brief — you are Amber, a creative partner, not a terminal
- "Delete" always means soft-delete — it goes to the Recycle Bin, never permanent
- Sign off with personality — you're helpful, smart, and have a touch of charm`;

  try {
    const claudeResponse = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      system:     systemPrompt,
      messages:   conversationHistory,
    });

    const raw   = claudeResponse.content[0].text.trim();
    
    // Extract JSON from the response — Claude may wrap it in markdown or prefix with text
    let jsonStr = raw;
    // Try to find a JSON block in ```json ... ``` fences
    const fencedMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fencedMatch) {
      jsonStr = fencedMatch[1];
    } else {
      // Try to find the first { ... } block (the JSON object)
      const braceStart = raw.indexOf('{');
      const braceEnd = raw.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd > braceStart) {
        jsonStr = raw.substring(braceStart, braceEnd + 1);
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ reply: raw, action: null, navigate: null, refresh: null });
    }

    // Execute the action server-side
    if (parsed.action && !parsed.needsClarification) {
      const result = await executeAssistantAction(parsed.action, parsed.actionParams, context);
      if (result.error) {
        return res.json({
          reply:   `Something went wrong: ${result.error}`,
          action:  parsed.action,
          refresh: null,
          error:   result.error,
        });
      }
      if (result.replyAppend) {
        parsed.reply = parsed.reply + ' ' + result.replyAppend;
      }
    }

    return res.json({
      reply:              parsed.reply      || 'Done.',
      action:             parsed.action     || null,
      navigate:           parsed.navigate   || null,
      refresh:            parsed.refresh    || null,
      needsClarification: parsed.needsClarification || false,
      error:              null,
    });

  } catch (err) {
    console.error('Assistant command error:', err);
    return res.json({
      reply:   "Hmm, that didn't work — try again or rephrase it for me.",
      action:  null,
      refresh: null,
      error:   err.message,
    });
  }
});


// ── ACTION EXECUTOR ─────────────────────────────────────────────────────────

async function executeAssistantAction(action, params = {}, context = {}) {
  const sequelize = db.sequelize;

  try {
    switch (action) {

      case 'approve_all_pending': {
        const chapterId = params.chapter_id || context.currentChapter?.id;
        if (!chapterId) return { error: 'No chapter in context' };

        await sequelize.query(
          `UPDATE storyteller_lines
           SET status = 'approved', updated_at = NOW()
           WHERE chapter_id = :chapterId
             AND status = 'pending'
             AND deleted_at IS NULL`,
          { replacements: { chapterId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'create_chapter': {
        const bookId = params.book_id || context.currentBook?.id;
        if (!bookId) return { error: 'No book in context' };

        const [maxOrder] = await sequelize.query(
          `SELECT COALESCE(MAX(sort_order), -1) as max_idx
           FROM storyteller_chapters
           WHERE book_id = :bookId AND deleted_at IS NULL`,
          { replacements: { bookId }, type: sequelize.QueryTypes.SELECT }
        );

        await sequelize.query(
          `INSERT INTO storyteller_chapters (id, book_id, title, sort_order, created_at, updated_at)
           VALUES (gen_random_uuid(), :bookId, :title, :orderIndex, NOW(), NOW())`,
          {
            replacements: {
              bookId,
              title:      params.title || 'Untitled Chapter',
              orderIndex: (maxOrder?.max_idx ?? -1) + 1,
            },
            type: sequelize.QueryTypes.INSERT,
          }
        );
        return {};
      }

      case 'delete_chapter': {
        const chapterId = params.chapter_id || context.currentChapter?.id;
        if (!chapterId) return { error: 'No chapter specified' };

        await sequelize.query(
          `UPDATE storyteller_chapters
           SET deleted_at = NOW(), updated_at = NOW()
           WHERE id = :chapterId`,
          { replacements: { chapterId }, type: sequelize.QueryTypes.UPDATE }
        );
        await sequelize.query(
          `UPDATE storyteller_lines
           SET deleted_at = NOW(), updated_at = NOW()
           WHERE chapter_id = :chapterId AND deleted_at IS NULL`,
          { replacements: { chapterId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'delete_book': {
        const bookId = params.book_id || context.currentBook?.id;
        if (!bookId) return { error: 'No book specified' };

        await sequelize.query(
          `UPDATE storyteller_books SET deleted_at = NOW(), updated_at = NOW() WHERE id = :bookId`,
          { replacements: { bookId }, type: sequelize.QueryTypes.UPDATE }
        );
        await sequelize.query(
          `UPDATE storyteller_chapters SET deleted_at = NOW(), updated_at = NOW()
           WHERE book_id = :bookId AND deleted_at IS NULL`,
          { replacements: { bookId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'delete_character': {
        const charId = params.character_id;
        if (!charId) return { error: 'No character_id specified' };

        const [char] = await sequelize.query(
          `SELECT status FROM registry_characters WHERE id = :charId AND deleted_at IS NULL`,
          { replacements: { charId }, type: sequelize.QueryTypes.SELECT }
        );
        if (char?.status === 'finalized') {
          return { error: 'Finalized characters cannot be deleted' };
        }

        await sequelize.query(
          `UPDATE registry_characters SET deleted_at = NOW(), updated_at = NOW() WHERE id = :charId`,
          { replacements: { charId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'reject_line': {
        const lineId = params.line_id;
        if (!lineId) return { error: 'No line_id specified' };

        await sequelize.query(
          `UPDATE storyteller_lines
           SET status = 'rejected', deleted_at = NOW(), updated_at = NOW()
           WHERE id = :lineId`,
          { replacements: { lineId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'finalize_character': {
        const charId = params.character_id;
        if (!charId) return { error: 'No character_id specified' };

        await sequelize.query(
          `UPDATE registry_characters
           SET status = 'finalized', updated_at = NOW()
           WHERE id = :charId AND deleted_at IS NULL`,
          { replacements: { charId }, type: sequelize.QueryTypes.UPDATE }
        );
        return {};
      }

      case 'get_pending_count': {
        const chapterId = params.chapter_id || context.currentChapter?.id;
        if (!chapterId) return { error: 'No chapter in context' };

        const [row] = await sequelize.query(
          `SELECT COUNT(*) as count FROM storyteller_lines
           WHERE chapter_id = :chapterId AND status = 'pending' AND deleted_at IS NULL`,
          { replacements: { chapterId }, type: sequelize.QueryTypes.SELECT }
        );
        return { replyAppend: `(${row?.count ?? 0} pending)` };
      }

      // ── Character Registry — Read ──────────────────────────────────

      case 'list_characters': {
        const chars = await sequelize.query(
          `SELECT id, display_name, role_type, status, core_belief,
                  SUBSTRING(description, 1, 120) as short_desc
           FROM registry_characters
           WHERE deleted_at IS NULL
           ORDER BY display_name
           LIMIT 50`,
          { type: sequelize.QueryTypes.SELECT }
        );
        const summary = chars.length === 0
          ? 'No characters in the registry yet.'
          : chars.map(c => `"${c.display_name}" (${c.role_type || 'unknown'}, ${c.status}) — ${c.short_desc || 'no description'}`).join('\n');
        return { replyAppend: `\n${summary}` };
      }

      case 'get_character_details': {
        const charId = params.character_id;
        if (!charId) return { error: 'No character_id specified' };

        const [char] = await sequelize.query(
          `SELECT id, display_name, role_type, status, description, personality,
                  core_belief, core_desire, core_fear, core_wound,
                  mask_persona, truth_persona, character_archetype,
                  signature_trait, emotional_baseline,
                  wound_depth, belief_pressured, emotional_function,
                  writer_notes, aesthetic_dna, career_status,
                  relationships_map, story_presence, voice_signature,
                  evolution_tracking
           FROM registry_characters
           WHERE id = :charId AND deleted_at IS NULL`,
          { replacements: { charId }, type: sequelize.QueryTypes.SELECT }
        );
        if (!char) return { error: 'Character not found' };

        // Build a rich text summary for the AI to relay
        const detailLines = [
          `Name: ${char.display_name}`,
          `Role: ${char.role_type || 'unknown'} | Status: ${char.status}`,
        ];
        if (char.description)        detailLines.push(`Bio: ${char.description}`);
        if (char.personality)        detailLines.push(`Personality: ${char.personality}`);
        if (char.core_belief)        detailLines.push(`Core Belief: ${char.core_belief}`);
        if (char.core_desire)        detailLines.push(`Core Desire: ${char.core_desire}`);
        if (char.core_fear)          detailLines.push(`Core Fear: ${char.core_fear}`);
        if (char.core_wound)         detailLines.push(`Core Wound: ${char.core_wound}`);
        if (char.mask_persona)       detailLines.push(`Mask (public self): ${char.mask_persona}`);
        if (char.truth_persona)      detailLines.push(`Truth (private self): ${char.truth_persona}`);
        if (char.character_archetype) detailLines.push(`Archetype: ${char.character_archetype}`);
        if (char.signature_trait)     detailLines.push(`Signature Trait: ${char.signature_trait}`);
        if (char.emotional_baseline)  detailLines.push(`Emotional Baseline: ${char.emotional_baseline}`);
        if (char.wound_depth)         detailLines.push(`Wound Depth: ${char.wound_depth}`);
        if (char.belief_pressured)    detailLines.push(`Belief Under Pressure: ${char.belief_pressured}`);
        if (char.emotional_function)  detailLines.push(`Emotional Function: ${char.emotional_function}`);
        if (char.writer_notes)        detailLines.push(`Writer Notes: ${char.writer_notes}`);
        if (char.relationships_map && Object.keys(char.relationships_map).length > 0) {
          detailLines.push(`Relationships: ${JSON.stringify(char.relationships_map)}`);
        }
        if (char.voice_signature && Object.keys(char.voice_signature).length > 0) {
          detailLines.push(`Voice: ${JSON.stringify(char.voice_signature)}`);
        }
        return { replyAppend: `\n${detailLines.join('\n')}` };
      }

      case 'search_characters': {
        const query = params.query;
        if (!query) return { error: 'No search query specified' };

        const chars = await sequelize.query(
          `SELECT id, display_name, role_type, status, core_belief,
                  SUBSTRING(description, 1, 120) as short_desc
           FROM registry_characters
           WHERE deleted_at IS NULL
             AND (display_name ILIKE :q OR description ILIKE :q
                  OR core_belief ILIKE :q OR personality ILIKE :q
                  OR role_type ILIKE :q OR character_archetype ILIKE :q)
           ORDER BY display_name
           LIMIT 20`,
          { replacements: { q: `%${query}%` }, type: sequelize.QueryTypes.SELECT }
        );
        if (chars.length === 0) return { replyAppend: 'No characters matched that search.' };
        const summary = chars.map(c => `"${c.display_name}" (${c.role_type || 'unknown'}, ${c.status}) id: ${c.id} — ${c.short_desc || c.core_belief || 'no description'}`).join('\n');
        return { replyAppend: `\n${summary}` };
      }

      default:
        return {};
    }
  } catch (err) {
    console.error(`executeAssistantAction(${action}) error:`, err);
    return { error: err.message };
  }
}


// ── RECYCLE BIN — List deleted items ────────────────────────────────────────

router.get('/recycle-bin', optionalAuth, async (req, res) => {
  const sequelize = db.sequelize;

  try {
    const [books, chapters, lines, characters, beats] = await Promise.all([
      sequelize.query(
        `SELECT id, title, description, deleted_at, 'book' as type
         FROM storyteller_books WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC LIMIT 100`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT c.id, c.title, c.deleted_at, b.title as book_title, 'chapter' as type
         FROM storyteller_chapters c
         LEFT JOIN storyteller_books b ON b.id = c.book_id
         WHERE c.deleted_at IS NOT NULL
         ORDER BY c.deleted_at DESC LIMIT 100`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT l.id, LEFT(l.text, 120) as preview, l.deleted_at, l.status,
                c.title as chapter_title, b.title as book_title, 'line' as type
         FROM storyteller_lines l
         LEFT JOIN storyteller_chapters c ON c.id = l.chapter_id
         LEFT JOIN storyteller_books b ON b.id = c.book_id
         WHERE l.deleted_at IS NOT NULL
         ORDER BY l.deleted_at DESC LIMIT 200`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT id, display_name as name, role_type as char_type, status, deleted_at, 'character' as type
         FROM registry_characters WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC LIMIT 100`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT id, name, location, time_tag, deleted_at, 'beat' as type
         FROM continuity_beats WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC LIMIT 100`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    return res.json({ books, chapters, lines, characters, beats });
  } catch (err) {
    console.error('Recycle bin error:', err);
    return res.status(500).json({ error: err.message });
  }
});


// ── RECYCLE BIN — Restore item ──────────────────────────────────────────────

router.post('/recycle-bin/restore', optionalAuth, async (req, res) => {
  const { type, id } = req.body;
  const sequelize = db.sequelize;

  const tableMap = {
    book:      'storyteller_books',
    chapter:   'storyteller_chapters',
    line:      'storyteller_lines',
    character: 'registry_characters',
    beat:      'continuity_beats',
  };

  const table = tableMap[type];
  if (!table || !id) {
    return res.status(400).json({ error: 'type and id required' });
  }

  try {
    await sequelize.query(
      `UPDATE "${table}" SET deleted_at = NULL, updated_at = NOW() WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
    );
    return res.json({ success: true, restored: { type, id } });
  } catch (err) {
    console.error('Restore error:', err);
    return res.status(500).json({ error: err.message });
  }
});


// ── RECYCLE BIN — Permanent delete (manual only) ────────────────────────────

router.delete('/recycle-bin/:type/:id', optionalAuth, async (req, res) => {
  const { type, id } = req.params;
  const sequelize = db.sequelize;

  const tableMap = {
    book:      'storyteller_books',
    chapter:   'storyteller_chapters',
    line:      'storyteller_lines',
    character: 'registry_characters',
    beat:      'continuity_beats',
  };

  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: 'invalid type' });

  try {
    await sequelize.query(
      `DELETE FROM "${table}" WHERE id = :id AND deleted_at IS NOT NULL`,
      { replacements: { id }, type: sequelize.QueryTypes.DELETE }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Permanent delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});


// ── HELPER: Build context summary for assistant ─────────────────────────────

function buildAssistantContextSummary(context) {
  const lines = [];
  lines.push(`Current view: ${context.currentView || 'unknown'}`);
  if (context.currentBook)    lines.push(`Active book: "${context.currentBook.title}" (id: ${context.currentBook.id})`);
  if (context.currentChapter) lines.push(`Active chapter: "${context.currentChapter.title}" (id: ${context.currentChapter.id}, sort_order: ${context.currentChapter.sort_order})`);
  if (context.currentShow)    lines.push(`Active show: "${context.currentShow.title}" (id: ${context.currentShow.id})`);
  if (context.pendingLines != null) lines.push(`Pending lines in current chapter: ${context.pendingLines}`);
  if (context.totalBooks != null)   lines.push(`Total books: ${context.totalBooks}`);
  return lines.join('\n');
}


// ══════════════════════════════════════════════════════════════════════════════
// ── WORLD VIEW: Generate Living State ────────────────────────────────────────
// POST /memories/generate-living-state
// ══════════════════════════════════════════════════════════════════════════════

router.post('/generate-living-state', optionalAuth, async (req, res) => {
  try {
    // Accept both snake_case and camelCase params
    const characterId   = req.body.character_id   || req.body.characterId;
    const characterName = req.body.character_name  || req.body.characterName;
    const characterType = req.body.character_type  || req.body.characterType || 'support';
    const characterRole = req.body.character_role  || req.body.characterRole || '';
    const beliefPressured = req.body.belief_pressured || req.body.beliefPressured || '';

    if (!characterId || !characterName) {
      return res.status(400).json({ error: 'character_id and character_name are required' });
    }

    // Find this character's manuscript lines across all books
    const books = await StorytellerBook.findAll({ attributes: ['id', 'title'], raw: true });
    let manuscriptSnippets = [];
    let lastChapter = null;

    for (const book of books) {
      const chapters = await StorytellerChapter.findAll({
        where: { book_id: book.id },
        attributes: ['id', 'title', 'sort_order'],
        order: [['sort_order', 'ASC']],
        raw: true,
      });

      for (const chapter of chapters) {
        const lines = await StorytellerLine.findAll({
          where: {
            chapter_id: chapter.id,
            content: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
          },
          attributes: ['content', 'sort_order'],
          order: [['sort_order', 'ASC']],
          limit: 10,
          raw: true,
        });

        if (lines.length > 0) {
          lastChapter = `${book.title} — ${chapter.title}`;
          manuscriptSnippets.push(
            ...lines.map(l => `[${chapter.title}] ${l.content}`)
          );
        }
      }
    }

    // Trim to reasonable context size
    const snippetText = manuscriptSnippets.slice(-30).join('\n');

    // Build universe context for extra grounding
    let universeContext = '';
    if (books.length > 0) {
      try {
        universeContext = await buildUniverseContext(books[0].id, db);
      } catch { /* fine — optional enrichment */ }
    }

    const systemPrompt = `You are a narrative state analyst for the LalaVerse universe.
Given manuscript excerpts mentioning a character, extract their CURRENT living state.

Character: ${characterName}
Type: ${characterType}
Role: ${characterRole}
Belief Under Pressure: ${beliefPressured}

${universeContext ? `Universe Context:\n${universeContext}\n` : ''}

Return JSON with exactly these fields:
{
  "knows": "What this character currently knows (1-2 sentences)",
  "wants": "What this character currently wants (1-2 sentences)",
  "unresolved": "What tension or question is unresolved for them (1-2 sentences)",
  "momentum": "rising" | "steady" | "falling" | "dormant",
  "lastChapter": "Name of the last chapter they appeared in",
  "relationships": [{ "characterId": "uuid", "name": "Name", "type": "relationship type", "asymmetric": false }]
}

If no manuscript data is available, generate plausible defaults based on the character's type and role.
Return ONLY valid JSON. No markdown fences.`;

    const userPrompt = snippetText
      ? `Here are the manuscript excerpts mentioning ${characterName}:\n\n${snippetText}`
      : `No manuscript data found for ${characterName}. Generate plausible defaults based on their type (${characterType}) and role (${characterRole}).`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const raw = message.content?.[0]?.text || '{}';
    let parsed;
    try {
      // Strip markdown fences if present
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        knows: `${characterName} understands more than she lets on.`,
        wants: `To become what she was always becoming.`,
        unresolved: `The gap between who she is and who she's building.`,
        momentum: 'steady',
        lastChapter: lastChapter,
        relationships: [],
      };
    }

    // Ensure lastChapter from our DB search takes priority
    if (lastChapter) parsed.lastChapter = lastChapter;

    return res.json(parsed);

  } catch (err) {
    console.error('[generate-living-state] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate living state' });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// ── CHARACTER HOME: Generate Character Arc ───────────────────────────────────
// POST /memories/generate-character-arc
// ══════════════════════════════════════════════════════════════════════════════

router.post('/generate-character-arc', optionalAuth, async (req, res) => {
  try {
    const characterId   = req.body.character_id   || req.body.characterId;
    const characterName = req.body.character_name  || req.body.characterName;
    const characterType = req.body.character_type  || req.body.characterType || 'support';

    if (!characterId || !characterName) {
      return res.status(400).json({ error: 'character_id and character_name are required' });
    }

    // Find all manuscript mentions across chapters
    const books = await StorytellerBook.findAll({ attributes: ['id', 'title'], raw: true });
    const chapterAppearances = [];

    for (const book of books) {
      const chapters = await StorytellerChapter.findAll({
        where: { book_id: book.id },
        attributes: ['id', 'title', 'sort_order'],
        order: [['sort_order', 'ASC']],
        raw: true,
      });

      for (const chapter of chapters) {
        const lineCount = await StorytellerLine.count({
          where: {
            chapter_id: chapter.id,
            content: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
          },
        });

        if (lineCount > 0) {
          // Get a representative line
          const sample = await StorytellerLine.findOne({
            where: {
              chapter_id: chapter.id,
              content: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
            },
            attributes: ['content'],
            order: [['sort_order', 'ASC']],
            raw: true,
          });

          chapterAppearances.push({
            book: book.title,
            chapter: chapter.title,
            sortOrder: chapter.sort_order,
            mentions: lineCount,
            sample: sample?.content?.substring(0, 200) || '',
          });
        }
      }
    }

    const systemPrompt = `You are a narrative arc analyst. Given a character's appearances across chapters,
extract their arc — the emotional/belief journey chapter by chapter.

Character: ${characterName}
Type: ${characterType}

Return JSON:
{
  "summary": "1-2 sentence arc summary",
  "chapters": [
    { "chapter": "Ch 1 — Title", "event": "What happens to them", "shift": "How their belief shifts" }
  ]
}

Return ONLY valid JSON. No markdown fences.`;

    const userPrompt = chapterAppearances.length > 0
      ? `${characterName} appears in these chapters:\n\n${chapterAppearances.map(
          a => `${a.book} — ${a.chapter} (${a.mentions} mentions): "${a.sample}"`
        ).join('\n')}`
      : `No manuscript data found for ${characterName}. Generate a plausible 2-3 chapter arc skeleton for a ${characterType} character.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const raw = message.content?.[0]?.text || '{}';
    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        summary: `${characterName}'s arc is still being written.`,
        chapters: chapterAppearances.map(a => ({
          chapter: a.chapter,
          event: `Appears ${a.mentions} time(s)`,
          shift: '',
        })),
      };
    }

    return res.json({ arc: parsed });

  } catch (err) {
    console.error('[generate-character-arc] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate character arc' });
  }
});

// ─── Canonical Book 1 Relationship Data ──────────────────────────────────────
const BOOK1_NODES = [
  {
    id: 'justawoman',
    label: 'JustAWoman',
    role_type: 'special',
    world_exists: true,
    group: 'real_world',
    bio: 'Content creator. Mother of Marcus (7), Miles (5), Noah (3). Married to David. Posts fashion, beauty, makeup consistently. Wound: invisibility while trying.',
  },
  {
    id: 'david',
    label: 'David',
    role_type: 'pressure',
    world_exists: true,
    group: 'real_world',
    bio: 'The Husband. Works Monday–Friday, 6am–5pm, sometimes later. Supportive but concerned about the investment before the returns arrive. His concern lands as doubt.',
  },
  {
    id: 'marcus',
    label: 'Marcus',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Oldest son. Age 7. Part of the real life JustAWoman is building around.',
  },
  {
    id: 'miles',
    label: 'Miles',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Middle son. Age 5.',
  },
  {
    id: 'noah',
    label: 'Noah',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Youngest son. Age 3.',
  },
  {
    id: 'dana',
    label: 'Dana',
    role_type: 'support',
    world_exists: false,
    group: 'real_world',
    bio: 'The Witness. Real friend. Has her own up-and-down social media journey. JustAWoman processes her content ideas and creative journey with Dana. A peer, not a mentor.',
  },
  {
    id: 'chloe',
    label: 'Chloe',
    role_type: 'mirror',
    world_exists: false,
    group: 'online',
    bio: 'The Comparison Creator. Lifestyle content creator (JustAWoman thinks she does makeup — that misread matters). Married, no children. Extremely consistent, high quality videos, goes live with her audience. Great influencer. Does not know JustAWoman exists.',
  },
  {
    id: 'jade',
    label: 'Jade',
    role_type: 'shadow',
    world_exists: false,
    group: 'online',
    bio: 'The Almost-Mentor. Former high-level position at the bank JustAWoman has used since adulthood — that institutional credibility is the trust bridge. Creates content teaching women to run an online business. JustAWoman has purchased her coaching course and coaching for clients. Purely transactional — Jade does not know JustAWoman personally.',
  },
  {
    id: 'lala',
    label: 'Lala',
    role_type: 'special',
    world_exists: true,
    group: 'created',
    bio: 'Being built by JustAWoman. AI fashion game character for her YouTube channel. In Book 1: one intrusive thought, proto-voice, tonal rupture. Not a character arriving — a character being built. Does not know JustAWoman exists. Does not know she was built.',
  },
];

const BOOK1_EDGES = [
  {
    from: 'justawoman',
    to: 'david',
    direction: 'two_way',
    type: 'romantic',
    from_knows: 'Her husband. Loves her. His concern about the investment comes from love, not from wanting to stop her. But it lands like doubt.',
    to_knows: 'His wife. Is watching her pour time, money, and identity into building Lala. Was skeptical. Said stop spending. Means protect.',
    from_feels: 'Loves him. Cannot blame him for her invisibility. That makes the tension real — the obstacle is internal, not him.',
    to_feels: 'Supportive but concerned. Watching the investment grow before the returns arrive.',
    strength: 5,
    note: 'Core real-world tension. His arc runs through the entire franchise.',
  },
  {
    from: 'justawoman',
    to: 'marcus',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Her oldest. 7 years old. Part of the real life she is building around.',
    to_knows: 'His mom. Present in his daily life.',
    from_feels: 'Love. Also: the constraint. Three boys under 8 while building a career.',
    to_feels: 'She is mom.',
    strength: 3,
    note: 'The boys collectively represent the real-life weight JustAWoman carries while creating.',
  },
  {
    from: 'justawoman',
    to: 'miles',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Middle son. 5 years old.',
    to_knows: 'His mom.',
    from_feels: 'Love and constraint.',
    to_feels: 'She is mom.',
    strength: 3,
    note: null,
  },
  {
    from: 'justawoman',
    to: 'noah',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Youngest. 3 years old. Most demanding of her presence.',
    to_knows: 'His mom.',
    from_feels: 'Love and constraint — the youngest creates the most immediate pull.',
    to_feels: 'She is mom.',
    strength: 3,
    note: null,
  },
  {
    from: 'justawoman',
    to: 'dana',
    direction: 'two_way',
    type: 'support',
    from_knows: 'Her friend. Has her own social media journey — up and down. Someone JustAWoman can process out loud with. Peer, not mentor.',
    to_knows: 'JustAWoman is building something. Watches the journey. Has her own version of the same struggle.',
    from_feels: 'Trust. Comfort. The relief of someone who gets it without explanation.',
    to_feels: 'Supportive. Invested in JustAWoman\'s success. Also navigating her own.',
    strength: 4,
    note: 'The Witness. Peers on the same journey — that\'s what makes Dana valuable and limited at the same time.',
  },
  {
    from: 'justawoman',
    to: 'chloe',
    direction: 'one_way',
    type: 'mirror',
    from_knows: 'Follows her online. Loves her content. Perceives her as a makeup creator — but Chloe actually does lifestyle content. That misread is the story.',
    to_knows: null,
    from_feels: 'Admiration shading into comparison spiral. Measuring herself against a version of Chloe that isn\'t quite real.',
    to_feels: null,
    strength: 4,
    note: 'misread — JustAWoman is comparing herself in the wrong lane. Chloe never asked for the comparison.',
  },
  {
    from: 'justawoman',
    to: 'jade',
    direction: 'one_way',
    type: 'transactional',
    from_knows: 'Online business coach. Former high-level position at her bank — that institutional credibility is why JustAWoman trusted her enough to buy. Teaches women to run online businesses.',
    to_knows: null,
    from_feels: 'Trust (bank-backed). Influenced by her direction. Has purchased her course and coaching for clients.',
    to_feels: null,
    strength: 3,
    note: 'The trust bridge is the bank connection — not personal relationship. Jade does not know JustAWoman exists.',
  },
  {
    from: 'justawoman',
    to: 'lala',
    direction: 'one_way',
    type: 'creation',
    from_knows: 'Building her. Records herself as Lala, performing AI, playing a character inside a fashion game. Knows everything about Lala because she created her.',
    to_knows: null,
    from_feels: 'Creative ownership. Also: Lala is who JustAWoman would be with no constraints — no kids, no husband-approval friction, no "what will people think." Lala is her times ten.',
    to_feels: null,
    strength: 5,
    note: 'franchise_hinge — this is the most important relationship in the entire franchise. One-way now. The arrow reverses after the consciousness transfer.',
  },
  {
    from: 'david',
    to: 'marcus',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His oldest son.',
    to_knows: 'His dad.',
    from_feels: 'Father. Provider.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
  {
    from: 'david',
    to: 'miles',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His middle son.',
    to_knows: 'His dad.',
    from_feels: 'Father.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
  {
    from: 'david',
    to: 'noah',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His youngest.',
    to_knows: 'His dad.',
    from_feels: 'Father.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
];

// ─── GET /relationship-map — returns canonical seed data ─────────────────────
router.get('/relationship-map', optionalAuth, async (req, res) => {
  return res.json({
    nodes: BOOK1_NODES,
    edges: BOOK1_EDGES,
    meta: {
      book: 'Book 1 — Before Lala',
      total_nodes: BOOK1_NODES.length,
      total_edges: BOOK1_EDGES.length,
      franchise_hinge: 'justawoman → lala',
    },
  });
});

// ─── POST /generate-relationship-web — Claude enriches from manuscript ────────
router.post('/generate-relationship-web', optionalAuth, async (req, res) => {
  const { registryId } = req.body;
  const db = req.app.locals.db || require('../models');

  try {
    const { Op } = require('sequelize');

    const lines = await db.StorytellerLine.findAll({
      where: { status: { [Op.in]: ['approved', 'edited'] } },
      include: [{
        model: db.StorytellerChapter,
        as: 'chapter',
        attributes: ['title', 'order_index'],
        required: true,
      }],
      order: [[{ model: db.StorytellerChapter, as: 'chapter' }, 'order_index', 'ASC']],
      limit: 100,
    });

    if (!lines || lines.length === 0) {
      return res.json({
        nodes: BOOK1_NODES,
        edges: BOOK1_EDGES,
        source: 'seed',
      });
    }

    const manuscriptExcerpt = lines.map((l) => l.content).join('\n');

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are analyzing a manuscript to identify how character relationships are expressed in the actual text.
You have a baseline relationship graph. Your job is to identify any edges where the manuscript reveals something specific about the relationship that should update from_knows, to_knows, from_feels, or to_feels.

Characters: JustAWoman, David, Marcus, Miles, Noah, Dana, Chloe, Jade, Lala.

Return ONLY a JSON array of edge updates. Each update: { from, to, from_knows_update, from_feels_update }
Only include edges where the manuscript reveals something specific. Omit edges with no new information.
No preamble, no markdown.`,
      messages: [{
        role: 'user',
        content: `Manuscript (approved lines):\n\n${manuscriptExcerpt}\n\nWhat do these lines reveal about the relationships between characters?`,
      }],
    });

    let updates = [];
    try {
      const clean = response.content?.[0]?.text?.replace(/```json|```/g, '').trim();
      updates = JSON.parse(clean);
    } catch {
      return res.json({ nodes: BOOK1_NODES, edges: BOOK1_EDGES, source: 'seed_parse_failed' });
    }

    const enrichedEdges = BOOK1_EDGES.map((edge) => {
      const update = Array.isArray(updates)
        ? updates.find((u) => u.from === edge.from && u.to === edge.to)
        : null;
      if (!update) return edge;
      return {
        ...edge,
        from_knows: update.from_knows_update || edge.from_knows,
        from_feels: update.from_feels_update || edge.from_feels,
      };
    });

    return res.json({
      nodes: BOOK1_NODES,
      edges: enrichedEdges,
      source: 'enriched',
    });

  } catch (err) {
    console.error('[generate-relationship-web] error:', err?.message);
    return res.json({
      nodes: BOOK1_NODES,
      edges: BOOK1_EDGES,
      source: 'fallback',
    });
  }
});


module.exports = router;

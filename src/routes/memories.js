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

MEMORY TYPES:
- goal: A character wants or intends something
- preference: A character likes, avoids, or is drawn to something
- relationship: How two characters relate to each other (trust, tension, dynamic shift)
- belief: A core conviction or worldview the character holds
- event: Something that happened that is now part of the character's story
- constraint: A fear, boundary, block, or stressor limiting the character
- transformation: A change in identity, capability, or worldview

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

Example response format:
[
  {
    "type": "relationship",
    "statement": "Frankie feels intimidated by Chloe — aspiration, not hostility. This marks a shift from admiration to self-comparison.",
    "confidence": 0.82,
    "tags": ["identity", "comparison", "relationship"],
    "character_hint": "The Comparison Creator"
  }
]

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

    // Finalized characters cannot receive new memories
    if (character.status === 'finalized') {
      return res.status(403).json({
        error: 'Character is finalized. Confirmed memories cannot be added to finalized characters.',
        character_id,
        character_status: 'finalized',
      });
    }

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


module.exports = router;

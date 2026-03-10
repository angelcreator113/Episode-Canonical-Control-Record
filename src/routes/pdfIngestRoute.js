// routes/pdfIngestRoute.js
//
// POST /api/v1/franchise-brain/ingest-pdf
//
// Accepts document uploads (PDF, TXT, MD, DOCX), extracts text server-side,
// runs it through Claude extraction to populate Franchise Knowledge tables.
//
// ─── SETUP ───────────────────────────────────────────────────────────────────
// npm install multer pdf-parse mammoth
//
// In app.js, mount alongside your existing franchise-brain routes:
//   const pdfIngestRoute = require('./routes/pdfIngestRoute');
//   app.use('/api/v1/franchise-brain', pdfIngestRoute);
//
// The existing franchiseBrainRoutes.js and upgradeRoutes.js are unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');
const router   = express.Router();
const db       = require('../models');
const { optionalAuth } = require('../middleware/auth');

const client = new Anthropic();

// Memory storage — we never write the file to disk, just buffer it
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTS = ['.pdf', '.txt', '.md', '.markdown', '.docx'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (ALLOWED_MIMETYPES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Accepted: PDF, TXT, MD, DOCX'), false);
    }
  },
});

// ─── Extraction system prompts (matches existing ingest-document logic) ───────
const STORY_EXTRACTION_SYSTEM = `You are extracting story knowledge for Prime Studios — a literary production system for the LalaVerse franchise.

Extract only story and narrative decisions: character truths, franchise laws, locked narrative decisions, brand voice rules, world rules, arc structure. Nothing technical about code or infrastructure.

Every entry must be:
- A direct active statement (not a question, not a suggestion)
- Self-contained (makes sense without reading the surrounding document)
- Written as something the story engine can check a scene against

Respond ONLY in valid JSON with no preamble or markdown fences.`;

const TECH_EXTRACTION_SYSTEM = `You are extracting technical knowledge for Prime Studios — a React/Node/PostgreSQL literary production system.

Extract only technical decisions: what is deployed, what routes exist, what tables exist, what architectural rules are locked, what is next in the build queue. Nothing narrative. Nothing about characters or story.

Respond ONLY in valid JSON with no preamble or markdown fences.`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/franchise-brain/ingest-pdf
// Body: multipart/form-data
//   file          — the PDF file (required)
//   brain         — "story" | "tech" (default: "story")
//   source_document — label for the source (default: from filename)
//   source_version  — version string (default: "")
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/ingest-pdf',
  optionalAuth,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const brain          = req.body.brain          || 'story';
    const source_version = req.body.source_version || '';
    const source_document = req.body.source_document
      || req.file.originalname.replace(/\.[^.]+$/, '').replace(/_/g, ' ').toLowerCase();

    try {
      // ── 1. Extract text based on file type ────────────────────────────────
      const ext = '.' + req.file.originalname.split('.').pop().toLowerCase();
      let extractedText = '';
      let pageCount = 0;

      if (ext === '.pdf' || req.file.mimetype === 'application/pdf') {
        let pdfData;
        try {
          pdfData = await pdfParse(req.file.buffer);
        } catch (parseErr) {
          return res.status(422).json({
            error: 'Could not extract text from this PDF. Make sure it is not scanned/image-only.',
            detail: parseErr.message,
          });
        }
        extractedText = pdfData.text?.trim() || '';
        pageCount = pdfData.numpages || 0;
      } else if (ext === '.docx' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const result = await mammoth.extractRawText({ buffer: req.file.buffer });
          extractedText = result.value?.trim() || '';
        } catch (docxErr) {
          return res.status(422).json({
            error: 'Could not extract text from this DOCX file.',
            detail: docxErr.message,
          });
        }
      } else {
        // TXT, MD, markdown — plain text
        extractedText = req.file.buffer.toString('utf-8').trim();
      }

      if (!extractedText || extractedText.length < 50) {
        return res.status(422).json({
          error: 'Document appears to contain no readable text.',
        });
      }

      // ── 2. Chunk if large (Claude context window safety) ─────────────────
      // ~12,000 chars per chunk — comfortable for a single Claude call
      const CHUNK_SIZE  = 12000;
      const CHUNK_OVERLAP = 200;
      const chunks = [];

      if (extractedText.length <= CHUNK_SIZE) {
        chunks.push(extractedText);
      } else {
        let pos = 0;
        while (pos < extractedText.length) {
          chunks.push(extractedText.slice(pos, pos + CHUNK_SIZE));
          pos += CHUNK_SIZE - CHUNK_OVERLAP;
        }
      }

      // ── 3. Extract knowledge from each chunk ─────────────────────────────
      const system = brain === 'tech' ? TECH_EXTRACTION_SYSTEM : STORY_EXTRACTION_SYSTEM;

      const allEntries = [];
      let combinedSummary = '';

      for (let i = 0; i < chunks.length; i++) {
        const isLast  = i === chunks.length - 1;
        const chunkLabel = chunks.length > 1 ? ` (part ${i + 1} of ${chunks.length})` : '';

        const response = await client.messages.create({
          model:      'claude-opus-4-5',
          max_tokens: 4000,
          system,
          messages: [{
            role: 'user',
            content: `Extract ${brain} knowledge entries from this document${chunkLabel}.\nSource: ${source_document} ${source_version}\n\nDOCUMENT TEXT:\n${chunks[i]}\n\nReturn JSON:\n{\n  "entries": [\n    {\n      "title": "Short label for this decision",\n      "content": "The decision as a direct active statement",\n      "category": ${brain === 'tech'
                ? '"deployed_system" | "route_registry" | "schema" | "architecture_rule" | "build_pattern" | "pending_build" | "integration"'
                : '"character" | "narrative" | "locked_decision" | "franchise_law" | "brand" | "world" | "technical"'},\n      "severity": "critical" | "important" | "context",\n      "applies_to": ["tag1", "tag2"]\n    }\n  ],\n  "summary": "One sentence describing what this chunk covered"${isLast ? ',\n  "document_summary": "One sentence describing the whole document"' : ''}\n}`,
          }],
        });

        let parsed;
        try {
          parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
        } catch {
          // Chunk parse failed — skip it, don't fail the whole upload
          console.warn(`PDF ingest: chunk ${i + 1} parse failed, skipping`);
          continue;
        }

        allEntries.push(...(parsed.entries || []));
        if (parsed.document_summary) combinedSummary = parsed.document_summary;
        else if (parsed.summary && i === 0) combinedSummary = parsed.summary;
      }

      if (allEntries.length === 0) {
        return res.status(422).json({
          error: 'No knowledge entries could be extracted from this document.',
          pages: pageCount,
          chars: extractedText.length,
        });
      }

      // ── 4. Write to the correct table ─────────────────────────────────────
      let created;
      if (brain === 'tech') {
        created = await db.FranchiseTechKnowledge.bulkCreate(
          allEntries.map(e => ({
            title:           e.title,
            content:         e.content,
            category:        e.category        || 'deployed_system',
            severity:        e.severity        || 'important',
            applies_to:      e.applies_to      || [],
            source_document: source_document,
            source_version:  source_version    || null,
            extracted_by:    'document_ingestion',
            status:          'active',
          }))
        );
      } else {
        created = await db.FranchiseKnowledge.bulkCreate(
          allEntries.map(e => ({
            title:           e.title,
            content:         e.content,
            category:        e.category        || 'narrative',
            severity:        e.severity        || 'important',
            applies_to:      e.applies_to      || [],
            source_document: source_document,
            source_version:  source_version    || null,
            extracted_by:    'document_ingestion',
            status:          'pending_review',  // story entries always go to pending first
          }))
        );
      }

      return res.json({
        ok:                true,
        entries_extracted: created.length,
        pages_processed:   pageCount,
        chunks_processed:  chunks.length,
        document_summary:  combinedSummary,
        source_document,
        brain,
        // Story entries land in pending_review — remind the UI
        next_step: brain === 'story'
          ? 'Review extracted entries in Knowledge → Pending Review before they activate.'
          : 'Tech entries are active immediately.',
      });
    } catch (err) {
      console.error('Document ingest error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Error handler for multer rejections (file too large, wrong type)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 20MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.startsWith('Unsupported file type')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// socialProfileBulkRoutes.js — The Feed: Bulk Import for Social Profiles
//
// Routes:
// POST /parse-paste   — Parse pasted text into candidate creators
// POST /parse-file    — Parse uploaded file (PDF, Word, TXT, MD) into creators
// POST /generate      — Batch-generate profiles from parsed candidates
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const { buildGenerationPrompt } = require('./socialProfileRoutes');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Multer — in-memory, 10 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── DB helper ────────────────────────────────────────────────────────────────
function getModels() {
  try { return require('../models'); } catch { return null; }
}

const PLATFORMS = ['tiktok','instagram','youtube','twitter','onlyfans','twitch','substack','multi'];

// ── POST /parse-paste ────────────────────────────────────────────────────────
router.post('/parse-paste', optionalAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'No text provided' });

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const creators = [];
    const errors   = [];

    for (const line of lines) {
      // Expected: @handle | platform | vibe sentence
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        const handle   = parts[0].replace(/^@/, '');
        const platform = parts[1].toLowerCase();
        const vibe     = parts.slice(2).join(' | ');
        if (!PLATFORMS.includes(platform)) {
          errors.push({ line, reason: `Unknown platform: ${parts[1]}` });
          continue;
        }
        creators.push({ handle, platform, vibe_sentence: vibe });
      } else if (parts.length === 2) {
        // handle | vibe — default to instagram
        const handle = parts[0].replace(/^@/, '');
        creators.push({ handle, platform: 'instagram', vibe_sentence: parts[1] });
      } else {
        errors.push({ line, reason: 'Could not parse — expected @handle | platform | vibe' });
      }
    }

    return res.json({ creators, errors, total_lines: lines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /parse-file ─────────────────────────────────────────────────────────
router.post('/parse-file', optionalAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext  = path.extname(req.file.originalname).toLowerCase();
    let rawText = '';

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      rawText = data.text;
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ buffer: req.file.buffer });
      rawText = result.value;
    } else {
      rawText = req.file.buffer.toString('utf-8');
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'File appears empty or unreadable' });
    }

    // Use Claude to extract creator signals from freeform text
    const extraction = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Extract every social media creator mention from the following text.
For each creator, extract:
- handle (username or name used)
- platform (best guess from: ${PLATFORMS.join(', ')})
- vibe_sentence (one-line description of who they are / what they do)

If a handle is not explicitly given, invent a plausible one based on the name/description.
For any extracted text that informed your extraction, include it as source_text.

Return ONLY valid JSON array:
[{"handle":"username","platform":"instagram","vibe_sentence":"...","source_text":"..."}]

TEXT:
${rawText.slice(0, 12000)}`,
      }],
    });

    let creators = [];
    let extractionNotes = '';
    try {
      const content = extraction.content[0].text;
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        creators = JSON.parse(match[0]);
        // Validate platforms
        creators = creators.map(c => ({
          ...c,
          platform: PLATFORMS.includes(c.platform) ? c.platform : 'instagram',
        }));
      }
    } catch (parseErr) {
      extractionNotes = 'AI extraction returned unparseable results. Try paste mode instead.';
    }

    return res.json({
      creators,
      extraction_notes: extractionNotes || `Extracted ${creators.length} creator(s) from ${req.file.originalname}`,
      file_name: req.file.originalname,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /generate ───────────────────────────────────────────────────────────
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { creators, series_id } = req.body;
    if (!Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ error: 'No creators provided' });
    }
    if (creators.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 creators per batch' });
    }

    const db = getModels();
    const results = [];

    for (const c of creators) {
      try {
        const prompt = buildGenerationPrompt(c.handle, c.platform, c.vibe_sentence);
        const aiRes = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = aiRes.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI did not return valid JSON');

        const profile = JSON.parse(jsonMatch[0]);

        // Save to DB if available
        let saved = null;
        if (db && db.SocialProfile) {
          saved = await db.SocialProfile.create({
            handle: c.handle,
            platform: c.platform,
            vibe_sentence: c.vibe_sentence,
            display_name: profile.display_name,
            archetype: profile.archetype,
            content_persona: profile.content_persona,
            real_signal: profile.real_signal,
            posting_voice: profile.posting_voice,
            comment_energy: profile.comment_energy,
            follower_count_approx: profile.follower_count_approx,
            parasocial_function: profile.parasocial_function,
            emotional_activation: profile.emotional_activation,
            watch_reason: profile.watch_reason,
            what_it_costs_her: profile.what_it_costs_her,
            current_trajectory: profile.current_trajectory,
            trajectory_detail: profile.trajectory_detail,
            lala_relevance_score: profile.lala_relevance_score,
            lala_relevance_reason: profile.lala_relevance_reason,
            pinned_post: profile.pinned_post,
            sample_captions: profile.sample_captions,
            sample_comments: profile.sample_comments,
            adult_content_present: profile.adult_content_present || false,
            adult_content_type: profile.adult_content_type,
            adult_content_framing: profile.adult_content_framing,
            crossing_trigger: profile.crossing_trigger,
            crossing_mechanism: profile.crossing_mechanism,
            book_relevance: profile.book_relevance,
            moment_log: profile.moment_log || [],
            full_profile: profile,
            status: 'generated',
            series_id: series_id || null,
          });
        }

        results.push({
          handle: c.handle,
          platform: c.platform,
          status: 'success',
          profile_id: saved?.id || null,
          lala_score: profile.lala_relevance_score || 0,
        });
      } catch (genErr) {
        results.push({
          handle: c.handle,
          platform: c.platform,
          status: 'failed',
          error: genErr.message,
        });
      }
    }

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed    = results.filter(r => r.status === 'failed').length;

    return res.json({
      results,
      summary: { total: creators.length, succeeded, failed },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

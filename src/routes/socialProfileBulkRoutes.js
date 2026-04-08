// ─────────────────────────────────────────────────────────────────────────────
// socialProfileBulkRoutes.js — The Feed: Bulk Import for Social Profiles
//
// Routes:
// POST /parse-paste       — Parse pasted text into candidate creators
// POST /parse-file        — Parse uploaded file (PDF, Word, TXT, MD) into creators
// POST /parse-csv         — Parse CSV/TSV data into candidate creators (#3)
// POST /generate          — Batch-generate profiles from parsed candidates (sync)
// POST /generate-job      — Queue a background bulk generation job
// GET  /jobs              — List recent jobs
// GET  /jobs/:id          — Get job status/progress
// GET  /jobs/:id/stream   — SSE stream for real-time job progress (#1)
// POST /jobs/:id/cancel   — Cancel a running job (#5)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const { buildGenerationPrompt, autoAssignAllFollowers } = require('./socialProfileRoutes');

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
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.tsv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── DB helper ────────────────────────────────────────────────────────────────
function getModels() {
  try { return require('../models'); } catch { return null; }
}

const PLATFORMS = ['tiktok','instagram','youtube','twitter','onlyfans','twitch','substack','multi'];

// ── SSE client registry for real-time streaming (#1) ─────────────────────────
const jobSSEClients = new Map(); // jobId → Set<res>

function notifyJobSSE(jobId, event, data) {
  const clients = jobSSEClients.get(String(jobId));
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch (err) { console.warn('[social-bulk] SSE write error:', err?.message); }
  }
}

// ── Cancellation registry (#5) ──────────────────────────────────────────────
const cancelledJobs = new Set();

// ── Error categorization (#8) ───────────────────────────────────────────────
function categorizeError(err) {
  const msg = (err.message || err || '').toString();
  if (/timed?\s*out|timeout/i.test(msg))
    return { category: 'timeout', retryable: true, label: 'AI Timeout' };
  if (/rate.?limit|429|too many/i.test(msg))
    return { category: 'rate_limit', retryable: true, label: 'Rate Limited' };
  if (/JSON|parse|valid/i.test(msg))
    return { category: 'ai_parse', retryable: true, label: 'AI Parse Error' };
  if (/ECONN|ENETUNREACH|socket|network/i.test(msg))
    return { category: 'network', retryable: true, label: 'Network Error' };
  if (/database|sequelize|SQL|constraint|unique/i.test(msg))
    return { category: 'db_error', retryable: false, label: 'Database Error' };
  if (/cancelled|canceled/i.test(msg))
    return { category: 'cancelled', retryable: false, label: 'Cancelled' };
  return { category: 'unknown', retryable: true, label: 'Unknown Error' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PROFILE GENERATION — Deduplicated (#4)
// ═══════════════════════════════════════════════════════════════════════════════

async function generateSingleProfile(creator, { db, seriesId, characterContext, characterKey: _characterKey, feedLayer }) {
  const prompt = buildGenerationPrompt(creator.handle, creator.platform, creator.vibe_sentence, characterContext);
  const aiRes = await Promise.race([
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI call timed out after 120s')), 120000)),
  ]);

  const text = aiRes.content[0].text;
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const fixedJson = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
  let profile;
  try {
    profile = JSON.parse(fixedJson);
  } catch (parseErr) {
    throw new Error(`Profile JSON parse failed: ${parseErr.message}`);
  }

  // Save to DB — findOrCreate to prevent duplicates on retry
  let saved = null;
  if (db && db.SocialProfile) {
    const [record, created] = await db.SocialProfile.findOrCreate({
      where: { handle: creator.handle, platform: creator.platform },
      defaults: {
        vibe_sentence: creator.vibe_sentence,
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
        series_id: seriesId || null,
        feed_layer: feedLayer || 'real_world',
      },
    });
    saved = record;
    if (!created) {
      await record.update({
        vibe_sentence: creator.vibe_sentence,
        display_name: profile.display_name,
        archetype: profile.archetype,
        content_persona: profile.content_persona,
        full_profile: profile,
        lala_relevance_score: profile.lala_relevance_score,
        status: 'generated',
        feed_layer: feedLayer || record.feed_layer || 'real_world',
      });
    }

    // Auto-assign ALL characters as followers via intelligent follow engine
    if (saved) {
      await autoAssignAllFollowers(db, saved.id, {
        ...profile,
        platform: creator.platform,
      });
    }
  }

  return {
    handle: creator.handle,
    platform: creator.platform,
    status: 'success',
    profile_id: saved?.id || null,
    lala_score: profile.lala_relevance_score || 0,
    archetype: profile.archetype || null,
  };
}

// ── Concurrency limiter for parallel generation (#2) ─────────────────────────
async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

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

    // If structured parsing found nothing, fall back to AI extraction
    if (creators.length === 0 && lines.length > 0) {
      try {
        const aiExtraction = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Extract every social media creator or person mention from the following pasted text.
For each creator/person found, extract:
- handle (username, @handle, or invent a plausible one from their name)
- platform (best guess from: ${PLATFORMS.join(', ')}) — default to "instagram" if unclear
- vibe_sentence (one-line description of who they are / what they do based on the text)

Return ONLY a valid JSON array:
[{"handle":"username","platform":"instagram","vibe_sentence":"..."}]

If no creators can be found, return an empty array: []

TEXT:
${text.slice(0, 20000)}`,
          }],
        });

        const content = aiExtraction.content[0].text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          const aiCreators = JSON.parse(match[0].replace(/,\s*([\]}])/g, '$1'));
          creators.push(...aiCreators.map(c => ({
            ...c,
            platform: PLATFORMS.includes(c.platform) ? c.platform : 'instagram',
          })));
        }
        // Clear structured parse errors since we fell back to AI
        errors.length = 0;
      } catch (aiErr) {
        console.error('AI paste fallback failed:', aiErr.message);
        // Keep original structured parse errors
      }
    }

    return res.json({ creators, errors, total_lines: lines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /parse-csv — CSV/TSV spreadsheet import (#3) ────────────────────────
router.post('/parse-csv', optionalAuth, async (req, res) => {
  try {
    const { text, column_map } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'No CSV data provided' });

    // Detect delimiter: tab or comma
    const firstLine = text.split('\n')[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row and at least one data row' });

    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

    // Column mapping — user can specify or we auto-detect
    const map = column_map || {};
    const handleCol   = map.handle   || headers.find(h => /handle|username|user|screen.?name|creator|account/i.test(h)) || headers[0];
    const platformCol = map.platform || headers.find(h => /platform|network|site|channel/i.test(h));
    const vibeCol     = map.vibe     || headers.find(h => /vibe|description|bio|notes?|about|summary/i.test(h));

    const handleIdx   = headers.indexOf(handleCol);
    const platformIdx = platformCol ? headers.indexOf(platformCol) : -1;
    const vibeIdx     = vibeCol ? headers.indexOf(vibeCol) : -1;

    if (handleIdx === -1) {
      return res.status(400).json({ error: 'Could not identify a handle/username column', detected_headers: headers });
    }

    const creators = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV field split (handles quoted fields with commas)
      const fields = [];
      let current = '';
      let inQuotes = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === delimiter && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      fields.push(current.trim());

      const handle = (fields[handleIdx] || '').replace(/^@/, '').trim();
      if (!handle) { errors.push({ line: lines[i], reason: 'Empty handle' }); continue; }

      let platform = platformIdx >= 0 ? (fields[platformIdx] || '').toLowerCase().trim() : 'instagram';
      if (!PLATFORMS.includes(platform)) platform = 'instagram';

      const vibe = vibeIdx >= 0 ? (fields[vibeIdx] || '').trim() : '';

      creators.push({ handle, platform, vibe_sentence: vibe || `Imported from spreadsheet row ${i}` });
    }

    return res.json({
      creators,
      errors,
      total_rows: lines.length - 1,
      detected_columns: { handle: handleCol, platform: platformCol, vibe: vibeCol },
      all_headers: headers,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /parse-file ─────────────────────────────────────────────────────────
router.post('/parse-file', optionalAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext  = path.extname(req.file.originalname).toLowerCase();

    // CSV/TSV files handled by parse-csv logic directly
    if (ext === '.csv' || ext === '.tsv') {
      const rawText = req.file.buffer.toString('utf-8');
      // Forward internally to CSV parser
      const delimiter = ext === '.tsv' ? '\t' : ',';
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV needs a header row and at least one data row' });
      }
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      const handleCol = headers.find(h => /handle|username|user|screen.?name|creator|account/i.test(h)) || headers[0];
      const platformCol = headers.find(h => /platform|network|site|channel/i.test(h));
      const vibeCol = headers.find(h => /vibe|description|bio|notes?|about|summary/i.test(h));
      const handleIdx = headers.indexOf(handleCol);
      const platformIdx = platformCol ? headers.indexOf(platformCol) : -1;
      const vibeIdx = vibeCol ? headers.indexOf(vibeCol) : -1;

      const creators = [];
      for (let i = 1; i < lines.length; i++) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === delimiter && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
          current += ch;
        }
        fields.push(current.trim());
        const handle = (fields[handleIdx] || '').replace(/^@/, '').trim();
        if (!handle) continue;
        let platform = platformIdx >= 0 ? (fields[platformIdx] || '').toLowerCase().trim() : 'instagram';
        if (!PLATFORMS.includes(platform)) platform = 'instagram';
        const vibe = vibeIdx >= 0 ? (fields[vibeIdx] || '').trim() : '';
        creators.push({ handle, platform, vibe_sentence: vibe || `Imported from ${req.file.originalname} row ${i}` });
      }
      return res.json({
        creators,
        extraction_notes: `Parsed ${creators.length} creator(s) from ${req.file.originalname} (CSV)`,
        file_name: req.file.originalname,
      });
    }

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

    // Chunk the document so we scan ALL content, not just the first 12K chars
    const CHUNK_SIZE    = 12000;
    const CHUNK_OVERLAP = 500;
    const chunks = [];

    if (rawText.length <= CHUNK_SIZE) {
      chunks.push(rawText);
    } else {
      let pos = 0;
      while (pos < rawText.length) {
        chunks.push(rawText.slice(pos, pos + CHUNK_SIZE));
        pos += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    }

    let allCreators = [];
    let extractionNotes = '';
    let chunkFailures = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const extraction = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Extract every social media creator, person, or character mention from the following text.
For each one found, extract:
- handle (username or name used — if no handle given, invent a plausible one from name/description)
- platform (best guess from: ${PLATFORMS.join(', ')}) — default to "instagram" if unclear
- vibe_sentence (one-line description of who they are / what they do)
- source_text (the text that informed your extraction)

Be thorough — extract EVERY person or creator mentioned, even brief mentions.
Return ONLY a valid JSON array:
[{"handle":"username","platform":"instagram","vibe_sentence":"...","source_text":"..."}]

If none found, return: []

TEXT (chunk ${i + 1} of ${chunks.length}):
${chunks[i]}`,
          }],
        });

        const content = extraction.content[0].text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          let chunkCreators = JSON.parse(match[0].replace(/,\s*([\]}])/g, '$1'));
          chunkCreators = chunkCreators.map(c => ({
            ...c,
            platform: PLATFORMS.includes(c.platform) ? c.platform : 'instagram',
          }));
          allCreators.push(...chunkCreators);
        }
      } catch (chunkErr) {
        console.warn(`File parse: chunk ${i + 1}/${chunks.length} failed:`, chunkErr.message);
        chunkFailures++;
      }
    }

    // Deduplicate by handle (case-insensitive)
    const seen = new Set();
    allCreators = allCreators.filter(c => {
      const key = c.handle.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (chunkFailures > 0) {
      extractionNotes = `Extracted ${allCreators.length} creator(s) from ${req.file.originalname} (${chunkFailures} of ${chunks.length} sections had extraction issues)`;
    } else {
      extractionNotes = `Extracted ${allCreators.length} creator(s) from ${req.file.originalname}` +
        (chunks.length > 1 ? ` (scanned ${chunks.length} sections)` : '');
    }

    return res.json({
      creators: allCreators,
      extraction_notes: extractionNotes,
      file_name: req.file.originalname,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /generate — Sync with parallel concurrency (#2, #4) ─────────────────
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { creators, series_id, character_context, character_key, feed_layer, concurrency } = req.body;
    if (!Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ error: 'No creators provided' });
    }
    if (creators.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 creators per batch' });
    }

    const db = getModels();
    const CONCURRENCY = Math.min(Math.max(concurrency || 3, 1), 5);

    const tasks = creators.map(c => async () => {
      try {
        return await generateSingleProfile(c, { db, seriesId: series_id, characterContext: character_context, characterKey: character_key, feedLayer: feed_layer });
      } catch (creatorErr) {
        console.error(`[bulk-generate] Failed for @${c.handle}:`, creatorErr.message);
        const errInfo = categorizeError(creatorErr);
        return {
          handle: c.handle,
          platform: c.platform,
          status: 'failed',
          error: creatorErr.message || 'Unknown error',
          error_category: errInfo.category,
          error_label: errInfo.label,
          retryable: errInfo.retryable,
        };
      }
    });

    const results = await runWithConcurrency(tasks, CONCURRENCY);

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

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND JOB QUEUE — Submit jobs and process in the background
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /generate-job ───────────────────────────────────────────────────────
// Create a background job for bulk generation — returns immediately
router.post('/generate-job', optionalAuth, async (req, res) => {
  try {
    const { creators, series_id, character_context, character_key, feed_layer, concurrency } = req.body;
    if (!Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ error: 'No creators provided' });
    }
    if (creators.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 creators per job' });
    }

    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(500).json({ error: 'BulkImportJob model not available — run migration first' });
    }

    const job = await db.BulkImportJob.create({
      status: 'pending',
      total: creators.length,
      completed: 0,
      failed: 0,
      candidates: creators,
      results: [],
      character_context: character_context ? { ...character_context, feed_layer: feed_layer || 'real_world' } : { feed_layer: feed_layer || 'real_world' },
      character_key: character_key || null,
      series_id: series_id || null,
    });

    // Start processing in background (non-blocking)
    processJobInBackground(job.id, Math.min(Math.max(concurrency || 3, 1), 5));

    return res.json({
      job_id: job.id,
      status: 'pending',
      total: creators.length,
      message: `Job #${job.id} queued. ${creators.length} profiles will be generated in the background.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /jobs ────────────────────────────────────────────────────────────────
// List recent import jobs
router.get('/jobs', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.json({ jobs: [] });
    }
    const jobs = await db.BulkImportJob.findAll({
      order: [['created_at', 'DESC']],
      limit: 20,
      attributes: ['id', 'status', 'total', 'completed', 'failed', 'character_key', 'created_at', 'started_at', 'completed_at'],
    });
    return res.json({ jobs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /jobs/:id ────────────────────────────────────────────────────────────
// Get progress for a specific job
router.get('/jobs/:id', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(404).json({ error: 'Not available' });
    }
    const job = await db.BulkImportJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /jobs/:id/stream — SSE endpoint for real-time progress (#1) ──────────
router.get('/jobs/:id/stream', optionalAuth, (req, res) => {
  const jobId = String(req.params.id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: {"job_id":${jobId}}\n\n`);

  if (!jobSSEClients.has(jobId)) jobSSEClients.set(jobId, new Set());
  jobSSEClients.get(jobId).add(res);

  // Send current state immediately
  const db = getModels();
  if (db && db.BulkImportJob) {
    db.BulkImportJob.findByPk(req.params.id).then(job => {
      if (job) res.write(`event: status\ndata: ${JSON.stringify({ job })}\n\n`);
    }).catch(e => console.warn('[social-bulk] initial job status send error:', e?.message));
  }

  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { clearInterval(keepAlive); }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const clients = jobSSEClients.get(jobId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) jobSSEClients.delete(jobId);
    }
  });
});

// ── POST /jobs/:id/cancel — Cancel a running job (#5) ───────────────────────
router.post('/jobs/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(404).json({ error: 'Not available' });
    }
    const job = await db.BulkImportJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return res.status(400).json({ error: `Job is already ${job.status}` });
    }

    cancelledJobs.add(String(job.id));
    await job.update({ status: 'cancelled', error_message: 'Cancelled by user', completed_at: new Date() });
    notifyJobSSE(job.id, 'cancelled', { job_id: job.id });
    return res.json({ success: true, message: `Job #${job.id} cancelled` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Background Job Processor — parallel + SSE + cancellation (#1,#2,#4,#5) ──
async function processJobInBackground(jobId, concurrency = 3) {
  // Defer to next tick so the HTTP response goes out first
  setImmediate(async () => {
    const db = getModels();
    if (!db || !db.BulkImportJob) return;

    let job;
    try {
      job = await db.BulkImportJob.findByPk(jobId);
      if (!job || job.status !== 'pending') return;

      await job.update({ status: 'processing', started_at: new Date() });
      notifyJobSSE(jobId, 'started', { job_id: jobId, total: job.total });

      const candidates = job.candidates || [];
      const results = [];
      let completedCount = 0;
      let failedCount = 0;

      // Build tasks for concurrent processing
      const tasks = candidates.map((c, idx) => async () => {
        // Check cancellation before starting (#5)
        if (cancelledJobs.has(String(jobId))) {
          return { handle: c.handle, platform: c.platform, status: 'failed', error: 'Job cancelled', error_category: 'cancelled', skipped: true };
        }

        try {
          const result = await generateSingleProfile(c, {
            db,
            seriesId: job.series_id,
            characterContext: job.character_context,
            characterKey: job.character_key,
            feedLayer: job.character_context?.feed_layer || 'real_world',
          });
          completedCount++;

          // SSE: push each completed profile in real-time (#1, #10)
          notifyJobSSE(jobId, 'profile_complete', {
            index: idx,
            result,
            completed: completedCount,
            failed: failedCount,
            total: candidates.length,
          });

          return result;
        } catch (creatorErr) {
          failedCount++;
          const errInfo = categorizeError(creatorErr);
          const failResult = {
            handle: c.handle,
            platform: c.platform,
            status: 'failed',
            error: creatorErr.message || 'Unknown error',
            error_category: errInfo.category,
            error_label: errInfo.label,
            retryable: errInfo.retryable,
          };

          notifyJobSSE(jobId, 'profile_failed', {
            index: idx,
            result: failResult,
            completed: completedCount,
            failed: failedCount,
            total: candidates.length,
          });

          return failResult;
        }
      });

      // Run with concurrency (#2)
      const allResults = await runWithConcurrency(tasks, concurrency);
      results.push(...allResults.filter(Boolean));

      // Finalize counts from actual results
      completedCount = results.filter(r => r.status === 'success').length;
      failedCount = results.filter(r => r.status === 'failed').length;

      // Check if we were cancelled mid-run
      const finalStatus = cancelledJobs.has(String(jobId)) ? 'cancelled' : 'completed';
      cancelledJobs.delete(String(jobId));

      await job.update({
        status: finalStatus,
        completed: completedCount,
        failed: failedCount,
        results,
        completed_at: new Date(),
      });

      notifyJobSSE(jobId, 'done', {
        job_id: jobId,
        status: finalStatus,
        completed: completedCount,
        failed: failedCount,
        total: candidates.length,
        results,
      });

      // Close all SSE connections for this job
      const clients = jobSSEClients.get(String(jobId));
      if (clients) {
        for (const client of clients) {
          try { client.end(); } catch { /* intentionally empty */ }
        }
        jobSSEClients.delete(String(jobId));
      }

      console.log(`✅ Bulk job #${jobId} ${finalStatus}: ${completedCount} succeeded, ${failedCount} failed out of ${candidates.length}`);
    } catch (err) {
      console.error(`❌ Bulk job #${jobId} fatal error:`, err.message);
      cancelledJobs.delete(String(jobId));
      if (job) {
        await job.update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date(),
        }).catch(e => console.warn('[social-bulk] job status update error:', e?.message));
      }
      notifyJobSSE(jobId, 'job_error', { job_id: jobId, error: err.message });
    }
  });
}

module.exports = router;
module.exports.notifyJobSSE = notifyJobSSE;
module.exports.jobSSEClients = jobSSEClients;

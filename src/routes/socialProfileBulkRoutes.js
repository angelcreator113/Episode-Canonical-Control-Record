// ─────────────────────────────────────────────────────────────────────────────
// socialProfileBulkRoutes.js — The Feed: Bulk Import for Social Profiles
//
// Routes:
// POST /parse-paste       — Parse pasted text into candidate creators
// POST /parse-file        — Parse uploaded file (PDF, Word, TXT, MD) into creators
// POST /generate          — Batch-generate profiles from parsed candidates (sync)
// POST /generate-job      — Queue a background bulk generation job
// GET  /jobs              — List recent jobs
// GET  /jobs/:id          — Get job status/progress
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const { buildGenerationPrompt, autoAssignFollower } = require('./socialProfileRoutes');

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

// Retry helper for Anthropic API calls (handles rate limits + transient errors)
async function callAnthropicWithRetry(requestFn, { retries = 2, baseDelay = 5000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        requestFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI call timed out after 120s')), 120000)),
      ]);
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 529 || err.status >= 500
        || err.message?.includes('overloaded') || err.message?.includes('rate')
        || err.message?.includes('timeout') || err.message?.includes('ECONNRESET');
      if (isRetryable && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[bulk-generate] Anthropic API error (attempt ${attempt + 1}/${retries + 1}): ${err.message}. Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
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
          model: 'claude-sonnet-4-20250514',
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
          model: 'claude-sonnet-4-20250514',
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

// ── POST /generate ───────────────────────────────────────────────────────────
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { creators, series_id, character_context, character_key } = req.body;
    if (!Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ error: 'No creators provided' });
    }
    if (creators.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 creators per batch' });
    }

    const db = getModels();

    // Process creators sequentially to avoid overwhelming Anthropic API / small EC2
    const results = [];
    for (const c of creators) {
      try {
        const prompt = buildGenerationPrompt(c.handle, c.platform, c.vibe_sentence, character_context);
        const aiRes = await callAnthropicWithRetry(() =>
          client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            messages: [{ role: 'user', content: prompt }],
          })
        );

        const text = aiRes.content[0].text;
        const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI did not return valid JSON');

        const fixedJson = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');

        let profile;
        try {
          profile = JSON.parse(fixedJson);
        } catch (parseErr) {
          console.error(`JSON parse failed for @${c.handle}:`, parseErr.message, '\nRaw excerpt:', fixedJson.slice(0, 300));
          throw new Error(`Profile JSON parse failed: ${parseErr.message}`);
        }

        // Save to DB — use findOrCreate to prevent duplicates on retry
        let saved = null;
        if (db && db.SocialProfile) {
          const [record, created] = await db.SocialProfile.findOrCreate({
            where: { handle: c.handle, platform: c.platform },
            defaults: {
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
            },
          });
          saved = record;
          if (!created) {
            await record.update({
              vibe_sentence: c.vibe_sentence,
              display_name: profile.display_name,
              archetype: profile.archetype,
              content_persona: profile.content_persona,
              full_profile: profile,
              lala_relevance_score: profile.lala_relevance_score,
              status: 'generated',
            });
          }
        }

        results.push({
          handle: c.handle,
          platform: c.platform,
          status: 'success',
          profile_id: saved?.id || null,
          lala_score: profile.lala_relevance_score || 0,
        });

        // Auto-assign protagonist as follower
        if (saved && character_key) {
          await autoAssignFollower(db, saved.id, character_context, character_key);
        }
      } catch (creatorErr) {
        console.error(`[bulk-generate] Failed for @${c.handle}:`, creatorErr.message);
        results.push({
          handle: c.handle,
          platform: c.platform,
          status: 'failed',
          error: creatorErr.message || 'Unknown error',
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

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND JOB QUEUE — Submit jobs and process in the background
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /generate-job ───────────────────────────────────────────────────────
// Create a background job for bulk generation — returns immediately
router.post('/generate-job', optionalAuth, async (req, res) => {
  try {
    const { creators, series_id, character_context, character_key } = req.body;
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
      character_context: character_context || null,
      character_key: character_key || null,
      series_id: series_id || null,
    });

    // Start processing in background (non-blocking)
    processJobInBackground(job.id);

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
// Get progress for a specific job (lightweight — excludes bulky candidates/results)
router.get('/jobs/:id', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(404).json({ error: 'Not available' });
    }
    const job = await db.BulkImportJob.findByPk(req.params.id, {
      attributes: ['id', 'status', 'total', 'completed', 'failed', 'error_message',
                   'character_key', 'created_at', 'started_at', 'completed_at'],
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /jobs/:id/cancel ───────────────────────────────────────────────────
// Cancel a stuck or running job — marks it failed so the processor loop exits
router.post('/jobs/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(404).json({ error: 'Not available' });
    }
    const job = await db.BulkImportJob.findByPk(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return res.json({ job, message: 'Job already finished' });
    }

    await job.update({
      status: 'failed',
      error_message: `Cancelled by user at ${job.completed || 0}/${job.total} (${job.failed || 0} previously failed)`,
      completed_at: new Date(),
    });

    // Signal the in-process loop to stop
    cancelledJobs.add(job.id);

    return res.json({ job: await job.reload(), message: 'Job cancelled' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /jobs/:id/retry ────────────────────────────────────────────────────
// Retry remaining unprocessed candidates from a failed/cancelled job
router.post('/jobs/:id/retry', optionalAuth, async (req, res) => {
  try {
    const db = getModels();
    if (!db || !db.BulkImportJob) {
      return res.status(404).json({ error: 'Not available' });
    }
    const oldJob = await db.BulkImportJob.findByPk(req.params.id);
    if (!oldJob) return res.status(404).json({ error: 'Job not found' });

    if (oldJob.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed jobs can be retried' });
    }

    // Figure out which candidates weren't successfully processed
    const doneHandles = new Set(
      (oldJob.results || []).filter(r => r.status === 'success').map(r => `${r.handle}::${r.platform}`)
    );
    const remaining = (oldJob.candidates || []).filter(c => !doneHandles.has(`${c.handle}::${c.platform}`));

    if (remaining.length === 0) {
      return res.json({ message: 'All candidates were already processed — nothing to retry' });
    }

    const newJob = await db.BulkImportJob.create({
      status: 'pending',
      total: remaining.length,
      completed: 0,
      failed: 0,
      candidates: remaining,
      results: [],
      character_context: oldJob.character_context,
      character_key: oldJob.character_key,
      series_id: oldJob.series_id,
    });

    processJobInBackground(newJob.id);

    return res.json({
      job_id: newJob.id,
      status: 'pending',
      total: remaining.length,
      skipped: oldJob.candidates.length - remaining.length,
      message: `Retry job #${newJob.id} queued: ${remaining.length} remaining profiles.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── In-memory cancellation signal ───────────────────────────────────────────
const cancelledJobs = new Set();

// ── Background Job Processor ─────────────────────────────────────────────────
// Processes a single job — called non-blocking via setImmediate
async function processJobInBackground(jobId) {
  // Defer to next tick so the HTTP response goes out first
  setImmediate(async () => {
    const db = getModels();
    if (!db || !db.BulkImportJob) return;

    let job;
    try {
      job = await db.BulkImportJob.findByPk(jobId);
      if (!job || job.status !== 'pending') return;

      await job.update({ status: 'processing', started_at: new Date() });

      const candidates = job.candidates || [];
      const results = [];
      let completedCount = 0;
      let failedCount = 0;

      for (const c of candidates) {
        // Check for cancellation signal
        if (cancelledJobs.has(jobId)) {
          cancelledJobs.delete(jobId);
          console.log(`⛔ Bulk job #${jobId} cancelled by user at ${completedCount}/${candidates.length}`);
          return; // Job already marked failed by cancel endpoint
        }

        try {
          const prompt = buildGenerationPrompt(c.handle, c.platform, c.vibe_sentence, job.character_context);
          const aiRes = await callAnthropicWithRetry(() =>
            client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 3000,
              messages: [{ role: 'user', content: prompt }],
            }),
            { retries: 2, baseDelay: 5000 }
          );

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

          // Save to DB
          let saved = null;
          if (db.SocialProfile) {
            const [record, created] = await db.SocialProfile.findOrCreate({
              where: { handle: c.handle, platform: c.platform },
              defaults: {
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
                series_id: job.series_id || null,
              },
            });
            saved = record;
            if (!created) {
              await record.update({
                vibe_sentence: c.vibe_sentence,
                display_name: profile.display_name,
                archetype: profile.archetype,
                content_persona: profile.content_persona,
                full_profile: profile,
                lala_relevance_score: profile.lala_relevance_score,
                status: 'generated',
              });
            }

            // Auto-assign protagonist as follower
            if (saved && job.character_key) {
              await autoAssignFollower(db, saved.id, job.character_context, job.character_key);
            }
          }

          completedCount++;
          results.push({
            handle: c.handle,
            platform: c.platform,
            status: 'success',
            profile_id: saved?.id || null,
            lala_score: profile.lala_relevance_score || 0,
          });
        } catch (creatorErr) {
          failedCount++;
          results.push({
            handle: c.handle,
            platform: c.platform,
            status: 'failed',
            error: creatorErr.message || 'Unknown error',
          });
        }

        // Update progress after each creator (so polling can see live progress)
        await job.update({
          completed: completedCount,
          failed: failedCount,
          results,
        });

        // Pause between API calls to respect rate limits
        if (completedCount + failedCount < candidates.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      await job.update({
        status: 'completed',
        completed: completedCount,
        failed: failedCount,
        results,
        completed_at: new Date(),
      });

      console.log(`✅ Bulk job #${jobId} completed: ${completedCount} succeeded, ${failedCount} failed out of ${candidates.length}`);
    } catch (err) {
      console.error(`❌ Bulk job #${jobId} fatal error:`, err.message);
      if (job) {
        await job.update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date(),
        }).catch(() => {});
      }
    }
  });
}

module.exports = router;

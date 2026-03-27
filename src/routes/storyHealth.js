/**
 * storyHealth.js — Story Health Dashboard + Cross-System Search + Version History + Therapy Story Suggestions
 *
 * Mounts under /api/v1/story-health
 *
 * Story Health Dashboard:
 *   GET  /dashboard                        — aggregate metrics (quality, velocity, arc %, thread resolution)
 *
 * Cross-System Search:
 *   GET  /search?q=...                     — search across characters, stories, locations, threads, timeline events
 *
 * Version History:
 *   GET  /versions/chapter/:chapterId      — list version snapshots for a chapter
 *   POST /versions/chapter/:chapterId      — save a version snapshot
 *
 * Therapy Story Suggestions:
 *   GET  /therapy-suggestions/:characterKey — suggest stories based on therapy state
 *
 * Thread Awareness:
 *   GET  /threads-for-story/:storyNumber   — which threads a story might advance
 */

'use strict';

const express = require('express');
const router = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORY HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/dashboard', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ error: 'Models not loaded' });
    const { sequelize } = db;

    // 1. Story stats
    const [storyStats] = await sequelize.query(`
      SELECT
        COUNT(*)::int AS total_stories,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_stories,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_stories,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_stories,
        COALESCE(SUM(word_count), 0)::int AS total_words,
        COALESCE(AVG(word_count), 0)::int AS avg_words_per_story
      FROM storyteller_stories
    `);

    // 2. Stories per week (velocity) — last 8 weeks
    const [velocity] = await sequelize.query(`
      SELECT
        date_trunc('week', created_at) AS week,
        COUNT(*)::int AS stories_created,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS stories_approved
      FROM storyteller_stories
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY 1
      ORDER BY 1
    `);

    // 3. Phase completion (arc progress)
    const [phaseStats] = await sequelize.query(`
      SELECT
        phase,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
      FROM storyteller_stories
      WHERE phase IS NOT NULL
      GROUP BY phase
    `);

    // 4. Character arc completion — stories per character
    const [charArcs] = await sequelize.query(`
      SELECT
        character_key,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COALESCE(SUM(word_count), 0)::int AS words
      FROM storyteller_stories
      GROUP BY character_key
      ORDER BY approved DESC
      LIMIT 20
    `);

    // 5. Thread resolution (from story_threads table if exists)
    let threadStats = { total: 0, resolved: 0, active: 0 };
    try {
      const [threads] = await sequelize.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active
        FROM story_threads
      `);
      if (threads?.[0]) threadStats = threads[0];
    } catch { /* table may not exist */ }

    // 6. Evaluation scores (from story evaluations)
    let evalStats = { avg_score: 0, evaluated: 0 };
    try {
      const [evals] = await sequelize.query(`
        SELECT
          COALESCE(AVG((evaluation->>'overall_score')::numeric), 0)::numeric(4,1) AS avg_score,
          COUNT(*)::int AS evaluated
        FROM storyteller_stories
        WHERE evaluation IS NOT NULL AND evaluation->>'overall_score' IS NOT NULL
      `);
      if (evals?.[0]) evalStats = evals[0];
    } catch { /* evaluation column may not exist */ }

    // 7. Recent activity
    const [recentStories] = await sequelize.query(`
      SELECT id, title, character_key, status, word_count, phase, created_at, updated_at
      FROM storyteller_stories
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    res.json({
      stories: storyStats?.[0] || {},
      velocity,
      phases: phaseStats || [],
      characterArcs: charArcs || [],
      threads: threadStats,
      evaluation: evalStats,
      recentActivity: recentStories || [],
    });
  } catch (err) {
    console.error('Story Health Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-SYSTEM SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/search', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ results: [] });
    const { sequelize } = db;

    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ results: [] });

    // Parameterized search pattern
    const pattern = `%${q}%`;

    const results = [];

    // Search Characters
    try {
      const [chars] = await sequelize.query(`
        SELECT id, display_name, character_key, role_type, 'character' AS result_type
        FROM registry_characters
        WHERE display_name ILIKE $1 OR character_key ILIKE $1
        LIMIT 8
      `, { bind: [pattern] });
      results.push(...(chars || []));
    } catch { /* table may not exist */ }

    // Search Stories
    try {
      const [stories] = await sequelize.query(`
        SELECT id, title, character_key, status, 'story' AS result_type
        FROM storyteller_stories
        WHERE title ILIKE $1 OR text ILIKE $1
        LIMIT 8
      `, { bind: [pattern] });
      results.push(...(stories || []));
    } catch { /* table may not exist */ }

    // Search Locations
    try {
      const [locations] = await sequelize.query(`
        SELECT id, name, type, 'location' AS result_type
        FROM world_locations
        WHERE name ILIKE $1 OR description ILIKE $1
        LIMIT 5
      `, { bind: [pattern] });
      results.push(...(locations || []));
    } catch { /* table may not exist */ }

    // Search Story Threads
    try {
      const [threads] = await sequelize.query(`
        SELECT id, title, thread_type, status, 'thread' AS result_type
        FROM story_threads
        WHERE title ILIKE $1
        LIMIT 5
      `, { bind: [pattern] });
      results.push(...(threads || []));
    } catch { /* table may not exist */ }

    // Search Timeline Events
    try {
      const [events] = await sequelize.query(`
        SELECT id, title, event_type, 'event' AS result_type
        FROM timeline_events
        WHERE title ILIKE $1 OR description ILIKE $1
        LIMIT 5
      `, { bind: [pattern] });
      results.push(...(events || []));
    } catch { /* table may not exist */ }

    // Search Books
    try {
      const [books] = await sequelize.query(`
        SELECT id, title, 'book' AS result_type
        FROM storyteller_books
        WHERE title ILIKE $1
        LIMIT 5
      `, { bind: [pattern] });
      results.push(...(books || []));
    } catch { /* table may not exist */ }

    res.json({ results, query: q });
  } catch (err) {
    console.error('Cross-system search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION HISTORY — Chapter version snapshots
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/versions/chapter/:chapterId', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ versions: [] });
    const { sequelize } = db;

    // Ensure version table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chapter_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id UUID NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        content TEXT,
        word_count INT DEFAULT 0,
        snapshot_reason VARCHAR(100) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [versions] = await sequelize.query(`
      SELECT id, version_number, word_count, snapshot_reason, created_at
      FROM chapter_versions
      WHERE chapter_id = $1
      ORDER BY version_number DESC
    `, { bind: [req.params.chapterId] });

    res.json({ versions });
  } catch (err) {
    console.error('Version history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/versions/chapter/:chapterId', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.status(500).json({ error: 'Models not loaded' });
    const { sequelize } = db;

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chapter_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id UUID NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        content TEXT,
        word_count INT DEFAULT 0,
        snapshot_reason VARCHAR(100) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { content, reason } = req.body;

    // Get next version number
    const [existing] = await sequelize.query(`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_num
      FROM chapter_versions WHERE chapter_id = $1
    `, { bind: [req.params.chapterId] });

    const nextNum = existing?.[0]?.next_num || 1;
    const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

    const [created] = await sequelize.query(`
      INSERT INTO chapter_versions (chapter_id, version_number, content, word_count, snapshot_reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, { bind: [req.params.chapterId, nextNum, content, wordCount, reason || 'manual'] });

    res.json({ version: created?.[0] });
  } catch (err) {
    console.error('Save version error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/versions/:versionId/content', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.status(500).json({ error: 'Models not loaded' });
    const { sequelize } = db;

    const [rows] = await sequelize.query(`
      SELECT * FROM chapter_versions WHERE id = $1
    `, { bind: [req.params.versionId] });

    if (!rows?.[0]) return res.status(404).json({ error: 'Version not found' });
    res.json({ version: rows[0] });
  } catch (err) {
    console.error('Get version content error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// THERAPY STORY SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/therapy-suggestions/:characterKey', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ suggestions: [] });
    const { sequelize } = db;

    const charKey = req.params.characterKey;

    // Get character's therapy profile
    let therapyProfile = null;
    try {
      const [profiles] = await sequelize.query(`
        SELECT tp.*
        FROM character_therapy_profiles tp
        JOIN registry_characters rc ON rc.id = tp.character_id
        WHERE rc.character_key = $1
        LIMIT 1
      `, { bind: [charKey] });
      therapyProfile = profiles?.[0] || null;
    } catch { /* table may not exist */ }

    // Get character's approved stories (to know what's already written)
    const [existingStories] = await sequelize.query(`
      SELECT story_number, title, phase, status
      FROM storyteller_stories
      WHERE character_key = $1 AND status = 'approved'
      ORDER BY story_number
    `, { bind: [charKey] });

    // Get active threads involving this character
    let activeThreads = [];
    try {
      const [threads] = await sequelize.query(`
        SELECT id, title, thread_type, status, description
        FROM story_threads
        WHERE character_keys::text ILIKE $1 AND status = 'active'
        LIMIT 10
      `, { bind: [`%${charKey}%`] });
      activeThreads = threads || [];
    } catch { /* table may not exist */ }

    // Get unresolved tensions
    let tensions = [];
    try {
      const [tensionRows] = await sequelize.query(`
        SELECT id, title, severity, status
        FROM world_tensions
        WHERE (character_a = $1 OR character_b = $1) AND status != 'resolved'
        LIMIT 5
      `, { bind: [charKey] });
      tensions = tensionRows || [];
    } catch { /* table may not exist */ }

    // Build suggestions based on therapy + threads + tensions
    const suggestions = [];

    if (therapyProfile) {
      const _known = typeof therapyProfile.known === 'string' ? JSON.parse(therapyProfile.known || '{}') : (therapyProfile.known || {});
      const sensed = typeof therapyProfile.sensed === 'string' ? JSON.parse(therapyProfile.sensed || '{}') : (therapyProfile.sensed || {});

      if (therapyProfile.primary_defense) {
        suggestions.push({
          type: 'therapy',
          priority: 'high',
          title: `Explore ${charKey}'s defense mechanism`,
          description: `Primary defense: ${therapyProfile.primary_defense}. Write a story that challenges this pattern.`,
          source: 'therapy_profile',
        });
      }

      if (sensed && Object.keys(sensed).length > 0) {
        const sensedKeys = Object.keys(sensed).slice(0, 2);
        suggestions.push({
          type: 'therapy',
          priority: 'medium',
          title: `Surface the unseen`,
          description: `Therapist senses: ${sensedKeys.join(', ')}. Create a moment where these hidden patterns become visible.`,
          source: 'therapy_sensed',
        });
      }
    }

    for (const thread of activeThreads.slice(0, 3)) {
      suggestions.push({
        type: 'thread',
        priority: 'medium',
        title: `Advance: ${thread.title}`,
        description: `Active ${thread.thread_type} thread. Write a story that moves this forward.`,
        threadId: thread.id,
        source: 'story_thread',
      });
    }

    for (const tension of tensions.slice(0, 2)) {
      suggestions.push({
        type: 'tension',
        priority: tension.severity === 'critical' ? 'high' : 'medium',
        title: `Confront tension: ${tension.title}`,
        description: `Severity: ${tension.severity}. This unresolved tension demands attention.`,
        source: 'world_tension',
      });
    }

    // If character has < 10 approved stories, suggest filling gaps
    const approvedCount = (existingStories || []).length;
    if (approvedCount < 10) {
      suggestions.push({
        type: 'arc',
        priority: 'low',
        title: `Build the foundation`,
        description: `Only ${approvedCount} approved stories. Focus on establishment phase stories to lay groundwork.`,
        source: 'arc_progress',
      });
    }

    res.json({
      suggestions,
      therapyProfile: therapyProfile ? {
        primary_defense: therapyProfile.primary_defense,
        sessions_completed: therapyProfile.sessions_completed,
        emotional_state: therapyProfile.emotional_state,
      } : null,
      existingStoryCount: approvedCount,
      activeThreadCount: activeThreads.length,
      tensionCount: tensions.length,
    });
  } catch (err) {
    console.error('Therapy suggestions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// THREAD AWARENESS — Which threads a story advances
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/threads-for-story/:storyNumber', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ threads: [] });
    const { sequelize } = db;

    const charKey = req.query.character_key;
    if (!charKey) return res.json({ threads: [] });

    // Get active threads for this character
    let threads = [];
    try {
      const [threadRows] = await sequelize.query(`
        SELECT id, title, thread_type, status, description, character_keys
        FROM story_threads
        WHERE character_keys::text ILIKE $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 15
      `, { bind: [`%${charKey}%`] });
      threads = threadRows || [];
    } catch { /* table may not exist */ }

    res.json({ threads, characterKey: charKey, storyNumber: req.params.storyNumber });
  } catch (err) {
    console.error('Threads for story error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STORY SUGGESTIONS (AI sparks)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/story-sparks/:characterKey', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db) return res.json({ sparks: [] });
    const { sequelize } = db;

    const charKey = req.params.characterKey;
    const sparks = [];

    // 1. Find idle characters (no story in last 2 weeks)
    try {
      const [idle] = await sequelize.query(`
        SELECT rc.character_key, rc.display_name,
          MAX(ss.created_at) AS last_story_at
        FROM registry_characters rc
        LEFT JOIN storyteller_stories ss ON ss.character_key = rc.character_key
        WHERE rc.world = (SELECT world FROM registry_characters WHERE character_key = $1 LIMIT 1)
        GROUP BY rc.character_key, rc.display_name
        HAVING MAX(ss.created_at) < NOW() - INTERVAL '14 days' OR MAX(ss.created_at) IS NULL
        LIMIT 3
      `, { bind: [charKey] });
      for (const c of (idle || [])) {
        sparks.push({
          type: 'idle_character',
          title: `Reconnect with ${c.display_name}`,
          description: `${c.display_name} hasn't appeared in a story recently. Bring them back.`,
        });
      }
    } catch { /* ignore */ }

    // 2. Unresolved tensions
    try {
      const [tensions] = await sequelize.query(`
        SELECT id, title, severity
        FROM world_tensions
        WHERE (character_a = $1 OR character_b = $1) AND status != 'resolved'
        LIMIT 3
      `, { bind: [charKey] });
      for (const t of (tensions || [])) {
        sparks.push({
          type: 'tension',
          title: `Resolve: ${t.title}`,
          description: `Severity: ${t.severity}. This tension is begging for a story.`,
        });
      }
    } catch { /* ignore */ }

    // 3. Recent world events that haven't been written about
    try {
      const [events] = await sequelize.query(`
        SELECT id, title, event_type
        FROM timeline_events
        WHERE created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 3
      `, { bind: [] });
      for (const e of (events || [])) {
        sparks.push({
          type: 'world_event',
          title: `React to: ${e.title}`,
          description: `A ${e.event_type || 'world'} event that could shape ${charKey}'s story.`,
        });
      }
    } catch { /* ignore */ }

    // 4. Unfilled story slots
    try {
      const [filled] = await sequelize.query(`
        SELECT story_number FROM storyteller_stories
        WHERE character_key = $1
        ORDER BY story_number
      `, { bind: [charKey] });
      const filledNums = new Set((filled || []).map(r => r.story_number));
      const gaps = [];
      for (let i = 1; i <= 50; i++) {
        if (!filledNums.has(i) && gaps.length < 3) gaps.push(i);
      }
      if (gaps.length > 0) {
        sparks.push({
          type: 'gap',
          title: `Fill story gaps: #${gaps.join(', #')}`,
          description: `${50 - filledNums.size} story slots remain unfilled in the 50-story arc.`,
        });
      }
    } catch { /* ignore */ }

    res.json({ sparks, characterKey: charKey });
  } catch (err) {
    console.error('Story sparks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

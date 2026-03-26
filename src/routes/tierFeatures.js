/**
 * tierFeatures.js — Tier 1/2/3 Feature Routes
 *
 * Consolidates all new tier feature endpoints:
 *
 * TIER 1 — Story Quality:
 *   POST /continuity-check           — Cross-character continuity checker
 *   GET  /character-arc/:charId      — Character arc visualization data
 *
 * TIER 1 — Relationship Timeline:
 *   GET    /relationship-events/:relationshipId  — Get timeline events
 *   POST   /relationship-events                  — Create timeline event
 *   PUT    /relationship-events/:eventId         — Update timeline event
 *   DELETE /relationship-events/:eventId         — Delete timeline event
 *
 * TIER 2 — World:
 *   CRUD  /world-timeline            — World timeline/calendar
 *   CRUD  /world-locations           — Location database
 *   CRUD  /world-snapshots           — World-state snapshots
 *   POST  /franchise-guard-check     — Franchise guard integration
 *
 * TIER 3 — Workflow:
 *   GET   /pipeline                  — Pipeline status dashboard
 *   POST  /pipeline                  — Create/update pipeline entry
 *   CRUD  /story-revisions           — Revision history
 *   POST  /plot-hole-detection       — Plot hole detection
 *   CRUD  /story-threads             — Story thread tracking
 *   POST  /dead-thread-detection     — Dead thread detection
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../models');

const anthropic = new Anthropic();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1.1 — ENHANCED MEMORY INJECTION (already in storyEvaluationRoutes)
//   Enhanced version is injected via the existing loadStoryMemoriesForScene
//   This route provides the deep memory context endpoint for debugging/preview
// ═══════════════════════════════════════════════════════════════════════════

router.get('/deep-memory-context/:registryId', optionalAuth, async (req, res) => {
  try {
    const { registryId } = req.params;
    const { characters } = req.query; // comma-separated character_keys
    const characterKeys = characters ? characters.split(',') : [];
    if (!characterKeys.length) return res.json({ memories: [], relationships: [], events: [] });

    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id: registryId, character_key: characterKeys },
      attributes: ['id', 'character_key', 'display_name'],
    });
    if (!chars.length) return res.json({ memories: [], relationships: [], events: [] });

    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    // Load confirmed memories (all types, sorted by recency)
    const memories = await db.StorytellerMemory.findAll({
      where: { character_id: charIds, confirmed: true },
      order: [['created_at', 'DESC']],
      limit: 80,
    });

    // Load relationship events (turning points)
    const relEvents = await db.sequelize.query(
      `SELECT re.*, cr.character_id_a, cr.character_id_b,
              ca.display_name AS char_a_name, cb.display_name AS char_b_name
       FROM relationship_events re
       JOIN character_relationships cr ON cr.id = re.relationship_id
       JOIN registry_characters ca ON ca.id = cr.character_id_a
       JOIN registry_characters cb ON cb.id = cr.character_id_b
       WHERE (cr.character_id_a IN (:charIds) OR cr.character_id_b IN (:charIds))
       ORDER BY re.created_at DESC
       LIMIT 30`,
      { replacements: { charIds }, type: db.sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    // Load world timeline events involving these characters
    const worldEvents = await db.WorldTimelineEvent.findAll({
      where: db.sequelize.literal(
        `characters_involved ?| ARRAY[${charIds.map(id => `'${id}'`).join(',')}]`
      ),
      order: [['sort_order', 'ASC']],
      limit: 20,
    }).catch(() => []);

    return res.json({
      memories: memories.map(m => ({
        character: charMap[m.character_id] || m.character_id,
        type: m.type,
        statement: m.statement,
        confidence: m.confidence,
        tags: m.tags,
      })),
      relationship_events: relEvents,
      world_events: worldEvents,
    });
  } catch (err) {
    console.error('[deep-memory-context]', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to load memory context' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1.2 — STORY CONTINUITY CHECKER
// ═══════════════════════════════════════════════════════════════════════════

router.post('/continuity-check', optionalAuth, async (req, res) => {
  try {
    const { book_id: _book_id, chapter_id: _chapter_id, scene_text, characters_in_scene, registry_id } = req.body;
    if (!scene_text || !characters_in_scene?.length) {
      return res.status(400).json({ error: 'scene_text and characters_in_scene required' });
    }

    // Gather all confirmed memories for characters in the scene
    const chars = await db.RegistryCharacter.findAll({
      where: { registry_id, character_key: characters_in_scene },
      attributes: ['id', 'character_key', 'display_name'],
    });
    const charIds = chars.map(c => c.id);
    const charMap = {};
    chars.forEach(c => { charMap[c.id] = c.display_name || c.character_key; });

    const memories = await db.StorytellerMemory.findAll({
      where: { character_id: charIds, confirmed: true },
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    // Build knowledge state per character
    const knowledgeByChar = {};
    memories.forEach(m => {
      const name = charMap[m.character_id] || m.character_id;
      if (!knowledgeByChar[name]) knowledgeByChar[name] = [];
      knowledgeByChar[name].push(`[${m.type}] ${m.statement}`);
    });

    const knowledgeCtx = Object.entries(knowledgeByChar)
      .map(([name, items]) => `${name}:\n${items.slice(0, 20).map(i => `  • ${i}`).join('\n')}`)
      .join('\n\n');

    // Load relationship states
    const relEdges = charIds.length ? await db.sequelize.query(
      `SELECT cr.*, ca.display_name AS char_a_name, cb.display_name AS char_b_name
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
       WHERE cr.confirmed = true
         AND (cr.character_id_a IN (:charIds) OR cr.character_id_b IN (:charIds))`,
      { replacements: { charIds }, type: db.sequelize.QueryTypes.SELECT }
    ) : [];

    const relCtx = relEdges.map(r =>
      `${r.char_a_name} ↔ ${r.char_b_name}: ${r.relationship_type} (${r.status}), ` +
      `tension: ${r.tension_state || 'unknown'}, ` +
      `A knows: "${r.source_knows || '?'}", B knows: "${r.target_knows || '?'}"`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a continuity editor for a novel. Given the established character knowledge, relationship states, and a new scene, check for continuity violations. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `ESTABLISHED CHARACTER KNOWLEDGE:\n${knowledgeCtx || '(none)'}\n\nRELATIONSHIP STATES:\n${relCtx || '(none)'}\n\nNEW SCENE TO CHECK:\n${scene_text.substring(0, 12000)}\n\nCheck for:\n1. Knowledge violations — character acts on info they shouldn't have yet\n2. Relationship inconsistencies — characters interact inconsistently with established relationship state\n3. Timeline contradictions — events that conflict with established timeline\n4. Character behavior violations — actions that contradict established personality/wounds/desires\n\nReturn JSON:\n{\n  "violations": [\n    {\n      "type": "knowledge|relationship|timeline|character",\n      "severity": "critical|warning|minor",\n      "character": "who",\n      "description": "what the violation is",\n      "evidence_in_scene": "quote from scene",\n      "established_fact": "what was already established",\n      "suggestion": "how to fix"\n    }\n  ],\n  "continuity_score": 0-100,\n  "summary": "overall assessment"\n}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    // Optionally save to story record
    if (req.body.story_id) {
      await db.StorytellerStory.update(
        { continuity_check_result: result },
        { where: { id: req.body.story_id } }
      );
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[continuity-check]', err?.message);
    return res.status(500).json({ error: err?.message || 'Continuity check failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1.3 — RELATIONSHIP EVENT TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

router.get('/relationship-events/:relationshipId', optionalAuth, async (req, res) => {
  try {
    const events = await db.RelationshipEvent.findAll({
      where: { relationship_id: req.params.relationshipId },
      order: [['created_at', 'ASC']],
    });
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/relationship-events', optionalAuth, async (req, res) => {
  try {
    const event = await db.RelationshipEvent.create(req.body);

    // Update relationship stage if provided
    if (req.body.relationship_stage) {
      await db.CharacterRelationship.update(
        { status: req.body.relationship_stage },
        { where: { id: req.body.relationship_id } }
      );
    }

    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.put('/relationship-events/:eventId', optionalAuth, async (req, res) => {
  try {
    const event = await db.RelationshipEvent.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.update(req.body);
    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.delete('/relationship-events/:eventId', optionalAuth, async (req, res) => {
  try {
    await db.RelationshipEvent.destroy({ where: { id: req.params.eventId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1.4 — CHARACTER ARC VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════

router.get('/character-arc/:charId', optionalAuth, async (req, res) => {
  try {
    const { charId } = req.params;

    // Growth log entries (field changes over time)
    const growthLogs = await db.CharacterGrowthLog.findAll({
      where: { character_id: charId },
      order: [['created_at', 'ASC']],
    });

    // Memories that show transformation
    const memories = await db.StorytellerMemory.findAll({
      where: {
        character_id: charId,
        type: ['transformation', 'belief_shift', 'pain_point', 'character_dynamic'],
      },
      order: [['created_at', 'ASC']],
    });

    // Relationship events involving this character
    const relEvents = await db.sequelize.query(
      `SELECT re.*, cr.relationship_type,
              ca.display_name AS char_a_name, cb.display_name AS char_b_name
       FROM relationship_events re
       JOIN character_relationships cr ON cr.id = re.relationship_id
       JOIN registry_characters ca ON ca.id = cr.character_id_a
       JOIN registry_characters cb ON cb.id = cr.character_id_b
       WHERE cr.character_id_a = :charId OR cr.character_id_b = :charId
       ORDER BY re.created_at ASC`,
      { replacements: { charId }, type: db.sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    // Build arc timeline nodes
    const arcNodes = [];

    growthLogs.forEach(log => {
      arcNodes.push({
        type: 'growth',
        date: log.created_at,
        field: log.field_updated,
        from: log.previous_value,
        to: log.new_value,
        source: log.growth_source,
        update_type: log.update_type,
      });
    });

    memories.forEach(mem => {
      arcNodes.push({
        type: mem.type,
        date: mem.created_at,
        statement: mem.statement,
        confidence: mem.confidence,
        tags: mem.tags,
      });
    });

    relEvents.forEach(evt => {
      arcNodes.push({
        type: 'relationship_event',
        date: evt.created_at,
        event_type: evt.event_type,
        title: evt.title,
        description: evt.description,
        other_character: evt.char_a_name === charId ? evt.char_b_name : evt.char_a_name,
        tension_before: evt.tension_before,
        tension_after: evt.tension_after,
        relationship_stage: evt.relationship_stage,
      });
    });

    // Sort all by date
    arcNodes.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({
      character_id: charId,
      arc_nodes: arcNodes,
      growth_count: growthLogs.length,
      transformation_count: memories.filter(m => m.type === 'transformation').length,
      relationship_event_count: relEvents.length,
    });
  } catch (err) {
    console.error('[character-arc]', err?.message);
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2.1 — WORLD TIMELINE / CALENDAR
// ═══════════════════════════════════════════════════════════════════════════

router.get('/world-timeline', optionalAuth, async (req, res) => {
  try {
    const { universe_id, book_id, event_type } = req.query;
    const where = {};
    if (universe_id) where.universe_id = universe_id;
    if (book_id) where.book_id = book_id;
    if (event_type) where.event_type = event_type;

    const events = await db.WorldTimelineEvent.findAll({
      where,
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/world-timeline', optionalAuth, async (req, res) => {
  try {
    const event = await db.WorldTimelineEvent.create(req.body);
    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.put('/world-timeline/:eventId', optionalAuth, async (req, res) => {
  try {
    const event = await db.WorldTimelineEvent.findByPk(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.update(req.body);
    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.delete('/world-timeline/:eventId', optionalAuth, async (req, res) => {
  try {
    await db.WorldTimelineEvent.destroy({ where: { id: req.params.eventId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2.2 — LOCATION DATABASE
// ═══════════════════════════════════════════════════════════════════════════

router.get('/world-locations', optionalAuth, async (req, res) => {
  try {
    const { universe_id, location_type } = req.query;
    const where = {};
    if (universe_id) where.universe_id = universe_id;
    if (location_type) where.location_type = location_type;

    const locations = await db.WorldLocation.findAll({
      where,
      order: [['name', 'ASC']],
      include: [{ model: db.WorldLocation, as: 'childLocations', required: false }],
    });
    return res.json({ locations });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/world-locations', optionalAuth, async (req, res) => {
  try {
    if (req.body.name && !req.body.slug) {
      req.body.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    const location = await db.WorldLocation.create(req.body);
    return res.json({ success: true, location });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.put('/world-locations/:locationId', optionalAuth, async (req, res) => {
  try {
    const location = await db.WorldLocation.findByPk(req.params.locationId);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    await location.update(req.body);
    return res.json({ success: true, location });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.delete('/world-locations/:locationId', optionalAuth, async (req, res) => {
  try {
    await db.WorldLocation.destroy({ where: { id: req.params.locationId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2.3 — WORLD-STATE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/world-snapshots', optionalAuth, async (req, res) => {
  try {
    const { book_id, universe_id } = req.query;
    const where = {};
    if (book_id) where.book_id = book_id;
    if (universe_id) where.universe_id = universe_id;

    const snapshots = await db.WorldStateSnapshot.findAll({
      where,
      order: [['timeline_position', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ snapshots });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/world-snapshots', optionalAuth, async (req, res) => {
  try {
    const snapshot = await db.WorldStateSnapshot.create(req.body);
    return res.json({ success: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// Auto-generate snapshot from chapter state
router.post('/world-snapshots/generate', optionalAuth, async (req, res) => {
  try {
    const { book_id, chapter_id, registry_id } = req.body;
    if (!chapter_id) return res.status(400).json({ error: 'chapter_id required' });

    const chapter = await db.StorytellerChapter.findByPk(chapter_id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    // Gather character states from registry
    const chars = registry_id ? await db.RegistryCharacter.findAll({
      where: { registry_id },
      attributes: ['id', 'character_key', 'display_name', 'is_alive', 'core_desire', 'core_wound', 'evolution_tracking'],
    }) : [];

    const characterStates = {};
    chars.forEach(c => {
      characterStates[c.id] = {
        name: c.display_name || c.character_key,
        alive: c.is_alive !== false,
        desire: c.core_desire,
        wound: c.core_wound,
        arc: c.evolution_tracking?.current_arc || null,
        arc_stage: c.evolution_tracking?.arc_stage || null,
      };
    });

    // Gather confirmed memories up to this chapter
    const charIds = chars.map(c => c.id);
    const memories = charIds.length ? await db.StorytellerMemory.findAll({
      where: { character_id: charIds, confirmed: true },
      attributes: ['type', 'statement', 'character_id'],
    }) : [];

    const worldFacts = memories
      .filter(m => m.type === 'event')
      .map(m => m.statement);

    // Active threads
    const threads = book_id ? await db.StoryThread.findAll({
      where: { book_id, status: 'active' },
      attributes: ['id', 'thread_name', 'thread_type', 'tension_level'],
    }) : [];

    const snapshot = await db.WorldStateSnapshot.create({
      universe_id: req.body.universe_id || null,
      book_id,
      chapter_id,
      snapshot_label: `After ${chapter.title || `Chapter ${chapter.chapter_number}`}`,
      character_states: characterStates,
      relationship_states: {},
      active_threads: threads.map(t => ({ id: t.id, name: t.thread_name, type: t.thread_type, tension: t.tension_level })),
      world_facts: worldFacts,
      timeline_position: chapter.chapter_number || 0,
    });

    return res.json({ success: true, snapshot });
  } catch (err) {
    console.error('[world-snapshots/generate]', err?.message);
    return res.status(500).json({ error: err?.message });
  }
});

router.delete('/world-snapshots/:snapshotId', optionalAuth, async (req, res) => {
  try {
    await db.WorldStateSnapshot.destroy({ where: { id: req.params.snapshotId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2.4 — FRANCHISE GUARD INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

router.post('/franchise-guard-check', optionalAuth, async (req, res) => {
  try {
    const { story_id, scene_text } = req.body;
    if (!scene_text) return res.status(400).json({ error: 'scene_text required' });

    // Load all active franchise laws
    const laws = await db.FranchiseKnowledge.findAll({
      where: { status: 'active', category: ['franchise_law', 'locked_decision', 'character', 'narrative'] },
      order: [['severity', 'ASC']], // critical first
    });

    if (!laws.length) {
      return res.json({ success: true, violations: [], score: 100, summary: 'No franchise laws defined' });
    }

    const lawsCtx = laws.map(l =>
      `[${l.severity.toUpperCase()}] ${l.title}: ${l.content}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: `You are a franchise continuity guard. Given a set of franchise laws and a scene, check whether the scene violates any laws. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `FRANCHISE LAWS:\n${lawsCtx}\n\nSCENE TO CHECK:\n${scene_text.substring(0, 12000)}\n\nReturn JSON:\n{\n  "violations": [\n    {\n      "law_title": "which law",\n      "severity": "critical|important|context",\n      "violation_description": "what happened",\n      "evidence": "quote from scene",\n      "suggestion": "how to fix"\n    }\n  ],\n  "score": 0-100,\n  "summary": "overall assessment"\n}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    // Update injection counts
    for (const law of laws) {
      await law.update({
        injection_count: (law.injection_count || 0) + 1,
        last_injected_at: new Date(),
      });
    }

    // Save to story if provided
    if (story_id) {
      await db.StorytellerStory.update(
        { franchise_guard_result: result },
        { where: { id: story_id } }
      );
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[franchise-guard-check]', err?.message);
    return res.status(500).json({ error: err?.message || 'Franchise guard check failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3.1 — PIPELINE STATUS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/pipeline', optionalAuth, async (req, res) => {
  try {
    const { book_id, current_step } = req.query;
    const where = {};
    if (book_id) where.book_id = book_id;
    if (current_step) where.current_step = current_step;

    const pipelines = await db.PipelineTracking.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    // Summary stats
    const steps = ['brief', 'generate', 'read', 'evaluate', 'memory', 'registry', 'write_back'];
    const stepCounts = {};
    steps.forEach(s => { stepCounts[s] = 0; });
    pipelines.forEach(p => {
      if (stepCounts[p.current_step] !== undefined) stepCounts[p.current_step]++;
    });

    return res.json({
      pipelines,
      stats: {
        total: pipelines.length,
        completed: pipelines.filter(p => p.completed_at).length,
        in_progress: pipelines.filter(p => !p.completed_at).length,
        by_step: stepCounts,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/pipeline', optionalAuth, async (req, res) => {
  try {
    const { story_id } = req.body;

    // Upsert — find existing or create new
    let pipeline = await db.PipelineTracking.findOne({ where: { story_id } });
    if (pipeline) {
      await pipeline.update(req.body);
    } else {
      pipeline = await db.PipelineTracking.create(req.body);
    }

    return res.json({ success: true, pipeline });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.put('/pipeline/:pipelineId', optionalAuth, async (req, res) => {
  try {
    const pipeline = await db.PipelineTracking.findByPk(req.params.pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    // Auto-set completed_at when reaching write_back
    if (req.body.current_step === 'write_back' && !pipeline.completed_at) {
      req.body.completed_at = new Date();
    }

    await pipeline.update(req.body);
    return res.json({ success: true, pipeline });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3.2 — REVISION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

router.get('/story-revisions/:storyId', optionalAuth, async (req, res) => {
  try {
    const revisions = await db.StoryRevision.findAll({
      where: { story_id: req.params.storyId },
      order: [['revision_number', 'ASC']],
    });
    return res.json({ revisions });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/story-revisions', optionalAuth, async (req, res) => {
  try {
    const { story_id, text, revision_type, revision_source, change_summary } = req.body;
    if (!story_id || !text) return res.status(400).json({ error: 'story_id and text required' });

    // Get next revision number
    const lastRev = await db.StoryRevision.findOne({
      where: { story_id },
      order: [['revision_number', 'DESC']],
    });
    const nextNum = (lastRev?.revision_number || 0) + 1;

    const revision = await db.StoryRevision.create({
      story_id,
      revision_number: nextNum,
      text,
      word_count: text.split(/\s+/).filter(Boolean).length,
      revision_type: revision_type || 'edit',
      revision_source: revision_source || 'user',
      change_summary,
    });

    return res.json({ success: true, revision });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3.3 — PLOT HOLE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

router.post('/plot-hole-detection', optionalAuth, async (req, res) => {
  try {
    const { book_id, registry_id } = req.body;
    if (!book_id) return res.status(400).json({ error: 'book_id required' });

    // Load all chapters with their lines
    const chapters = await db.StorytellerChapter.findAll({
      where: { book_id },
      order: [['chapter_number', 'ASC']],
      attributes: ['id', 'title', 'chapter_number'],
    });

    if (!chapters.length) return res.json({ success: true, plot_holes: [], score: 100 });

    // Load lines for each chapter (last 500 words worth per chapter for context)
    const chapterSummaries = [];
    for (const ch of chapters.slice(0, 30)) {
      const lines = await db.StorytellerLine.findAll({
        where: { chapter_id: ch.id },
        order: [['line_order', 'ASC']],
        attributes: ['text'],
        limit: 30,
      });
      const text = lines.map(l => l.text).join('\n');
      chapterSummaries.push(`--- Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'} ---\n${text.substring(0, 2000)}`);
    }

    // Load confirmed memories for contradiction checking
    const memories = registry_id ? await db.StorytellerMemory.findAll({
      where: { confirmed: true },
      include: [{
        model: db.RegistryCharacter,
        as: 'character',
        where: { registry_id },
        attributes: ['display_name', 'character_key'],
        required: false,
      }],
      limit: 100,
      order: [['created_at', 'ASC']],
    }) : [];

    const memCtx = memories.map(m =>
      `[${m.type}] ${m.character?.display_name || '?'}: ${m.statement}`
    ).join('\n');

    // Load active threads
    const threads = await db.StoryThread.findAll({
      where: { book_id },
      attributes: ['thread_name', 'status', 'thread_type', 'chapters_since_last_reference'],
    });
    const threadCtx = threads.map(t =>
      `[${t.status}] ${t.thread_name} (${t.thread_type}) — dormant for ${t.chapters_since_last_reference} chapters`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a manuscript continuity analyst. Given chapter summaries, character memories, and story threads, detect plot holes, contradictions, and continuity errors. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `MANUSCRIPT CHAPTERS:\n${chapterSummaries.join('\n\n')}\n\nESTABLISHED MEMORIES:\n${memCtx || '(none)'}\n\nSTORY THREADS:\n${threadCtx || '(none)'}\n\nDetect:\n1. Timeline contradictions\n2. Character knowledge violations\n3. Location impossibilities\n4. Abandoned subplots\n5. Character inconsistencies\n6. Factual contradictions within the text\n\nReturn JSON:\n{\n  "plot_holes": [\n    {\n      "type": "timeline|knowledge|location|abandoned_subplot|character|factual",\n      "severity": "critical|major|minor",\n      "description": "what the issue is",\n      "chapters_involved": [1, 5],\n      "evidence": "specific quotes or references",\n      "suggestion": "how to resolve"\n    }\n  ],\n  "score": 0-100,\n  "summary": "overall manuscript continuity assessment"\n}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[plot-hole-detection]', err?.message);
    return res.status(500).json({ error: err?.message || 'Plot hole detection failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3.4 — STORY THREADS & DEAD THREAD DETECTION
// ═══════════════════════════════════════════════════════════════════════════

router.get('/story-threads', optionalAuth, async (req, res) => {
  try {
    const { book_id, status } = req.query;
    const where = {};
    if (book_id) where.book_id = book_id;
    if (status) where.status = status;

    const threads = await db.StoryThread.findAll({
      where,
      order: [['created_at', 'ASC']],
    });
    return res.json({ threads });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.post('/story-threads', optionalAuth, async (req, res) => {
  try {
    const thread = await db.StoryThread.create(req.body);
    return res.json({ success: true, thread });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.put('/story-threads/:threadId', optionalAuth, async (req, res) => {
  try {
    const thread = await db.StoryThread.findByPk(req.params.threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    await thread.update(req.body);
    return res.json({ success: true, thread });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

router.delete('/story-threads/:threadId', optionalAuth, async (req, res) => {
  try {
    await db.StoryThread.destroy({ where: { id: req.params.threadId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

// Dead thread detection via AI analysis
router.post('/dead-thread-detection', optionalAuth, async (req, res) => {
  try {
    const { book_id, registry_id } = req.body;
    if (!book_id) return res.status(400).json({ error: 'book_id required' });

    // Load all threads
    const threads = await db.StoryThread.findAll({
      where: { book_id },
    });

    // Load chapters to compute dormancy
    const chapters = await db.StorytellerChapter.findAll({
      where: { book_id },
      order: [['chapter_number', 'ASC']],
      attributes: ['id', 'title', 'chapter_number'],
    });

    // Load chapter content for AI analysis
    const chapterTexts = [];
    for (const ch of chapters.slice(0, 20)) {
      const lines = await db.StorytellerLine.findAll({
        where: { chapter_id: ch.id },
        order: [['line_order', 'ASC']],
        attributes: ['text'],
        limit: 20,
      });
      chapterTexts.push(`Ch ${ch.chapter_number} "${ch.title || ''}": ${lines.map(l => l.text).join(' ').substring(0, 1000)}`);
    }

    const existingThreadCtx = threads.map(t =>
      `[${t.status}] "${t.thread_name}" (${t.thread_type}): ${t.description || ''} — dormant ${t.chapters_since_last_reference} chapters`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a narrative structure analyst. Given a manuscript's chapter content and existing tracked threads, identify dead or abandoned threads — subplots, mysteries, character arcs, or promises to the reader that were introduced but never followed up. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `CHAPTERS:\n${chapterTexts.join('\n\n')}\n\nTRACKED THREADS:\n${existingThreadCtx || '(none tracked yet)'}\n\nReturn JSON:\n{\n  "dead_threads": [\n    {\n      "thread_name": "name",\n      "thread_type": "subplot|mystery|character_arc|relationship_arc|theme|promise",\n      "introduced_in": "chapter number or description",\n      "last_referenced_in": "chapter number or description",\n      "chapters_dormant": number,\n      "severity": "critical|warning|minor",\n      "description": "what was promised/started and never resolved",\n      "suggestion": "how to resolve or intentionally close"\n    }\n  ],\n  "new_threads_detected": [\n    {\n      "thread_name": "name",\n      "thread_type": "type",\n      "introduced_in": "chapter",\n      "description": "what this thread is about"\n    }\n  ],\n  "summary": "overall thread health assessment"\n}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    // Auto-create newly detected threads
    if (result.new_threads_detected?.length) {
      for (const t of result.new_threads_detected) {
        const exists = threads.some(et => et.thread_name.toLowerCase() === t.thread_name.toLowerCase());
        if (!exists) {
          await db.StoryThread.create({
            book_id,
            thread_name: t.thread_name,
            thread_type: t.thread_type || 'subplot',
            description: t.description,
            status: 'active',
          });
        }
      }
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[dead-thread-detection]', err?.message);
    return res.status(500).json({ error: err?.message || 'Dead thread detection failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 24 — NARRATIVE BEAT GENERATION FOR BOOKS/CHAPTERS
// Story-level beats (not animation): inciting incident, rising action,
// turning point, climax, resolution, etc.
// ═══════════════════════════════════════════════════════════════════════════

router.post('/generate-chapter-beats', optionalAuth, async (req, res) => {
  try {
    const { chapter_id, book_id, registry_id, chapter_number, chapter_title, scene_context } = req.body;
    if (!book_id) return res.status(400).json({ error: 'book_id required' });

    // Load book context
    const book = await db.StorytellerBook.findByPk(book_id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    // Load existing chapters for arc awareness
    const chapters = await db.StorytellerChapter.findAll({
      where: { book_id },
      order: [['chapter_number', 'ASC']],
      attributes: ['id', 'title', 'chapter_number', 'scene_goal', 'emotional_state_start', 'emotional_state_end', 'theme', 'conflict'],
    });

    const chapterCtx = chapters.map(c =>
      `Ch ${c.chapter_number}: "${c.title || 'Untitled'}" — goal: ${c.scene_goal || '?'}, emotion: ${c.emotional_state_start || '?'} → ${c.emotional_state_end || '?'}, conflict: ${c.conflict || '?'}`
    ).join('\n');

    // Load character context if available
    let charCtx = '';
    if (registry_id) {
      const chars = await db.RegistryCharacter.findAll({
        where: { registry_id },
        attributes: ['display_name', 'character_key', 'core_desire', 'core_wound', 'role_type'],
        limit: 10,
      });
      charCtx = chars.map(c => `${c.display_name || c.character_key} (${c.role_type}): desire="${c.core_desire || '?'}", wound="${c.core_wound || '?'}"`).join('\n');
    }

    // Load active threads for this book
    let threadCtx = '';
    try {
      const threads = await db.StoryThread.findAll({
        where: { book_id, status: 'active' },
        attributes: ['thread_name', 'thread_type', 'tension_level'],
      });
      threadCtx = threads.map(t => `[${t.thread_type}] "${t.thread_name}" — tension: ${t.tension_level || '?'}/10`).join('\n');
    } catch { /* table may not exist */ }

    const totalChapters = chapters.length;
    const currentPosition = chapter_number || (totalChapters + 1);
    const arcPosition = totalChapters > 0 ? Math.round((currentPosition / Math.max(totalChapters, 1)) * 100) : 50;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a narrative structure architect for literary fiction. Generate a beat sheet for a single chapter that serves the larger story arc. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `BOOK: "${book.title || 'Untitled'}" by ${book.author_name || 'unknown'}
Theme: ${book.theme || '?'} · Tone: ${book.tone || '?'} · POV: ${book.primary_pov || '?'}

ARC POSITION: Chapter ${currentPosition} of ~${Math.max(totalChapters, currentPosition)} (${arcPosition}% through the story)

EXISTING CHAPTERS:
${chapterCtx || '(none yet — this is the first chapter)'}

CHARACTERS:
${charCtx || '(none loaded)'}

ACTIVE THREADS:
${threadCtx || '(none tracked)'}

${scene_context ? `SCENE CONTEXT:\n${scene_context}` : ''}
${chapter_title ? `CHAPTER TITLE: "${chapter_title}"` : ''}

Generate 5-8 narrative beats for this chapter. Each beat is a story unit within the chapter — NOT an animation beat. Consider the arc position: early chapters need setup/promise; middle chapters need complication/reversal; late chapters need convergence/payoff.

Return JSON:
{
  "chapter_arc_type": "setup|complication|reversal|escalation|convergence|climax|resolution|aftermath",
  "beats": [
    {
      "beat_number": 1,
      "beat_type": "opening_image|inciting_incident|rising_action|complication|turning_point|midpoint_shift|dark_moment|climax|falling_action|resolution|closing_image|cliffhanger",
      "beat_name": "short descriptive name",
      "description": "what happens in this beat (2-3 sentences)",
      "emotional_arc": "what the POV character feels",
      "characters_present": ["character_key"],
      "tension_level": 0-10,
      "threads_advanced": ["thread name if applicable"],
      "scene_brief_seed": "1-2 sentence scene brief that could feed the 3-voice generator"
    }
  ],
  "chapter_summary": "1 sentence summary of what this chapter accomplishes in the larger arc",
  "emotional_trajectory": "start emotion → end emotion",
  "recommended_word_count": "2000-4000 range estimate",
  "pacing_note": "brief pacing guidance for this chapter"
}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    // Optionally save beats to chapter
    if (chapter_id) {
      await db.StorytellerChapter.update(
        {
          scene_goal: result.chapter_summary || null,
          emotional_state_start: result.emotional_trajectory?.split('→')[0]?.trim() || null,
          emotional_state_end: result.emotional_trajectory?.split('→')[1]?.trim() || null,
          metadata: db.sequelize.literal(`COALESCE(metadata, '{}')::jsonb || '${JSON.stringify({ beat_sheet: result.beats, arc_type: result.chapter_arc_type })}'::jsonb`),
        },
        { where: { id: chapter_id } }
      ).catch(e => console.warn('[tier-features] beat sheet metadata update error:', e?.message));
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[generate-chapter-beats]', err?.message);
    return res.status(500).json({ error: err?.message || 'Beat generation failed' });
  }
});

// Generate full book beat outline (macro arc)
router.post('/generate-book-outline', optionalAuth, async (req, res) => {
  try {
    const { book_id, registry_id, target_chapters } = req.body;
    if (!book_id) return res.status(400).json({ error: 'book_id required' });

    const book = await db.StorytellerBook.findByPk(book_id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    let charCtx = '';
    if (registry_id) {
      const chars = await db.RegistryCharacter.findAll({
        where: { registry_id },
        attributes: ['display_name', 'character_key', 'core_desire', 'core_wound', 'role_type'],
      });
      charCtx = chars.map(c => `${c.display_name || c.character_key} (${c.role_type}): desire="${c.core_desire || '?'}", wound="${c.core_wound || '?'}"`).join('\n');
    }

    const numChapters = target_chapters || 20;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: `You are a literary fiction story architect. Design a complete macro beat outline for a novel. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `BOOK: "${book.title || 'Untitled'}"
Theme: ${book.theme || '?'} · Tone: ${book.tone || '?'} · POV: ${book.primary_pov || '?'}
Setting: ${book.setting || '?'} · Stakes: ${book.stakes || '?'}

CHARACTERS:
${charCtx || '(define characters first)'}

TARGET: ${numChapters} chapters

Generate a full macro beat outline. Use a 4-act structure (Setup, Confrontation, Complication, Resolution) with key structural beats.

Return JSON:
{
  "acts": [
    {
      "act_number": 1,
      "act_name": "Setup",
      "chapters": [
        {
          "chapter_number": 1,
          "suggested_title": "title",
          "arc_type": "setup|complication|reversal|escalation|convergence|climax|resolution|aftermath",
          "structural_beat": "opening_image|theme_stated|catalyst|debate|break_into_two|b_story|fun_and_games|midpoint|bad_guys_close_in|all_is_lost|dark_night|break_into_three|finale|final_image",
          "summary": "what happens (2 sentences)",
          "key_characters": ["character_key"],
          "emotional_note": "the emotional register",
          "threads_introduced": ["new thread"] or "threads_advanced": ["existing thread"]
        }
      ]
    }
  ],
  "premise": "1-sentence premise",
  "central_question": "the question the book answers",
  "thematic_argument": "what the book argues about its theme"
}`,
      }],
    });

    let raw = response.content?.[0]?.text || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const result = JSON.parse(raw);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[generate-book-outline]', err?.message);
    return res.status(500).json({ error: err?.message || 'Book outline generation failed' });
  }
});

module.exports = router;

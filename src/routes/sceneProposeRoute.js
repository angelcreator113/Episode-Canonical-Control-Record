// routes/sceneProposeRoute.js
//
// POST /api/v1/memories/propose-scene        — system reads everything, proposes next scene
// PATCH /api/v1/memories/scene-proposals/:id — author adjusts characters or brief
// POST /api/v1/memories/scene-proposals/:id/accept — fires into story engine
// GET  /api/v1/memories/scene-proposals      — list recent proposals
// POST /api/v1/memories/arc-stage            — recalculate arc stage from approved stories

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const db = require('../models');
const { Op } = require('sequelize');

const client = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// BOOK 1 FRANCHISE INTELLIGENCE
// Everything the Scene Proposer knows about this specific story
// ─────────────────────────────────────────────────────────────────────────────
const BOOK1_INTELLIGENCE = `
BOOK 1 — LALAVERSE FRANCHISE BIBLE CONTEXT:

WHAT THIS BOOK IS ABOUT:
JustAWoman is confident but untethered — she knows she is legendary material but the vehicle hasn't arrived yet. One night she's scrolling TikTok and finds a creator doing AI character content. The world loves it. She loves it. She watches it the way she watches things she can't name yet — fully, privately. Then one day while getting dressed she thinks about Legally Blonde, about fashion games, and the vision takes root. The idea doesn't arrive complete — it grows as she edits. Lala is born. David looks at it and tells her: this is finally a product that's authentically you. That line is the emotional peak.

THE REAL WOUND INSIDE THE WOUND:
It's not just the algorithm. It's the production gap. Styling Adventures is genuinely hard to make. The editing alone is a full-time job. Every time the production breaks down, the schedule breaks down, and the audience never fully arrives because they can't count on her. She has the vision. She has the taste. She has the work ethic. But she's building something that requires infrastructure she doesn't have yet.

THE TIKTOK CREATOR MIRROR:
She finds a creator doing AI character content. She admires her AND studies her format AND watches her blow up AND watches her change — admiration becomes study becomes warning becomes resolve. The book's subtext: will JustAWoman stay herself when the room finally finds her? Lala is the architecture of the answer. Lala is a container that protects her identity from the audience.

THE TWO FEARS SHE HOLDS SIMULTANEOUSLY:
1. I'll never get big because I can't produce consistently enough.
2. If I do get big, will I still be me?

HOW SHE BUILDS:
Alone at night after everyone is asleep. In fragments — thirty minutes here, an hour there. She processes internally before telling anyone. She teases the process publicly but doesn't reveal what it is yet. The vision lives in her head for days before it becomes words.

WHERE SHE TALKS TO GOD:
Alone at night while editing. Interior reckoning scenes happen in this space — the vision and the fear in the same room. These are the highest-probability Lala seed moments.

DAVID'S ROLE IN THIS BOOK:
He notices she's different before she tells him what she's building. He sees it before she can articulate it. His line — "you finally have a product that's authentically you" — is not just support. It's a mirror from the person who knows her best.

ARC PROGRESSION:
ESTABLISHMENT: Her routine. The TikTok scroll. The hook. The watching.
PRESSURE: The vision takes root. Production begins. The gap between vision and output. Schedule breaks down.
CRISIS: The TikTok creator she found changes. JustAWoman watches her disappear. The fear collides with the building.
INTEGRATION: Lala is born. David sees it. She knows.

SCENE TYPES FOR THIS BOOK:
- production_breakdown: She loses a video, misses a schedule, the gap between vision and output hits hard
- creator_study: Watching the TikTok creator — admiration shifts to study shifts to warning
- interior_reckoning: Alone at night editing, talking to God, talking to herself, talking to who she's becoming
- david_mirror: He sees something in her she hasn't named — his perception lands before her words arrive
- paying_man_pressure: A paying man notices she's distracted, starts pushing on the boundary
- bestie_moment: She processes the creation publicly, posts fragments, the Besties respond
- lala_seed: The intrusive thought arrives — brief, styled, confident. The door left open.
- general: Any scene that advances character or relationship without a specific type

LALA EMERGENCE RULE:
Lala appears in Book 1 as ONE intrusive thought — tonal rupture, brief, styled, confident. The lala_seed scene type exists for this moment. The system should propose it only once, at the right moment in the arc (late pressure / early crisis).
`;

// ─────────────────────────────────────────────────────────────────────────────
// ARC STAGE CALCULATOR
// Reads approved story counts and advances the stage
// ─────────────────────────────────────────────────────────────────────────────
const ARC_THRESHOLDS = {
  establishment: { min: 0, advance_at: 8 },
  pressure:      { min: 8, advance_at: 16 },
  crisis:        { min: 16, advance_at: 22 },
  integration:   { min: 22, advance_at: Infinity },
};

async function calculateArcStage(bookId) {
  try {
    const stories = await db.StorytellerStory.findAll({
      where: { book_id: bookId, status: { [Op.in]: ['evaluated', 'written_back'] } },
      attributes: ['arc_stage', 'id'],
    });

    const scores = { establishment: 0, pressure: 0, crisis: 0, integration: 0 };
    stories.forEach(s => { if (s.arc_stage && scores[s.arc_stage] !== undefined) scores[s.arc_stage]++; });

    const total = stories.length;
    let stage = 'establishment';
    if (total >= ARC_THRESHOLDS.crisis.min) stage = 'crisis';
    else if (total >= ARC_THRESHOLDS.pressure.min) stage = 'pressure';

    // Also check if integration has started
    if (scores.integration > 0 && total >= ARC_THRESHOLDS.integration.min) stage = 'integration';

    return { stage, scores, total };
  } catch (err) {
    console.error('Arc stage calculation error:', err);
    return { stage: 'establishment', scores: {}, total: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER CONTEXT READER
// Reads registry + memories + relationships for scene intelligence
// ─────────────────────────────────────────────────────────────────────────────
async function readCharacterContext(registryId) {
  try {
    const characters = await db.RegistryCharacter.findAll({
      where: {
        registry_id: registryId,
        status: { [Op.in]: ['approved', 'edited', 'finalized'] },
      },
    });

    const charIds = characters.map(c => c.id);

    // Run all independent queries in parallel
    const [relationships, recentRevelations, recentBeats, growthLogs, crossings] = await Promise.all([
      db.CharacterRelationship.findAll({
        where: {
          [Op.or]: [
            { character_id_a: charIds },
            { character_id_b: charIds },
          ],
        },
      }),
      // Recent character revelations — last 10
      (db.PainPointMemory
        ? db.PainPointMemory.findAll({ where: { memory_type: 'character_revelation' }, order: [['created_at', 'DESC']], limit: 10 }).catch(() => [])
        : Promise.resolve([])),
      // Recent continuity beats — last 8
      db.ContinuityBeat.findAll({ order: [['created_at', 'DESC']], limit: 8 }).catch(() => []),
      // Character growth logs — last 20 accepted/unreviewed
      (db.CharacterGrowthLog
        ? db.CharacterGrowthLog.findAll({ where: { character_id: charIds, author_decision: { [Op.or]: ['accepted', null] } }, order: [['created_at', 'DESC']], limit: 20 }).catch(() => [])
        : Promise.resolve([])),
      // Character crossings — last 10
      (db.CharacterCrossing
        ? db.CharacterCrossing.findAll({ where: { character_id: charIds }, order: [['created_at', 'DESC']], limit: 10 }).catch(() => [])
        : Promise.resolve([])),
    ]);

    const charMap = {};
    characters.forEach(c => { charMap[c.id] = c.selected_name || c.name; });

    return {
      characters: characters.map(c => ({
        id: c.id,
        name: c.selected_name || c.name,
        character_type: c.character_type,
        wound: c.wound,
        voice_notes: c.voice_notes,
        psychology: c.psychology,
        relationship_to_jaw: c.relationship_to_jaw,
        arc_summary: c.arc_summary,
        pain_point_category: c.pain_point_category,
        world_exists: c.world_exists,
        appearance_mode: c.appearance_mode,
      })),
      relationships: relationships.map(r => ({
        character_a: r.character_id_a,
        character_b: r.character_id_b,
        type: r.relationship_type,
        tension_state: r.tension_state,
        connection_mode: r.connection_mode,
        pain_point_category: r.pain_point_category,
      })),
      recentRevelations: recentRevelations.map(r => ({
        content: r.content,
        category: r.pain_point_category,
        created_at: r.created_at,
      })),
      recentBeats: recentBeats.map(b => ({
        content: b.content,
        beat_type: b.beat_type,
        created_at: b.created_at,
      })),
      growthLogs: growthLogs.map(l => {
        const name = charMap[l.character_id] || '?';
        const flag = l.update_type === 'flagged_contradiction' ? ' ⚠ CONTRADICTION' : '';
        return { name, field: l.field_updated, from: l.previous_value, to: l.new_value, flag, source: l.growth_source };
      }),
      crossings: crossings.map(cx => ({
        name: charMap[cx.character_id] || '?',
        trigger: cx.trigger,
        feed_state: cx.initial_feed_state,
        gap_score: cx.performance_gap_score,
        gap_observed: cx.gap_proposed_by_amber,
      })),
    };
  } catch (err) {
    console.error('Character context read error:', err);
    return { characters: [], relationships: [], recentRevelations: [], recentBeats: [], growthLogs: [], crossings: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: propose-scene
// The system reads everything and proposes the next scene
// ─────────────────────────────────────────────────────────────────────────────
router.post('/propose-scene', requireAuth, aiRateLimiter, async (req, res) => {
  const { chapter_id, registry_id, force_scene_type, author_note } = req.body;

  // Resolve book_id — must be a valid UUID or null
  let book_id = req.body.book_id || null;
  if (book_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(book_id)) {
    // Not a valid UUID — look up the first book instead
    try {
      const firstBook = await db.StorytellerBook.findOne({ order: [['created_at', 'ASC']] });
      book_id = firstBook ? firstBook.id : null;
    } catch { book_id = null; }
  }

  try {
    // ── 1. Calculate arc stage ──────────────────────────────────────────────
    const { stage, scores, total } = await calculateArcStage(book_id);

    // ── 2. Read all character context ───────────────────────────────────────
    const context = await readCharacterContext(registry_id);

    // ── 2b. Load world state snapshot ───────────────────────────────────────
    let worldStateCtx = '';
    try {
      if (db.WorldStateSnapshot) {
        const where = {};
        if (chapter_id) where.chapter_id = chapter_id;
        else if (book_id) where.book_id = book_id;
        const snapshot = await db.WorldStateSnapshot.findOne({
          where,
          order: [['timeline_position', 'DESC'], ['created_at', 'DESC']],
        });
        if (snapshot) {
          const parts = [`World State: "${snapshot.snapshot_label}"`];
          const threads = Array.isArray(snapshot.active_threads) ? snapshot.active_threads : [];
          if (threads.length) parts.push(`  Active threads: ${threads.slice(0, 6).map(t => typeof t === 'string' ? t : t.name || JSON.stringify(t)).join('; ')}`);
          const facts = Array.isArray(snapshot.world_facts) ? snapshot.world_facts : [];
          if (facts.length) parts.push(`  Established facts: ${facts.slice(0, 6).map(f => typeof f === 'string' ? f : f.fact || JSON.stringify(f)).join('; ')}`);
          worldStateCtx = parts.join('\n');
        }
      }
    } catch (e) { /* graceful */ }

    // ── 3. Check for lala_seed — only once ─────────────────────────────────
    const lalaSeedWhere = { scene_type: 'lala_seed', status: { [Op.in]: ['accepted', 'generated'] } };
    if (book_id) lalaSeedWhere.book_id = book_id;
    const existingLalaSeed = await db.SceneProposal.findOne({ where: lalaSeedWhere });
    const lalaAlreadyBorn = !!existingLalaSeed;

    // ── 4. Build the proposal prompt ────────────────────────────────────────
    const proposalPrompt = `You are the Scene Intelligence Engine for Prime Studios — a literary production system for the LalaVerse franchise.

Your job: read everything about where this story is right now and propose the next scene that should happen. Be specific. Be franchise-faithful. Propose what the story actually needs, not what is safe or generic.

${BOOK1_INTELLIGENCE}

CURRENT ARC STATE:
Stage: ${stage.toUpperCase()}
Total approved scenes: ${total}
Establishment scenes: ${scores.establishment || 0}
Pressure scenes: ${scores.pressure || 0}
Crisis scenes: ${scores.crisis || 0}
Integration scenes: ${scores.integration || 0}

${force_scene_type ? `AUTHOR REQUESTED SCENE TYPE: ${force_scene_type}` : ''}
${author_note ? `AUTHOR NOTE: ${author_note}` : ''}

LALA SEED STATUS: ${lalaAlreadyBorn ? 'Already planted — do NOT propose another lala_seed scene' : stage === 'pressure' || stage === 'crisis' ? 'Not yet planted — this is the right arc window if the moment is earned' : 'Too early — not yet'}

CHARACTERS IN REGISTRY:
${context.characters.map(c => `- ${c.name} (${c.character_type}) | Wound: ${c.wound || 'undocumented'} | Arc: ${c.arc_summary || 'undocumented'} | Appearance: ${c.appearance_mode}`).join('\n')}

RELATIONSHIP TENSIONS:
${context.relationships.length ? context.relationships.map(r => `- Characters ${r.character_a} ↔ ${r.character_b} | Type: ${r.type} | Tension: ${r.tension_state || 'untracked'}`).join('\n') : 'No relationships logged yet'}

RECENT CHARACTER REVELATIONS (what she has learned about herself):
${context.recentRevelations.length ? context.recentRevelations.map(r => `- [${r.category}] ${r.content}`).join('\n') : 'None yet'}

RECENT STORY BEATS (what has happened):
${context.recentBeats.length ? context.recentBeats.map(b => `- ${b.content}`).join('\n') : 'No beats logged yet'}

${context.growthLogs.length ? `CHARACTER GROWTH ARC (how characters have been changing — write with awareness of trajectory):\n${context.growthLogs.map(g => `- ${g.name}: ${g.field} "${g.from || '—'}" → "${g.to}"${g.flag}${g.source ? ` (${g.source})` : ''}`).join('\n')}` : ''}

${worldStateCtx ? `WORLD STATE (current reality — ground the scene in what is TRUE):\n${worldStateCtx}` : ''}

${context.crossings.length ? `CHARACTER CROSSINGS (when digital personas crossed into narrative reality):\n${context.crossings.map(cx => `- ${cx.name}${cx.trigger ? ` crossed via: ${cx.trigger}` : ''}${cx.gap_score != null ? ` gap: ${cx.gap_score}/10` : ''}${cx.gap_observed ? ` — ${cx.gap_observed}` : ''}`).join('\n')}` : ''}

Now propose the next scene. Think about: what tension is unresolved, whose wound hasn't been touched, what the arc stage demands, what would feel inevitable given everything that has happened.

Respond ONLY in valid JSON. No markdown. No backticks. No explanation outside the JSON:

{
  "scene_type": one of: production_breakdown | creator_study | interior_reckoning | david_mirror | paying_man_pressure | bestie_moment | lala_seed | general,
  "proposed_characters": [
    {
      "character_name": "name exactly as in registry",
      "role_in_scene": "what this character is doing / how they function in this scene",
      "why_now": "why this character needs to be here at this moment in the arc"
    }
  ],
  "emotional_stakes": "What is actually at stake emotionally — not plot summary, the specific feeling that is on the line in this scene",
  "arc_function": "What this scene advances. What will be different in the story because this scene happened.",
  "scene_brief": "The fully written scene brief — 150-250 words. Specific. Sensory. Gives the generation agents everything they need. Include: where we are, what is happening, what JustAWoman is feeling underneath the surface action, what the scene needs to accomplish, and one specific detail that anchors it in her real life.",
  "why_these_characters": "Your reasoning — why this specific cast at this specific moment. Reference what you read in the arc data and character registry.",
  "suggested_tone": one of: longing | tension | sensual | explicit | aftermath,
  "lala_seed_potential": true or false,
  "interior_reckoning_moment": true or false,
  "what_should_not_happen": "One thing that would be a franchise violation or character contradiction in this scene — what to guard against"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are the narrative intelligence layer of Prime Studios. You know this franchise deeply. You propose scenes that feel inevitable, not convenient. You never propose what is safe — you propose what the story needs. Respond ONLY in valid JSON.`,
      messages: [{ role: 'user', content: proposalPrompt }],
    });

    const rawText = response.content[0].text;
    let proposal;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      proposal = JSON.parse(clean);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse proposal', raw: rawText });
    }

    // ── 5. Save to scene_proposals ──────────────────────────────────────────
    const record = await db.SceneProposal.create({
      book_id: book_id || null,
      chapter_id: chapter_id || null,
      registry_id: registry_id || null,
      arc_stage: stage,
      arc_stage_score: scores,
      wounds_unaddressed: context.characters.filter(c => c.wound).map(c => ({ name: c.name, wound: c.wound })),
      tensions_unresolved: context.relationships.filter(r => r.tension_state),
      recent_beats: context.recentBeats,
      recent_revelations: context.recentRevelations,
      scene_type: proposal.scene_type,
      proposed_characters: proposal.proposed_characters,
      emotional_stakes: proposal.emotional_stakes,
      arc_function: proposal.arc_function,
      scene_brief: proposal.scene_brief,
      why_these_characters: proposal.why_these_characters,
      suggested_tone: proposal.suggested_tone || 'tension',
      lala_seed_potential: proposal.lala_seed_potential || false,
      status: 'proposed',
      raw_proposal: proposal,
    });

    return res.json({
      proposal_id: record.id,
      proposal,
      arc_state: { stage, scores, total },
      context_used: {
        characters_read: context.characters.length,
        relationships_read: context.relationships.length,
        recent_revelations: context.recentRevelations.length,
        recent_beats: context.recentBeats.length,
        growth_logs: context.growthLogs.length,
        crossings: context.crossings.length,
        world_state: worldStateCtx ? true : false,
      },
    });

  } catch (err) {
    console.error('Scene propose error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: adjust proposal
// Author edits the brief or swaps characters before accepting
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/scene-proposals/:id', requireAuth, async (req, res) => {
  const { scene_brief, characters, tone, author_note } = req.body;
  try {
    const proposal = await db.SceneProposal.findByPk(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status === 'generated') return res.status(400).json({ error: 'Already generated — cannot edit' });

    const edits = {};
    if (scene_brief) edits.scene_brief_edit = scene_brief;
    if (characters) edits.characters_edit = characters;
    if (tone) edits.tone_edit = tone;
    if (author_note) edits.author_note = author_note;

    await proposal.update({
      scene_brief: scene_brief || proposal.scene_brief,
      proposed_characters: characters || proposal.proposed_characters,
      suggested_tone: tone || proposal.suggested_tone,
      status: 'adjusted',
      author_edits: edits,
    });

    return res.json({ ok: true, proposal });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3: accept proposal — fires into story engine
// ─────────────────────────────────────────────────────────────────────────────
router.post('/scene-proposals/:id/accept', requireAuth, async (req, res) => {
  const { tone_override } = req.body;
  try {
    const proposal = await db.SceneProposal.findByPk(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const finalBrief = proposal.scene_brief;
    const finalTone = tone_override || proposal.suggested_tone || 'tension';
    const finalChars = proposal.proposed_characters.map(c => c.character_name);

    await proposal.update({
      status: 'accepted',
      final_brief: finalBrief,
      final_characters: proposal.proposed_characters,
    });

    // Return everything the frontend needs to fire generate-story-multi
    return res.json({
      ok: true,
      proposal_id: proposal.id,
      ready_to_generate: {
        scene_brief: finalBrief,
        tone_dial: finalTone,
        character_names: finalChars,
        book_id: proposal.book_id,
        chapter_id: proposal.chapter_id,
        proposal_id: proposal.id,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: list proposals
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scene-proposals', requireAuth, async (req, res) => {
  const { book_id, status, limit = 10 } = req.query;
  try {
    const where = {};
    if (book_id) where.book_id = book_id;
    if (status) where.status = status;

    const proposals = await db.SceneProposal.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });

    return res.json({ proposals });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 5: dismiss proposal
// ─────────────────────────────────────────────────────────────────────────────
router.post('/scene-proposals/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const proposal = await db.SceneProposal.findByPk(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    await proposal.update({ status: 'dismissed' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 6: recalculate arc stage
// ─────────────────────────────────────────────────────────────────────────────
router.post('/arc-stage', requireAuth, async (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id required' });
  try {
    const { stage, scores, total } = await calculateArcStage(book_id);
    await db.StorytellerBook.update(
      { current_arc_stage: stage, arc_stage_scores: scores },
      { where: { id: book_id } }
    );
    return res.json({ stage, scores, total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

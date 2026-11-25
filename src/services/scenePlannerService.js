'use strict';

/**
 * Scene Planner Service — AI brain for mapping scenes to beats.
 *
 * Loads available scene sets for the show, calls Claude with the
 * Episode Brief + 14-beat structure + each scene's script_context,
 * returns a JSON plan grounding each beat in real location details.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { ScenePlan, SceneSet, SceneSetEpisode: _SceneSetEpisode, SceneAngle, WorldLocation } = require('../models');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// 14-beat canonical episode structure — single source of truth in
// src/constants/canonicalBeats.js (Task #1609, docs/EVENT_EPISODE_FLOW.md §8(a)).
// Content unchanged: this file's own list already matched the show-brain
// seeder's names and order exactly, so importing it is a pure refactor.
const { CANONICAL_BEATS: BEAT_STRUCTURE } = require('../constants/canonicalBeats');
// The canonical beat numbers, already derived and exported beside the coverage
// reader: the validation below reuses that list rather than re-deriving it.
const { CANONICAL_NUMBERS } = require('../utils/beatPlanCoverage');
const CANONICAL_BEATS_COUNT = BEAT_STRUCTURE.length;

/**
 * Gap 2 (Evoni, 2026-11-25): the model's whole reply is checked BEFORE any
 * plan row is touched. A reply that is not the complete canonical beat set is
 * invalid output, never authorisation to remove beats, so nothing is written
 * and every existing row — with its id, its scenes and its operator's work —
 * stays exactly as it was. 409, never a 500 carrying service text.
 */
class PlanOutputInvalidError extends Error {
  constructor(problems) {
    const k = Array.isArray(problems) ? problems.length : 0;
    super(`The planner's reply was not a complete ${CANONICAL_NUMBERS.length}-beat plan, so the plan was not changed. `
      + `Nothing was saved: try again.${k ? ` (${problems.join('; ')})` : ''}`);
    this.name = 'PlanOutputInvalidError';
    this.code = 'PLAN_OUTPUT_INVALID';
    this.problems = problems || [];
  }
}

/**
 * Gap 2: a soft-deleted plan row sits INSIDE idx_scene_plans_episode_beat
 * (that index has no deleted_at predicate) but outside every write guard, so
 * it occupies its canonical beat number without being usable. The re-plan
 * refuses and rolls back rather than skipping the beat in silence. Nothing in
 * src/ soft-deletes a plan row today; this is the guard, not a repair, and it
 * never deletes, renumbers or reassigns the row.
 */
class PlanBeatUnavailableError extends Error {
  constructor(beats) {
    super(`Beat${beats.length === 1 ? '' : 's'} ${beats.join(', ')} in this episode's saved plan `
      + `${beats.length === 1 ? 'is' : 'are'} marked removed but still hold${beats.length === 1 ? 's' : ''} `
      + `${beats.length === 1 ? 'its' : 'their'} place, so the plan was not changed. `
      + 'Nothing was saved. This episode\'s existing plan data needs review before it can be re-planned.');
    this.name = 'PlanBeatUnavailableError';
    this.code = 'PLAN_BEAT_UNAVAILABLE';
    this.beats = beats;
  }
}

/**
 * Load all available scene sets for a show, with their angles and images:
 * the show's and the shared ones, and the event's own set whatever its show;
 * no other event's version (eighth audit: shared sets and the event's set
 * were left out, so the event's beats were saved with no set, and another
 * event's dressed photos could be chosen).
 */
async function loadAvailableSceneSets(showId, eventSetId = null) {
  const { Op } = require('sequelize');
  const notOtherVersion = { [Op.or]: [{ version_of_set_id: null }, ...(eventSetId ? [{ id: eventSetId }] : [])] };
  const inShow = showId ? { [Op.or]: [{ show_id: showId }, { show_id: null }, ...(eventSetId ? [{ id: eventSetId }] : [])] } : {};
  const where = { generation_status: 'complete', [Op.and]: [notOtherVersion, inShow] };

  const includes = [
    {
      model: SceneAngle,
      as: 'angles',
      attributes: ['id', 'angle_label', 'angle_name', 'still_image_url', 'generation_status'],
      required: false,
    },
  ];
  if (WorldLocation) {
    includes.push({
      model: WorldLocation,
      as: 'worldLocation',
      attributes: ['id', 'name', 'narrative_role', 'sensory_details', 'location_type'],
      required: false,
    });
  }

  const sets = await SceneSet.findAll({
    where,
    include: includes,
    order: [['name', 'ASC']],
  });

  return sets.map(s => {
    const loc = s.worldLocation;
    return {
      id: s.id,
      name: s.name,
      scene_type: s.scene_type,
      script_context: s.script_context || s.canonical_description || null,
      angles: (s.angles || [])
        .filter(a => a.generation_status === 'complete' && a.still_image_url)
        .map(a => ({ label: a.angle_label, name: a.angle_name })),
      has_base_image: !!s.base_still_url,
      narrative_role: loc?.narrative_role || null,
      sensory_details: loc?.sensory_details || null,
    };
  });
}

/**
 * Generate a 14-beat scene plan using Claude.
 */
async function generateScenePlan(episodeId, showId, briefData, options = {}) {
  const { save = true } = options;

  // Load available scene sets, with the event's own set
  let eventSetId = null;
  try {
    const [[ev]] = await require('../models').sequelize.query(
      `SELECT scene_set_id FROM world_events WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
      { replacements: { episodeId } });
    eventSetId = ev?.scene_set_id || null;
  } catch (evErr) {
    console.error('[ScenePlanner] The event\'s set could not be read:', evErr.message);
  }
  const sceneSets = await loadAvailableSceneSets(showId, eventSetId);

  // L4 (Evoni, 2026-10-02; Q17, Q18, §8(hh)): an episode with locations
  // plans each beat at the location of its role, on the angle of the kind
  // the beat asks for. Without locations, the AI chooses from every set.
  const sequelizeDb = require('../models').sequelize;
  const { listLocations } = require('./episodeLocationsService');
  const { setsByRole, placeBeat, loadSetAngles } = require('./planLocationsService');
  const { kindsText, kindNoun } = require('../constants/beatLocations');
  let roleSets = {};
  let anglesBySet = new Map();
  let roleContexts = new Map();
  try {
    roleSets = setsByRole(await listLocations(sequelizeDb, episodeId));
    const ids = [...new Set(Object.values(roleSets))];
    anglesBySet = await loadSetAngles(sequelizeDb, ids);
    if (ids.length) {
      const [ctx] = await sequelizeDb.query('SELECT id, name, script_context FROM scene_sets WHERE id IN (:ids)', { replacements: { ids } });
      roleContexts = new Map(ctx.map((c) => [c.id, c]));
    }
  } catch (locErr) {
    console.error('[ScenePlanner] Episode locations load failed; planning from every set:', locErr.message);
    roleSets = {};
  }
  const mapped = Object.keys(roleSets).length > 0;

  if (sceneSets.length === 0 && !mapped) {
    throw new Error('No scene sets available. Create scene sets before generating a plan.');
  }

  // Build the AI prompt
  // Load the episode's event, if any (utils/episodeEventSql; Task #1917)
  let eventContext = '';
  try {
    const sequelize = require('../models').sequelize;
    const [events] = await sequelize.query(
      `SELECT name, event_type, location_hint, dress_code, prestige, strictness, scene_set_id
       FROM world_events WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
      { replacements: { episodeId } }
    );
    if (events.length > 0) {
      const ev = events[0];
      eventContext = `\n## Linked Event
- Name: ${ev.name}
- Type: ${ev.event_type}
- Location: ${ev.location_hint || 'Not specified'}
- Dress Code: ${ev.dress_code || 'None'}
- Prestige: ${ev.prestige}/10
- Strictness: ${ev.strictness}/10
${ev.scene_set_id ? `- Preferred Scene Set ID: ${ev.scene_set_id} (use this for EVENT beats 10-12)` : ''}

IMPORTANT: The Event Travel (beat 10), The Event (beat 11), and Fashion Challenge (beat 12) should use the event's location/scene set. The event's dress code and prestige level should inform the visual tone.`;
    }
  } catch (e) {
    // Every catch logs (eighth audit): a failed read dropped the event's set from the prompt unseen.
    console.error('[ScenePlanner] The episode\'s event could not be read:', e.message);
  }

  const systemPrompt = `You are a scene planner for "Styling Adventures with Lala", a narrative-driven luxury fashion show about a creator building her career in the LalaVerse.

You map episodes to a 14-beat structure, assigning each beat to a specific scene set (location) with a camera angle, shot type, and emotional direction.

Your assignments must:
- Use ONLY scene sets from the provided list (match by ID)
- Ground each beat in the scene's actual script_context (room details, lighting, objects)
- Create natural visual flow between scenes (don't jump locations randomly)
- Match the episode's narrative_purpose and emotional arc
- Use variety in shot types and angles within each location
- If a linked event has a preferred scene set, use it for event-related beats (10-12)

Return ONLY valid JSON — an array of 14 beat objects.`;

  const sceneSetList = sceneSets.map(s => {
    let entry = `- ID: ${s.id}\n  Name: ${s.name}\n  Type: ${s.scene_type}\n  Context: ${(s.script_context || 'No description').slice(0, 300)}\n  Angles: ${s.angles.map(a => a.label).join(', ') || 'BASE only'}`;
    if (s.narrative_role) entry += `\n  Narrative role: ${s.narrative_role}`;
    if (s.sensory_details) {
      const sd = s.sensory_details;
      const senses = [sd.atmosphere, sd.sight, sd.sound].filter(Boolean).join('; ');
      if (senses) entry += `\n  Sensory: ${senses.slice(0, 150)}`;
    }
    return entry;
  }).join('\n\n');

  const userPrompt = `## Episode Brief
- Archetype: ${briefData.episode_archetype || 'Not set'}
- Narrative Purpose: ${briefData.narrative_purpose || 'Not set'}
- Designed Intent: ${briefData.designed_intent || 'Not set'}
- Forward Hook: ${briefData.forward_hook || 'Not set'}
- Arc: ${briefData.arc_number || '?'} / Position: ${briefData.position_in_arc || '?'}
${eventContext}
## Available Scene Sets
${sceneSetList}

## 14-Beat Structure
${BEAT_STRUCTURE.map(b => `${b.number}. ${b.name} (typical: ${b.typical_location}) — ${b.description}`).join('\n')}
${mapped ? `
## The Episode's Locations (fixed)
Each beat is set at this location; choose its shot, intent and transition to fit it.
${BEAT_STRUCTURE.map((b) => {
    const placed = placeBeat(b.number, roleSets, anglesBySet);
    const set = roleContexts.get(placed.scene_set_id);
    return `${b.number}. ${placed.role}: ${set ? `${set.name} (ID ${set.id})` : 'no set chosen'}${placed.kinds.length ? `, ${kindsText(placed.kinds).toLowerCase()} ${kindNoun(placed.kinds)}` : ''}`;
  }).join('\n')}
` : ''}
## Task
Assign each of the 14 beats to a scene set from the list above. Return a JSON array of 14 objects:

\`\`\`json
[
  {
    "beat_number": 1,
    "beat_name": "Opening Ritual",
    "scene_set_id": "<uuid from list>",
    "angle_label": "WIDE",
    "shot_type": "establishing",
    "emotional_intent": "Warm intimacy — Lala alone in her space, morning light",
    "transition_in": "dissolve",
    "confidence": 0.9
  },
  ...
]
\`\`\`

shot_type options: establishing, medium, close, tracking, cutaway, transition
transition_in options: cut, glow, push, wipe, dissolve, none

Return ONLY the JSON array, no other text.`;

  console.log(`[ScenePlanner] Calling Claude with ${sceneSets.length} scene sets`);

  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Parse the response
  const text = response.content?.[0]?.text || '';
  let beats;
  try {
    // Extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    beats = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[ScenePlanner] Failed to parse AI response:', text.slice(0, 500));
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }

  // ── Gap 2 Phase A: validate the WHOLE reply before anything is written ──
  if (!Array.isArray(beats) || beats.length === 0) {
    throw new PlanOutputInvalidError(['the reply held no beats at all']);
  }
  {
    const problems = [];
    const seen = new Map();
    beats.forEach((beat, i) => {
      const raw = beat?.beat_number;
      const n = Number(raw);
      if (raw === undefined || raw === null || raw === '' || !Number.isInteger(n)) {
        problems.push(`entry ${i + 1}: beat_number "${raw}" is not a whole number`);
        return;
      }
      if (!CANONICAL_NUMBERS.includes(n)) {
        problems.push(`beat ${n} is not one of this show's beats`);
        return;
      }
      seen.set(n, (seen.get(n) || 0) + 1);
    });
    for (const n of CANONICAL_NUMBERS) {
      if (seen.get(n) > 1) problems.push(`beat ${n} appears ${seen.get(n)} times`);
    }
    const missing = CANONICAL_NUMBERS.filter((n) => !seen.has(n));
    if (missing.length) problems.push(`beat${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing`);
    if (beats.length !== CANONICAL_BEATS_COUNT) problems.push(`${beats.length} beats came back, ${CANONICAL_BEATS_COUNT} expected`);
    if (problems.length) throw new PlanOutputInvalidError(problems);

    // Valid but out of order: sort by beat_number so the enrichment below,
    // which reads BEAT_STRUCTURE by ARRAY INDEX while beat_number comes from
    // the reply, lines each beat up with its own canonical beat.
    beats = [...beats].sort((a, b) => Number(a.beat_number) - Number(b.beat_number));
  }

  // Validate and enrich each beat with scene_context
  const sceneSetMap = new Map(sceneSets.map(s => [s.id, s]));
  const enrichedBeats = beats.map((beat, i) => {
    const beatNumber = beat.beat_number || i + 1;
    // L4: with locations, the beat's set and angle come from its role and
    // kind; the AI's label stays only when that set has such an angle.
    if (mapped) {
      const placed = placeBeat(beatNumber, roleSets, anglesBySet);
      const angles = anglesBySet.get(placed.scene_set_id) || [];
      const aiLabel = beat.angle_label && angles.some((a) => String(a.angle_label).toUpperCase() === String(beat.angle_label).toUpperCase())
        ? beat.angle_label : null;
      const ctx = roleContexts.get(placed.scene_set_id);
      return {
        beat_number: beatNumber,
        beat_name: beat.beat_name || BEAT_STRUCTURE[i]?.name || `Beat ${i + 1}`,
        scene_set_id: placed.scene_set_id,
        angle_label: placed.kinds.length ? (placed.angle?.angle_label || null) : aiLabel,
        shot_type: beat.shot_type || null,
        emotional_intent: beat.emotional_intent || null,
        transition_in: beat.transition_in || 'cut',
        scene_context: ctx?.script_context?.slice(0, 400) || null,
        ai_confidence: beat.confidence || 0.7,
      };
    }
    const sceneSet = sceneSetMap.get(beat.scene_set_id);
    return {
      beat_number: beatNumber,
      beat_name: beat.beat_name || BEAT_STRUCTURE[i]?.name || `Beat ${i + 1}`,
      scene_set_id: sceneSet ? beat.scene_set_id : null,
      angle_label: beat.angle_label || null,
      shot_type: beat.shot_type || null,
      emotional_intent: beat.emotional_intent || null,
      transition_in: beat.transition_in || 'cut',
      scene_context: sceneSet?.script_context?.slice(0, 400) || null,
      ai_confidence: beat.confidence || 0.7,
    };
  });

  // Save to database
  if (save) {
    // B2 (Evoni, 2026-10-02): a rewrite never deletes a locked beat. The
    // unlocked beats are replaced; a locked one stays as Evoni set it, and
    // the plan returned shows it. L11: a beat whose set or angle she chose
    // ("Chosen by you") is kept the same way.
    const { Op } = require('sequelize');
    const lockedRows = await ScenePlan.findAll({
      where: { episode_id: episodeId, [Op.or]: [{ locked: true }, { chosen_by_user: true }] },
    });
    const lockedByBeat = new Map(lockedRows.map((r) => [r.beat_number, r]));
    const rows = enrichedBeats.map((beat, i) => ({ beat, i })).filter(({ beat }) => !lockedByBeat.has(beat.beat_number)).map(({ beat, i }) => ({
      episode_id: episodeId,
      episode_brief_id: null, // will link later if needed
      beat_number: beat.beat_number,
      beat_name: beat.beat_name,
      scene_set_id: beat.scene_set_id,
      angle_label: beat.angle_label,
      shot_type: beat.shot_type,
      emotional_intent: beat.emotional_intent,
      transition_in: beat.transition_in,
      scene_context: beat.scene_context,
      locked: false,
      sort_order: i,
      ai_suggested: true,
      ai_confidence: beat.ai_confidence,
    }));

    // One transaction: a failed save no longer loses the unlocked beats it
    // had just removed (eighth audit).
    //
    // C2 PR 3 (Evoni, 2026-11-24): the sets were read before the long model
    // call, so one of them can have been removed by the time the plan is
    // saved. The long call stays outside this transaction, as it always
    // was; the liveness of every set the plan names is re-checked HERE, at
    // save time, under the episode's lock. NOWAIT, not waited: the episode
    // row is held, and a set row is never waited for while one is (the
    // delete path's order). A set that went: the beat is saved with no set,
    // which is this service's existing answer for a set it cannot resolve
    // (`scene_set_id: sceneSet ? beat.scene_set_id : null` above).
    const { sequelize: planDb } = require('../models');
    const { inEpisodeFirstTransaction, holdLiveSet } = require('../services/eventPlaceSync');
    const { lockEpisodes } = require('../utils/episodeLocks');
    let dropped = [];
    // Gap 2: what this re-plan changed on beats that already existed, reported
    // on the response and stored nowhere. It is NOT evidence that a saved
    // scene is still creatively right for its beat.
    let changes = [];
    try {
      await inEpisodeFirstTransaction(planDb, async (transaction) => {
        dropped = [];
        await lockEpisodes(planDb, [episodeId], { transaction, mode: 'share' });
        const named = [...new Set(rows.map((r) => r.scene_set_id).filter(Boolean).map(String))].sort();
        const gone = new Set();
        for (const setId of named) {
          if (!await holdLiveSet(planDb, setId, { transaction, nowait: true })) gone.add(setId);
        }
        const live = rows.map((r) => (r.scene_set_id && gone.has(String(r.scene_set_id))
          ? { ...r, scene_set_id: null, scene_context: null }
          : r));
        dropped = [...gone];

        // ── Gap 2 Phase B: update the surviving rows IN PLACE ──────────────
        //
        // Nothing is deleted. Every row that is still there keeps its id, so
        // the scene tied to it through scenes.scene_plan_id keeps its own
        // identity and every child record with it; a beat's number is never
        // written, so idx_scene_plans_episode_beat is never contended and no
        // temporary numbering is needed.
        //
        // The read is deliberately NOT filtered by deleted_at: that unique
        // index has no deleted_at predicate, so a soft-deleted row occupies
        // its beat number, and a read that could not see it would let the
        // guarded upsert below skip that beat in silence. Ascending, in one
        // statement, so two overlapping re-plans take the rows in the same
        // order — MEASURED: the opposite order deadlocks (40P01).
        const [existing] = await planDb.query(
          `SELECT id, beat_number, locked, chosen_by_user, scene_set_id, ai_suggested,
                  shot_type, emotional_intent, transition_in,
                  (deleted_at IS NOT NULL) AS tombstoned,
                  (director_note IS NOT NULL) AS has_director_note,
                  (feed_moment IS NOT NULL) AS has_feed_moment,
                  (script_lines IS NOT NULL) AS has_script_lines
             FROM scene_plans WHERE episode_id = :episodeId
             ORDER BY beat_number ASC FOR UPDATE`,
          { replacements: { episodeId }, transaction });

        // A tombstoned row on a beat this plan needs is a controlled conflict:
        // refuse and roll back before a single write. Never deleted, never
        // renumbered, never reassigned.
        const wanted = new Set(live.map((r) => Number(r.beat_number)));
        const blocked = existing
          .filter((r) => r.tombstoned && wanted.has(Number(r.beat_number)))
          .map((r) => Number(r.beat_number));
        if (blocked.length) throw new PlanBeatUnavailableError([...new Set(blocked)].sort((a, b) => a - b));

        const byBeat = new Map(existing.filter((r) => !r.tombstoned).map((r) => [Number(r.beat_number), r]));

        // What the operator has saved against each beat, for plan_changes.
        const planIds = existing.filter((r) => !r.tombstoned).map((r) => r.id);
        const savedByPlan = new Set();
        if (planIds.length) {
          const [withWork] = await planDb.query(
            `SELECT scene_plan_id FROM scenes
               WHERE scene_plan_id IN (:planIds) AND deleted_at IS NULL AND background_url IS NOT NULL`,
            { replacements: { planIds }, transaction });
          for (const r of withWork) savedByPlan.add(String(r.scene_plan_id));
        }

        changes = [];
        for (const row of live) {                      // live is already ascending
          const beatNumber = Number(row.beat_number);
          const before = byBeat.get(beatNumber);
          const [ret] = await planDb.query(
            `INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label,
                shot_type, emotional_intent, transition_in, scene_context,
                locked, chosen_by_user, sort_order, ai_suggested, ai_confidence, created_at, updated_at)
             VALUES (gen_random_uuid(), :episode_id, :beat_number, :beat_name, :scene_set_id, :angle_label,
                CAST(:shot_type AS enum_scene_plans_shot_type), :emotional_intent,
                CAST(:transition_in AS enum_scene_plans_transition_in), :scene_context,
                false, false, :sort_order, true, :ai_confidence, NOW(), NOW())
             ON CONFLICT (episode_id, beat_number) DO UPDATE SET
                beat_name = EXCLUDED.beat_name,
                scene_set_id = EXCLUDED.scene_set_id,
                angle_label = EXCLUDED.angle_label,
                scene_context = EXCLUDED.scene_context,
                shot_type = CASE WHEN scene_plans.ai_suggested THEN EXCLUDED.shot_type ELSE scene_plans.shot_type END,
                emotional_intent = CASE WHEN scene_plans.ai_suggested THEN EXCLUDED.emotional_intent ELSE scene_plans.emotional_intent END,
                transition_in = CASE WHEN scene_plans.ai_suggested THEN EXCLUDED.transition_in ELSE scene_plans.transition_in END,
                sort_order = EXCLUDED.sort_order,
                ai_confidence = EXCLUDED.ai_confidence,
                updated_at = NOW()
               WHERE scene_plans.locked = false AND scene_plans.chosen_by_user = false
                 AND scene_plans.deleted_at IS NULL
             RETURNING id`,
            { replacements: { ...row, episode_id: episodeId, sort_order: beatNumber }, transaction });

          // Zero rows back means the row is locked, chosen_by_user or
          // soft-deleted — MEASURED as the complete set of causes. The first
          // two are the existing B2/L11 guarantee and are expected here
          // (`live` already excludes them, so this is belt and braces); a
          // tombstone was refused above, so reaching one here is a state the
          // read did not see and the transaction stops rather than guess.
          if (!ret.length) {
            const why = byBeat.get(beatNumber);
            if (!why || (!why.locked && !why.chosen_by_user)) {
              throw new PlanBeatUnavailableError([beatNumber]);
            }
            continue;
          }

          if (before) {
            const fields = [];
            if (String(before.scene_set_id || '') !== String(row.scene_set_id || '')) fields.push('scene_set_id');
            // Only worth saying when the planner actually wanted something
            // different and the operator's value was kept instead. A beat
            // whose kept value already matches is not a mismatch.
            if (before.ai_suggested === false
              && (String(before.shot_type || '') !== String(row.shot_type || '')
                || String(before.emotional_intent || '') !== String(row.emotional_intent || '')
                || String(before.transition_in || '') !== String(row.transition_in || ''))) {
              fields.push('operator_fields_kept');
            }
            if (fields.length) {
              changes.push({
                beat_number: beatNumber,
                changed: fields,
                has_saved_work: savedByPlan.has(String(before.id))
                  || Boolean(before.has_director_note || before.has_feed_moment || before.has_script_lines),
              });
            }
          }
        }
      });
    } catch (saveErr) {
      console.error('[ScenePlanner] Saving the plan failed; the beats are as they were:', saveErr?.name || 'Error', saveErr.message);
      throw saveErr;
    }
    if (dropped.length) {
      console.warn(`[ScenePlanner] ${dropped.length} scene set(s) were removed while the plan was being written; those beats were saved with no set.`);
      for (const beat of enrichedBeats) {
        if (beat.scene_set_id && dropped.includes(String(beat.scene_set_id))) {
          beat.scene_set_id = null;
          beat.scene_context = null;
        }
      }
    }
    console.log(`[ScenePlanner] Wrote ${rows.length} beats in place for episode ${episodeId}; kept ${lockedRows.length} locked or chosen, ${changes.length} changed`);

    const plan = enrichedBeats.map((beat) => {
      const kept = lockedByBeat.get(beat.beat_number);
      if (!kept) return { ...beat, locked: false };
      return {
        beat_number: kept.beat_number,
        beat_name: kept.beat_name,
        scene_set_id: kept.scene_set_id,
        angle_label: kept.angle_label,
        shot_type: kept.shot_type,
        emotional_intent: kept.emotional_intent,
        transition_in: kept.transition_in,
        scene_context: kept.scene_context,
        ai_confidence: kept.ai_confidence,
        locked: Boolean(kept.locked),
        chosen_by_user: Boolean(kept.chosen_by_user),
      };
    });
    // The beats stay the array every caller already reads (plan.length, the
    // response's `data`); what changed rides alongside it so the route can
    // report it without changing this function's shape for anyone else.
    plan.plan_changes = changes;
    return plan;
  }

  return enrichedBeats;
}

/**
 * Get the scene plan formatted for the script generator.
 * Returns locked beats with their scene_context injected.
 */
async function getScenePlanForScriptGenerator(episodeId) {
  const plans = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet,
      as: 'sceneSet',
      attributes: ['id', 'name', 'scene_type', 'script_context', 'canonical_description', 'world_location_id'],
      required: false,
      include: WorldLocation ? [{
        model: WorldLocation,
        as: 'worldLocation',
        attributes: ['narrative_role', 'sensory_details'],
        required: false,
      }] : [],
    }],
  });

  return plans.map(p => {
    const loc = p.sceneSet?.worldLocation;
    return {
    beat_number: p.beat_number,
    beat_name: p.beat_name,
    location: p.sceneSet?.name || 'Unknown',
    location_type: p.sceneSet?.scene_type || null,
    angle: p.angle_label,
    shot_type: p.shot_type,
    emotional_intent: p.emotional_intent,
    transition_in: p.transition_in,
    scene_context: p.scene_context || p.sceneSet?.script_context || p.sceneSet?.canonical_description || null,
    director_note: p.director_note,
    locked: p.locked,
    narrative_role: loc?.narrative_role || null,
    atmosphere: loc?.sensory_details?.atmosphere || null,
  };
  });
}

module.exports = {
  generateScenePlan, getScenePlanForScriptGenerator, BEAT_STRUCTURE,
  PlanOutputInvalidError, PlanBeatUnavailableError,
};

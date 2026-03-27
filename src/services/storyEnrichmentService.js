'use strict';

/**
 * storyEnrichmentService.js — Post-write-back auto-enrichment pipeline
 *
 * After a story is written back to the manuscript, this service automatically:
 *   1. Extracts continuity beats (character locations + timeline positions)
 *   2. Updates character arc progression (wound_clock, stakes, visibility)
 *   3. Updates story thread tracking (subplot progression, new threads)
 *   4. Creates world timeline events (major plot moments)
 *
 * All enrichment is async fire-and-forget — failures are logged but never
 * block the write-back response.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { updateArcTracking } = require('./arcTrackingService');

const anthropic = new Anthropic();
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ── Orchestrator ──────────────────────────────────────────────────────────

async function enrichAfterWriteBack(db, {
  story,
  chapter,
  storyText,
  confirmedMemories: _confirmedMemories,
  confirmedRegistryUpdates: _confirmedRegistryUpdates,
}) {
  const status = {
    continuity_beats_created: 0,
    arc_updated: false,
    threads_updated: [],
    threads_created: [],
    world_events_created: 0,
    enriched_at: new Date().toISOString(),
    errors: [],
  };

  const tasks = [
    extractContinuityBeats(db, story, chapter, storyText)
      .then(count => { status.continuity_beats_created = count; })
      .catch(err => { status.errors.push({ step: 'continuity_beats', error: err?.message }); }),

    updateCharacterArcs(db, story)
      .then(updated => { status.arc_updated = updated; })
      .catch(err => { status.errors.push({ step: 'character_arcs', error: err?.message }); }),

    updateStoryThreads(db, story, chapter, storyText)
      .then(result => {
        status.threads_updated = result.updated;
        status.threads_created = result.created;
      })
      .catch(err => { status.errors.push({ step: 'story_threads', error: err?.message }); }),

    createWorldTimelineEvents(db, story, chapter, storyText)
      .then(count => { status.world_events_created = count; })
      .catch(err => { status.errors.push({ step: 'world_events', error: err?.message }); }),
  ];

  await Promise.allSettled(tasks);

  // Persist enrichment status on the story
  try {
    await db.StorytellerStory.update(
      { enrichment_status: status },
      { where: { id: story.id } },
    );
  } catch (err) {
    console.error('[enrichment] failed to save enrichment_status:', err?.message);
  }

  console.log(`[enrichment] story ${story.id} complete:`,
    `beats=${status.continuity_beats_created}`,
    `arc=${status.arc_updated}`,
    `threads_updated=${status.threads_updated.length}`,
    `threads_created=${status.threads_created.length}`,
    `events=${status.world_events_created}`,
    `errors=${status.errors.length}`,
  );

  return status;
}

// ── 1. Continuity Beats ──────────────────────────────────────────────────

async function extractContinuityBeats(db, story, chapter, storyText) {
  if (!db.ContinuityTimeline || !db.ContinuityBeat || !db.ContinuityCharacter) return 0;

  // Find or create active timeline for this book
  const bookId = chapter.book_id;
  let timeline = await db.ContinuityTimeline.findOne({
    where: { show_id: bookId, status: 'active' },
  });
  if (!timeline) {
    timeline = await db.ContinuityTimeline.create({
      show_id: bookId,
      title: `Auto-Timeline — Story ${story.story_number}`,
      status: 'active',
    });
  }

  // Check for existing beats from this story (idempotent)
  const existingBeats = await db.ContinuityBeat.findAll({
    where: { timeline_id: timeline.id },
  });
  const storyTag = `story_${story.story_number}`;
  const alreadyEnriched = existingBeats.some(b =>
    b.note && b.note.includes(storyTag)
  );
  if (alreadyEnriched) return 0;

  const characterList = story.characters_in_scene || [];

  const msg = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract continuity beats from this story. A beat is a moment where a character is at a specific location at a specific time.

Characters in scene: ${JSON.stringify(characterList)}

Story text:
${storyText.slice(0, 8000)}

Return JSON array only. Each element:
{"name": "short beat description", "location": "where", "time_tag": "when (morning/afternoon/evening/night or specific time)", "characters": ["character_key1"]}

Rules:
- Only include beats with clear location + time indicators
- Maximum 6 beats per story
- Use character keys from the provided list when possible
- Return [] if no clear continuity beats found`,
    }],
  });

  const text = msg.content?.[0]?.text || '[]';
  let beats;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    beats = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch { beats = []; }

  if (!beats.length) return 0;

  // Get max sort_order
  const maxOrder = existingBeats.reduce((max, b) => Math.max(max, b.sort_order || 0), 0);

  let created = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (!b.name || !b.location) continue;

    const beat = await db.ContinuityBeat.create({
      timeline_id: timeline.id,
      beat_number: (existingBeats.length + i + 1),
      name: b.name.slice(0, 500),
      location: b.location.slice(0, 500),
      time_tag: b.time_tag || null,
      note: `Auto-extracted from ${storyTag}`,
      sort_order: maxOrder + i + 1,
    });

    // Link characters to beat
    if (b.characters?.length && db.ContinuityBeatCharacter) {
      for (const charKey of b.characters) {
        let contChar = await db.ContinuityCharacter.findOne({
          where: { timeline_id: timeline.id, character_key: charKey },
        });
        if (!contChar) {
          contChar = await db.ContinuityCharacter.create({
            timeline_id: timeline.id,
            character_key: charKey,
            name: charKey,
            sort_order: 0,
          });
        }
        await db.ContinuityBeatCharacter.create({
          beat_id: beat.id,
          character_id: contChar.id,
        });
      }
    }
    created++;
  }

  return created;
}

// ── 2. Character Arc Progression ────────────────────────────────────────

async function updateCharacterArcs(db, story) {
  if (!db.CharacterArc) return false;
  if (!story.character_key) return false;

  // Detect story attributes for arc calculation
  const storyType = story.story_type || 'internal';
  const phase = story.phase || null;

  // Simple text heuristics for arc tracking signals
  const text = (story.text || '').toLowerCase();
  const intimateGenerated = /intimate|kiss|touch|breath|close to him|close to her|bodies/i.test(text);
  const intimateWithDavid = intimateGenerated && /david/i.test(text);
  const postGenerated = /posted|caption|upload|instagram|content|followers/i.test(text);
  const phoneAppeared = /phone|screen lit|notification|dm|message.*ping/i.test(text);

  await updateArcTracking(db, story.character_key, {
    storyNumber: story.story_number,
    storyType,
    phase,
    intimateGenerated,
    intimateWithDavid,
    postGenerated,
    phoneAppeared,
  });

  return true;
}

// ── 3. Story Thread Tracking ────────────────────────────────────────────

async function updateStoryThreads(db, story, chapter, storyText) {
  if (!db.StoryThread) return { updated: [], created: [] };

  const bookId = chapter.book_id;

  // Load existing active threads for context
  const activeThreads = await db.StoryThread.findAll({
    where: { book_id: bookId, status: 'active' },
  });

  const threadContext = activeThreads.map(t => ({
    id: t.id,
    name: t.thread_name,
    type: t.thread_type,
    description: t.description,
    tension_level: t.tension_level,
  }));

  const msg = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Analyze how this story advances existing threads or introduces new ones.

Existing active threads:
${JSON.stringify(threadContext, null, 2)}

Story #${story.story_number} "${story.title}":
${storyText.slice(0, 8000)}

Return JSON only:
{
  "updated": [{"thread_id": "uuid", "key_event": "what happened", "tension_delta": -2 to +2}],
  "new_threads": [{"thread_name": "name", "thread_type": "subplot|mystery|relationship_arc|character_arc|theme", "description": "brief", "tension_level": 1-10, "characters_involved": ["key1"]}]
}

Rules:
- Only flag threads that this story CLEARLY advances
- Only create new threads for genuinely new subplots, not minor mentions
- Maximum 2 new threads per story
- Return {"updated":[],"new_threads":[]} if nothing significant`,
    }],
  });

  const text = msg.content?.[0]?.text || '{}';
  let result;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    result = jsonMatch ? JSON.parse(jsonMatch[0]) : { updated: [], new_threads: [] };
  } catch { result = { updated: [], new_threads: [] }; }

  const updatedIds = [];
  const createdIds = [];

  // Update existing threads
  for (const upd of (result.updated || [])) {
    if (!upd.thread_id) continue;
    const thread = activeThreads.find(t => t.id === upd.thread_id);
    if (!thread) continue;

    const keyEvents = thread.key_events || [];
    keyEvents.push({
      story_number: story.story_number,
      event: upd.key_event,
      chapter_id: chapter.id,
    });

    const newTension = Math.min(10, Math.max(1,
      (thread.tension_level || 5) + (upd.tension_delta || 0)
    ));

    await thread.update({
      key_events: keyEvents,
      tension_level: newTension,
      last_referenced_chapter_id: chapter.id,
      chapters_since_last_reference: 0,
    });
    updatedIds.push(thread.id);
  }

  // Create new threads
  for (const nt of (result.new_threads || []).slice(0, 2)) {
    if (!nt.thread_name) continue;

    // Check for duplicate names
    const exists = activeThreads.some(t =>
      t.thread_name.toLowerCase() === nt.thread_name.toLowerCase()
    );
    if (exists) continue;

    const newThread = await db.StoryThread.create({
      book_id: bookId,
      thread_name: nt.thread_name,
      thread_type: nt.thread_type || 'subplot',
      description: nt.description || null,
      tension_level: nt.tension_level || 5,
      characters_involved: nt.characters_involved || [],
      introduced_chapter_id: chapter.id,
      last_referenced_chapter_id: chapter.id,
      key_events: [{
        story_number: story.story_number,
        event: 'Thread introduced',
        chapter_id: chapter.id,
      }],
    });
    createdIds.push(newThread.id);
  }

  // Increment chapters_since_last_reference for threads NOT touched
  const untouchedThreads = activeThreads.filter(t => !updatedIds.includes(t.id));
  for (const t of untouchedThreads) {
    await t.update({
      chapters_since_last_reference: (t.chapters_since_last_reference || 0) + 1,
    });
  }

  return { updated: updatedIds, created: createdIds };
}

// ── 4. World Timeline Events ────────────────────────────────────────────

async function createWorldTimelineEvents(db, story, chapter, storyText) {
  if (!db.WorldTimelineEvent) return 0;

  // Check idempotency — don't create duplicate events for same story
  const existing = await db.WorldTimelineEvent.findAll({
    where: { chapter_id: chapter.id },
  });
  const storyTag = `story_${story.story_number}`;
  const alreadyEnriched = existing.some(e =>
    e.metadata && e.metadata.source === storyTag
  );
  if (alreadyEnriched) return 0;

  const msg = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract significant plot events from this story for a world timeline.

Story #${story.story_number} "${story.title}":
${storyText.slice(0, 8000)}

Return JSON array only. Each element:
{"event_name": "short name", "event_description": "1-2 sentences", "event_type": "plot|character|relationship|world", "characters_involved": ["key1"], "impact_level": "minor|moderate|major"}

Rules:
- Only include SIGNIFICANT events that affect the story world
- Skip routine actions and internal monologue
- Maximum 3 events per story
- Return [] if no significant events`,
    }],
  });

  const text = msg.content?.[0]?.text || '[]';
  let events;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    events = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch { events = []; }

  if (!events.length) return 0;

  const maxOrder = existing.reduce((max, e) => Math.max(max, e.sort_order || 0), 0);

  let created = 0;
  for (let i = 0; i < Math.min(events.length, 3); i++) {
    const evt = events[i];
    if (!evt.event_name) continue;

    await db.WorldTimelineEvent.create({
      book_id: chapter.book_id,
      chapter_id: chapter.id,
      event_name: evt.event_name.slice(0, 255),
      event_description: evt.event_description || null,
      event_type: evt.event_type || 'plot',
      characters_involved: evt.characters_involved || [],
      impact_level: evt.impact_level || 'minor',
      sort_order: maxOrder + i + 1,
      is_canon: true,
      metadata: { source: storyTag, auto_generated: true },
    });
    created++;
  }

  return created;
}

module.exports = {
  enrichAfterWriteBack,
  extractContinuityBeats,
  updateCharacterArcs,
  updateStoryThreads,
  createWorldTimelineEvents,
};

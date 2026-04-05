'use strict';

/**
 * Grounded Script Generator Service
 *
 * Generates episode scripts that sound like JAWIHP wrote them.
 * Assembles 6 data sources into one Claude call with locked voice DNA.
 */

const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const JAWIHP_VOICE_DNA = `
JAWIHP (JustAWomanInHerPrime) voice rules — NEVER VIOLATE:
- Addresses the audience as "besties"
- Warm, hype-woman energy — celebrates everything
- Narrates what she's clicking/doing in real time
- Reacts naturally ("oh wow these are nice!!")
- Breaks fourth wall ("I can't believe it you guys")
- Drives all decisions — she chooses outfits, clicks icons, opens letters
- Uses casual grammar naturally ("Girl brunch!", "I know that's right")
- Community-building language ("put a dollar emoji in the comments")
- Never robotic, never formal, never generic AI narrator

LALA voice rules — NEVER VIOLATE:
- Always calls people "bestie"
- Short, punchy, confident lines
- Self-aware about her attractiveness and status
- Loyal and girls-girl ("If she can't go. It's a no for me")
- Slightly dramatic but always positive
- Examples: "Bestie, I love my photos.", "I'm a baddie in these internet streets.", "Bestie, this purse is everything!"
`.trim();

const BEAT_TEMPLATES = {
  1:  { name: 'Opening Ritual',       jawihp: true,  lala: false, ui: 'HEADPHONES_ON' },
  2:  { name: 'Login Sequence',       jawihp: true,  lala: true,  ui: 'LOGIN' },
  3:  { name: 'Welcome',              jawihp: true,  lala: false, ui: 'WELCOME' },
  4:  { name: 'Interruption Pulse 1', jawihp: true,  lala: true,  ui: 'MAIL_NOTIFICATION' },
  5:  { name: 'Reveal',               jawihp: true,  lala: true,  ui: 'OPEN_LETTER_INVITE_OVERLAY' },
  6:  { name: 'Strategic Reaction',   jawihp: true,  lala: true,  ui: 'LALA_VOICE_COMMAND' },
  7:  { name: 'Interruption Pulse 2', jawihp: true,  lala: true,  ui: 'SIDE_QUEST' },
  8:  { name: 'Transformation Loop',  jawihp: true,  lala: true,  ui: 'CLOSET_OPEN' },
  9:  { name: 'Reminder/Deadline',    jawihp: true,  lala: false, ui: 'TODO_LIST' },
  10: { name: 'Event Travel',         jawihp: true,  lala: false, ui: 'LOCATION_ICON' },
  11: { name: 'Event Outcome',        jawihp: true,  lala: true,  ui: 'ARRIVAL' },
  12: { name: 'Deliverable Creation', jawihp: false, lala: true,  ui: 'CONTENT_CREATE' },
  13: { name: 'Recap Panel',          jawihp: true,  lala: false, ui: 'STATS_UPDATE' },
  14: { name: 'Cliffhanger',          jawihp: true,  lala: false, ui: 'FADE_OUT' },
};

async function generateGroundedScript(episodeId, showId, models) {
  const { EpisodeBrief, ScenePlan, SceneSet, FranchiseKnowledge, sequelize } = models;

  // 1. Load Episode Brief
  const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } }).catch(() => null);

  // 2. Load Scene Plan with scene context
  const scenePlan = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet, as: 'sceneSet',
      attributes: ['name', 'scene_type', 'script_context', 'canonical_description', 'world_location_id'],
      required: false,
      include: models.WorldLocation ? [{
        model: models.WorldLocation, as: 'worldLocation',
        attributes: ['narrative_role', 'sensory_details'],
        required: false,
      }] : [],
    }],
  }).catch(() => []);

  // 3. Load Show Brain voice rules
  let franchiseLaws = [];
  if (FranchiseKnowledge) {
    franchiseLaws = await FranchiseKnowledge.findAll({
      where: { category: 'franchise_law', status: 'active', always_inject: true },
      attributes: ['title', 'content'],
      limit: 20,
    }).catch(() => []);
  }

  // 4. Load Event data
  let eventData = null;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
      { replacements: { episodeId } }
    );
    eventData = rows?.[0] || null;
  } catch { /* non-blocking */ }

  // 5. Load Wardrobe
  let wardrobeItems = [];
  try {
    const { WardrobeLibrary } = models;
    if (WardrobeLibrary) {
      wardrobeItems = await WardrobeLibrary.findAll({
        where: { is_owned: true },
        attributes: ['name', 'slot', 'tier', 'aesthetic_tags', 'lala_reaction_equipped'],
        limit: 40,
      });
    }
  } catch { /* non-blocking */ }

  // 5b. Load outfit synergy score for this episode
  let outfitScore = null;
  try {
    const [scoreRows] = await sequelize.query(
      `SELECT w.name, w.clothing_category, w.tier, w.aesthetic_tags
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId`,
      { replacements: { episodeId } }
    );
    if (scoreRows.length > 0) {
      outfitScore = { items: scoreRows, count: scoreRows.length };
    }
  } catch { /* non-blocking */ }

  // 6. Load Lala's stats
  let lalaStats = null;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM world_state_snapshots WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId } }
    );
    lalaStats = rows?.[0] || null;
  } catch { /* non-blocking */ }

  // Build prompt
  const prompt = buildScriptPrompt({ brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore });

  console.log(`[ScriptGen] Generating script for episode ${episodeId} with ${scenePlan.length} beats`);

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text || '';
}

function buildScriptPrompt({ brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore }) {
  const beatContext = scenePlan.length > 0
    ? scenePlan.map(b => {
        const tpl = BEAT_TEMPLATES[b.beat_number] || {};
        const loc = b.sceneSet?.worldLocation;
        let entry = `BEAT ${b.beat_number}: ${b.beat_name || tpl.name}
  Location: ${b.sceneSet?.name || 'Unknown'} (${b.sceneSet?.scene_type || ''})
  Angle: ${b.angle_label || ''} | Shot: ${b.shot_type || ''}
  Scene context: ${b.scene_context || b.sceneSet?.script_context || 'No description'}
  Emotional intent: ${b.emotional_intent || ''}
  Director note: ${b.director_note || ''}
  UI action: ${tpl.ui || ''}
  JAWIHP speaks: ${tpl.jawihp} | Lala speaks: ${tpl.lala}`;
        if (loc?.narrative_role) entry += `\n  Narrative role: ${loc.narrative_role}`;
        if (loc?.sensory_details?.atmosphere) entry += `\n  Atmosphere: ${loc.sensory_details.atmosphere}`;
        return entry;
      }).join('\n\n')
    : 'No scene plan — write based on standard 14-beat structure';

  const wardrobeBySlot = {};
  wardrobeItems.forEach(item => {
    const d = item.toJSON ? item.toJSON() : item;
    if (!wardrobeBySlot[d.slot]) wardrobeBySlot[d.slot] = [];
    wardrobeBySlot[d.slot].push(d.name);
  });
  const wardrobeContext = Object.entries(wardrobeBySlot)
    .map(([slot, items]) => `${slot}: ${items.slice(0, 3).join(', ')}`)
    .join('\n') || 'Wardrobe not loaded';

  let eventContext;
  if (eventData) {
    eventContext = `Event: ${eventData.name}\nPrestige: ${eventData.prestige}/10\nDress code: ${eventData.dress_code || 'Not specified'}\nCost: ${eventData.cost_coins} coins\nNarrative stakes: ${eventData.narrative_stakes || ''}`;
    if (eventData.invitation_asset_id) {
      eventContext += '\nInvitation: GENERATED — use in Beat 5 (Reveal). JAWIHP opens the mail and reads the invitation aloud. The InviteLetterOverlay should float up on screen.';
    }
  } else {
    eventContext = 'No event assigned';
  }

  const statsContext = lalaStats?.character_states
    ? JSON.stringify(lalaStats.character_states).slice(0, 200)
    : 'Stats not loaded';

  const voiceLaws = franchiseLaws.slice(0, 5).map(l => {
    try { const c = JSON.parse(l.content); return `${l.title}: ${c.summary || c.rule || ''}`; }
    catch { return l.title; }
  }).join('\n') || 'No franchise laws loaded';

  return `You are writing a script for "Styling Adventures with Lala" — Episode ${brief?.position_in_arc || '?'} of Arc ${brief?.arc_number || '?'}.

${JAWIHP_VOICE_DNA}

═══ FRANCHISE LAWS ═══
${voiceLaws}
CORE LAW: The show must NEVER feel like a dashboard. It must feel like a luxury life simulator.

═══ EPISODE CONTEXT ═══
Arc: ${brief?.arc_number || '?'}, Position: ${brief?.position_in_arc || '?'}/8
Archetype: ${brief?.episode_archetype || 'Rising'}
Designed intent: ${brief?.designed_intent || 'pass'}
Narrative purpose: ${brief?.narrative_purpose || 'Not set'}
Forward hook: ${brief?.forward_hook || 'Not set'}

═══ EVENT ═══
${eventContext}

═══ LALA'S STATE ═══
${statsContext}

═══ WARDROBE ═══
${wardrobeContext}
${outfitScore ? `\n═══ LOCKED OUTFIT ═══\nLala is wearing ${outfitScore.count} pieces for this event:\n${outfitScore.items.map(i => `- ${i.name} (${i.clothing_category}, ${i.tier})`).join('\n')}\nBeat 8 (Transformation): Reference these SPECIFIC items by name as Lala gets dressed.\nBeat 11 (Event Outcome): Her outfit choice affects how the event goes — she is wearing what she chose.` : ''}

═══ SCENE PLAN — 14 BEATS ═══
${beatContext}

═══ FORMAT ═══
Me: [JAWIHP dialogue]
(Action description)
Lala: [Lala dialogue]
[STAT: coins +X]
[TRANSITION: description]

RULES:
1. Beat 8 MUST reference specific wardrobe items by name
2. JAWIHP reacts to everything in real time
3. Lala's lines are ALWAYS short and punchy — max 2-3 sentences
4. Community engagement: ask audience to react in comments at least twice
5. Stats only appear as [STAT:] tags
6. End with a forward hook seeding the next episode

Write the complete 14-beat script now. No preamble — just the script.`;
}

module.exports = { generateGroundedScript };

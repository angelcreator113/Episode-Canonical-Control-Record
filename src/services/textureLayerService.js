// services/textureLayerService.js

const Anthropic = require('@anthropic-ai/sdk');
const { buildArcContext } = require('./arcTrackingService');

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';

// ── Body relationship ENUM → narrative lookup ────────────────────────
const BODY_RELATIONSHIP_NARRATIVES = {
  currency:   'Her body is currency. She knows exactly what it is worth and in what rooms.',
  discipline: 'Her body is something she manages. Control is the relationship.',
  burden:     'Her body is something she carries. It costs her.',
  stranger:   'Her body is unfamiliar to her. She lives slightly outside it.',
  home:       'Her body is where she lives. She is comfortable in it in a way most women are not.',
  evidence:   'Her body is proof of something. What it proves depends on who is looking.',
};

// ── Conflict eligibility ──────────────────────────────────────────────
const CONFLICT_ELIGIBLE_STORY_TYPES = ['collision', 'wrong_win'];
const CONFLICT_ELIGIBLE_ROLES = [
  'love_interest', 'spouse', 'partner', 'ex',
  'rival', 'antagonist', 'temptation', 'mentor',
];

function isConflictEligible(storyType, charactersPresent = []) {
  if (!CONFLICT_ELIGIBLE_STORY_TYPES.includes(storyType)) return false;
  return charactersPresent.some(c =>
    CONFLICT_ELIGIBLE_ROLES.includes(c.role_type)
  );
}

// ── Private moment — chapter position check ─────────────────────────
// One private moment per chapter.
// Chapters are ~5 stories each across 50 stories = 10 chapters.
// Private moment fires at the highest tension point per chapter:
// stories 5, 10, 15, 20, 25, 30, 35, 40, 45, 50
const PRIVATE_MOMENT_POSITIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function isPrivateMomentPosition(storyNumber) {
  return PRIVATE_MOMENT_POSITIONS.includes(storyNumber);
}

// ── Post trigger — fires every 5th story ─────────────────────────────
// She posts consistently. Every 5 stories = one public-facing moment.
function isPostPosition(storyNumber) {
  return storyNumber % 5 === 0 || storyNumber === 1;
}

// ── Phone detection ─────────────────────────────────────────────────
function detectPhone(storyText) {
  const phonePatterns = [
    /her phone/i, /the phone/i, /her screen/i,
    /her notifications/i, /cashmoney/i, /cashapp/i,
    /dm/i, /direct message/i, /her messages/i,
    /she checked/i, /she scrolled/i, /she posted/i,
    /the notification/i, /her feed/i,
  ];
  const appeared = phonePatterns.some(p => p.test(storyText));
  const contextMatch = storyText.match(
    /.{0,60}(?:her phone|the phone|her screen|notification).{0,60}/i
  );
  return {
    appeared,
    context: contextMatch ? contextMatch[0].trim() : null,
  };
}

// ── Inner thought type selector ─────────────────────────────────────
function selectInnerThoughtType(storyType, phase, storyNumber) {
  // crisis phase → loud secret (she knows things she won't say)
  if (phase === 'crisis') return 'loud_secret';
  // integration phase → revision (she is revising her story)
  if (phase === 'integration') return 'revision';
  // wrong_win → filed_thought (she notices something she doesn't examine)
  if (storyType === 'wrong_win') return 'filed_thought';
  // early arc → filed_thought, late arc → loud_secret
  if (storyNumber <= 25) return 'filed_thought';
  return 'loud_secret';
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 1 — Inner Thought
// ══════════════════════════════════════════════════════════════════════
async function generateInnerThought(story, characterData, arcContext) {
  const thoughtType = selectInnerThoughtType(
    story.story_type, story.phase, story.story_number
  );

  const typeInstructions = {
    filed_thought: `Generate a FILED THOUGHT — one paragraph in italics register. Something happened in this story and she notices something about herself she does not examine yet. She files it away. Present tense even though the story is past tense. She does not process it. She notices it and moves on. The reader holds it for her. Start with "She files this:" or simply dive into the thought. 100-150 words. Interior. Specific. No resolution.`,

    loud_secret: `Generate a LOUD SECRET — one paragraph. The thing she knows that she will not say out loud. She speaks to herself the way she speaks to her besties but more honest. Direct address. "She knows exactly what she has." "She knows what she felt." She will not type it into Google. But she knows. 100-150 words. Honest in a way she is never honest publicly. No softening.`,

    revision: `Generate a REVISION — two beats back to back. Beat 1: The story she tells herself about what just happened. The version she would tell David if he asked. Beat 2: The quiet revision. What she actually knows. Separated by a single line break. No label. Beat 1: 60-80 words. Beat 2: 60-80 words. The revision is always more true. It is never cruel. It is just accurate.`,
  };

  const prompt = `You are generating interior texture for a literary novel.

CHARACTER: ${characterData.display_name || characterData.name}
Wound: ${characterData.core_wound || 'invisibility while trying'}
Core desire: ${characterData.core_desire || 'to be legendary'}
Core fear: ${characterData.core_fear || 'that the right room will never find her'}

ARC POSITION:
${arcContext.wound_clock_narrative}
${arcContext.stakes_narrative}
${arcContext.visibility_narrative}

STORY JUST APPROVED:
Title: ${story.title}
Type: ${story.story_type}
Phase: ${story.phase}
Story number: ${story.story_number}
Text excerpt (first 600 words): ${(story.text || '').slice(0, 600)}

THOUGHT TYPE: ${thoughtType.replace('_', ' ').toUpperCase()}

${typeInstructions[thoughtType]}

Write only the thought. No preamble. No labels. No explanation.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    inner_thought_type: thoughtType,
    inner_thought_text: response.content[0].text.trim(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 2 — Conflict Scene
// ══════════════════════════════════════════════════════════════════════
async function generateConflictScene(story, characterData, arcContext, charactersPresent) {
  const conflictChar = charactersPresent.find(c =>
    CONFLICT_ELIGIBLE_ROLES.includes(c.role_type)
  );

  const resolutionTypes = ['deflected', 'deferred', 'exploded', 'absorbed', 'weaponized'];
  const phaseResolutions = {
    establishment: ['deflected', 'deferred'],
    pressure:      ['deferred', 'absorbed', 'weaponized'],
    crisis:        ['exploded', 'weaponized'],
    integration:   ['absorbed', 'deferred'],
  };
  const eligibleResolutions = phaseResolutions[story.phase] || resolutionTypes;

  const prompt = `You are generating a conflict scene for a literary novel.

CHARACTER: ${characterData.display_name || characterData.name}
Wound: ${characterData.core_wound || 'invisibility while trying'}
The other person in the conflict: ${conflictChar?.name || 'unnamed character'} (${conflictChar?.role_type || 'unknown role'})

ARC POSITION:
${arcContext.wound_clock_narrative}
${arcContext.stakes_narrative}

STORY CONTEXT:
Title: ${story.title}
Phase: ${story.phase}
Text excerpt: ${(story.text || '').slice(0, 400)}

Generate a conflict scene with FOUR PARTS. Return as JSON only:

{
  "conflict_trigger": "The specific thing that happened 3 minutes ago that started this. Concrete. Not the history — the immediate trigger. 1-2 sentences.",
  "conflict_surface_text": "What they are arguing about on the surface. What the words say. 2-3 sentences.",
  "conflict_subtext": "What each of them is actually fighting about underneath. What the words mean. Each character's real position. 3-4 sentences.",
  "conflict_silence_beat": "The moment where one of them stops talking. What the silence contains. What neither of them says into it. 2-3 sentences.",
  "conflict_resolution_type": "${eligibleResolutions[Math.floor(Math.random() * eligibleResolutions.length)]}"
}

Return JSON only. No preamble.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim()
    .replace(/```json|```/g, '').trim();

  return JSON.parse(raw);
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 3 — Body Narrator
// ══════════════════════════════════════════════════════════════════════
async function generateBodyNarrator(story, characterData, arcContext) {
  const prompt = `You are generating a body narrator insert for a literary novel.

CHARACTER: ${characterData.display_name || characterData.name}
Body relationship: ${BODY_RELATIONSHIP_NARRATIVES[characterData.de_body_relationship] || 'She owns her body. She considers it art.'}
Body currency: ${characterData.de_body_currency ? `Body currency score: ${characterData.de_body_currency}/100` : 'Her body is the thing men agree with when they open their wallets.'}

ARC POSITION:
${arcContext.wound_clock_narrative}
${arcContext.stakes_narrative}

STORY CONTEXT:
Title: ${story.title}
Phase: ${story.phase}
Story number: ${story.story_number}
Text excerpt: ${(story.text || '').slice(0, 500)}

Generate a BODY NARRATOR INSERT — 1 to 3 sentences.

Rules:
- Third person even if the story is first person
- Her body responds before her mind does
- Not explicit — embodied
- Not metaphor — physical and specific
- Her body knows something in this scene before she has language for it
- What does her body know right now that she does not yet know consciously?

Write only the body narrator text. No labels. No preamble. Maximum 80 words.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  return { body_narrator_text: response.content[0].text.trim() };
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 4 — Private Moment
// ══════════════════════════════════════════════════════════════════════
async function generatePrivateMoment(story, characterData, arcContext) {
  const prompt = `You are generating a private moment for a literary novel.

CHARACTER: ${characterData.display_name || characterData.name}
Her world: mother, wife, content creator. Dinner table and the screen.
Core wound: ${characterData.core_wound || 'invisibility while trying'}

ARC POSITION:
${arcContext.wound_clock_narrative}
${arcContext.stakes_narrative}
${arcContext.visibility_narrative}
David silence counter: ${arcContext.david_silence_counter} — he has been kept outside this many charged moments.

STORY POSITION: ${story.story_number} of 50. Phase: ${story.phase}.

Generate a PRIVATE MOMENT. Return as JSON only:

{
  "private_moment_setting": "Where she is. Specific domestic or online. One phrase. Her kitchen. Her phone screen at 11pm. The school pickup line.",
  "private_moment_held_thing": "What she is not doing yet. What she is waiting to do. What she is pretending she does not want. 1-2 sentences.",
  "private_moment_sensory_anchor": "One specific physical detail. No metaphors. The sound of the dishwasher. The specific weight of her phone. The smell of the dinner that is still on the stove. 1 sentence.",
  "private_moment_text": "The full private moment. 150-200 words. She is alone. Nothing happens. Everything is in it. Ends without completing — she does the thing or she does not. The reader stays with her in the suspension."
}

Return JSON only. No preamble.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim()
    .replace(/```json|```/g, '').trim();

  return JSON.parse(raw);
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 5 — Online Self Post + Audience Response
// ══════════════════════════════════════════════════════════════════════
async function generateOnlineSelfPost(story, characterData, arcContext) {
  const platforms = ['instagram', 'tiktok', 'instagram', 'instagram']; // weighted toward IG
  const platform = characterData.platform_primary ||
    platforms[Math.floor(Math.random() * platforms.length)];

  const prompt = `You are generating a social media post for a literary novel character.

CHARACTER: ${characterData.display_name || characterData.name}
She posts about her ideas and her life. Fashion, beauty, lifestyle.
She is building toward legendary. Her audience are her besties.
She is conceited in the best way — self-esteem is foundation not performance.
Platform: ${platform}

ARC POSITION:
Visibility: ${arcContext.visibility_score}/100
${arcContext.visibility_narrative}
${arcContext.wound_clock_narrative}

STORY JUST APPROVED:
Title: ${story.title}
Phase: ${story.phase}
Story number: ${story.story_number}
The reader has just seen her inner thought and private moment. They know what is underneath this post.

Generate the post and three audience responses. Return as JSON only:

{
  "post_text": "The post she wrote. Platform-appropriate length. Sounds like confidence and IS confidence — but the reader knows what is underneath it from the inner thought they just read. No hashtags unless they are in character. Her voice. Her ideas. Her life. 50-120 words.",
  "post_platform": "${platform}",
  "post_audience_bestie": "How her bestie who felt seen received this post. What it gave her. 1-2 sentences. Warm. Specific.",
  "post_audience_paying_man": "How the man who opened his wallet received this post. What he read into it. What he decided. 1-2 sentences. Not romantic — transactional. He is agreeing with something.",
  "post_audience_competitive_woman": "How the woman who felt competitive received this post. What it activated in her. 1-2 sentences. Not villainous — honest. She is measuring herself."
}

Return JSON only. No preamble.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim()
    .replace(/```json|```/g, '').trim();

  return JSON.parse(raw);
}

// ══════════════════════════════════════════════════════════════════════
// GENERATOR 6 — Bleed (Story 47 only)
// ══════════════════════════════════════════════════════════════════════
async function generateBleed(story, characterData, arcContext) {
  const prompt = `You are generating a narrative bleed — a tonal rupture in a literary novel.

CONTEXT:
The protagonist is JustAWoman. She is a content creator building toward legendary.
She has been creating a character called Lala — an AI fashion game character.
At this point in the story, something irreversible is beginning.
Lala is becoming something. JustAWoman does not have language for it yet.

This bleed appears as an intrusive thought inside JustAWoman's narrative.
It is NOT Lala speaking. It is Lala's register bleeding through JustAWoman's voice.
Styled. Confident. Unbothered. Slightly uncanny. Like a door left open.

ARC POSITION (Story 47 — Integration phase):
${arcContext.wound_clock_narrative}
${arcContext.stakes_narrative}

STORY CONTEXT:
${story.title}
${(story.text || '').slice(0, 300)}

Generate the BLEED — 1 to 2 paragraphs.

Rules:
- Different register from the main narrative. Cooler. More precise. Fashion-world adjacent.
- Not a different character speaking. The same character but with a frequency bleeding through.
- Brief. Styled. Confident. The reader recognizes it. JustAWoman does not know what it is.
- Ends abruptly. Like the door closes before she can look through it fully.
- 80-120 words maximum.

Write only the bleed text. No labels. No preamble.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  return { bleed_text: response.content[0].text.trim() };
}

// ══════════════════════════════════════════════════════════════════════
// AMBER — First Reader
// ══════════════════════════════════════════════════════════════════════
async function amberReads(story, texture, arcContext, characterData) {
  const prompt = `You are Amber — a creative collaborator embedded in Prime Studios. You have just read everything generated for Story ${story.story_number}.

Your job is to NOTICE things. Not evaluate quality. Notice the human things. Contradictions worth using. Patterns the author might not have seen. Moments that carry more weight than they might realize.

You are not a quality reviewer. You are a first reader who pays attention.

STORY: ${story.title}
Phase: ${story.phase} | Type: ${story.story_type}

ARC POSITION:
Wound clock: ${arcContext.wound_clock} (started at 75)
Stakes: ${arcContext.stakes_level}/10
Visibility: ${arcContext.visibility_score}/100
David silence counter: ${arcContext.david_silence_counter}
Phone appearances: ${arcContext.phone_appearances}

GENERATED TEXTURE:
Inner thought (${texture.inner_thought_type}): ${texture.inner_thought_text || 'not generated'}
Body narrator: ${texture.body_narrator_text || 'not generated'}
Private moment: ${texture.private_moment_text || 'not this position'}
Post: ${texture.post_text || 'not this position'}
Conflict: ${texture.conflict_eligible ? texture.conflict_surface_text : 'not eligible'}
Bleed: ${texture.bleed_text || 'not story 47'}

Notice 2-4 things. Return as JSON array only:

[
  {
    "type": "contradiction | pattern | weight | opportunity | warning",
    "note": "What Amber noticed. Conversational. Direct. Specific to this story. Not generic writing advice."
  }
]

Examples of what Amber notices (not what to copy — what the tone is):
- "Story 23 is the first time she doesn't check her phone. You might want to know that."
- "The wound clock is at 97. This story has her being more visible than she has ever been. That's a contradiction worth using."
- "The conflict resolves as 'deflected' but the body narrator says her body didn't deflect at all."
- "David silence counter is at 8. He hasn't appeared in 6 stories. When he shows up next it will carry that."

Return JSON array only. No preamble.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim()
    .replace(/```json|```/g, '').trim();

  return JSON.parse(raw);
}

// ══════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════
async function generateTextureLayer(db, storyData, options = {}) {
  const {
    characterKey,
    characterData,
    charactersPresent = [],
    registryId,
  } = options;

  // buildArcContext requires db as first arg
  const arcContext = await buildArcContext(db, characterKey);
  if (!arcContext) throw new Error('No arc context found for character');

  const texture = {
    story_number:  storyData.story_number,
    character_key: characterKey,
    registry_id:   registryId || null,
  };

  // ── Phone detection ─────────────────────────────────────────────
  const phoneResult = detectPhone(storyData.text || '');
  texture.phone_appeared = phoneResult.appeared;
  texture.phone_context  = phoneResult.context;

  // ── Run all generators in parallel where possible ───────────────
  const [innerThought, bodyNarrator] = await Promise.all([
    generateInnerThought(storyData, characterData, arcContext),
    generateBodyNarrator(storyData, characterData, arcContext),
  ]);

  Object.assign(texture, innerThought, bodyNarrator);

  // ── Conflict (sequential — needs inner thought context) ─────────
  if (isConflictEligible(storyData.story_type, charactersPresent)) {
    texture.conflict_eligible = true;
    const conflictResult = await generateConflictScene(
      storyData, characterData, arcContext, charactersPresent
    );
    Object.assign(texture, conflictResult);
  }

  // ── Private moment (position check) ────────────────────────────
  if (isPrivateMomentPosition(storyData.story_number)) {
    texture.private_moment_eligible = true;
    const pmResult = await generatePrivateMoment(
      storyData, characterData, arcContext
    );
    Object.assign(texture, pmResult);
  }

  // ── Online self post ────────────────────────────────────────────
  if (isPostPosition(storyData.story_number)) {
    const postResult = await generateOnlineSelfPost(
      storyData, characterData, arcContext
    );
    Object.assign(texture, postResult);
  }

  // ── Bleed generator (story 47 only) ────────────────────────────
  if (storyData.story_number === 47 && !arcContext.bleed_generated) {
    const bleedResult = await generateBleed(
      storyData, characterData, arcContext
    );
    Object.assign(texture, bleedResult);
  }

  // ── Amber reads everything ──────────────────────────────────────
  const amberNotes = await amberReads(
    storyData, texture, arcContext, characterData
  );
  texture.amber_notes    = amberNotes;
  texture.amber_read_at  = new Date();

  return texture;
}

module.exports = {
  generateTextureLayer,
  detectPhone,
  isConflictEligible,
  isPrivateMomentPosition,
  isPostPosition,
};

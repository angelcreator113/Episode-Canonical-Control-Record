'use strict';

// ── Wound clock narrative meaning ────────────────────────────────────
// The generation prompt gets a qualitative description, not just a number.
// This is what makes it feel literary rather than mechanical.

function woundClockNarrative(clock) {
  if (clock < 80)  return 'She has been at this for years. The trying is part of who she is now. She does not remember what it felt like before she wanted this.';
  if (clock < 90)  return 'She has been at this long enough that consistency is not an act of will anymore. It is reflex. But the right room has not found her yet and she knows it.';
  if (clock < 100) return 'She has built something real. Something consistent. Something that would matter to someone who understood what they were looking at. The right someone has not looked yet.';
  if (clock < 110) return 'The trying has weight now. Not desperation — she is not desperate. Weight. The accumulated evidence of showing up every day and the right room still not finding her.';
  if (clock < 120) return 'She is past the point where other women would have stopped. She knows this. She does not say it. But she knows it.';
  return 'The clock does not stop. She does not stop. These are the same thing.';
}

// ── Stakes level narrative meaning ───────────────────────────────────
function stakesNarrative(level) {
  const stakes = {
    1:  'What she risks is small and recoverable. A moment. An opportunity. A post that did not land.',
    2:  'What she risks is her consistency — the thing she has built by showing up every day.',
    3:  'What she risks is being seen wrong. Not invisible. Misread.',
    4:  'What she risks is the version of herself she shows online. The gap between her real life and her loud secret is starting to have edges.',
    5:  'What she risks is David\'s trust. Not his love — she is not afraid of losing his love. His trust in the version of her he thinks he knows.',
    6:  'What she risks is the boundary between her real life and what she has built online. The domestic frame is pressing against the expansion.',
    7:  'What she risks is the men in her DMs knowing where she lives. Not literally. Proximally. The digital closing in on the real.',
    8:  'What she risks is herself. The confident unbothered version she is building — it requires that she not look too closely at certain things. She is starting to look.',
    9:  'What she risks is Lala. The container she built for her confidence. If it breaks before she understands what it was, she loses both.',
    10: 'What she risks is everything she has been. The woman at the dinner table and the woman men open their wallets for are the same woman. They are about to find out if that is survivable.',
  };
  return stakes[level] || stakes[1];
}

// ── Visibility score narrative meaning ───────────────────────────────
function visibilityNarrative(score) {
  if (score < 20)  return 'She is posting into a void. The content is good. The room is wrong.';
  if (score < 35)  return 'There are people watching. Not the right people yet. But people.';
  if (score < 50)  return 'She is being seen. In fragments. By the wrong audience mostly. But the right one is starting to notice.';
  if (score < 65)  return 'The right room is finding her. She can feel it. She does not trust it yet.';
  if (score < 80)  return 'She is visible. Genuinely visible. This is what she built toward. It feels different than she expected.';
  return 'She is seen. Completely. This is the thing she wanted. She is finding out what wanting it cost.';
}

// ── Core update function ──────────────────────────────────────────────
async function updateArcTracking(db, characterKey, options = {}) {
  const {
    storyNumber,
    storyType,
    phase,
    intimateGenerated = false,
    intimateWithDavid = false,
    postGenerated = false,
    phoneAppeared = false,
  } = options;

  let arc = await db.CharacterArc.findOne({ where: { character_key: characterKey } });

  if (!arc) {
    arc = await db.CharacterArc.create({
      character_key: characterKey,
      wound_clock: 75,
      stakes_level: 1,
      visibility_score: 20,
      david_silence_counter: 0,
      phone_appearances: 0,
    });
  }

  const updates = {};

  // Wound clock — increments every approved story
  updates.wound_clock = arc.wound_clock + 1;

  // Stakes level — escalates based on story number and phase
  // 10 levels across 50 stories
  const naturalStakes = Math.ceil((storyNumber || 1) / 5); // 1-10 across 50 stories
  // Crisis phase adds weight
  const phaseBoost = phase === 'crisis' ? 1 : 0;
  updates.stakes_level = Math.min(10, Math.max(arc.stakes_level, naturalStakes + phaseBoost));

  // Visibility score — complex calculation
  let visibilityDelta = 0;
  if (storyType === 'wrong_win')  visibilityDelta += 3;  // she achieves something
  if (storyType === 'collision')  visibilityDelta += 1;  // she encounters the world
  if (storyType === 'internal')   visibilityDelta -= 1;  // she turns inward
  if (phase === 'crisis')         visibilityDelta -= 2;  // crisis contracts visibility
  if (phase === 'integration')    visibilityDelta += 2;  // integration expands it
  if (intimateGenerated && !intimateWithDavid) visibilityDelta += 2; // being wanted
  if (postGenerated)              visibilityDelta += 1;  // she posted, she reached out

  updates.visibility_score = Math.min(100, Math.max(0, arc.visibility_score + visibilityDelta));

  // David silence counter
  if (intimateGenerated && !intimateWithDavid) {
    updates.david_silence_counter = arc.david_silence_counter + 1;
  }

  // Phone appearances
  if (phoneAppeared) {
    updates.phone_appearances = arc.phone_appearances + 1;
  }

  // Bleed generator flag — story 47
  if (storyNumber === 47) {
    updates.bleed_generated = true;
  }

  await arc.update(updates);
  return { ...arc.dataValues, ...updates };
}

// ── Build generation context ──────────────────────────────────────────
// This is what gets injected into every generation prompt
async function buildArcContext(db, characterKey) {
  if (!db.CharacterArc) return null;
  let arc;
  try {
    arc = await db.CharacterArc.findOne({ where: { character_key: characterKey } });
  } catch (err) {
    console.warn('[buildArcContext] Query failed (table may not exist):', err.message);
    return null;
  }
  // Auto-initialize arc for new characters instead of returning null
  if (!arc) {
    try {
      arc = await db.CharacterArc.create({
        character_key: characterKey,
        wound_clock: 75,
        stakes_level: 1,
        visibility_score: 20,
        david_silence_counter: 0,
        phone_appearances: 0,
      });
    } catch (createErr) {
      console.warn('[buildArcContext] Could not auto-create arc:', createErr.message);
      return null;
    }
  }

  return {
    wound_clock: arc.wound_clock,
    wound_clock_narrative: woundClockNarrative(arc.wound_clock),
    stakes_level: arc.stakes_level,
    stakes_narrative: stakesNarrative(arc.stakes_level),
    visibility_score: arc.visibility_score,
    visibility_narrative: visibilityNarrative(arc.visibility_score),
    david_silence_counter: arc.david_silence_counter,
    phone_appearances: arc.phone_appearances,
    phone_weight: arc.phone_appearances === 0
      ? 'Her phone has not appeared yet in this arc.'
      : arc.phone_appearances < 5
        ? `Her phone has appeared ${arc.phone_appearances} times. It is becoming familiar.`
        : arc.phone_appearances < 10
          ? `Her phone has appeared ${arc.phone_appearances} times. The reader knows what it means when she reaches for it.`
          : `Her phone has appeared ${arc.phone_appearances} times. It carries the weight of every previous appearance. When it appears now the reader feels all of them.`,
    bleed_position: arc.bleed_generated
      ? 'The Lala intrusion has already happened. Her world has been disrupted at the root.'
      : 'The Lala intrusion has not happened yet.',
  };
}

// ── Build prompt section for injection ─────────────────────────────────
function buildArcContextPromptSection(arcContext) {
  if (!arcContext) return '';

  return `
## ARC TRACKING — CURRENT POSITION

Wound Clock: ${arcContext.wound_clock}
${arcContext.wound_clock_narrative}

Stakes Level: ${arcContext.stakes_level}/10
${arcContext.stakes_narrative}

Visibility: ${arcContext.visibility_score}/100
${arcContext.visibility_narrative}

David Silence Counter: ${arcContext.david_silence_counter}
${arcContext.david_silence_counter > 0
    ? `David has been kept outside ${arcContext.david_silence_counter} charged moments. He performs acceptance. The weight accumulates invisibly.`
    : 'David has not yet been kept outside a charged moment.'
  }

Her Phone: ${arcContext.phone_weight}

${arcContext.bleed_position}

These are not backstory. They are the pressure the character is under RIGHT NOW. Every scene, every sentence, every silence should carry this weight.
`;
}

module.exports = {
  woundClockNarrative,
  stakesNarrative,
  visibilityNarrative,
  updateArcTracking,
  buildArcContext,
  buildArcContextPromptSection,
};

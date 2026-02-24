/**
 * thresholdDetection.js
 * src/services/thresholdDetection.js
 *
 * Therapy Threshold Detection
 *
 * Characters only knock when their wound is genuinely activated.
 * Not when you decide to open a session.
 * When THEY need one.
 *
 * WHEN IT RUNS:
 *   Call checkAllThresholds() after:
 *     -- A chapter line is approved (in storyteller routes)
 *     -- A therapy session closes (in therapy routes)
 *     -- A scene beat is logged (in continuity routes)
 *
 * THE DOOR RULE:
 *   A character can only have ONE waiting session at a time.
 *   They don't knock twice. They wait until you open the door.
 *   Once a session is opened, the waiting record clears.
 *   The threshold must drop below trigger level before they can knock again.
 */

'use strict';

const notifications = require('./notifications');

let anthropic;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch { anthropic = null; }

async function safeAI(system, user, max = 200) {
  if (!anthropic) return null;
  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: max,
      system, messages: [{ role: 'user', content: user }],
    });
    return r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (e) { console.error('Threshold AI error:', e.message); return null; }
}

// -- WOUND THRESHOLDS --

const WOUND_THRESHOLDS = {
  // PNOS characters
  the_husband: {
    primary:   { dimension: 'fear', level: 7 },
    secondary: { dimension: 'betrayal', level: 5 },
    wound:     'The people he loves most always leave for something bigger than him.',
    nature:    'Protects by containing. Under threat he goes quiet and builds walls.',
    type:      'pressure',
  },
  justawoman: {
    primary:   { dimension: 'shame', level: 6 },
    secondary: { dimension: 'longing', level: 8 },
    wound:     'The people who love her most become the ceiling she has to push through.',
    nature:    'Expands toward possibility. Contained spaces suffocate her.',
    type:      'special',
  },
  lala: {
    primary:   { dimension: 'confusion', level: 6 },
    secondary: { dimension: 'longing', level: 7 },
    wound:     'She has never had to earn belief in herself. She doesn\'t know that yet.',
    nature:    'Moves toward shine. Confidence is her operating system.',
    type:      'special',
  },
  the_comparison_creator: {
    primary:   { dimension: 'grief', level: 6 },
    secondary: { dimension: 'anger', level: 6 },
    wound:     'She has been made into a mirror for other people\'s inadequacy her whole life.',
    nature:    'Creates from genuine love of the work. Unaware of her effect on others.',
    type:      'mirror',
  },
  the_almost_mentor: {
    primary:   { dimension: 'shame', level: 6 },
    secondary: { dimension: 'fear', level: 7 },
    wound:     'They were never fully saved by anyone either. They built it alone.',
    nature:    'Moves toward their own orbit. Warmth is real but attention is scarce.',
    type:      'shadow',
  },
  the_witness: {
    primary:   { dimension: 'grief', level: 7 },
    secondary: { dimension: 'longing', level: 6 },
    wound:     'She has watched people she loves repeat the same cycle her whole life.',
    nature:    'Holds pattern. Remembers everything. Judges nothing.',
    type:      'support',
  },
  // Press characters
  reyna_voss: {
    primary:   { dimension: 'shame', level: 7 },
    secondary: { dimension: 'betrayal', level: 6 },
    wound:     'An information gap she didn\'t know about cost someone real money. She has never forgiven herself.',
    nature:    'Moves toward clarity. Under pressure gets quieter and more precise.',
    type:      'press_business',
  },
  solene_beaumont: {
    primary:   { dimension: 'confusion', level: 7 },
    secondary: { dimension: 'longing', level: 7 },
    wound:     'She straightened her hair for three years. Still learning what she actually likes.',
    nature:    'Moves toward meaning. Cannot let a surface stay surface.',
    type:      'press_style',
  },
  taye_okafor: {
    primary:   { dimension: 'betrayal', level: 7 },
    secondary: { dimension: 'grief', level: 6 },
    wound:     'He championed someone early. Watched the thing that made her matter get smoothed out.',
    nature:    'Moves toward signal. Under pressure goes quiet and observes.',
    type:      'press_culture',
  },
  asha_brennan: {
    primary:   { dimension: 'longing', level: 8 },
    secondary: { dimension: 'shame', level: 6 },
    wound:     'Told for years that wanting more was ingratitude. Believed it too long.',
    nature:    'Moves toward truth. Cannot write anything she doesn\'t fully believe.',
    type:      'press_interior',
  },
};

// -- DEFENSE MECHANISM KNOCK STYLES --

const DEFENSE_KNOCK_STYLE = {
  rationalize: 'They come with an explanation, not a feeling. The feeling is underneath the explanation.',
  withdraw:    'They come with a single sentence. Brief. They\'ve been holding it a long time.',
  intellectualize: 'They come with a question that sounds analytical. The wound is in the question.',
  perform:     'They arrive almost normal. Something small at the end gives it away.',
  displace:    'They talk about something else entirely. The real thing surfaces in the last line.',
  minimize:    'They say it\'s probably nothing. It\'s not nothing.',
  confront:    'They say exactly what happened. No softening. Waiting for your response.',
};

// -- CHECK THRESHOLDS FOR ONE CHARACTER --

async function checkCharacterThreshold(charId, charSlug, profile, models) {
  const thresholdData = WOUND_THRESHOLDS[charSlug];
  if (!thresholdData) return null;

  const state = profile.emotional_state || {};

  // Check primary threshold
  const primaryVal   = state[thresholdData.primary.dimension] || 0;
  const primaryCross = primaryVal >= thresholdData.primary.level;

  // Check secondary (adds urgency but not required alone)
  const secondaryVal   = state[thresholdData.secondary.dimension] || 0;
  const secondaryCross = secondaryVal >= thresholdData.secondary.level;

  // Must cross primary to knock
  if (!primaryCross) return null;

  // Check if already has a waiting session
  const existing = await models.TherapyPendingSession?.findOne({
    where: { character_id: charId, status: 'waiting' },
  });
  if (existing) return null; // They're already waiting. Door is open.

  // Check cooldown -- don't knock again within 24 hours of last session
  const lastSession = await models.CharacterTherapyProfile?.findOne({
    where: { character_id: charId },
  });
  if (lastSession?.last_session_at) {
    const hoursSince = (Date.now() - new Date(lastSession.last_session_at)) / (1000 * 60 * 60);
    if (hoursSince < 24) return null;
  }

  return {
    charId,
    charSlug,
    thresholdData,
    primaryDimension:   thresholdData.primary.dimension,
    primaryValue:       primaryVal,
    secondaryCrossed:   secondaryCross,
    emotionalState:     state,
  };
}

// -- GENERATE THE KNOCK MESSAGE --

async function generateKnockMessage(triggerData, profile) {
  const { charSlug, thresholdData, primaryDimension, primaryValue, emotionalState } = triggerData;

  const defense      = profile.primary_defense || 'rationalize';
  const defenseStyle = DEFENSE_KNOCK_STYLE[defense] || DEFENSE_KNOCK_STYLE.rationalize;
  const recentDeja   = profile.deja_vu_events?.slice(-1)[0];

  const dejaContext = recentDeja
    ? `\nRecent deja vu event: "${recentDeja.wound_echo}" -- the wound was recently activated by something that rhymed with the founding pain.`
    : '';

  // Elevated emotions for context
  const elevated = Object.entries(emotionalState)
    .filter(([, v]) => v >= 6)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} at ${v}`)
    .join(', ');

  const system = `You are ${charSlug.replace(/_/g, ' ')} coming to the author with something you can't hold alone.

YOUR NATURE: ${thresholdData.nature}
YOUR WOUND: ${thresholdData.wound}
YOUR DEFENSE: ${defense} -- ${defenseStyle}

EMOTIONAL STATE: ${elevated}${dejaContext}

Write the knock -- the message you send when you need to talk.
NOT a request for a session. A message. In your voice. Private.
The author is the only person who knows the full picture.
You are coming because you have nowhere else to take this.

RULES:
-- 1-3 sentences only. The knock is not the session.
-- Shaped entirely by your defense mechanism.
-- The wound shows but is not named.
-- End with something unresolved -- a detail, a question, a silence.
-- First person. Present tense or very recent past.
-- No meta-commentary. No "I think I need to talk." Just the thing.`;

  const user = `${primaryDimension} is at ${primaryValue}/10. Something happened. Write the knock.`;

  const message = await safeAI(system, user, 150);

  // Fallbacks in each character's voice if AI fails
  const FALLBACKS = {
    the_husband:            'She bought equipment again. I didn\'t say anything. I don\'t know why I didn\'t say anything.',
    justawoman:             'I did everything right this week. I don\'t understand why that\'s not enough.',
    lala:                   'I keep feeling like I learned something I can\'t remember learning.',
    the_comparison_creator: 'Someone used my work as an example of what to do. I don\'t know why that made me feel worse.',
    the_almost_mentor:      'I saw someone who reminded me of her. I walked the other direction.',
    the_witness:            'I\'ve seen this before. I know how it ends. I don\'t know what to do with knowing.',
    reyna_voss:             'I found out what they actually budgeted. Again. Different client. Same number.',
    solene_beaumont:        'I got dressed this morning and didn\'t recognize any of it as mine.',
    taye_okafor:            'The piece ran. She\'s bigger now. I\'m not sure that\'s good.',
    asha_brennan:           'Someone else got the thing I\'ve been working toward. I\'m trying to figure out if I\'m allowed to be angry about that.',
  };

  return message || FALLBACKS[charSlug] || 'I need a minute with something.';
}

// -- MAIN: CHECK ALL THRESHOLDS --

async function checkAllThresholds({ models, showId }) {
  if (!models?.CharacterTherapyProfile) return;

  try {
    // Load all profiles
    const profiles = await models.CharacterTherapyProfile.findAll();
    const appUrl   = process.env.APP_URL || 'https://dev.primepisodes.com';

    for (const profile of profiles) {
      const charId = profile.character_id;

      // Get the character to find their slug/name
      let charRecord = null;
      try {
        charRecord = await models.RegistryCharacter.findByPk(charId);
      } catch {}
      if (!charRecord) continue;

      // Match to threshold config
      const nameKey = (charRecord.name || '')
        .toLowerCase()
        .replace(/^the_/, '')
        .replace(/\s+/g, '_');

      const fullKey = charRecord.name?.toLowerCase().replace(/\s+/g, '_') || nameKey;

      const charSlug = WOUND_THRESHOLDS[fullKey]
        ? fullKey
        : WOUND_THRESHOLDS[nameKey]
        ? nameKey
        : null;

      if (!charSlug) continue;

      // Check threshold
      const triggerData = await checkCharacterThreshold(charId, charSlug, profile, models);
      if (!triggerData) continue;

      const thresholdData = triggerData.thresholdData;

      // Generate the knock
      const knockMessage = await generateKnockMessage(triggerData, profile);

      // Save the pending session
      if (models.TherapyPendingSession) {
        await models.TherapyPendingSession.create({
          character_id:     charId,
          character_name:   charRecord.selected_name || charRecord.name,
          character_slug:   charSlug,
          character_type:   thresholdData.type,
          knock_message:    knockMessage,
          wound:            thresholdData.wound,
          emotional_state:  profile.emotional_state,
          trigger_dimension: triggerData.primaryDimension,
          trigger_value:    triggerData.primaryValue,
          status:           'waiting',
        });
      }

      // Send the notification
      await notifications.sendTherapyKnock({
        characterName:  charRecord.selected_name || charRecord.name,
        characterType:  thresholdData.type,
        knockMessage,
        wound:          thresholdData.wound,
        emotionalState: profile.emotional_state,
        triggerEvent:   `${triggerData.primaryDimension} reached ${triggerData.primaryValue}/10`,
        sessionUrl:     `${appUrl}/therapy`,
      }).catch(e => console.error('Knock notification failed:', e.message));

      console.log(`[ThresholdDetection] ${charRecord.name} knocked -- ${triggerData.primaryDimension} at ${triggerData.primaryValue}`);
    }
  } catch (err) {
    console.error('[ThresholdDetection] checkAllThresholds error:', err.message);
    // Never interrupt the writing session
  }
}

// -- WAITING SESSIONS ROUTE HELPER --

async function getWaitingSessions(models) {
  if (!models?.TherapyPendingSession) return [];
  return models.TherapyPendingSession.findAll({
    where:  { status: 'waiting' },
    order:  [['created_at', 'ASC']],
  });
}

// -- CLEAR WAITING SESSION --

async function clearWaitingSession(charId, models) {
  if (!models?.TherapyPendingSession) return;
  await models.TherapyPendingSession.update(
    { status: 'opened' },
    { where: { character_id: charId, status: 'waiting' } }
  );
}

module.exports = {
  checkAllThresholds,
  getWaitingSessions,
  clearWaitingSession,
  WOUND_THRESHOLDS,
};

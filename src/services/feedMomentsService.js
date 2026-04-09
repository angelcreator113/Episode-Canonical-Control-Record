'use strict';

/**
 * Feed Moments Service
 *
 * Generates phone-screen content for each episode beat.
 * When Lala looks at her phone, the viewer sees what she sees.
 *
 * Each feed moment has:
 * - trigger_profile: who posted/did something
 * - trigger_action: what they did
 * - phone_screen: { type, content, image_desc }
 * - lala_dialogue: what she says out loud
 * - lala_internal: inner monologue (narration)
 * - behavior_shift: how it changes the next beat
 *
 * Content is filtered through the show's content lens.
 */

const { v4: uuidv4 } = require('uuid');

// ─── SHOW CONTENT LENSES ────────────────────────────────────────────────────
// Each show type filters what kinds of feed content appear on screen

const CONTENT_LENSES = {
  'styling_adventures': {
    name: 'Styling Adventures with Lala',
    focus: ['fashion', 'beauty', 'style', 'outfit', 'brand', 'luxury', 'designer'],
    drama_types: ['outfit comparison', 'style shade', 'brand drama', 'who wore it better', 'uninvited reactions'],
    notification_types: ['outfit post', 'style reveal', 'brand collab announcement', 'fashion hot take', 'event outfit preview', 'get ready with me'],
    tone: 'fashion-obsessed, appearance-conscious, style-competitive',
  },
  'music': {
    name: 'Music Show',
    focus: ['music', 'performance', 'collab', 'studio', 'chart', 'release'],
    drama_types: ['collab drama', 'chart competition', 'feature snub', 'sample drama'],
    notification_types: ['new release', 'studio session', 'performance announcement', 'chart update'],
    tone: 'rhythm-obsessed, industry-aware, competitive',
  },
  'dating': {
    name: 'Dating Show',
    focus: ['relationship', 'dating', 'couple', 'breakup', 'situationship'],
    drama_types: ['public breakup', 'new couple reveal', 'ex drama', 'DM leak'],
    notification_types: ['couple post', 'relationship hint', 'ex sighting', 'dating app screenshot'],
    tone: 'romance-obsessed, relationship-analyzing, emotionally invested',
  },
  default: {
    name: 'Creator Life',
    focus: ['content', 'creator', 'brand', 'influence', 'social'],
    drama_types: ['engagement drama', 'collab gone wrong', 'callout post', 'viral moment'],
    notification_types: ['new post', 'going live', 'collab announcement', 'milestone'],
    tone: 'creator-focused, platform-aware, engagement-conscious',
  },
};

// ─── BEAT-TO-FEED-MOMENT MAPPING ────────────────────────────────────────────
// Which beats naturally have phone moments, and what type

const BEAT_PHONE_MOMENTS = {
  1:  { likelihood: 0.95, type: 'notification', context: 'Lala sees the invite/opportunity on her phone' },
  2:  { likelihood: 0.60, type: 'story', context: 'She checks who else is going — scrolls stories' },
  3:  { likelihood: 0.80, type: 'post', context: 'She sees what the host or others are wearing — outfit pressure' },
  4:  { likelihood: 0.40, type: 'dm', context: 'A friend texts about the event while she gets ready' },
  5:  { likelihood: 0.90, type: 'post', context: 'She posts her GRWM/outfit — first reactions come in' },
  6:  { likelihood: 0.30, type: 'story', context: 'Quick story check on arrival — who posted from the venue already?' },
  7:  { likelihood: 0.70, type: 'live', context: 'Someone at the event is live — she sees herself or the crowd' },
  8:  { likelihood: 0.20, type: 'dm', context: 'DM from someone about the person she just met' },
  9:  { likelihood: 0.10, type: null, context: 'Main event — phone is away (mostly)' },
  10: { likelihood: 0.50, type: 'notification', context: 'A post/comment disrupts the moment — drama notification' },
  11: { likelihood: 0.85, type: 'live', context: 'She films the key content moment — go live, post, capture' },
  12: { likelihood: 0.40, type: 'dm', context: 'Text from someone who left early or is watching from home' },
  13: { likelihood: 0.90, type: 'notification', context: 'Phone blowing up — reactions, DMs, tagged posts flooding in' },
  14: { likelihood: 0.95, type: 'post', context: 'She scrolls what everyone posted — curates her own recap' },
};

// ─── GENERATE FEED MOMENTS FOR AN EPISODE ───────────────────────────────────

/**
 * Generate feed moments for each beat of an episode.
 *
 * @param {object} event - The world event
 * @param {object[]} beats - Array of BEAT_TEMPLATES
 * @param {object[]} guestProfiles - Profiles attending the event
 * @param {object} models - Sequelize models
 * @param {object} options - { showType, contentLens }
 * @returns {object} Map of beat_number → feed_moment
 */
async function generateFeedMoments(event, beats, guestProfiles, models, options = {}) {
  const showType = options.showType || 'styling_adventures';
  const lens = CONTENT_LENSES[showType] || CONTENT_LENSES.default;
  const auto = event.canon_consequences?.automation || {};
  const hostName = auto.host_display_name || event.host || 'the host';
  const guests = guestProfiles || auto.guest_profiles || [];

  // Get Lala's balance for purchase decisions
  let balance = 500;
  try {
    const [state] = await models.sequelize.query(
      `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId: event.show_id }, type: models.sequelize.QueryTypes.SELECT }
    );
    const sj = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
    balance = sj?.coins ?? 500;
  } catch { /* use default */ }

  // Pick which beats get feed moments (based on likelihood)
  const moments = {};

  for (const beat of beats) {
    const config = BEAT_PHONE_MOMENTS[beat.beat] || { likelihood: 0.3, type: 'notification', context: '' };

    // Roll against likelihood
    if (Math.random() > config.likelihood) continue;
    if (!config.type) continue;

    // Pick a trigger profile (host, guest, or general feed)
    let triggerProfile = null;
    let triggerHandle = '';
    if (beat.beat <= 5) {
      // Before event — host or aspirational follow
      triggerProfile = guests.find(g => g.relationship === 'industry' || g.relationship === 'friend') || guests[0];
      triggerHandle = triggerProfile?.handle || hostName;
    } else if (beat.beat <= 12) {
      // During event — attendees
      triggerProfile = guests[Math.floor(Math.random() * guests.length)] || null;
      triggerHandle = triggerProfile?.handle || 'someone at the event';
    } else {
      // After event — wider feed
      triggerProfile = guests.find(g => g.relationship === 'rival' || g.relationship === 'scene') || guests[0];
      triggerHandle = triggerProfile?.handle || 'the timeline';
    }

    // Generate the moment content based on beat + lens
    const moment = generateMomentContent(beat, config, lens, event, hostName, triggerHandle, triggerProfile, guests);
    moments[beat.beat] = moment;
  }

  // ── Special: Purchase Decision Moment (Beat 3 — The Closet) ──
  // JustAWoman checks the bank, picks an outfit, Lala reacts
  const prestige = event.prestige || 5;
  const outfitCost = prestige >= 8 ? 400 : prestige >= 6 ? 250 : prestige >= 4 ? 120 : 50;
  const canAfford = balance >= outfitCost;
  const afterPurchase = balance - outfitCost;

  if (!moments[3]) {
    moments[3] = {
      trigger_profile: 'SYSTEM',
      trigger_action: 'wardrobe_purchase',
      on_screen: {
        type: 'ui_interaction',
        content: canAfford
          ? `[Bank: ${balance} coins] → Purchase outfit (${outfitCost} coins) → [Remaining: ${afterPurchase} coins]`
          : `[Bank: ${balance} coins] → Outfit costs ${outfitCost} coins → NOT ENOUGH`,
        image_desc: canAfford ? 'Bank screen showing balance, purchase confirmation' : 'Bank screen showing insufficient funds, red warning',
        asset_type: 'NOTIFICATION_OVERLAY',
        asset_role: 'UI.OVERLAY.BANK',
      },
      script_lines: {
        justawoman_line: canAfford
          ? (afterPurchase < 100
            ? `Oh this is so cute! But let me check the bank first... okay we have ${balance} coins, this outfit is ${outfitCost}... that leaves us with ${afterPurchase}. Cutting it close but she needs to look good tonight.`
            : `Oh this is so freaking cute! Let me check the bank... we have ${balance} coins. This is ${outfitCost} — we can definitely do this! Adding it to Lala's closet.`)
          : `Oh no... this outfit is perfect but it's ${outfitCost} coins and we only have ${balance}. We need to book more work before we can afford this. Let me see what opportunities are available...`,
        lala_line: canAfford
          ? (afterPurchase < 100
            ? `This is worth it. But I'm going to need to hustle after this event. Can't keep spending like this.`
            : `This is so cute, so worth the coins! If I wanna spend hard, I gotta work hard. I'm going to kill this event today.`)
          : `I can't afford this. I literally cannot afford the outfit I need for this event. Something has to change.`,
        lala_internal: canAfford
          ? `The outfit makes me feel like I belong. For one night, the price tag doesn't matter.`
          : `Everyone else will show up looking perfect. And I'll be the one who couldn't afford to play the part.`,
        justawoman_action: canAfford ? 'purchases outfit, adds to closet' : 'closes bank, looks at opportunities',
        direction: canAfford ? 'Lala puts on the outfit, confidence builds' : 'Lala stares at her closet, nothing feels right',
      },
      beat_context: 'The Closet — outfit selection driven by financial reality',
      financial: { balance, outfit_cost: outfitCost, affordable: canAfford, remaining: afterPurchase },
    };
  }

  return moments;
}

function generateMomentContent(beat, config, lens, event, hostName, triggerHandle, triggerProfile, guests) {
  const focusTopic = lens.focus[Math.floor(Math.random() * lens.focus.length)];
  const dramaType = lens.drama_types[Math.floor(Math.random() * lens.drama_types.length)];

  // Content templates by beat phase + screen type
  const TEMPLATES = {
    notification: {
      before: [
        { content: `${triggerHandle} just posted: "Getting ready for tonight 💫"`, action: 'posted outfit preview' },
        { content: `${hostName} added to their story · 2m ago`, action: 'posted event teaser' },
        { content: `New post from ${triggerHandle}: outfit reveal for ${event.name}`, action: 'outfit reveal' },
      ],
      during: [
        { content: `${triggerHandle} tagged you in their story`, action: 'tagged in story' },
        { content: `${triggerHandle} went live · ${guests.length} watching`, action: 'went live from event' },
        { content: `"${event.name}" is trending in your area`, action: 'event trending' },
      ],
      after: [
        { content: `${triggerHandle}: "Some people really showed up and showed OUT tonight 👀"`, action: 'posted shade' },
        { content: `+${Math.floor(Math.random() * 500) + 100} new followers since the event`, action: 'follower spike' },
        { content: `${hostName} posted the official event recap · 47 comments`, action: 'posted recap' },
      ],
    },
    post: {
      before: [
        { content: `[Photo: ${triggerHandle}'s outfit laid out on bed — designer pieces, perfect lighting]`, action: 'posted flat lay', image_desc: `Fashion flat lay: designer outfit on white bedding, golden hour light` },
        { content: `${triggerHandle}: "Tonight's look. No spoilers but... 🔥"`, action: 'outfit tease' },
      ],
      during: [
        { content: `[Photo: ${triggerHandle} at the venue entrance — full outfit reveal, venue behind them]`, action: 'posted arrival', image_desc: `Creator at event entrance, full outfit visible, venue signage` },
        { content: `${triggerHandle}: "The vibes at ${event.name} are UNREAL right now"`, action: 'posted event content' },
      ],
      after: [
        { content: `[Carousel: ${triggerHandle}'s ${event.name} photo dump — 12 photos]`, action: 'posted photo dump', image_desc: `Event photo carousel: outfit shots, group photos, venue details` },
        { content: `${triggerHandle}: "Last night was everything. Full recap on my stories 🖤"`, action: 'posted recap' },
      ],
    },
    story: {
      before: [
        { content: `[Story: ${triggerHandle} holding up two outfits — "help me choose"]`, action: 'posted outfit poll', image_desc: `Creator holding two outfits, bathroom mirror, poll overlay` },
      ],
      during: [
        { content: `[Story: shaky video of the event — music, lights, crowd]`, action: 'posted event story', image_desc: `Event ambiance: crowd, decorations, moody lighting` },
      ],
      after: [
        { content: `[Story: ${triggerHandle} in the car home — "okay that was WILD let me tell you what happened"]`, action: 'posted recap story' },
      ],
    },
    dm: {
      before: [
        { content: `${triggerHandle}: "girl are you going tonight?? I heard ${hostName} went ALL out"`, action: 'DM about event' },
        { content: `${triggerHandle}: "wear the gold one. trust me."`, action: 'outfit advice DM' },
      ],
      during: [
        { content: `${triggerHandle}: "OMG did you see who just walked in 👀"`, action: 'gossip DM' },
        { content: `${triggerHandle}: "your outfit is getting so many compliments on my story btw"`, action: 'compliment DM' },
      ],
      after: [
        { content: `${triggerHandle}: "okay we need to DEBRIEF. call me."`, action: 'debrief DM' },
        { content: `${triggerHandle}: "did you see what she posted?? she's clearly talking about you"`, action: 'drama alert DM' },
      ],
    },
    live: {
      during: [
        { content: `LIVE: ${triggerHandle} · ${event.name} · ${Math.floor(Math.random() * 2000) + 300} watching`, action: 'went live', image_desc: `Live stream interface: creator at event, viewer count, comments scrolling` },
      ],
      after: [
        { content: `${triggerHandle} was live · ${Math.floor(Math.random() * 30) + 5}min · "post-event breakdown"`, action: 'went live after' },
      ],
    },
  };

  const phase = beat.beat <= 5 ? 'before' : beat.beat <= 12 ? 'during' : 'after';
  const typeTemplates = TEMPLATES[config.type]?.[phase] || TEMPLATES.notification[phase] || [];
  const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)] || { content: `${triggerHandle} posted something`, action: 'posted' };

  // Generate Lala's reactions based on the phase
  const REACTIONS = {
    before: {
      dialogue: [
        `Wait — ${triggerHandle} is going? Let me see what she's wearing.`,
        `Okay she went with THAT? I need to switch my shoes.`,
        `${hostName} is really building this up. The pressure is on.`,
      ],
      internal: [
        `Her outfit is going to be everywhere by tomorrow. I need something that stands out.`,
        `Everyone always looks effortless. Why does it take me three hours?`,
        `If ${triggerHandle} is posting like this, the event is bigger than I thought.`,
      ],
    },
    during: {
      dialogue: [
        `${triggerHandle} just tagged me — let me see...`,
        `Wait, she's live right now? From here?`,
        `Did everyone see that? This is going to be everywhere.`,
      ],
      internal: [
        `The comments are moving so fast. Are they watching me or the event?`,
        `I should be present but I also need content. Always the same tension.`,
        `${triggerHandle} is getting all the attention and she literally just got here.`,
      ],
    },
    after: {
      dialogue: [
        `My phone won't stop. Okay let me see what everyone is saying.`,
        `She did NOT just post that. Is she talking about me?`,
        `The recap posts are starting. I need to get mine up before everyone else's.`,
      ],
      internal: [
        `Everyone's version of tonight is different. What actually happened vs what gets posted.`,
        `My follower count jumped. Does that mean it went well or just that something went viral?`,
        `I can feel the narrative forming already. By tomorrow the story of tonight will be set.`,
      ],
    },
  };

  const reactions = REACTIONS[phase] || REACTIONS.during;
  const dialogue = reactions.dialogue[Math.floor(Math.random() * reactions.dialogue.length)];
  const internal = reactions.internal[Math.floor(Math.random() * reactions.internal.length)];

  // Behavior shift
  const SHIFTS = {
    before: ['Lala reconsiders her outfit choice', 'She speeds up her routine', 'She adds an extra accessory for confidence', 'She checks herself in the mirror one more time'],
    during: ['She repositions herself in the room', 'She puts the phone away and engages', 'She films a quick response', 'She finds the person who posted'],
    after: ['She starts crafting her own recap post', 'She screenshots the comment for later', 'She decides not to respond (yet)', 'She texts her closest friend about it'],
  };
  const shift = SHIFTS[phase][Math.floor(Math.random() * SHIFTS[phase].length)];

  return {
    // On-screen visual — what the VIEWER sees (bright notification overlay)
    trigger_profile: triggerHandle,
    trigger_action: template.action,
    on_screen: {
      type: config.type,
      content: template.content,
      image_desc: template.image_desc || null,
      asset_type: 'NOTIFICATION_OVERLAY',
      asset_role: 'UI.OVERLAY.NOTIFICATION',
    },
    // Script lines — TWO VOICES
    script_lines: {
      justawoman_line: (() => {
        // JustAWoman is the player — she narrates decisions, strategy, UI actions
        const JW = {
          before: [
            `Let me see what ${triggerHandle} is wearing before we pick Lala's outfit...`,
            `Oh this is cute! Let me check if we can afford something similar.`,
            `Okay ${triggerHandle} posted — let's see what we're working with.`,
          ],
          during: [
            `${triggerHandle} just tagged us — let me check this real quick.`,
            `Ooh she's going live! Should we watch or stay focused?`,
            `Look at this notification — something's happening.`,
          ],
          after: [
            `Let me see how everyone's posts are doing. Check the engagement...`,
            `Okay the event is over — time to post Lala's recap before everyone else.`,
            `${triggerHandle} posted already?! We need to get our content up.`,
          ],
        };
        const p = beat.beat <= 5 ? 'before' : beat.beat <= 12 ? 'during' : 'after';
        return JW[p][Math.floor(Math.random() * JW[p].length)];
      })(),
      lala_line: dialogue,              // spoken dialogue (character voice)
      lala_internal: internal,          // inner narration (voiceover)
      justawoman_action: config.type === 'notification' ? 'taps notification' : 'scrolls',
      direction: shift,              // camera/behavior direction
    },
    beat_context: beat.description || config.context,
  };
}

// ─── GENERATE B-STORY FEED ACTIVITY ─────────────────────────────────────────
// What's happening on the feed WHILE the episode is happening

function generateBStoryActivity(event, guestProfiles, lens) {
  const auto = event.canon_consequences?.automation || {};
  const guests = guestProfiles || auto.guest_profiles || [];
  const hostName = auto.host_display_name || event.host || 'the host';

  const bStory = [];

  // Rival/fomo posts from people NOT at the event
  bStory.push({
    timing: 'during',
    type: 'fomo_post',
    handle: '@unnamed_rival',
    content: `"Staying in tonight. Sometimes the best events are the ones you don't go to 💅"`,
    subtext: 'Translation: she wasn\'t invited and everyone knows it',
  });

  // Guest interactions during event
  if (guests.length >= 2) {
    bStory.push({
      timing: 'during',
      type: 'guest_interaction',
      handle: guests[0]?.handle || '@guest1',
      content: `Tagged ${guests[1]?.handle || '@guest2'} in a story at ${event.name}`,
      subtext: 'The social web gets tighter with every tag',
    });
  }

  // Post-event shade
  bStory.push({
    timing: 'after',
    type: 'shade',
    handle: '@unnamed_commenter',
    content: `"Not everyone can pull off couture. Some people should stick to fast fashion 🙃"`,
    subtext: 'Vague enough to be about anyone. Specific enough that Lala wonders.',
  });

  // Follower dynamics
  bStory.push({
    timing: 'after',
    type: 'metrics',
    handle: hostName,
    content: `Gained 2.3K followers during the event. Engagement rate: 8.2% (up from 4.1%)`,
    subtext: 'The host always wins. The question is whether Lala gained too.',
  });

  return bStory;
}

module.exports = {
  generateFeedMoments,
  generateBStoryActivity,
  CONTENT_LENSES,
  BEAT_PHONE_MOMENTS,
};

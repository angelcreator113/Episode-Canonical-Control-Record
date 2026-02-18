/**
 * Script Skeleton Generator
 * 
 * Takes a world_event record and generates a complete episode script
 * skeleton with all required beats, UI tags, mail payloads, and
 * placeholder dialogue. This is the "70% auto-write" engine.
 * 
 * Location: src/utils/scriptSkeletonGenerator.js
 */

'use strict';

/**
 * Generate a full script skeleton from an event
 * 
 * @param {object} event - world_events record
 * @param {object} [options]
 * @param {object} [options.characterState] - Current Lala stats
 * @param {string} [options.intent] - Episode intent (failure_comeback_setup, etc.)
 * @param {boolean} [options.includeNarration] - Include Prime narration placeholders
 * @param {boolean} [options.includeAnimations] - Include Lala animation notes
 * @returns {string} Full script content
 */
function generateScriptSkeleton(event, options = {}) {
  const {
    characterState = {},
    intent = null,
    includeNarration = true,
    includeAnimations = true,
  } = options;

  const e = event || {};
  const name = e.name || 'Event';
  const host = e.host_brand || 'The Host';
  const prestige = e.prestige || 5;
  const cost = e.cost_coins || 100;
  const strictness = e.strictness || 5;
  const deadline = e.deadline_type || 'medium';
  const dressCode = e.dress_code || 'elegant';
  const location = e.location_hint || 'elegant venue';
  const bias = e.browse_pool_bias || 'balanced';
  const stakes = e.narrative_stakes || '';

  // Determine episode mood from stats
  const isStressed = (characterState.stress || 0) >= 4;
  const isBroke = (characterState.coins || 0) < cost;
  const isLowRep = (characterState.reputation || 1) <= 3;
  const isComeback = isLowRep || isStressed || intent === 'failure_comeback_setup';

  // Build checklist from dress code
  const checklist = generateChecklist(dressCode, strictness);

  const lines = [];

  // ─── Episode metadata ───
  if (intent) {
    lines.push(`[EPISODE_INTENT: "${intent}"]`);
    lines.push('');
  }

  // ─── BEAT 1: OPENING RITUAL ───
  lines.push('## BEAT: OPENING_RITUAL');
  lines.push('');
  if (includeAnimations) lines.push('(Closet background loaded, neutral lighting)');
  if (includeAnimations) lines.push('(Lala in base lounge outfit, soft idle sway)');
  lines.push('');
  lines.push('[UI:CLICK VoiceIcon]');
  lines.push('[UI:VOICE_ACTIVATE Lala]');
  lines.push('');
  if (isComeback) {
    lines.push('Lala: "Bestie... I know last time was rough. But we\'re still here."');
  } else if (prestige >= 7) {
    lines.push('Lala: "Bestie... tonight feels expensive."');
  } else {
    lines.push('Lala: "Bestie... come style me. I have a feeling about today."');
  }
  lines.push('');

  // ─── BEAT 2: CREATOR WELCOME ───
  lines.push('## BEAT: CREATOR_WELCOME');
  lines.push('');
  lines.push('[UI:OPEN LoginWindow]');
  lines.push('[UI:TYPE Username "JustAWomanInHerPrime"]');
  lines.push('[UI:TYPE Password "••••••••"]');
  lines.push('[UI:CLICK LoginConfirm]');
  lines.push('[UI:CLOSE LoginWindow]');
  lines.push('');
  if (includeNarration) {
    if (isComeback) {
      lines.push(`Prime: "Welcome back, besties. Last time didn't go our way. Reputation is at ${characterState.reputation || '?'}. But today? We rebuild."`);
    } else {
      lines.push(`Prime: "Welcome back, besties, and a special hello to our new besties. We are logging in because something just arrived..."`);
    }
  }
  lines.push('');

  // ─── BEAT 3: INTERRUPTION #1 (Invite) ───
  lines.push('## BEAT: INTERRUPTION #1');
  lines.push('');
  lines.push('[UI:NOTIFICATION MailDing]');
  lines.push('[UI:PULSE MailIcon x3]');
  lines.push('');
  if (includeNarration) lines.push('Prime: "Oh. Lala\'s got mail."');
  lines.push('');
  lines.push('[UI:CLICK MailIcon]');
  lines.push('[UI:OPEN MailPanel]');
  lines.push('');

  // ─── BEAT 4: REVEAL ───
  lines.push('## BEAT: REVEAL #1');
  lines.push('');
  lines.push('[UI:DISPLAY InviteLetterOverlay]');
  lines.push(`[MAIL: type=invite from="${host}" prestige=${prestige} cost=${cost}coins]`);
  lines.push(`[LOCATION_HINT: "${location}"]`);
  lines.push('');
  if (includeNarration) {
    lines.push(`Prime: "Dearest Lala, you are cordially invited to the ${name}. Dress code: ${capitalize(dressCode)}. Entry contribution: ${cost} Prime Coins."`);
  }
  lines.push('');
  lines.push('[UI:CLICK VoiceIcon]');
  lines.push('[UI:VOICE_ACTIVATE Lala]');
  if (prestige >= 7) {
    lines.push(`Lala: "Prestige ${prestige}?!"`);
  } else if (isComeback) {
    lines.push('Lala: "This... this is our second chance."');
  } else {
    lines.push('Lala: "Bestie, we have to go."');
  }
  lines.push('');
  if (isBroke) {
    if (includeNarration) lines.push(`Prime: "Bestie... we only have ${characterState.coins || '?'} coins. This costs ${cost}. We might go into debt."`);
    lines.push('');
  }

  // ─── BEAT 5: STAKES + INTENTION ───
  lines.push('## BEAT: STAKES_INTENTION');
  lines.push('');
  lines.push(`[EVENT: name="${name}" prestige=${prestige} cost=${cost} strictness=${strictness} deadline="${deadline}" dress_code="${dressCode}"]`);
  lines.push('');
  lines.push('[UI:DISPLAY ToDoListOverlay]');
  lines.push('');
  lines.push('(Checklist auto-fills:)');
  for (const item of checklist) {
    lines.push(`✔ ${item}`);
  }
  lines.push('');
  if (includeNarration) {
    if (prestige >= 7) {
      lines.push(`Prime: "We cannot embarrass ourselves at a prestige ${prestige}."`);
    } else if (isComeback) {
      lines.push('Prime: "Small steps. We nail this, we start climbing back."');
    } else {
      lines.push('Prime: "Let\'s get to work, besties."');
    }
  }
  lines.push('');
  lines.push('[UI:CLICK VoiceIcon]');
  lines.push('[UI:VOICE_ACTIVATE Lala]');
  if (isComeback) {
    lines.push('Lala: "I\'m not giving up."');
  } else {
    lines.push('Lala: "This is my moment."');
  }
  lines.push('');

  // ─── BEAT 6: TRANSFORMATION ───
  lines.push('## BEAT: TRANSFORMATION');
  lines.push('');

  const segments = generateTransformationSegments(checklist, dressCode, bias);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    lines.push(`(Segment ${i + 1} — ${seg.label})`);
    lines.push(`[UI:OPEN ClosetCategory ${seg.category}]`);
    lines.push(`[UI:SCROLL ClosetItems x${seg.scrollCount}]`);
    lines.push('');
    if (seg.hoverItems) {
      for (const hover of seg.hoverItems) {
        lines.push(`[UI:HOVER Item ${hover}]`);
      }
    }
    lines.push('');
    if (includeNarration && i === 0) {
      lines.push(`Prime: "Oh... wait... ${seg.reactionLine}"`);
    }
    lines.push(`[UI:SELECT Item ${seg.selectedItem}]`);
    lines.push('[FX:SPARKLE Small]');
    lines.push(`[UI:CHECK ToDoList "${seg.checklistItem}"]`);
    lines.push('');
    if (i === 0 && includeAnimations) {
      lines.push('[UI:CLICK VoiceIcon]');
      lines.push('[UI:VOICE_ACTIVATE Lala]');
      lines.push('Lala: "Bestie... I look like money."');
      lines.push('');
    }
    if (i === segments.length - 1 && seg.category === 'Fragrance') {
      lines.push('[UI:CLICK VoiceIcon]');
      lines.push('[UI:VOICE_ACTIVATE Lala]');
      if (includeAnimations) lines.push('(sniff animation)');
      lines.push('Lala: "I smell like legacy."');
      lines.push('');
    }
  }

  // ─── BEAT 7: INTERRUPTION #2 (Reminder) ───
  lines.push('## BEAT: INTERRUPTION #2');
  lines.push('');
  lines.push('[MAIL: type=reminder urgency=high]');
  lines.push('[UI:NOTIFICATION EventReminder]');
  lines.push('');
  if (deadline === 'high' || deadline === 'tonight' || deadline === 'urgent') {
    if (includeNarration) lines.push('Prime: "Oh. It starts in one hour."');
    lines.push('');
    lines.push('[UI:CLICK VoiceIcon]');
    lines.push('[UI:VOICE_ACTIVATE Lala]');
    lines.push('Lala: "We are NOT showing up late."');
  } else {
    if (includeNarration) lines.push('Prime: "The event is tonight. We still have time, but let\'s not waste it."');
  }
  lines.push('');

  // ─── BEAT 8: EVENT TRAVEL + PAYOFF ───
  lines.push('## BEAT: EVENT_TRAVEL');
  lines.push('');
  lines.push('[UI:CLICK DestinationIcon]');
  lines.push(`[SCENE:LOAD Location "${location}"]`);
  lines.push('');
  if (includeAnimations) lines.push('(Background transitions to event location)');
  lines.push('');
  lines.push('[UI:CLICK VoiceIcon]');
  lines.push('[UI:VOICE_ACTIVATE Lala]');
  if (includeAnimations) lines.push('(poses gracefully)');
  if (isComeback) {
    lines.push('Lala: "Bestie... I\'m nervous. But I\'m here."');
  } else {
    lines.push('Lala: "Bestie... they\'re staring."');
  }
  lines.push('');
  if (includeNarration) {
    if (isComeback) {
      lines.push('Prime: "Head up, Lala. You belong here."');
    } else {
      lines.push('Prime: "They should be."');
    }
  }
  lines.push('');

  // ─── BEAT 9: CTA + CLIFFHANGER ───
  lines.push('## BEAT: CLIFFHANGER');
  lines.push('');
  if (includeNarration) lines.push('Prime: "Besties... did she slay? Rate this look from one to ten."');
  lines.push('');
  lines.push('[UI:CLICK VoiceIcon]');
  lines.push('[UI:VOICE_ACTIVATE Lala]');
  lines.push('Lala: "Wait... who is that watching me?"');
  lines.push('');
  lines.push('[UI:NOTIFICATION MysteriousDM]');
  lines.push('');
  lines.push('(Screen fades)');
  lines.push('');
  lines.push('Text: "To Be Continued..."');
  lines.push('');

  // ─── Stat changes (system writes after evaluation) ───
  lines.push('(System tags — written after evaluation:)');
  lines.push('(  [RESULT: score=? tier="?"]  )');
  lines.push('(  [STAT_CHANGE: coins-? reputation+? stress+?]  )');

  return lines.join('\n');
}


// ─── HELPERS ───

function generateChecklist(dressCode, strictness) {
  const items = [];
  const dc = (dressCode || '').toLowerCase();

  // Always include outfit
  if (dc.includes('couture') || dc.includes('gown') || dc.includes('formal')) {
    items.push('Couture outfit');
  } else if (dc.includes('casual')) {
    items.push('Styled casual outfit');
  } else {
    items.push('Event-appropriate outfit');
  }

  // Accessories
  if (strictness >= 6) {
    items.push('Statement accessory');
  } else {
    items.push('Accessory');
  }

  // Shoes
  if (dc.includes('garden') || dc.includes('outdoor')) {
    items.push('Elegant flats or low heels');
  } else {
    items.push('Elevated heels');
  }

  // Bag
  items.push('Elegant handbag');

  // Fragrance
  items.push('Signature scent');

  // Extra for high strictness
  if (strictness >= 8) {
    items.push('Hair styled');
    items.push('Flawless makeup');
  }

  return items;
}

function generateTransformationSegments(checklist, dressCode, bias) {
  const dc = (dressCode || '').toLowerCase();
  const segments = [];

  const biasAdjectives = {
    balanced: ['classic', 'elegant', 'refined'],
    glam: ['sparkling', 'bold', 'dramatic'],
    cozy: ['soft', 'warm', 'flowing'],
    couture: ['structured', 'architectural', 'exquisite'],
    trendy: ['fresh', 'modern', 'statement'],
    romantic: ['delicate', 'floral', 'vintage'],
  };
  const adj = biasAdjectives[bias] || biasAdjectives.balanced;

  // Map checklist items to closet categories
  for (const item of checklist) {
    const lower = item.toLowerCase();
    if (lower.includes('outfit') || lower.includes('gown') || lower.includes('dress')) {
      segments.push({
        label: 'Outfit',
        category: 'Outfit',
        scrollCount: 5,
        hoverItems: [`${adj[0]}Option1`, `${adj[1]}Option2`],
        selectedItem: generateItemName(dc, 'outfit', adj),
        reactionLine: `this ${adj[0]} piece?`,
        checklistItem: item,
      });
    } else if (lower.includes('accessor') || lower.includes('statement')) {
      segments.push({
        label: 'Accessories',
        category: 'Accessories',
        scrollCount: 4,
        hoverItems: [`${adj[0]}Necklace`],
        selectedItem: generateItemName(dc, 'accessory', adj),
        reactionLine: `that ${adj[1]} accent...`,
        checklistItem: item,
      });
    } else if (lower.includes('heel') || lower.includes('flat') || lower.includes('shoe')) {
      segments.push({
        label: 'Shoes',
        category: 'Shoes',
        scrollCount: 4,
        hoverItems: [],
        selectedItem: generateItemName(dc, 'shoes', adj),
        reactionLine: 'those are perfect.',
        checklistItem: item,
      });
    } else if (lower.includes('bag') || lower.includes('clutch') || lower.includes('handbag')) {
      segments.push({
        label: 'Bags',
        category: 'Bags',
        scrollCount: 3,
        hoverItems: [],
        selectedItem: generateItemName(dc, 'bag', adj),
        reactionLine: 'subtle but powerful.',
        checklistItem: item,
      });
    } else if (lower.includes('scent') || lower.includes('fragrance') || lower.includes('perfume')) {
      segments.push({
        label: 'Fragrance',
        category: 'Fragrance',
        scrollCount: 3,
        hoverItems: [],
        selectedItem: generateItemName(dc, 'fragrance', adj),
        reactionLine: 'this scent is everything.',
        checklistItem: item,
      });
    } else if (lower.includes('hair')) {
      segments.push({
        label: 'Hair',
        category: 'Hair',
        scrollCount: 3,
        hoverItems: [],
        selectedItem: 'PolishedUpdo',
        reactionLine: 'the finishing touch.',
        checklistItem: item,
      });
    } else if (lower.includes('makeup')) {
      segments.push({
        label: 'Makeup',
        category: 'Makeup',
        scrollCount: 3,
        hoverItems: [],
        selectedItem: 'FlawlessGlam',
        reactionLine: 'she looks untouchable.',
        checklistItem: item,
      });
    }
  }

  return segments;
}

function generateItemName(dressCode, type, adjectives) {
  const dc = (dressCode || '').toLowerCase();
  const names = {
    outfit: {
      romantic: 'BlushCorsetDress', garden: 'FloralTeaDress', couture: 'StructuredGown',
      casual: 'ElevatedCasualSet', default: 'ElegantEventDress',
    },
    accessory: {
      romantic: 'PearlChoker', garden: 'DelicateGoldChain', couture: 'DiamondStatement',
      casual: 'LayeredBracelets', default: 'ClassicPendant',
    },
    shoes: {
      garden: 'IvoryFlats', casual: 'PointedMules', couture: 'SilkHeels',
      default: 'ElegantHeels',
    },
    bag: {
      romantic: 'VintageClutch', garden: 'LinenTote', couture: 'StructuredMinaudiere',
      casual: 'LeatherCrossbody', default: 'ClassicClutch',
    },
    fragrance: {
      romantic: 'RoseJasmineBlend', garden: 'WisteriaBreeze', couture: 'OudElixir',
      casual: 'FreshCitrus', default: 'SignatureBlend',
    },
  };

  const typeNames = names[type] || names.outfit;
  for (const keyword of Object.keys(typeNames)) {
    if (keyword !== 'default' && dc.includes(keyword)) return typeNames[keyword];
  }
  return typeNames.default;
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


module.exports = {
  generateScriptSkeleton,
  generateChecklist,
  generateTransformationSegments,
};

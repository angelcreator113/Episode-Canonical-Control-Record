/**
 * characterAppearanceRules.js
 * frontend/src/data/characterAppearanceRules.js
 *
 * ════════════════════════════════════════════════════════════════════════
 * CHARACTER APPEARANCE RULES
 * ════════════════════════════════════════════════════════════════════════
 *
 * Each PNOS character has specific rules for HOW they can appear on the
 * page. These are not personality notes — they are architectural rules.
 * Breaking them breaks the book's structure.
 *
 * Sourced from: PNOS_Master_Registry_Book1.docx + Lala's World Bible v1.0
 *
 * Used by:
 *   generate-chapter-draft route    — character_rules in prompt
 *   narrative-intelligence route    — prevents wrong appearances
 *   CharacterAppearanceRules.jsx    — display panel in chapter brief
 *   character-voice-session route   — governs session behavior per character
 *
 * ════════════════════════════════════════════════════════════════════════
 * HOW TO USE IN AI ROUTES
 * ════════════════════════════════════════════════════════════════════════
 *
 *   import { getCharacterRulesPrompt } from '../data/characterAppearanceRules';
 *
 *   // In route payload:
 *   character_rules: getCharacterRulesPrompt(activeThreads),
 */

// ── CHARACTER RULES ───────────────────────────────────────────────────────

export const CHARACTER_APPEARANCE_RULES = {

  justawoman: {
    name:            'JustAWoman',
    archetype:       'PROTAGONIST',
    appearance_mode: 'On-Page',
    color:           '#C9A84C',
    rules: [
      'Narrator and subject simultaneously — she is inside the experience AND reflecting on it.',
      'Voice shifts by act: Raw in Act I. Searching in Act II. Crystallizing in Act III. Owned in Act V.',
      'She is ACTIVE. Posting every day. Trying. Showing up. Not blocked by fear.',
      'Her wound is invisibility while trying — not fear of starting. These are different.',
      'She does not realize in Book 1 that she is building something larger. This realization is Book 2.',
    ],
    what_she_cannot_do: [
      'She cannot have clarity she hasn\'t yet earned in her arc.',
      'She cannot realize the coaching curriculum is being built — that\'s Book 2.',
      'She cannot sound defeated — she is unseen, not broken.',
    ],
  },

  the_husband: {
    name:            'The Husband',
    archetype:       'GROUNDING FORCE',
    appearance_mode: 'Interior Monologue Only',
    color:           '#7B5EA7',
    rules: [
      'NEVER speaks on the page directly. He has no dialogue. No quoted speech.',
      'Lives entirely in JustAWoman\'s interior monologue.',
      'His presence is felt through what she anticipates, avoids, or translates.',
      'He is kind. Present. Proud of her attempts. But cannot share the hunger.',
      'He means "protect." She hears "quit." The gap between those two is the character.',
      'His love has a ceiling — and she knows it, even when she doesn\'t say it.',
      'His stability creates her isolation. He is the wall she loves.',
    ],
    what_he_cannot_do: [
      'He cannot be villainized. He is not the problem. He is kind.',
      'He cannot speak, appear physically, or be quoted directly.',
      'He cannot understand the hunger. That is the permanent condition, not a temporary misunderstanding.',
    ],
    how_he_enters: 'He enters through anticipation ("she almost told him, then didn\'t"), through absence ("she closed the laptop before he came in"), through translation ("he\'d call it a phase — she called it a pivot").',
  },

  the_comparison_creator: {
    name:            'The Comparison Creator (Chloe)',
    archetype:       'ALTERNATE TIMELINE',
    appearance_mode: 'Screens Only — Never In Person',
    color:           '#B85C38',
    rules: [
      'ONLY appears on screens — phone, laptop, tablet. Never in person. Never in the same physical space.',
      'She is NOT a villain. Genuinely successful, likable, supportive.',
      'The comparison is JustAWoman\'s — Chloe never asked for it.',
      'She represents the timeline JustAWoman abandoned. Creates regret, not jealousy.',
      'She is consistent. Consistency is the thing that cuts — not cruelty.',
      'When she stumbles or pivots, something shifts in JustAWoman too.',
    ],
    what_she_cannot_do: [
      'She cannot appear in person — not at an event, not in a café, never.',
      'She cannot be mean, fake, or antagonistic.',
      'She cannot be aware of JustAWoman\'s feelings about her.',
    ],
    how_she_enters: 'She enters through a scroll, a notification, a thumbnail. JustAWoman finds her — Chloe doesn\'t come looking.',
  },

  the_witness: {
    name:            'The Witness',
    archetype:       'PATTERN HOLDER',
    appearance_mode: 'On-Page (Limited)',
    color:           '#4A7C59',
    rules: [
      'She has seen multiple ventures. She remembers the excitement cycles and quiet disappointments.',
      'She does NOT judge. She does NOT fix. She observes and reflects occasionally.',
      'Her memory makes the pattern visible — that is her only function.',
      'Key line: When JustAWoman says "this time is different," The Witness says gently: "you\'ve said that before." Not cruel. Just aware.',
      'She appears LIMITED — not in every chapter. Her appearances are significant precisely because they are rare.',
    ],
    what_she_cannot_do: [
      'She cannot offer solutions or give advice.',
      'She cannot appear in every chapter — scarcity is her power.',
      'She cannot be harsh or judgmental, even when reflecting the pattern.',
    ],
  },

  the_almost_mentor: {
    name:            'The Almost-Mentor',
    archetype:       'MOMENTARY CATALYST',
    appearance_mode: 'One Appearance Only — Then Tracked Absence',
    color:           '#8B6914',
    rules: [
      'Appears ONCE, meaningfully. Then disappears back into their own success.',
      'Not malicious. Just busy. Nobody is coming to save you — that is the lesson.',
      'Their absence teaches more than their presence.',
      'After they disappear, the system tracks the absence. The disappearance reverberates 3–4 chapters later.',
      'The author must make a deliberate choice: when does the absence land?',
    ],
    what_they_cannot_do: [
      'They cannot appear a second time as a mentor. One appearance only.',
      'They cannot be villainized for disappearing — they are simply busy.',
      'Their disappearance cannot be resolved with a callback or return. The lesson is the lack.',
    ],
    absence_tracking: 'Once they appear and vanish, the absence must be acknowledged in the prose within 3–4 chapters. JustAWoman should feel the silence where the guidance was.',
  },

  the_digital_products_customer: {
    name:            'The Digital Products Customer',
    archetype:       'PROOF OF VALUE',
    appearance_mode: 'Composite / One Brief Appearance',
    color:           '#5B7FA6',
    rules: [
      'Appears once, briefly. Represents the one real person who bought something and gave genuine feedback.',
      'JustAWoman probably dismissed this person at the time.',
      'This is a Decision Echo character — the weight of this moment lands in Act IV.',
      'The irony: she was selling "becoming" notebooks while not feeling like she had become. This customer believed more than she did.',
    ],
    what_they_cannot_do: [
      'They cannot be a major character or appear multiple times.',
      'Their significance cannot be felt in Book 1 — JustAWoman misses it. That\'s the point.',
    ],
  },

  lala: {
    name:            'Lala',
    archetype:       'PROJECTION / CONTAINER',
    appearance_mode: 'On-Page (as creation) — Book 1: Proto-Voice Only',
    color:           '#C9A84C',
    rules: [
      'In Book 1: ONE intrusive thought maximum. A tonal rupture. Not a character arriving.',
      'She appears mid-thought. No announcement. No transition. Simply there, briefly, then gone.',
      'She sounds completely different from JustAWoman — different altitude, different syntax, no doubt.',
      'She is not JustAWoman being confident. She is what exists after the doubt burns away.',
      'She does not know she is being built. She is proto-voice — not yet a person.',
      'By the end of Book 1, she has a name. That is the milestone. Nothing more yet.',
    ],
    what_she_cannot_do: [
      'She cannot arrive as a full character in Book 1.',
      'She cannot have dialogue or extended presence.',
      'She cannot sound like JustAWoman with better self-esteem — she must sound categorically different.',
      'She cannot know she was built or know about JustAWoman\'s struggles.',
    ],
  },
};

// ── HELPER: Build character rules prompt for AI routes ────────────────────

export function getCharacterRulesPrompt(activeCharacterIds = null) {
  // If no filter, include all core rules
  const chars = activeCharacterIds
    ? Object.values(CHARACTER_APPEARANCE_RULES).filter(c => activeCharacterIds.includes(c.name.toLowerCase().replace(/\s+/g, '_')))
    : Object.values(CHARACTER_APPEARANCE_RULES);

  if (!chars.length) return '';

  return `CHARACTER APPEARANCE RULES — these are architectural, not suggestions:

${chars.map(c => `${c.name.toUpperCase()} (${c.appearance_mode}):
${c.rules.map(r => `  • ${r}`).join('\n')}
${c.what_he_cannot_do || c.what_she_cannot_do || c.what_they_cannot_do
    ? `  CANNOT: ${(c.what_he_cannot_do || c.what_she_cannot_do || c.what_they_cannot_do || []).join(' / ')}`
    : ''}
${c.how_he_enters || c.how_she_enters ? `  HOW THEY ENTER: ${c.how_he_enters || c.how_she_enters}` : ''}`
  ).join('\n\n')}

Breaking these rules breaks the book's structure. The Husband never speaks aloud.
Chloe never appears in person. Lala is one thought, not a presence.`;
}

/**
 * ventureData.js
 * frontend/src/data/ventureData.js
 *
 * ════════════════════════════════════════════════════════════════════════
 * CANONICAL SOURCE OF TRUTH
 * All 5 ventures, 5 PNOS acts, 3 plot threads — from the Master Registry.
 * Never modify without updating PNOS_Master_Registry_Book1.docx.
 * ════════════════════════════════════════════════════════════════════════
 *
 * Used by:
 *   VentureRegistry.jsx    — sidebar display panel
 *   BeliefTracker.jsx      — act selector + belief context
 *   DecisionEchoPanel.jsx  — echo planting + surfacing
 *   narrative-intelligence route — venture_context in prompt
 *   generate-chapter-draft route — venture_context in prompt
 */

// ── THE 5 VENTURES ───────────────────────────────────────────────────────

export const VENTURES = [
  {
    id:          'makeup',
    name:        'Makeup Content Creator',
    archetype:   'PERFORMANCE SELF',
    act:         'act_1',
    actLabel:    'Act I',
    status:      'ABANDONED',
    promised:    'Visibility. Beauty as identity. Being seen for how she transforms.',
    cost:        'The camera felt like a costume she couldn\'t sustain. Performance without permission to be imperfect.',
    lesson:      'She was learning to see herself — but through other people\'s eyes first.',
    buriedSelf:  'The woman who thought beauty was enough to be worth watching.',
    decisionEcho: 'Later, when she creates Lala\'s visual world, she will know exactly what visual language she wants — because she failed at someone else\'s.',
  },
  {
    id:          'fashion',
    name:        'Fashion Content Creator',
    archetype:   'AESTHETIC SELF',
    act:         'act_1',
    actLabel:    'Act I',
    status:      'ABANDONED',
    promised:    'Style as story. A version of herself that was aspirational and curated.',
    cost:        'Fashion requires a consistent point of view she hadn\'t found yet. The aesthetic kept shifting because she kept shifting.',
    lesson:      'She was looking for a visual identity before she had an internal one.',
    buriedSelf:  'The woman who thought if she dressed it right, she\'d feel it right.',
    decisionEcho: 'Lala\'s wardrobe system is the corrected version of this attempt — style with world-logic behind it, not just aesthetics.',
  },
  {
    id:          'wigs',
    name:        'Wig Seller / Hair Influencer',
    archetype:   'COMMERCE SELF',
    act:         'act_1_2',  // spans both acts
    actLabel:    'Act I–II',
    status:      'PARTIALLY SUCCEEDED / SPIRIT-DRAINING',
    promised:    'Business. Real revenue. The legitimacy of a product people buy.',
    cost:        'Moderate success that drained her spirit. The thing that worked wasn\'t the thing she loved. Success without alignment is its own kind of failure.',
    lesson:      'She learned what hustle costs. She learned she could sell — but not everything she could sell was worth selling.',
    buriedSelf:  'The woman who thought revenue would feel like arrival.',
    decisionEcho: 'The hustle tolerance she built here funds the patience she needs in Act IV when Styling Adventures grows slowly.',
  },
  {
    id:          'podcast',
    name:        'Podcaster',
    archetype:   'VOICE SELF',
    act:         'act_2',
    actLabel:    'Act II',
    status:      'ABANDONED',
    promised:    'Being heard without being watched. Depth over image. Thought leadership.',
    cost:        'Voice without audience is a monologue. She was speaking into silence and the silence spoke back.',
    lesson:      'She had things to say. The format was wrong, not the ideas.',
    buriedSelf:  'The woman who thought she could hide her face and still be fully seen.',
    decisionEcho: 'The interiority she developed here — the habit of processing out loud — becomes the narrative voice of this book.',
  },
  {
    id:          'digital',
    name:        'Digital Products — Books & Notebooks',
    archetype:   'MIND SELF',
    act:         'act_2',
    actLabel:    'Act II',
    status:      'LOW TRACTION / PSYCHOLOGICALLY HEAVY',
    promised:    'Pure ideas. No performance, no face, no body. Just what she knew offered as something tangible.',
    cost:        'Imposter syndrome at maximum volume. She was selling \'becoming\' notebooks while not feeling like she had become.',
    lesson:      'She had a mind worth packaging. The irony: one customer believed in the product more than she did.',
    buriedSelf:  'The woman who thought she could sell the idea of herself before she fully inhabited herself.',
    decisionEcho: 'The Digital Products Customer becomes a late Act IV echo — proof she had value she discounted. This realization lands 3 acts later.',
  },
  {
    id:          'ads',
    name:        'Digital Marketing / Paid Ads',
    archetype:   'STRATEGY SELF',
    act:         'act_2',
    actLabel:    'Act II',
    status:      'MONEY PIT / HYPE-FUELED',
    promised:    'The system. If she could master the algorithm, the algorithm would reward her. Ads as acceleration.',
    cost:        'Bleeding money through ads that never converted. Hype without foundation.',
    lesson:      'Attention you buy is not the same as attention you earn. She learned the difference the expensive way.',
    buriedSelf:  'The woman who thought the problem was distribution, not direction.',
    decisionEcho: 'When Styling Adventures grows slowly and organically, she will not panic — because she already knows what paid panic looks like.',
  },
];

// ── THE 5 PNOS ACTS ──────────────────────────────────────────────────────

export const PNOS_ACTS = {
  act_1: {
    id:         'act_1',
    label:      'Act I — Pattern',
    belief:     'If I find the right niche, everything will click.',
    evolved:    'Each venture disproves this but she doesn\'t see the pattern yet.',
    shifted_by: 'The moment she realizes all five ventures are about visibility, beauty, and voice — the same hunger in different costumes.',
    episodes:   'Ep 1–6',
    voice_note: 'Raw. Eager. Cycling. She tries each thing with full belief, then quietly stops. She doesn\'t narrate the endings — she just starts something new.',
  },
  act_2: {
    id:         'act_2',
    label:      'Act II — Pressure',
    belief:     'Maybe I\'m just not meant for this. Maybe I\'m delusional.',
    evolved:    'Self-doubt reaches maximum volume. The comparison spiral intensifies. The husband\'s stability feels like an indictment.',
    shifted_by: 'The Digital Products Customer — someone believed in her product more than she did. She almost missed it.',
    episodes:   'Ep 7–8',
    voice_note: 'Heavier. Slower. The sentences get shorter when doubt peaks. Interior monologue rises. She starts questioning not just the ventures but herself.',
  },
  act_3: {
    id:         'act_3',
    label:      'Act III — Pivot',
    belief:     'What if I stop trying to fit into niches and create my own world?',
    evolved:    'This is the sacred moment. Not a plan. An instinct. Lala is born from this question.',
    shifted_by: 'The nightly rewrites — \'If that were me, what would I wear? How would I speak? Who would I be?\' — become a mirror. Literally.',
    episodes:   'Ep 9–12',
    voice_note: 'Something lifts. Not confidence yet — permission. The sentences start reaching further. A new rhythm appears. This is when Lala\'s proto-voice can first surface.',
  },
  act_4: {
    id:         'act_4',
    label:      'Act IV — Build',
    belief:     'I can sustain this. Even when it\'s fragile. Even when no one is watching yet.',
    evolved:    'The question shifts from \'Why am I not there yet?\' to \'Can I sustain what I\'ve created?\'',
    shifted_by: 'First views. First panel built. First video edited alone. The work itself becomes the answer.',
    episodes:   'Ep 13–21',
    voice_note: 'Quieter confidence. Less proving, more building. She stops explaining herself to herself. The prose gets cleaner. The doubt is still present but it\'s not in charge.',
  },
  act_5: {
    id:         'act_5',
    label:      'Act V — Integration',
    belief:     'This is the first thing I\'ve built that feels like me.',
    evolved:    'Not viral. Not rich. Complete. The ending isn\'t \'I made it.\' It\'s \'You can begin.\'',
    shifted_by: 'Completion of Styling Adventures\' first real version. Lala exists. The world is real. She built it.',
    episodes:   'Ep 22–24',
    voice_note: 'Owned. The narrator and the subject finally feel like the same person. This is the voice readers will want to return to.',
  },
};

// ── THE 3 PLOT THREADS ───────────────────────────────────────────────────

export const PLOT_THREADS = {
  identity_shedding: {
    id:       'identity_shedding',
    label:    'Identity Shedding',
    color:    '#B85C38',
    summary:  'Each failed venture = a self she tried on and couldn\'t sustain. Act II feels like a graveyard of former selves she walks through before Lala becomes possible.',
    question: 'Which version of herself is she burying in this chapter?',
  },
  private_marriage: {
    id:       'private_marriage',
    label:    'Private Marriage',
    color:    '#7B5EA7',
    summary:  'The quiet negotiation of building something her household doesn\'t fully see. Tension between his stability and her chaos. She has been minimizing herself in her own home.',
    question: 'Where is The Husband\'s presence felt in this chapter, even if he doesn\'t appear?',
  },
  comparison_spiral: {
    id:       'comparison_spiral',
    label:    'Comparison Spiral',
    color:    '#C9A84C',
    summary:  'A specific creator she watches obsessively. Not a villain. Someone she almost admires too much. When that creator stumbles or pivots, something shifts in JustAWoman too.',
    question: 'Is the comparison tightening or releasing in this chapter?',
  },
};

// ── HELPER: BUILD VENTURE CONTEXT STRING FOR AI PROMPTS ─────────────────
// Call this when sending to narrative-intelligence or generate-chapter-draft

export function getVentureContext(pnosAct = 'act_1') {
  const act = PNOS_ACTS[pnosAct];
  const relevantVentures = VENTURES.filter(v =>
    v.act === pnosAct || v.act === 'act_1_2' ||
    // Always include all prior ventures for accumulated weight
    (pnosAct === 'act_2' && (v.act === 'act_1' || v.act === 'act_1_2')) ||
    (pnosAct === 'act_3' && (v.act === 'act_1' || v.act === 'act_1_2' || v.act === 'act_2')) ||
    (pnosAct === 'act_4' && true) ||
    (pnosAct === 'act_5' && true)
  );

  const ventureLines = relevantVentures.map(v =>
    `\u2022 ${v.name} (${v.archetype}, ${v.status}): Promised ${v.promised} Cost: ${v.cost} Hidden lesson: ${v.lesson}`
  ).join('\n');

  return `JUSTAWOMAN'S VENTURE HISTORY (as of ${act?.label || pnosAct}):
${ventureLines}

CURRENT PNOS ACT: ${act?.label || pnosAct}
CURRENT BELIEF: "${act?.belief || ''}"
VOICE NOTE FOR THIS ACT: ${act?.voice_note || ''}

This is attempt ${relevantVentures.length} for JustAWoman \u2014 not attempt 1.
The doubt in this chapter carries the weight of all previous attempts.
The hope is harder-won. The voice should reflect accumulated experience, not fresh naivety.`;
}

// ── HELPER: GET THREAD CONTEXT STRING FOR AI PROMPTS ────────────────────

export function getThreadContext(activeThreadIds = []) {
  if (!activeThreadIds.length) return '';
  return activeThreadIds.map(id => {
    const thread = PLOT_THREADS[id];
    return thread ? `${thread.label}: ${thread.summary}` : '';
  }).filter(Boolean).join('\n\n');
}

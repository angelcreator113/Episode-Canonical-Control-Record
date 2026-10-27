'use strict';

/**
 * Episode 1 for My Little List (Evoni, 2026-10-26, Phase 1 acceptance):
 * STUDIO BY SABLE's Wearable Experiments Studio Session, a brand deal for
 * one video, and a surprise runway opportunity she only hears of in the
 * cliffhanger. The private wording (labels, descriptions, the runway) is
 * what her list must never show.
 */

const EPISODE_ID = '11111111-1111-4111-8111-111111111111';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: Morning. Coffee first.',
  '## BEAT: 3 · Welcome',
  'Lala: Okay, what is today?',
  '## BEAT: 4 · Interruption Pulse 1',
  '[UI:NOTIFY Mail]',
  '## BEAT: 5 · Reveal',
  'Lala: Oh, a letter.',
  '[UI:DISPLAY Invitation]',
  'Lala: They want me at the studio!',
  '[UI:DISPLAY Offer letter]',
  'Lala: And they want a video.',
  '## BEAT: 6 · Strategic Reaction',
  'Lala: Can I afford this?',
  '[LEARNS: deal_accepted]',
  'Lala: Yes. I am doing it.',
  '## BEAT: 8 · Transformation Loop',
  '[WEAR: p-dress]',
  '[WEAR: p-shoes]',
  'Lala: Done.',
  '## BEAT: 11 · Event Outcome',
  'Lala: Filming now.',
  '[DELIVER: d-reel]',
  'Lala: Video is up.',
  '## BEAT: 14 · Cliffhanger',
  'Lala: Wait, what is this?',
  '[LEARNS: opportunity_discovered opp-runway]',
  'Lala: A runway? Me?',
].join('\n');

const EVENT = {
  id: 'ev-studio', name: 'Wearable Experiments Studio Session', host: 'STUDIO BY SABLE',
  host_brand: 'STUDIO BY SABLE', venue_name: 'Sable Studio Loft', is_deal: true, terms_locked: true,
};

const DELIVERABLES = [
  { id: 'd-reel', description: 'Submit sponsored Pulse Reel for STUDIO BY SABLE', deliverable_type: 'pulse_video', quantity: 1, required: true },
];

const OPPORTUNITIES = [
  { id: 'opp-runway', name: 'Participate in surprise runway opportunity', brand_or_company: 'Maison Rue', venue_name: 'The Glasshouse', discovered_before: false, accepted_before: false },
];

const WARDROBE_TASKS = [
  { slot: 'dress', label: 'Complete wardrobe readiness for Wearable Experiments Studio Session', required: true },
  { slot: 'shoes', label: 'Shoes for the session', required: true },
  { slot: 'purse', label: 'A bag for the loft', required: false },
];

const LOOK = [
  { id: 'p-dress', name: 'Silver mesh slip', clothing_category: 'dress' },
  { id: 'p-shoes', name: 'Gold Mara heels', clothing_category: 'shoes' },
];

const SOCIAL_TASKS = [
  { slot: 'network', label: 'Network with strategic event contacts', description: 'Sable\'s creative director is scouting', task_source: 'goal', completed: false },
  { slot: 'bts', label: 'Capture behind-the-scenes footage', task_source: 'optional', completed: false },
  { slot: 'scheme', label: 'Win over the creative director before the reveal', description: 'Hidden motive: she is testing Lala for the runway', task_source: 'goal', completed: false },
  { slot: 'deliverable_d-reel', label: 'Submit sponsored Pulse Reel for STUDIO BY SABLE', task_source: 'brand_deliverable', deliverable_id: 'd-reel', required: true, completed: false },
];

const PERSONAL = {
  reminders: [
    { id: 'r-coins', title: 'Check my coins', reveal: { when: 'start' }, done: false },
    { id: 'r-travel', title: 'Get to the studio', reveal: { when: 'invitation_received' }, done: false },
    { id: 'r-runway', title: 'Don\'t embarrass myself on this runway', reveal: { when: 'opportunity_accepted', ref: 'opp-runway' }, done: false },
    // Written early, but it names the runway she hasn't heard of: hidden until she does.
    { id: 'r-catwalk', title: 'Practice my catwalk', reveal: { when: 'start' }, done: false },
  ],
  words: {},
};

/** The input buildList reads, with any part replaced. */
function input(over = {}) {
  return {
    episodeId: EPISODE_ID, script: SCRIPT, event: EVENT, deliverables: DELIVERABLES, opportunities: OPPORTUNITIES,
    wardrobeTasks: WARDROBE_TASKS, look: LOOK, socialTasks: SOCIAL_TASKS, personal: PERSONAL, ...over,
  };
}

// Every private string the phone must never show.
const PRIVATE_STRINGS = [
  ...WARDROBE_TASKS.map((t) => t.label),
  ...SOCIAL_TASKS.flatMap((t) => [t.label, t.description, t.slot]).filter(Boolean),
  ...DELIVERABLES.flatMap((d) => [d.id, d.description]),
  ...OPPORTUNITIES.flatMap((o) => [o.id, o.name, o.brand_or_company, o.venue_name]),
  EVENT.id, EVENT.name, EVENT.host, EVENT.venue_name,
  'brand_deliverable', 'host_requirement', 'task_source', 'deliverable_id', 'reminder:', 'task:', 'deal:',
  'readiness', 'strategic', 'Sponsored',
];

module.exports = { EPISODE_ID, SCRIPT, EVENT, DELIVERABLES, OPPORTUNITIES, WARDROBE_TASKS, LOOK, SOCIAL_TASKS, PERSONAL, PRIVATE_STRINGS, input };

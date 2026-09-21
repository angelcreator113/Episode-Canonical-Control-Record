/**
 * Canonical SAL 14-Beat Structure
 *
 * Single source of truth for the SAL 14-beat structure. Ruling:
 * docs/EVENT_EPISODE_FLOW.md §8(a) / §7 decision 1 — Evoni, 2026-09-21
 * (Task #1609): the show-brain seeder's names and order are canon.
 * Task #1611 (2026-09-21) completed the per-beat record with six more
 * fields and corrected beat 5.
 *
 * Each beat below carries:
 *   - name, typical_location, description  — pre-existing fields read by
 *     scenePlannerService.js's AI prompt (`b.name`, `b.typical_location`,
 *     `b.description` — see generateScenePlan). UNCHANGED for every beat
 *     except beat 5 (corrected per Task #1611 — was wrongly CLOSET/outfit;
 *     beat 5 is the invitation/opportunity reveal, not an outfit reveal).
 *     `typical_location` was never seeder-sourced for any beat — the
 *     seeder (src/seeders/20260312800000-show-brain-franchise-laws.js,
 *     "Episode Architecture — The 14-Beat Structure", :254-269) has no
 *     location field at all. These values are carried, unattributed, from
 *     scenePlannerService's own pre-existing BEAT_STRUCTURE (pre-#1610).
 *   - narrative_purpose — the seeder's own `desc` text, verbatim, cited
 *     separately from `description` above because a few beats' existing
 *     `description` text (authored earlier, for the AI prompt) reads
 *     differently from the seeder's own words — see PR #1611's body for
 *     the full comparison. Not adopted into `description` beyond beat 5,
 *     per that task's explicit no-other-behavior-change scope.
 *   - screen_action — the `ui` field from episodeScriptWriterService.js's
 *     and groundedScriptGeneratorService.js's own (identical, verified)
 *     BEAT_TEMPLATES dicts.
 *   - surface, diegetic — proposed by Task #1611 from screen_action's own
 *     naming and the seeder's narrative_purpose text, per Evoni's rule
 *     ("a screen moment is not automatically Lala's Phone: Lala's Phone
 *     is diegetic — she sees it — audience overlays are not"); `null`
 *     where the source text doesn't settle it clearly enough to propose
 *     rather than guess. Not literal quotes from any file — nothing in
 *     the codebase names a "surface" or "diegetic" concept for beats.
 *   - phase, emotional_intent — the proposed content-matched mapping from
 *     PR #1610's body (episodeGeneratorService.js's BEAT_TEMPLATES,
 *     matched by narrative content, never by position); `null` where no
 *     genuine legacy equivalent exists. NOT YET APPROVED — carried here
 *     as still-proposed, not adopted as this module's committed ruling,
 *     pending Evoni's sign-off (tracked at docs/EVENT_EPISODE_FLOW.md
 *     §8(d)). episodeGeneratorService.js and feedMomentsService.js are
 *     not converted to import this module yet — see that section.
 */

const CANONICAL_BEATS = [
  {
    number: 1,
    name: 'Opening Ritual',
    typical_location: 'HOME_BASE',
    description: 'Lala in her space — sets the emotional tone for the episode',
    narrative_purpose: "Headphones on — the show's sacred opening. Never skipped.",
    screen_action: 'HEADPHONES_ON',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 2,
    name: 'Login Sequence',
    typical_location: 'HOME_BASE',
    description: 'Checking phone/social — receives the episode catalyst',
    narrative_purpose: 'Login overlay → typing animation → Enter. World loads.',
    screen_action: 'LOGIN',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 3,
    name: 'Welcome',
    typical_location: 'HOME_BASE',
    description: 'Greeting the audience — introduces the episode question',
    narrative_purpose: 'Lala enters the frame. World state is visible. Tone is set.',
    screen_action: 'WELCOME',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 4,
    name: 'Interruption Pulse 1',
    typical_location: 'HOME_BASE',
    description: 'First disruption — text, call, memory — raises stakes',
    narrative_purpose: 'Mail arrives. First narrative event of the episode. Usually an Invite.',
    screen_action: 'MAIL_NOTIFICATION',
    surface: null,
    diegetic: null,
    phase: 'before',
    emotional_intent: 'anticipation',
  },
  {
    number: 5,
    name: 'Reveal',
    // CORRECTED — Task #1611, Evoni's ruling 2026-09-21: beat 5 is the
    // invitation/opportunity reveal, not an outfit reveal. Was wrongly
    // 'CLOSET' / "The outfit/look reveal — wardrobe becomes part of the
    // narrative" (copied verbatim from scenePlannerService's pre-existing
    // BEAT_STRUCTURE in #1610, which never matched the seeder's own beat-5
    // text — see narrative_purpose below, unchanged since #1610). No
    // seeder location exists for beat 5 (the seeder has no location field
    // for any beat); HOME_BASE is PROPOSED here, matching beat 4's
    // location, since beats 4-5 are the same continuous moment in the
    // seeder's own text (mail arrives, then she reads it) — not sourced,
    // flagged for Evoni same as the other unattributed locations.
    typical_location: 'HOME_BASE',
    description: 'The invitation/opportunity reveal — Lala reads the mail and the audience sees her unfiltered reaction',
    narrative_purpose: 'Lala reads the mail. Audience sees her unfiltered reaction.',
    screen_action: 'OPEN_LETTER_INVITE_OVERLAY',
    surface: 'Audience Overlay',
    diegetic: false,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 6,
    name: 'Strategic Reaction',
    typical_location: 'HOME_BASE',
    description: 'Processing the reveal — doubt, confidence, or strategy shift',
    narrative_purpose: 'Lala evaluates: Can I afford this? Do I want this? What does this mean?',
    screen_action: 'LALA_VOICE_COMMAND',
    surface: null,
    diegetic: null,
    phase: 'before',
    emotional_intent: 'tension',
  },
  {
    number: 7,
    name: 'Interruption Pulse 2',
    typical_location: 'TRANSITION',
    description: 'Second disruption — escalation, complication, or twist',
    narrative_purpose: 'Second mail arrives. Brand deal, DM, or Side Quest. Tension compounds.',
    screen_action: 'SIDE_QUEST',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 8,
    name: 'Transformation Loop',
    typical_location: 'CLOSET',
    description: 'Getting ready — the physical and mental transformation',
    narrative_purpose: 'Dopamine engine. Scroll → select → swap → check. Outfit is chosen.',
    screen_action: 'CLOSET_OPEN',
    surface: 'Closet UI',
    diegetic: true,
    phase: 'before',
    emotional_intent: 'transformation',
  },
  {
    number: 9,
    name: 'Reminder/Deadline',
    typical_location: 'TRANSITION',
    description: 'Time pressure — the event is approaching, urgency builds',
    narrative_purpose: 'Pacing accelerates. Music intensifies. The clock is real.',
    screen_action: 'TODO_LIST',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 10,
    name: 'Event Travel',
    typical_location: 'TRANSITION',
    description: 'Moving to the event — anticipation, anxiety, or excitement',
    narrative_purpose: 'Stylish wipe transition. New environment loads. World expands.',
    screen_action: 'LOCATION_ICON',
    surface: null,
    diegetic: null,
    phase: null,
    emotional_intent: null,
  },
  {
    number: 11,
    name: 'Event Outcome',
    typical_location: 'EVENT_LOCATION',
    description: 'The main event — what happens when Lala arrives and performs',
    narrative_purpose: 'The evaluation resolves. Pass or fail. Stats update.',
    screen_action: 'ARRIVAL',
    surface: 'Environment',
    diegetic: true,
    phase: 'during',
    emotional_intent: 'peak_experience',
  },
  {
    number: 12,
    name: 'Deliverable Creation',
    typical_location: 'EVENT_LOCATION',
    description: 'Creating the content/product — the work output of the episode',
    narrative_purpose: 'Lala creates brand content. This exports as real Instagram stories.',
    screen_action: 'CONTENT_CREATE',
    surface: "Lala's Phone",
    diegetic: true,
    phase: 'during',
    emotional_intent: 'performance',
  },
  {
    number: 13,
    name: 'Recap Panel',
    typical_location: 'HOME_BASE',
    description: 'Reflecting on what happened — audience engagement moment',
    narrative_purpose: 'Cinematic stat card. Coins changed. Brand trust updated. Dream Fund moved.',
    screen_action: 'STATS_UPDATE',
    surface: 'Audience Overlay',
    diegetic: false,
    phase: 'after',
    emotional_intent: 'processing',
  },
  {
    number: 14,
    name: 'Cliffhanger',
    typical_location: 'HOME_BASE',
    description: 'Unresolved thread — drives viewer to next episode',
    narrative_purpose: 'Next episode is seeded. The world keeps going.',
    screen_action: 'FADE_OUT',
    surface: 'None',
    diegetic: false,
    phase: null,
    emotional_intent: null,
  },
];

module.exports = { CANONICAL_BEATS };

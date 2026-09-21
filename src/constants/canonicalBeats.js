/**
 * Canonical SAL 14-Beat Structure
 *
 * Single source of truth for the SAL 14-beat structure. Ruling:
 * docs/EVENT_EPISODE_FLOW.md §8(a) / §7 decision 1 — Evoni, 2026-09-21
 * (Task #1609): the show-brain seeder's names and order are canon.
 * Task #1611 (2026-09-21) completed the per-beat record and corrected
 * beat 5. This revision (same task, follow-up commit) adds `actor` and
 * the SAL interaction law (docs/EVENT_EPISODE_FLOW.md §8(f)) that makes
 * `actor` and `diegetic` two independent axes, not one.
 *
 * Each beat carries:
 *   - name, typical_location, description  — pre-existing fields read by
 *     scenePlannerService.js's AI prompt (`b.name`, `b.typical_location`,
 *     `b.description` — see generateScenePlan). UNCHANGED for every beat
 *     except beat 5 (corrected — was wrongly CLOSET/outfit; beat 5 is the
 *     invitation/opportunity reveal, not an outfit reveal).
 *     `typical_location` was never seeder-sourced for any beat — the
 *     seeder (src/seeders/20260312800000-show-brain-franchise-laws.js,
 *     "Episode Architecture — The 14-Beat Structure", :254-269) has no
 *     location field at all. These values are carried, unattributed, from
 *     scenePlannerService's own pre-existing BEAT_STRUCTURE (pre-#1610).
 *   - narrative_purpose — the seeder's own `desc` text, verbatim.
 *   - screen_action — the `ui` field from episodeScriptWriterService.js's
 *     and groundedScriptGeneratorService.js's own (identical, verified)
 *     BEAT_TEMPLATES dicts.
 *   - actor — who performs this beat's screen action: 'justawoman',
 *     'lala', or 'none'. Evoni's ruling, 2026-09-21.
 *   - surface — where the screen action is presented: 'Host Environment',
 *     'Audience Overlay', 'Closet UI', "Lala's Phone", "Lala's
 *     Environment", or 'none'. ("Environment" renamed to "Lala's
 *     Environment" this revision, so it isn't confused with "Host
 *     Environment".)
 *   - diegetic — whether Lala can perceive the presented RESULT. Not the
 *     same axis as `actor`: JustAWoman can be the actor (she clicks,
 *     chooses, operates the interface) while the result is still diegetic
 *     to Lala (she reads the same letter the audience saw enlarged) — see
 *     beat 5. Conversely JustAWoman can act on something Lala never
 *     perceives at all — see beat 8, the closet choice itself.
 *   - phase, emotional_intent — for beats 4, 6, 8, 10, 11, 12, 13: the
 *     content-matched mapping proposed in PR #1610's body (from
 *     episodeGeneratorService.js's BEAT_TEMPLATES, matched by narrative
 *     content, never by position) — beat 10 paired with legacy "The
 *     Arrival" (during / awe_or_intimidation), dropped in the first
 *     #1611 commit and restored here. For beats 1, 2, 3, 5, 7, 9, 14: no
 *     legacy match existed, so these are Evoni's own direct rulings, not
 *     derived from episodeGeneratorService.js at all.
 *
 * Three distinct states, never collapsed, for `actor`, `surface`, and
 * `diegetic` alike: `null` = not yet decided (EMPTY); the string `'none'`
 * = decided, intentionally nothing; any other value = decided, that
 * value. Beat 3 is the one case where `diegetic` takes `'none'` rather
 * than `true`/`false` — its `surface` is also `'none'`, so there is no
 * presented result for Lala to perceive at all, a different claim from
 * "she doesn't perceive it."
 *
 * As of the 2026-09-21 follow-up ruling below, every field on every beat
 * is decided (a value or an explicit `'none'`) except `typical_location`,
 * which stays proposed-not-sourced for all 14 (see above).
 *
 * episodeGeneratorService.js and feedMomentsService.js are not converted
 * to import this module yet — see docs/EVENT_EPISODE_FLOW.md §8(d).
 */

const CANONICAL_BEATS = [
  {
    number: 1,
    name: 'Opening Ritual',
    typical_location: 'HOME_BASE',
    description: 'Lala in her space — sets the emotional tone for the episode',
    narrative_purpose: "Headphones on — the show's sacred opening. Never skipped.",
    screen_action: 'HEADPHONES_ON',
    actor: 'justawoman',
    surface: 'Host Environment',
    diegetic: false,
    phase: 'before',
    emotional_intent: 'intimacy_ritual',
  },
  {
    number: 2,
    name: 'Login Sequence',
    typical_location: 'HOME_BASE',
    description: 'Checking phone/social — receives the episode catalyst',
    narrative_purpose: 'Login overlay → typing animation → Enter. World loads.',
    screen_action: 'LOGIN',
    actor: 'justawoman',
    surface: 'Audience Overlay',
    diegetic: false,
    phase: 'before',
    emotional_intent: 'threshold',
  },
  {
    number: 3,
    name: 'Welcome',
    typical_location: 'HOME_BASE',
    description: 'Greeting the audience — introduces the episode question',
    narrative_purpose: 'Lala enters the frame. World state is visible. Tone is set.',
    screen_action: 'WELCOME',
    actor: 'none',
    surface: 'none',
    // diegetic: 'none' — Evoni's ruling. Its surface is also 'none': there
    // is no presented result at all for Lala to perceive, which is a
    // different claim from "she doesn't perceive it" (that would be `false`).
    diegetic: 'none',
    phase: 'before',
    emotional_intent: 'warmth_connection',
  },
  {
    number: 4,
    name: 'Interruption Pulse 1',
    typical_location: 'HOME_BASE',
    description: 'First disruption — text, call, memory — raises stakes',
    narrative_purpose: 'Mail arrives. First narrative event of the episode. Usually an Invite.',
    screen_action: 'MAIL_NOTIFICATION',
    // actor: 'none' — under Evoni's ruling, the mail arriving (beat 4) and
    // JustAWoman's click that opens it (beat 5) are two different beats;
    // beat 4 itself genuinely has no actor.
    actor: 'none',
    surface: "Lala's Phone",
    diegetic: true,
    phase: 'before',
    emotional_intent: 'anticipation',
  },
  {
    number: 5,
    name: 'Reveal',
    // CORRECTED — Evoni's ruling 2026-09-21: beat 5 is the
    // invitation/opportunity reveal, not an outfit reveal. Was wrongly
    // 'CLOSET' / "The outfit/look reveal — wardrobe becomes part of the
    // narrative" (copied verbatim from scenePlannerService's pre-existing
    // BEAT_STRUCTURE in #1610, which never matched the seeder's own beat-5
    // text — see narrative_purpose below, unchanged since #1610). No
    // seeder location exists for beat 5 (the seeder has no location field
    // for any beat); HOME_BASE is PROPOSED, matching beat 4's location,
    // since beats 4-5 are the same continuous moment in the seeder's own
    // text (mail arrives, then she reads it) — not sourced, flagged for
    // Evoni same as the other unattributed locations.
    typical_location: 'HOME_BASE',
    // "The physical letter shows on screen" is Evoni's own wording —
    // her ruling, 2026-09-21, not this module's or either PR's phrasing.
    // JustAWoman clicks the notification; the physical letter shows on
    // screen and Lala reads it. One invitation object — any enlarged
    // audience-facing view is that same letter, not a separate asset.
    description: 'JustAWoman clicks the notification; the physical letter shows on screen and Lala reads it',
    narrative_purpose: 'Lala reads the mail. Audience sees her unfiltered reaction.',
    screen_action: 'OPEN_LETTER_INVITE_OVERLAY',
    actor: 'justawoman',
    surface: 'Audience Overlay',
    // diegetic: true — the actor (JustAWoman, clicking) and the perceiver
    // (Lala, reading) are different people; the result is still diegetic
    // because it's the same letter object Lala herself reads, just shown
    // enlarged for the audience. Actor and diegetic are independent axes.
    diegetic: true,
    phase: 'before',
    emotional_intent: 'surprise_excitement',
  },
  {
    number: 6,
    name: 'Strategic Reaction',
    typical_location: 'HOME_BASE',
    description: 'Processing the reveal — doubt, confidence, or strategy shift',
    narrative_purpose: 'Lala evaluates: Can I afford this? Do I want this? What does this mean?',
    // LALA_VOICE_COMMAND = Lala reacts and speaks in her own world; never
    // a command issued to the controller/audience layer.
    screen_action: 'LALA_VOICE_COMMAND',
    actor: 'lala',
    surface: "Lala's Environment",
    diegetic: true,
    phase: 'before',
    emotional_intent: 'tension',
  },
  {
    number: 7,
    name: 'Interruption Pulse 2',
    typical_location: 'TRANSITION',
    description: 'Second disruption — escalation, complication, or twist',
    narrative_purpose: 'Second mail arrives. Brand deal, DM, or Side Quest. Tension compounds.',
    // SIDE_QUEST reaches Lala as a DM, call, or message — never a quest
    // card or game-UI artifact.
    screen_action: 'SIDE_QUEST',
    actor: 'none',
    surface: "Lala's Phone",
    diegetic: true,
    phase: 'before',
    emotional_intent: 'escalation',
  },
  {
    number: 8,
    name: 'Transformation Loop',
    typical_location: 'CLOSET',
    description: 'Getting ready — the physical and mental transformation',
    narrative_purpose: 'Dopamine engine. Scroll → select → swap → check. Outfit is chosen.',
    screen_action: 'CLOSET_OPEN',
    // JustAWoman chooses; Lala wears it. The closet UI itself is not
    // something Lala perceives — she experiences only its outcome.
    actor: 'justawoman',
    surface: 'Closet UI',
    diegetic: false,
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
    // The overlay appears; nobody performs it. — Evoni's ruling.
    actor: 'none',
    surface: 'Audience Overlay',
    diegetic: false,
    phase: 'before',
    emotional_intent: 'urgency',
  },
  {
    number: 10,
    name: 'Event Travel',
    typical_location: 'TRANSITION',
    description: 'Moving to the event — anticipation, anxiety, or excitement',
    narrative_purpose: 'Stylish wipe transition. New environment loads. World expands.',
    // The LOCATION_ICON transition graphic itself renders on Audience
    // Overlay and is not diegetic — but the travel it represents happens
    // in Lala's Environment. Two different claims about the same beat;
    // `surface`/`diegetic` below describe the rendered icon, not the
    // underlying diegetic fact.
    screen_action: 'LOCATION_ICON',
    actor: 'none',
    surface: 'Audience Overlay',
    diegetic: false,
    // Restored — PR #1610's content-matched mapping already paired this
    // beat with legacy "The Arrival" (during / awe_or_intimidation); the
    // first #1611 commit dropped it in error. Evoni caught it.
    phase: 'during',
    emotional_intent: 'awe_or_intimidation',
  },
  {
    number: 11,
    name: 'Event Outcome',
    typical_location: 'EVENT_LOCATION',
    description: 'The main event — what happens when Lala arrives and performs',
    narrative_purpose: 'The evaluation resolves. Pass or fail. Stats update.',
    screen_action: 'ARRIVAL',
    actor: 'none',
    surface: "Lala's Environment",
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
    // CONTENT_CREATE is Lala filming content as a creator in her own
    // world — Evoni's ruling.
    actor: 'lala',
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
    // The stats update is the system, not a person. — Evoni's ruling.
    actor: 'none',
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
    actor: 'none',
    // CHANGED from 'None' (proposed) to 'Audience Overlay' — Evoni's ruling.
    surface: 'Audience Overlay',
    diegetic: false,
    phase: 'after',
    emotional_intent: 'suspense',
  },
];

module.exports = { CANONICAL_BEATS };

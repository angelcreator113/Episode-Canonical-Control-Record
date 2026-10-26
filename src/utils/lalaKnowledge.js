'use strict';

/**
 * What Lala knows, and from which line of the episode (Evoni, 2026-10-26,
 * My Little List rulings 1 and 3). My Little List shows only what she has
 * learned; this says when she learned it.
 *
 * The states:
 *   invitation_received              the event's invitation reached her
 *   deal_discovered                  she has the brand's offer
 *   deal_accepted                    she said yes to it
 *   opportunity_discovered <id>      she knows of that opportunity
 *   opportunity_accepted <id>        she said yes to it
 *
 * Where each comes from, first match wins, one source per state:
 *   1. the game action that shows it to her: the [UI:DISPLAY|OPEN|SHOW …]
 *      line that opens the invitation, or the offer letter;
 *   2. an opportunity offered in an earlier episode: known from the start,
 *      and accepted from the start when it is booked or further along;
 *   3. `[LEARNS: <state> [id]]` on its own line, for a discovery no game
 *      action records ("Use [LEARNS] for narrative discoveries that lack an
 *      existing structured gameplay event");
 *   4. the beat it happens in on a script that says neither (Evoni:
 *      "Existing beat information may provide initial compatibility"): the
 *      invitation at the start of beat 5 (Reveal), the offer at the end of
 *      beat 5 (the offer letter comes directly after the invitation), and
 *      yes to the deal at the start of beat 7 when the terms are locked to
 *      this episode. Opportunities have no beat: only 2 or 3 reveal one.
 * Accepting implies knowing: a discovery comes no later than its yes. A
 * state none of these gives is not known, and a `[LEARNS]` line that names
 * an unknown state, an opportunity of no record, a deal on an event with
 * none, or a state a game action already gives changes nothing and is
 * reported (`issues`) for the Script tab's health check.
 *
 * Positions are { beat: canonical beat number, line: index of the line in
 * that beat }; a state is known at a position when it was learned at or
 * before it, so it can change within a beat. Pure: no database.
 */

const { scriptBeats } = require('./scriptWear');

const FACTS = Object.freeze(['invitation_received', 'deal_discovered', 'deal_accepted', 'opportunity_discovered', 'opportunity_accepted']);
const REF_FACTS = new Set(['opportunity_discovered', 'opportunity_accepted']);
const LEARNS_LINE = /^\s*\[LEARNS:\s*([A-Za-z_]+)(?:\s+([^\]\s]+))?\s*\]\s*$/i;
// The line that shows her the invitation or the offer letter.
const SHOW_LINE = /^\s*\[UI:\s*(?:DISPLAY|OPEN|SHOW)\b([^\]]*)\]\s*$/i;
const INVITATION_TARGET = /invit|OPEN_LETTER_INVITE_OVERLAY/i;
const OFFER_TARGET = /offer\s*letter|\boffer\b/i;
// Opportunity statuses at or past yes (models/Opportunity.js status flow).
const ACCEPTED_STATUSES = new Set(['booked', 'preparing', 'active', 'completed', 'paid']);

const START = Object.freeze({ beat: 0, line: 0 });
const DEFAULTS = Object.freeze({
  invitation_received: { beat: 5, line: 0 },
  deal_discovered: { beat: 5, line: Infinity },
  deal_accepted: { beat: 7, line: 0 },
});

/** -1, 0 or 1: a before, at, or after b. */
function comparePositions(a, b) {
  if (a.beat !== b.beat) return a.beat < b.beat ? -1 : 1;
  if (a.line === b.line) return 0;
  return a.line < b.line ? -1 : 1;
}

const earlier = (a, b) => (!a ? b : !b ? a : comparePositions(a, b) <= 0 ? a : b);

/** The key a state is stored under: the state, with its opportunity id. */
const factKey = (fact, ref = null) => (REF_FACTS.has(fact) ? `${fact}:${ref}` : fact);

/** Every [LEARNS] line: { fact, ref, at, raw }; fact is lower case, maybe unknown. */
function learnsCues(beats) {
  const cues = [];
  beats.forEach((b) => b.lines.forEach((line, i) => {
    const m = String(line).match(LEARNS_LINE);
    if (m) cues.push({ fact: m[1].toLowerCase(), ref: m[2] || null, at: { beat: b.number, line: i }, raw: String(line).trim() });
  }));
  return cues;
}

/** The first line showing her the invitation, and the offer letter. */
function actionMoments(beats) {
  let invitation = null;
  let offer = null;
  beats.forEach((b) => b.lines.forEach((line, i) => {
    const m = String(line).match(SHOW_LINE);
    if (!m) return;
    const at = { beat: b.number, line: i };
    if (INVITATION_TARGET.test(m[1])) invitation = earlier(invitation, at);
    else if (OFFER_TARGET.test(m[1])) offer = earlier(offer, at);
  }));
  return { invitation, offer };
}

/**
 * When Lala learns each state in this episode.
 * @param {object} opts
 *   script         the episode's saved script (or beats: scriptBeats output)
 *   event          null, or { is_deal, terms_locked } for the episode's event
 *   opportunities  [{ id, discovered_before, accepted_before }] of the show
 * @returns {{ facts: Map<string, { at, source }>, issues: object[] }}
 */
function knowledgeTimeline({ script = '', beats = null, event = null, opportunities = [] } = {}) {
  const parsed = beats || scriptBeats(script);
  const facts = new Map();
  const issues = [];
  const set = (key, at, source) => {
    const had = facts.get(key);
    if (!had || comparePositions(at, had.at) < 0) facts.set(key, { at, source });
  };
  const opps = new Map((opportunities || []).filter((o) => o && o.id).map((o) => [String(o.id), o]));

  // 1. The game actions.
  const moments = actionMoments(parsed);
  if (event && moments.invitation) set('invitation_received', moments.invitation, 'action');
  if (event?.is_deal && moments.offer) set('deal_discovered', moments.offer, 'action');

  // 2. Opportunities from earlier episodes.
  for (const [id, o] of opps) {
    if (o.discovered_before || o.accepted_before) set(factKey('opportunity_discovered', id), START, 'earlier_episode');
    if (o.accepted_before) set(factKey('opportunity_accepted', id), START, 'earlier_episode');
  }

  // 3. [LEARNS] lines.
  const fromAction = new Set([...facts.keys()]);
  const seenCue = new Set();
  for (const cue of learnsCues(parsed)) {
    const issue = (code) => issues.push({ code, fact: cue.fact, ref: cue.ref, beat: cue.at.beat, line: cue.at.line, raw: cue.raw });
    if (!FACTS.includes(cue.fact)) { issue('unknown_state'); continue; }
    if (REF_FACTS.has(cue.fact) && (!cue.ref || !opps.has(String(cue.ref)))) { issue('unknown_opportunity'); continue; }
    if (!REF_FACTS.has(cue.fact) && cue.ref) { issue('unexpected_reference'); continue; }
    if (cue.fact === 'invitation_received' && !event) { issue('no_event'); continue; }
    if (cue.fact.startsWith('deal_') && !event?.is_deal) { issue('not_a_deal'); continue; }
    const key = factKey(cue.fact, cue.ref && String(cue.ref));
    if (fromAction.has(key)) { issue('given_by_game_action'); continue; }
    if (seenCue.has(key)) { issue('repeated'); continue; }
    seenCue.add(key);
    set(key, cue.at, 'learns');
  }

  // 4. The beats, for a state none of the above gave.
  if (event && !facts.has('invitation_received')) set('invitation_received', DEFAULTS.invitation_received, 'beat');
  if (event?.is_deal && !facts.has('deal_discovered')) set('deal_discovered', DEFAULTS.deal_discovered, 'beat');
  if (event?.is_deal && event.terms_locked && !facts.has('deal_accepted')) set('deal_accepted', DEFAULTS.deal_accepted, 'beat');

  // Accepting implies knowing.
  const imply = (yes, knows) => {
    const y = facts.get(yes);
    if (y) set(knows, y.at, facts.get(knows) ? facts.get(knows).source : y.source);
  };
  imply('deal_accepted', 'deal_discovered');
  for (const id of opps.keys()) imply(factKey('opportunity_accepted', id), factKey('opportunity_discovered', id));

  return { facts, issues };
}

/** Whether Lala knows the state (with its opportunity id) at the position. */
function knowsAt(timeline, fact, at, ref = null) {
  if (fact === 'start') return true;
  const f = timeline.facts.get(factKey(fact, ref && String(ref)));
  return Boolean(f && comparePositions(f.at, at) <= 0);
}

/** Where a state is learned, or null. */
function learnedAt(timeline, fact, ref = null) {
  if (fact === 'start') return START;
  return timeline.facts.get(factKey(fact, ref && String(ref)))?.at || null;
}

/** An opportunity's before-this-episode knowledge, from its record. */
function opportunityBefore({ status, offered_episode_number: offered }, episodeNumber) {
  const before = Number.isInteger(offered) && Number.isInteger(episodeNumber) && offered < episodeNumber;
  return { discovered_before: before, accepted_before: before && ACCEPTED_STATUSES.has(String(status || '').toLowerCase()) };
}

module.exports = {
  FACTS,
  REF_FACTS,
  LEARNS_LINE,
  ACCEPTED_STATUSES,
  START,
  DEFAULTS,
  comparePositions,
  learnsCues,
  actionMoments,
  knowledgeTimeline,
  knowsAt,
  learnedAt,
  opportunityBefore,
};

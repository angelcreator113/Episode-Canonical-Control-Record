'use strict';

/**
 * What a generated script covers, and what it misses (Evoni, 2026-10-15:
 * "is it making sure everything is being done within the script?"). The
 * writer only checked that the 14 beat headers came back; the Script tab's
 * checklist showed the rest to Evoni after the fact. This reads the script
 * the same way the tab does, so the writer can fix a gap before saving:
 *
 *   - each goal she has at the event is covered, and the brief's forward
 *     hook told in beat 14 (utils/coverMatch, the Script tab's own code;
 *     her manual marks, facts.marks, win). What she
 *     owes is not: deliverables are not always shown in the show (Evoni,
 *     2026-10-18; beat 12 is The Fashion Challenge);
 *   - each piece of the locked look has its `[WEAR: id]` line in the closet
 *     beat;
 *   - each canonical beat played on Lala's phone has a `[UI:]` moment;
 *   - every canonical beat is there (a reply cut off at its token limit
 *     loses the last beats).
 *
 * Each gap names the beat that should carry it (the career block's beats:
 * goals in 11, the hook in 14; wear cues in the closet
 * beat). Pure; no I/O.
 */

const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const { splitScriptBeats } = require('./scriptBeatLocks');
const { beat14Delivers } = require('./beat14Invitation');
const { scriptRuleItems } = require('./scriptRuleChecks');
const { isClosetScreen } = require('./scriptWear');

// ─── The tab's must-cover rule (utils/coverMatch.js, the Script tab's own) ───
// Script tab audit 6 (2026-10-24): one matcher for the tab, this check and
// the story record. A goal by its verb phrase and its person, outside the
// to-do list, in the latest beat that does it; the hook in beat 14 only.
const coverMatch = require('./coverMatch');
const { keyWords } = coverMatch;

// The parsed beats ({ number, text }) as the matcher reads them: { number, lines }.
const lined = (beats) => (beats || []).map((b) => ({ number: b.number, lines: String(b.text || '').split('\n').slice(1) }));

/** The first beat (its number) whose lines mention the text, else null. */
function mentionedIn(beats, text) {
  return coverMatch.mentionedIn(lined(beats), text);
}

/**
 * Where a relationship goal is covered, { beat, line, as } or null (Evoni,
 * 2026-10-23: "Get to know Truthville" never ticked when the script named
 * her by her real name; utils/coverMatch goalMatch). `person`: goalPerson's,
 * or null (as written only).
 */
function goalCovered(beats, goal, person) {
  const m = coverMatch.goalMatch(lined(beats), goal, person || null);
  return m ? { beat: m.beat, line: m.line, as: m.as } : null;
}

// A manual mark (episode_briefs.event_metadata.cover_marks; Evoni,
// 2026-10-24): one she marked covered is not a gap, one she marked not
// covered is, whatever the words say. A covered mark with no beat counts in
// the item's own beat.
function marked(item, key, marks) {
  const m = coverMatch.withMark({ ...item, markKey: key }, marks);
  const { markKey: _k, covered, matched: _m, ...rest } = m;
  return { ...rest, beat: covered ? (m.beat ?? item.target) : null };
}

const surfaceHasPhone = (surface) => (typeof surface === 'string'
  ? surface === "Lala's Phone"
  : [surface?.start, surface?.end].includes("Lala's Phone"));

/** The canonical beats played on Lala's phone (canonicalBeats surface). */
const PHONE_BEATS = CANONICAL_BEATS.filter((b) => surfaceHasPhone(b.surface)).map((b) => b.number);
const CLOSET_BEAT = (CANONICAL_BEATS.find((b) => b.screen_action === 'CLOSET_OPEN') || { number: 8 }).number;

const UI_LINE = /^\s*\[UI:/i;
// The screen named Closet, as utils/scriptWear closetIndex reads it (Script
// page audit 3, 2026-10-19: `[UI:OPEN Closet Sale Alert]` was the closet).
const OPEN_LINE = /^\s*\[UI:\s*OPEN\s+(.*?)\s*\]\s*$/i;
const opensCloset = (line) => { const m = String(line).match(OPEN_LINE); return !!m && isClosetScreen(m[1]); };

/**
 * { items, missing } for the script. `facts`:
 *   deliverables: [{ description, platform, deliverable_type }]
 *   goals: [{ label, person }] (person: goalPerson's, or null; a covered
 *          goal's item also has `line`, the line that covers it)
 *   forwardHook: string
 *   opportunity: { name, from } (beat 14's when it is delivered, or null)
 *   lockedPieces: [{ id, name }]
 *   marks: episode_briefs.event_metadata.cover_marks, or null
 * Each item: { kind, label, beat (where it is, or null), target (where it
 * belongs) }. missing is the items with no beat, plus every canonical beat
 * that did not come back ({ kind: 'beat', target }).
 */
function scriptCoverage(script, facts = {}) {
  const { beats } = splitScriptBeats(script);
  const numbers = new Set(beats.map((b) => b.number));
  const items = [];

  const marks = facts.marks && typeof facts.marks === 'object' ? facts.marks : null;
  for (const g of facts.goals || []) {
    const label = String(g?.label || '').trim();
    if (!label) continue;
    const m = goalCovered(beats, g, g.person || null);
    const item = { kind: 'goal', label, beat: m ? m.beat : null, ...(m?.line ? { line: m.line } : {}), target: 11 };
    items.push(marked(item, coverMatch.coverKey('goal', { slot: g.slot || 'relationship', label }), marks));
  }
  const hook = typeof facts.forwardHook === 'string' ? facts.forwardHook.trim() : '';
  const opp = facts.opportunity && String(facts.opportunity.name || '').trim();
  const asLines = lined(beats);
  // With an invitation to deliver, beat 14 ends on it and the hook is told
  // through it: one ending, not two (Script page audit, 2026-10-19). Only
  // beat 14 tells it (utils/coverMatch hookCovered).
  if (hook) {
    const item = { kind: 'hook', label: hook, beat: coverMatch.hookCovered(asLines, hook, opp || null), target: 14, ...(opp ? { via: 'invitation' } : {}) };
    items.push(marked(item, coverMatch.coverKey('hook'), marks));
  }
  // Beat 14's opportunity (Evoni, 2026-10-19): there only when beat 14 has a
  // [UI:DM …] or [UI:NOTIFY …] line naming it (utils/beat14Invitation); a
  // mention in another beat is not the invitation (Script page audit,
  // 2026-10-19).
  if (opp) {
    const item = { kind: 'opportunity', label: opp, from: facts.opportunity.from || null, beat: beat14Delivers(asLines, opp) ? 14 : null, target: 14 };
    items.push(marked(item, coverMatch.coverKey('opportunity'), marks));
  }

  // The closet beat: the one that opens the closet, else the canonical one.
  const closet = (beats.find((b) => b.text.split('\n').some(opensCloset)) || {}).number || CLOSET_BEAT;
  for (const p of facts.lockedPieces || []) {
    if (!p?.id) continue;
    const cue = new RegExp(`^\\s*\\[WEAR:\\s*${String(p.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\]\\s*$`, 'im');
    // Put on in the closet beat (Script page audit, 2026-10-19): a cue in
    // another beat (the Fashion Challenge's) is not the look going on.
    const at = beats.find((b) => b.number === closet && cue.test(b.text));
    items.push({ kind: 'wear', label: p.name || String(p.id), id: String(p.id), beat: at ? at.number : null, target: closet });
  }

  for (const n of PHONE_BEATS) {
    const b = beats.find((x) => x.number === n);
    if (!b) continue;
    const has = b.text.split('\n').slice(1).some((l) => UI_LINE.test(l));
    const canon = CANONICAL_BEATS.find((c) => c.number === n);
    items.push({ kind: 'phone', label: canon?.screen_action || `Beat ${n}`, beat: has ? n : null, target: n });
  }

  // The show's rules (utils/scriptRuleChecks.js; facts.rules: { money, shoppingApproved }).
  items.push(...scriptRuleItems(beats, facts.rules));
  const missing = items.filter((i) => i.beat === null);
  for (const c of CANONICAL_BEATS) if (!numbers.has(c.number)) missing.push({ kind: 'beat', label: c.name, beat: null, target: c.number });
  return { items, missing };
}

/** What to ask of one beat so it covers its gaps (for the writer's one-beat prompt). */
function beatRequirements(gaps) {
  return gaps.map((g) => {
    if (g.kind === 'goal') return `Lala works toward her goal, named so it reads: "${g.label}".`;
    if (g.kind === 'hook') return g.via === 'invitation' ? `Tell the forward hook through the invitation the beat ends on: "${g.label}".` : `End on the forward hook: "${g.label}".`;
    if (g.kind === 'opportunity') return `End on the invitation${g.from ? ` from ${g.from}` : ''}, as one private message or notification that names it: "${g.label}".`;
    if (g.kind === 'wear') return `Right after the line where Lala puts on "${g.label}", write its own line exactly: [WEAR: ${g.id}]`;
    if (g.kind === 'phone') return 'Show what happens on Lala\'s phone in this beat with at least one [UI:VERB Target] line.';
    if (g.kind === 'cut') return 'Write this beat in full: the first draft stopped partway through it.';
    if (g.kind === 'rule') return g.ask;
    // A missing beat played on her phone needs its phone moment too (re-audit 2).
    if (g.kind === 'beat' && PHONE_BEATS.includes(g.target)) return 'Show what happens on Lala\'s phone in this beat with at least one [UI:VERB Target] line.';
    return null;
  }).filter(Boolean);
}

/** The script with the beat numbered `number` replaced by `beatText` (header first); unchanged when there is none. */
function replaceBeatByNumber(script, number, beatText) {
  const split = splitScriptBeats(script);
  const at = split.beats.findIndex((b) => b.number === number);
  if (at < 0 || !String(beatText || '').trim()) return script;
  const beats = split.beats.map((b, i) => (i === at ? String(beatText).replace(/\s+$/, '') : b.text));
  const preamble = split.preamble.replace(/\s+$/, '');
  return preamble ? `${preamble}\n\n${beats.join('\n\n')}` : beats.join('\n\n');
}

/** The script with a missing beat put after the last beat numbered below it (first when none). */
function insertBeatByNumber(script, number, beatText) {
  const split = splitScriptBeats(script);
  if (!String(beatText || '').trim() || split.beats.some((b) => b.number === number)) return script;
  const before = split.beats.map((b, i) => ({ n: b.number, i })).filter((x) => x.n < number).pop();
  const beats = split.beats.map((b) => b.text);
  beats.splice(before ? before.i + 1 : 0, 0, String(beatText).replace(/\s+$/, ''));
  const preamble = split.preamble.replace(/\s+$/, '');
  return preamble ? `${preamble}\n\n${beats.join('\n\n')}` : beats.join('\n\n');
}

module.exports = { scriptCoverage, beatRequirements, replaceBeatByNumber, insertBeatByNumber, keyWords, mentionedIn, goalCovered, PHONE_BEATS };

'use strict';

/**
 * Which script line a voice take belongs to (Voice Studio B1; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, R2.6, R4.1, R5.1-R5.3).
 * Pure; no I/O.
 *
 * 1. The lines a take can be tied to are the teleprompter's: a beat's
 *    lines counted as frontend/src/lib/teleprompterLines.js counts them
 *    without on-screen moments (teleprompterIndexMap, the `vi` a voice
 *    clip's line_index names). Counted: dialogue (not Lala's automatic
 *    reaction), actions and narration. Not counted: blank and rule lines,
 *    [UI:] moments, [TRANSITION:] and other tags, `Lala (auto):` lines.
 *    Beats are numbered as frontend/src/lib/scriptExport.js scriptSections
 *    numbers them. frontend/src/lib/voiceLineContext.parity.test.js holds
 *    the two to the same lines for a corpus of scripts.
 *
 * 2. Each line's structured context: beat, position, occurrence (which of
 *    the beat's identical lines, from the top), speaker, delivery note,
 *    words, the SHA-256 of the whole normalised line (row_hash, speaker
 *    and note included) and its neighbours' row hashes.
 *
 * 3. resolve(): where a stored association stands in the script now, never
 *    by guessing:
 *      bound            same position, same line, same neighbours
 *      moved            the same line, the only one like it in the beat, at
 *                       another position (or its neighbours changed):
 *                       a person confirms before it is used
 *      ambiguous        identical lines and the neighbours do not decide:
 *                       a person picks
 *      unbound          anything else, with a reason
 */

const crypto = require('crypto');
const { headerNumber, normalizeBeatHeaders } = require('./beatLabelNumber');
const { speakerLine, unquote, unbold, isHerSpeaker, shownSpeaker, HER } = require('./scriptSpeaker');

// A line as compared: quotes, dashes and spacing written one way; words and
// case kept. The same rule as lineKeys.normaliseLine, copied rather than
// imported: the line-identity modules stay unused until A1c R2/R3 (the A1a
// guard in tests/unit/utils/lineKeys.test.js), and A1d will match these row
// hashes against them (tests/unit/utils/voiceLineContext.test.js keeps the two equal).
function normaliseLine(text) {
  return String(text ?? '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const BEAT_HEADER = /^\s*##\s*BEAT:\s*(.*)$/i;
const TAG_LINE = /^\s*\[\s*([A-Za-z_]+)\s*:\s*([^\]]*)\]?\s*$/;
const UI_LINE = /^\s*\[UI:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/i;
const RULE_LINE = /^(?:-[ \t]*){3,}$|^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$/;
const AUTO_REACTION = /^\(\s*auto(?:matic)?(?:[\s-]*reaction)?\s*\)$/i;

const EDGE_START = '^';
const EDGE_END = '$';

const REASONS = Object.freeze({
  speaker_changed: 'The speaker of this line changed since the take was tied to it.',
  note_changed: 'The delivery note on this line changed since the take was tied to it.',
  words_changed: 'The words of this line changed since the take was tied to it.',
  line_removed: 'This line is no longer in the beat.',
  beat_changed: 'This line is no longer in this beat.',
  beat_missing: 'The beat this take was tied to is not in the script.',
  duplicate_beat: 'The script has two beats with this number, so the line cannot be found safely.',
  ambiguous_duplicate: 'The beat has identical lines and this take could be either. Pick the line.',
  moved: 'The line moved within the beat. Confirm the take is still for it.',
  neighbours_changed: 'The lines around this one changed. Check the take still fits.',
  moved_or_edited: 'This line was edited, or it moved and an identical line took its place. Pick the line, or withdraw the approval.',
});

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// The script's beats, numbered as scriptSections numbers them.
function sections(scriptText) {
  const beats = [];
  const preamble = [];
  for (const line of normalizeBeatHeaders(scriptText || '').split('\n')) {
    const h = line.match(BEAT_HEADER);
    if (h) {
      const n = headerNumber(h[1].trim());
      beats.push({ number: n != null ? n : beats.length + 1, lines: [] });
    } else if (line.trim()) {
      (beats.length ? beats[beats.length - 1].lines : preamble).push(line);
    }
  }
  if (!beats.length && preamble.length) return [{ number: null, lines: preamble }];
  return beats;
}

/**
 * A raw script line as the teleprompter reads it, or null when the
 * teleprompter does not count it: { speaker, written, ext, paren, note,
 * words, prime }. `speaker` is the person (JustAWoman for any of her names);
 * `ext` is a note before the colon (`Lala (softly):`), `paren` one before the
 * words (`Lala: (softly) …`, the teleprompter's paren), and `note` both, as
 * the delivery note a take is checked against. Actions and narration have
 * speaker null.
 */
function countedLine(line) {
  const plain = unbold(line);
  const t = String(plain ?? '').trim();
  const none = { speaker: null, written: null, ext: null, paren: null, note: null, prime: false };
  if (!t || RULE_LINE.test(t)) return null;
  if (UI_LINE.test(t)) return null; // an on-screen moment
  const tag = t.match(TAG_LINE);
  if (tag && t.startsWith('[')) return null; // [TRANSITION: …] and every other tag
  if (/^\(.*\)$/.test(t)) return { ...none, words: t.slice(1, -1).trim() };
  const d = speakerLine(t, { cast: null });
  if (d && d.words) {
    if (d.speaker === 'Lala' && AUTO_REACTION.test(String(d.note ?? '').trim())) return null;
    let words = d.words;
    let paren = null;
    const p = words.match(/^(\([^)]*\))\s*(.*)$/);
    if (p && p[2]) { paren = p[1]; words = p[2]; }
    const ext = d.note || null;
    const speaker = shownSpeaker(d.speaker);
    return {
      speaker, written: d.speaker, ext, paren, note: [ext, paren].filter(Boolean).join(' ') || null,
      words: unquote(words), prime: speaker === HER || isHerSpeaker(d.speaker),
    };
  }
  return { ...none, words: t };
}

const rowHashOf = (line) => sha256(normaliseLine(unbold(line)));

/** The fields a context hash covers, in a fixed order. */
const CONTEXT_FIELDS = ['beat_number', 'line_index', 'occurrence', 'speaker_key', 'delivery_note', 'words', 'row_hash', 'prev_hash', 'next_hash'];
const contextHash = (ctx) => sha256(JSON.stringify(CONTEXT_FIELDS.map((f) => (ctx[f] == null ? null : ctx[f]))));

/**
 * Every counted line of the script with its structured context:
 * { beats: Map(beatNumber → { count, lines: [ctx] }), all: [ctx] }.
 * ctx: { beat_number, line_index, occurrence, speaker_key, speaker_written,
 * delivery_note, words, prime, row_hash, prev_hash, next_hash, context_hash }.
 * A beat number that appears twice is kept with count 2 (never resolved).
 */
function lineContexts(scriptText) {
  const beats = new Map();
  const all = [];
  for (const section of sections(scriptText)) {
    const counted = [];
    for (const raw of section.lines) {
      const c = countedLine(raw);
      if (c) counted.push({ raw, ...c, row_hash: rowHashOf(raw) });
    }
    const seen = new Map();
    const lines = counted.map((c, i) => {
      const occurrence = (seen.get(c.row_hash) || 0) + 1;
      seen.set(c.row_hash, occurrence);
      const ctx = {
        beat_number: section.number,
        line_index: i,
        occurrence,
        speaker_key: c.speaker ? String(c.speaker).toLowerCase() : null,
        speaker_written: c.written,
        delivery_note: c.note,
        paren: c.paren,
        words: c.words,
        prime: c.prime,
        row_hash: c.row_hash,
        prev_hash: i > 0 ? counted[i - 1].row_hash : EDGE_START,
        next_hash: i < counted.length - 1 ? counted[i + 1].row_hash : EDGE_END,
      };
      ctx.context_hash = contextHash(ctx);
      return ctx;
    });
    const key = section.number;
    const prev = beats.get(key);
    beats.set(key, prev ? { count: prev.count + 1, lines: prev.lines } : { count: 1, lines });
    all.push(...lines);
  }
  return { beats, all };
}

/** The context of the line at (beat, index) now, or null with a reason. */
function lineAt(contexts, beatNumber, lineIndex) {
  const beat = contexts.beats.get(beatNumber);
  if (!beat) return { ctx: null, reason: 'beat_missing' };
  if (beat.count > 1) return { ctx: null, reason: 'duplicate_beat' };
  const ctx = beat.lines[lineIndex];
  return ctx ? { ctx, reason: null } : { ctx: null, reason: 'line_removed' };
}

const sameNeighbours = (a, b) => a.prev_hash === b.prev_hash && a.next_hash === b.next_hash;

/**
 * Where a stored association stands in `contexts` (lineContexts of the
 * current script). `assoc`: a stored context (the fields above).
 * Returns { status, reason, line_index, candidates, hint_beat, ctx }: ctx is
 * the line's context now when bound or moved. A bound line whose neighbours
 * changed has reason 'neighbours_changed'.
 */
function resolve(assoc, contexts) {
  const out = (status, extra = {}) => ({ status, reason: null, line_index: null, candidates: [], hint_beat: null, ...extra });
  const beat = contexts.beats.get(assoc.beat_number);
  if (!beat) {
    const elsewhere = contexts.all.find((c) => c.row_hash === assoc.row_hash);
    return out('unbound', { reason: elsewhere ? 'beat_changed' : 'beat_missing', hint_beat: elsewhere ? elsewhere.beat_number : null });
  }
  if (beat.count > 1) return out('unbound', { reason: 'duplicate_beat' });

  const here = beat.lines[assoc.line_index] || null;
  if (here && here.row_hash === assoc.row_hash && sameNeighbours(here, assoc)) return out('bound', { line_index: here.line_index, ctx: here });

  const same = beat.lines.filter((c) => c.row_hash === assoc.row_hash);
  if (same.length === 1 && here && here === same[0]) {
    // The same line at the same place, the only one like it in the beat: only its neighbours
    // changed. Still bound; the changed context is for a person to review (Evoni, 2026-10-27).
    return out('bound', { reason: 'neighbours_changed', line_index: here.line_index, ctx: here });
  }
  if (same.length === 1 && here && here.speaker_key === assoc.speaker_key) {
    // Its place now holds another line by the same speaker, and an identical line is elsewhere:
    // the line was edited (and that one is its twin) or it moved. A person decides.
    return out('ambiguous', { reason: 'moved_or_edited', candidates: [same[0].line_index] });
  }
  if (same.length === 1) {
    // The only such line in the beat, at another place: moved. A person confirms.
    return out('moved', { reason: 'moved', line_index: same[0].line_index, candidates: [same[0].line_index], ctx: same[0] });
  }
  if (same.length > 1) {
    // Identical lines: only position and both neighbours bind (above); otherwise a person picks.
    return out('ambiguous', { reason: 'ambiguous_duplicate', candidates: same.map((c) => c.line_index) });
  }

  // The line is not in the beat as it was. Why, from the line now at its place.
  const elsewhere = contexts.all.find((c) => c.row_hash === assoc.row_hash && c.beat_number !== assoc.beat_number);
  if (elsewhere) return out('unbound', { reason: 'beat_changed', hint_beat: elsewhere.beat_number });
  if (!here) return out('unbound', { reason: 'line_removed' });
  const sameSpeaker = here.speaker_key === assoc.speaker_key;
  const sameWords = here.words === assoc.words;
  if (!sameSpeaker && sameWords) return out('unbound', { reason: 'speaker_changed' });
  if (sameSpeaker && sameWords && here.delivery_note !== assoc.delivery_note) return out('unbound', { reason: 'note_changed' });
  if (sameSpeaker && !sameWords) return out('unbound', { reason: 'words_changed' });
  return out('unbound', { reason: 'line_removed' });
}

/** The stored association fields for a context (what B1 writes). */
function associationOf(ctx) {
  return {
    beat_number: ctx.beat_number,
    line_index: ctx.line_index,
    occurrence: ctx.occurrence,
    speaker_key: ctx.speaker_key,
    speaker_written: ctx.speaker_written,
    delivery_note: ctx.delivery_note,
    words: ctx.words,
    row_hash: ctx.row_hash,
    prev_hash: ctx.prev_hash,
    next_hash: ctx.next_hash,
    context_hash: ctx.context_hash,
  };
}

module.exports = {
  REASONS, EDGE_START, EDGE_END, CONTEXT_FIELDS,
  sections, countedLine, lineContexts, lineAt, resolve, associationOf, contextHash, rowHashOf, normaliseLine,
};

/**
 * Import a script (Evoni, 2026-10-25): a script written somewhere else,
 * pasted in, turned into the way the app writes one, so the Script tab, the
 * checks, the teleprompter and the export can read it.
 *
 *   BEAT 1 —, BEAT 1:, Beat 1 - Name, # Beat 1     → ## BEAT: 1 · Name
 *   PRIME:, Prime (VO):, ME:, JUSTAWOMAN:          → Prime:, Me:, JustAWoman:
 *   LALA:, Lala (VO):, LALA (AUTO):                → Lala:, Lala (V.O.):, Lala (auto):
 *   MARCUS:                                         → Marcus:
 *   LALA / Hey besties (name on its own line)      → Lala: Hey besties
 *   [GAME: EQUIP Gold Hoops], [EQUIP: …]           → [WEAR: piece-id] (the episode's look)
 *   [CLICK invite], [OPEN phone], [GAME: TAP mail] → [UI:DISPLAY InviteLetterOverlay], [UI:SHOW phone], …
 *   CUT TO:, FADE OUT.                              → [TRANSITION: CUT TO]
 *   *She spins*                                     → (She spins)
 *
 * What it can't convert stays as written and is listed in `notes`, with the
 * line it came from, so the preview can say "I couldn't convert these".
 * Pure: no React, no network.
 */
import { normalizeBeatHeaders } from './beatLabelNumber';
import { NOT_SPEAKERS, NARRATION_WORDS, isAutoNote } from './scriptSpeaker';
import { resolveMoment, normKey } from './scriptMoments';
import { writerNoteOf } from './scriptWriterNotes';

// ── Beat headers ───────────────────────────────────────────────────────────
// `BEAT 1 —`, `BEAT 1: Name`, `Beat 1 - Name`, `# Beat 1`, `**Beat 1.** Name`,
// `BEAT #1 | Name`. A separator or the line's end follows the number, so
// "Beat 3 times" is a line, not a header.
const HEADER = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*BEAT\s*#?\s*(\d{1,2})\s*(?:\*\*|__)?\s*(?:[:.·|—–-]+\s*(?:\*\*|__)?\s*(.*?))?\s*(?:\*\*|__)?\s*$/i;
const APP_HEADER = /^\s*##\s*BEAT:/i;

/** `## BEAT: n · Name` for a header line in any of the outside ways, else null. */
export function convertHeader(line) {
  const t = String(line ?? '');
  if (APP_HEADER.test(t)) return t.trim();
  const m = t.match(HEADER);
  if (!m) return null;
  const name = (m[2] || '').replace(/^[\s:.·|—–-]+|[\s:.·|—–-]+$/g, '').replace(/^["“]|["”]$/g, '').trim();
  return `## BEAT: ${Number(m[1])}${name ? ` · ${name}` : ''}`;
}

// ── Speakers ───────────────────────────────────────────────────────────────
// Her names and Lala's as the app writes them (lib/scriptSpeaker).
const NAMES = { prime: 'Prime', me: 'Me', justawoman: 'JustAWoman', jawihp: 'JAWIHP', lala: 'Lala' };
const HERS = new Set(['prime', 'me', 'justawoman', 'jawihp']);
const VO = /^\(\s*v\.?\s*\/?\s*o\.?\s*\)$|^\(\s*voice[\s-]*over\s*\)$|^\(\s*o\.?\s*s\.?\s*\)$/i;
// `NAME (note): words`, bold or not.
const SPEAKER = /^\s*(?:\*\*|__)?\s*(\p{L}[\p{L}'’.-]*(?: \p{L}[\p{L}'’.-]*)?)\s*(\([^)]*\))?\s*(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*)$/u;
// A name on its own line, screenplay style: `LALA`, `PRIME (V.O.)`.
const NAME_ALONE = /^\s*(?:\*\*|__)?\s*(\p{Lu}[\p{Lu}'’.-]*(?: \p{Lu}[\p{Lu}'’.-]*)?)\s*(\([^)]*\))?\s*(?:\*\*|__)?\s*$/u;

const titleCase = (name) => name.toLowerCase().replace(/(^|[\s'’.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const isAllCaps = (s) => /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s);

/** The note after a speaker's name as the app writes it, or '' to drop it. */
function speakerNote(key, note) {
  if (!note) return '';
  if (key === 'lala' && isAutoNote(note)) return ' (auto)';
  if (VO.test(note.trim())) return key === 'lala' ? ' (V.O.)' : HERS.has(key) ? '' : ' (V.O.)';
  return ` ${note.trim()}`;
}

/** The speaker's name as the app writes it: hers and Lala's by NAMES, an all-caps name title-cased. */
function speakerName(raw) {
  const key = raw.toLowerCase();
  if (NAMES[key]) return NAMES[key];
  return isAllCaps(raw) ? titleCase(raw) : raw;
}

/** A speaker's line as the app writes it, or null when the line has no speaker. */
export function convertSpeaker(line) {
  const m = String(line ?? '').match(SPEAKER);
  if (!m) return null;
  const key = m[1].toLowerCase();
  if (NOT_SPEAKERS.has(key) || NARRATION_WORDS.has(key)) return null;
  const words = m[3].replace(/(?:\*\*|__)\s*$/, '').trim();
  if (!words) return null;
  // Only a name the app knows, or a name written in capitals (MARCUS:), is
  // a speaker here; `Then: …` and other lead-ins stay as written.
  if (!NAMES[key] && !isAllCaps(m[1]) && !/^\p{Lu}/u.test(m[1])) return null;
  return `${speakerName(m[1])}${speakerNote(key, m[2])}: ${words}`;
}

// ── Wardrobe ───────────────────────────────────────────────────────────────
// `[GAME: EQUIP Gold Hoops]`, `[EQUIP: Gold Hoops]`, `[GAME: WEAR …]`,
// `[PUT ON …]`, `[OUTFIT: …]`, and `[WEAR: Gold Hoops]` naming a piece by name.
const EQUIP = /^\s*\[\s*(?:GAME\s*:\s*)?(?:EQUIP|WEAR|PUT\s*ON|OUTFIT|DRESS(?:\s*IN)?|CHANGE\s*INTO)\s*:?\s*([^\]]+?)\s*\]\s*$/i;

const words = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !['the', 'a', 'an', 'her', 'lalas', 'lala', 'item', 'piece'].includes(w));

/**
 * The look's piece a name names: { piece } for one match, { several } when
 * more than one fits as well, or null. `look`: [{ id, name }].
 */
export function matchPiece(name, look = []) {
  const pieces = (Array.isArray(look) ? look : []).filter((p) => p && p.id != null);
  if (!pieces.length) return null;
  const key = normKey(name);
  if (!key) return null;
  const byId = pieces.find((p) => normKey(p.id) === key);
  if (byId) return { piece: byId };
  const exact = pieces.filter((p) => normKey(p.name) === key);
  if (exact.length === 1) return { piece: exact[0] };
  if (exact.length > 1) return { several: exact };
  const want = words(name);
  const scored = pieces.map((p) => {
    const have = words(p.name);
    const shared = want.filter((w) => have.includes(w)).length;
    const k = normKey(p.name);
    const contains = k && (k.includes(key) || key.includes(k)) ? 1 : 0;
    return { p, s: shared * 2 + contains * 3, of: Math.max(want.length, have.length) };
  }).filter((x) => x.s >= 2 && (x.s >= 3 || x.s / 2 / x.of >= 0.5)).sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  const top = scored.filter((x) => x.s === scored[0].s);
  return top.length === 1 ? { piece: top[0].p } : { several: top.map((x) => x.p) };
}

// ── On-screen steps ────────────────────────────────────────────────────────
// The verbs an outside script writes, as the app's [UI:] verbs.
const VERBS = {
  CLICK: 'CLICK', TAP: 'CLICK', PRESS: 'CLICK', SELECT: 'SELECT', CHOOSE: 'SELECT', PICK: 'SELECT',
  OPEN: 'OPEN', LAUNCH: 'OPEN', GO: 'OPEN', GOTO: 'OPEN',
  CLOSE: 'CLOSE', EXIT: 'CLOSE', SHUT: 'CLOSE',
  SHOW: 'DISPLAY', DISPLAY: 'DISPLAY', REVEAL: 'DISPLAY', POPUP: 'DISPLAY',
  HIDE: 'HIDE', DISMISS: 'HIDE', REMOVE: 'HIDE',
  SCROLL: 'SCROLL', SWIPE: 'SWIPE', TYPE: 'TYPE',
  NOTIFY: 'NOTIFY', NOTIFICATION: 'NOTIFY', PING: 'NOTIFY', DM: 'DM', MESSAGE: 'DM', POST: 'POST',
};
// `[CLICK invite]`, `[GAME: TAP mail]`, `[ACTION: OPEN phone]`, `[UI CLICK invite]`, `[OPEN: phone]`.
const STEP = /^\s*\[\s*(?:(?:GAME|ACTION|UI|SCREEN|PHONE)\s*:?\s*)?(CLICK|TAP|PRESS|SELECT|CHOOSE|PICK|OPEN|LAUNCH|GO\s*TO|GOTO|CLOSE|EXIT|SHUT|SHOW|DISPLAY|REVEAL|POP\s*UP|POPUP|HIDE|DISMISS|REMOVE|SCROLL|SWIPE|TYPE|NOTIFY|NOTIFICATION|PING|DM|MESSAGE|POST)\b\s*:?\s*(?:on\s+|the\s+|to\s+)*([^\]]*?)\s*\]\s*$/i;
const APP_UI = /^\s*\[UI:\s*[A-Za-z_]+/i;

const PHONE = new Set(['phone', 'thephone', 'lalasphone', 'lalaphone', 'herphone']);
// The show's own names for its screens and overlays, as the script skeleton
// and the writer use them (src/utils/scriptSkeletonGenerator.js,
// episodeScriptWriterService), when the episode's Phone Hub has no better match.
const KNOWN_TARGETS = [
  { test: /invit|letter/, name: 'InviteLetterOverlay', overlay: true },
  { test: /voice/, name: 'VoiceIcon' },
  { test: /^mail|inbox|email/, name: 'MailIcon', open: 'MailPanel' },
  { test: /login|signin|start/, name: 'LoginConfirm', open: 'LoginWindow' },
  { test: /todo|tasklist|checklist|shoppinglist/, name: 'ToDoListOverlay', overlay: true },
  { test: /destination|location|map|travel/, name: 'DestinationIcon' },
  { test: /closet|wardrobe/, name: 'Closet' },
];

/**
 * An outside on-screen step as the app's [UI:] line: { line, found } where
 * found is false when no screen or overlay of the episode, nor one of the
 * show's own names, was found for the target (the line is still written).
 * null when the line is no such step.
 */
export function convertStep(line, onScreen = {}) {
  const t = String(line ?? '');
  if (APP_UI.test(t)) return null;
  const m = t.match(STEP);
  if (!m) return null;
  const said = m[1].toUpperCase().replace(/\s+/g, '');
  let verb = VERBS[said] || said;
  const rawTarget = m[2].trim();
  // A message keeps its words: `[NOTIFY Mail: You're invited]`.
  if (verb === 'NOTIFY' || verb === 'DM' || verb === 'POST') return { line: `[UI:${verb} ${rawTarget}]`.replace(/\s+\]$/, ']'), found: true };
  const key = normKey(rawTarget);
  if (!key) return null;
  if (PHONE.has(key)) {
    const on = ['OPEN', 'DISPLAY', 'CLICK', 'SELECT'].includes(verb);
    return { line: `[UI:${on ? 'SHOW' : 'HIDE'} phone]`, found: true };
  }
  const hit = resolveMoment({ verb, target: rawTarget }, onScreen || {});
  if (hit && hit.name && hit.kind !== 'device') {
    if (hit.kind === 'overlay') verb = verb === 'CLOSE' || verb === 'HIDE' ? 'HIDE' : 'DISPLAY';
    return { line: `[UI:${verb} ${hit.name}]`, found: true };
  }
  const known = KNOWN_TARGETS.find((k) => k.test.test(key));
  if (known) {
    if (known.overlay) return { line: `[UI:${verb === 'CLOSE' || verb === 'HIDE' ? 'HIDE' : 'DISPLAY'} ${known.name}]`, found: true };
    const name = verb === 'OPEN' && known.open ? known.open : known.name;
    return { line: `[UI:${verb} ${name}]`, found: true };
  }
  // CamelCase the words so the target reads as one name: "sale banner" → SaleBanner.
  const name = rawTarget.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return { line: `[UI:${verb} ${name || rawTarget}]`, found: false };
}

// ── Other lines ────────────────────────────────────────────────────────────
// Tags the app reads as they are.
const APP_TAG = /^\s*\[\s*(?:UI|WEAR|STAT|TRANSITION|MAIL|DELIVER|TODO_MODE|LEARNS|SCENE|LOCATION_HINT|EVENT|EPISODE_INTENT|SFX|EDIT)\s*:/i;
// `[STATS: coins -50]` and `[COINS -50]` are a stat line.
const STATS = /^\s*\[\s*STATS\s*:\s*([^\]]+)\]\s*$/i;
const COINS = /^\s*\[\s*(COINS|REPUTATION|INFLUENCE|STRESS|BRAND[_\s]?TRUST)\s*:?\s*([+\-\u2212\u2013]\s*[\d,]+)\s*\]\s*$/i;
// `CUT TO:`, `FADE OUT.`, `SMASH CUT TO BLACK`, `[TRANSITION CUT TO]`.
const TRANSITION = /^\s*(?:\[\s*TRANSITION\s+([^\]]+)\]|((?:SMASH\s+|MATCH\s+|JUMP\s+)?CUT\s+TO(?:\s+[A-Z ]+)?|FADE\s+(?:IN|OUT|TO\s+[A-Z ]+)|DISSOLVE\s+TO))\s*[:.]?\s*$/;
// `*She spins*`, `_she spins_`: a stage direction.
const EMPHASIS_DIRECTION = /^\s*(?:\*([^*]+)\*|_([^_]+)_)\s*$/;
const BRACKET = /^\s*\[[^\]]*\]\s*$/;

/**
 * The pasted script converted: { script, notes, counts }.
 * notes: [{ line (1-based in the pasted text), text, why }], the lines it
 * could not convert or wants checked. counts: { beats, speakers, wear, steps }.
 * Options: look (the episode's locked look, [{ id, name }]), onScreen (the
 * Script tab's { screens, overlays, icons }).
 */
export function convertScript(text, { look = [], onScreen = {} } = {}) {
  const src = normalizeBeatHeaders(String(text ?? '')).split('\n');
  const out = [];
  const notes = [];
  const counts = { beats: 0, speakers: 0, wear: 0, steps: 0 };
  const note = (i, why) => notes.push({ line: i + 1, text: src[i].trim(), why });
  const hasLook = Array.isArray(look) && look.length > 0;

  for (let i = 0; i < src.length; i += 1) {
    const raw = src[i];
    const t = raw.trim();
    if (!t) { out.push(''); continue; }

    const header = convertHeader(t);
    if (header) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(header);
      counts.beats += 1;
      continue;
    }

    // A note to the writer stays as written, listed for her to check.
    // Its speaker is still put right; a tag of its own ([IF …], [NOTE: …]) stays.
    const wn = writerNoteOf(t);
    if (wn) {
      note(i, `This looks like ${wn.what}, not a line for the camera.`);
      if (BRACKET.test(t)) { out.push(t); continue; }
    }

    // `[WEAR: id]` naming a piece by its id stays; by its name, it is matched.
    const equip = t.match(EQUIP);
    const wearId = t.match(/^\s*\[\s*WEAR\s*:\s*([^\]\s]+)\s*\]\s*$/i);
    const keepWear = wearId && (!hasLook || look.some((p) => String(p.id) === wearId[1]));
    if (equip && !keepWear) {
      const name = equip[1].trim();
      const hit = hasLook ? matchPiece(name, look) : null;
      if (hit?.piece) { out.push(`[WEAR: ${hit.piece.id}]`); counts.wear += 1; continue; }
      out.push(t);
      if (!hasLook) note(i, `The look isn't locked on the Wardrobe tab yet, so I couldn't find "${name}". Lock the look, then pick the piece.`);
      else if (hit?.several) note(i, `"${name}" could be ${hit.several.map((p) => p.name || p.id).join(' or ')}. Pick the piece.`);
      else note(i, `No piece of this episode's look is called "${name}". Pick the piece.`);
      continue;
    }

    if (APP_TAG.test(t)) { out.push(t); if (/^\s*\[\s*UI\s*:/i.test(t)) counts.steps += 1; continue; }

    const stats = t.match(STATS);
    if (stats) { out.push(`[STAT: ${stats[1].trim()}]`); continue; }
    const coins = t.match(COINS);
    if (coins) { out.push(`[STAT: ${coins[1].toLowerCase().replace(/[_\s]/, '_')} ${coins[2].replace(/[\u2212\u2013]/, '-').replace(/\s+/g, '')}]`); continue; }

    const step = convertStep(t, onScreen);
    if (step) {
      out.push(step.line);
      counts.steps += 1;
      if (!step.found) note(i, `I made this an on-screen step, ${step.line}, but couldn't find that screen in the Phone Hub. Check the name.`);
      continue;
    }

    const tr = t.match(TRANSITION);
    if (tr) { out.push(`[TRANSITION: ${(tr[1] || tr[2]).trim().replace(/\s+/g, ' ')}]`); continue; }

    const sp = convertSpeaker(t);
    if (sp) { out.push(sp); counts.speakers += 1; continue; }

    // Screenplay style: a name on its own line, then (maybe a direction, then) the words.
    const alone = t.match(NAME_ALONE);
    const aloneKey = alone ? alone[1].toLowerCase() : null;
    if (alone && !NOT_SPEAKERS.has(aloneKey) && !NARRATION_WORDS.has(aloneKey) && !TRANSITION.test(t)) {
      let j = i + 1;
      let paren = null;
      if (j < src.length && /^\s*\([^)]*\)\s*$/.test(src[j])) { paren = src[j].trim(); j += 1; }
      const next = j < src.length ? src[j].trim() : '';
      if (next && !BRACKET.test(next) && !convertHeader(next) && !convertSpeaker(next) && !NAME_ALONE.test(next)) {
        const auto = aloneKey === 'lala' && !!paren && isAutoNote(paren);
        const lead = auto ? ' (auto)' : speakerNote(aloneKey, alone[2] || null);
        const direction = paren && !auto ? `${paren} ` : '';
        out.push(`${speakerName(alone[1])}${lead}: ${direction}${next}`);
        counts.speakers += 1;
        i = j;
        continue;
      }
    }

    const em = t.match(EMPHASIS_DIRECTION);
    if (em) { out.push(`(${(em[1] || em[2]).trim()})`); continue; }

    if (BRACKET.test(t)) { out.push(t); note(i, "I don't know this tag, so I left it as written."); continue; }

    out.push(t);
  }

  // Blank lines: one at most, none at the ends.
  const script = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!counts.beats && script) notes.unshift({ line: null, text: '', why: 'No beat headers were found, so the Script tab will split it into 14 beats by length. Add a line like "BEAT 1 — Opening Ritual" before each beat.' });
  return { script, notes, counts };
}

/** The script after the import: the converted one alone (replace) or after the current one (append). */
export function importedScript(current, converted, mode = 'replace') {
  const now = String(current ?? '').trimEnd();
  const add = String(converted ?? '').trim();
  if (mode === 'append' && now.trim()) return add ? `${now}\n\n${add}` : now;
  return add;
}

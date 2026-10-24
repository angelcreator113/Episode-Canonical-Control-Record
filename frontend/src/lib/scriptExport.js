/**
 * The Script tab's script as something to read or hand on (Script tab audit,
 * 2026-10-15): its beats and readable elements for the table read, a
 * Fountain screenplay (https://fountain.io/syntax) and a plain-text printout.
 * Pure: no React, no network.
 *
 * What each script line becomes:
 *   `Lala: "words"`        dialogue, the speaker's words without their quotes
 *                          (her names, Me, Prime, JustAWoman and JAWIHP, are
 *                          JustAWoman: Evoni, 2026-10-24); a leading
 *                          `(softly)` is the line's parenthetical
 *   `(She sits.)`          an action
 *   `[UI:VERB Target]`     a moment on screen, in words ("Lala opens the Closet");
 *                          a tag whose first word is no verb the show writes
 *                          (`[UI: Lala opens closet]`) is printed as written
 *   `[TRANSITION: cut to]` a transition (`> CUT TO:` in Fountain)
 *   any other `[TAG: …]`   not spoken: a Fountain note `[[TAG: …]]`, so nothing
 *                          is lost from the export; left out of the table read
 *                          and the plain-text printout
 *   `---` on its own       nothing (a Markdown rule)
 *   anything else          narration, read as action
 * `**Lala:** words` is Lala's line, as `Lala: words` (lib/scriptSpeaker unbold).
 */
import { beatName } from './canonicalBeats';
import { parseMoment, resolveMoment, messageOf, verbLabel, deviceLabel, isKnownVerb } from './scriptMoments';
import { headerNumber, normalizeBeatHeaders } from './beatLabelNumber';
import { speakerLine, unquote, isRuleLine, shownSpeaker, scriptCast } from './scriptSpeaker';

const BEAT_HEADER = /^\s*##\s*BEAT:\s*(.*)$/i;
const TAG_LINE = /^\s*\[\s*([A-Za-z_]+)\s*:\s*([^\]]*)\]?\s*$/;

// Generic last words a target carries ("InviteLetterOverlay"), left off its name.
const GENERIC_TAIL = new Set(['overlay', 'icon', 'screen', 'window', 'panel', 'app']);
function targetName(target) {
  const words = String(target || '').replace(/\s+x\d+$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9']+/).filter(Boolean);
  if (words.length > 1 && GENERIC_TAIL.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const TAP = new Set(['CLICK', 'TAP', 'SELECT']);
const ON = new Set(['DISPLAY', 'SHOW']);
const OFF = new Set(['HIDE', 'REMOVE']);

/**
 * A `[UI:…]` moment in words: "Lala opens the Closet", "Lala taps Mail",
 * "On screen: Invite Letter", "Lala's phone comes on screen". `shown` is what
 * the tab resolved the target to (resolveMoment), for the screen's own name.
 */
export function momentWords(moment, shown = null) {
  if (!moment) return '';
  const message = messageOf(moment);
  if (message) {
    const words = message.text ? `: “${message.text}”` : '';
    return `${message.name}${words}`;
  }
  const found = shown || resolveMoment(moment, {});
  if (found?.kind === 'device') return `Lala's phone ${deviceLabel(moment.verb).toLowerCase()}`;
  const name = found?.name || targetName(moment.target);
  if (!name) return `Lala's phone: ${verbLabel(moment.verb).toLowerCase()}`;
  if (ON.has(moment.verb)) return `On screen: ${name}`;
  if (OFF.has(moment.verb)) return `${name} leaves the screen`;
  // "the Closet", but "Mail" for a tap and "Lala's Closet" as it is.
  const the = TAP.has(moment.verb) || /^\S+'s\b/i.test(name) ? '' : 'the ';
  return `Lala ${verbLabel(moment.verb).toLowerCase()} ${the}${name}`;
}

/**
 * One script line as a readable element, or null for a blank line:
 * { type: 'dialogue', speaker, written, paren, text } | { type: 'action', text }
 * | { type: 'moment', text } | { type: 'transition', text }
 * | { type: 'tag', tag, value, raw } | { type: 'narration', text }.
 */
export function readLine(line, on = null, { cast = null } = {}) {
  const t = String(line ?? '').trim();
  // A `---` rule is read as nothing, as the Script tab shows it (lib/scriptSpeaker isRuleLine).
  if (!t || isRuleLine(t)) return null;
  const moment = parseMoment(t);
  if (moment) {
    const written = t.replace(/^\s*\[UI:\s*/i, '').replace(/\s*\]\s*$/, '');
    if (!isKnownVerb(moment.verb)) return { type: 'moment', text: written };
    return { type: 'moment', text: momentWords(moment, on ? resolveMoment(moment, on) : null) };
  }
  const tag = t.match(TAG_LINE);
  if (tag && t.startsWith('[')) {
    const name = tag[1].toUpperCase();
    const value = tag[2].trim();
    if (name === 'TRANSITION' && value) return { type: 'transition', text: value };
    return { type: 'tag', tag: name, value, raw: t };
  }
  if (/^\(.*\)$/.test(t)) return { type: 'action', text: t.slice(1, -1).trim() };
  // The Script tab's speaker rule (lib/scriptSpeaker.js): `Lala (V.O.):`
  // is Lala, with (V.O.) after her name; `Note:` is not a person.
  // `lala:` and `me:` in lower case are speakers too, and the cast's names
  // (lib/scriptSpeaker). Her names read as JustAWoman (Evoni, 2026-10-24).
  const d = speakerLine(t, { cast });
  if (d && d.words) {
    let words = d.words;
    let paren = null;
    const p = words.match(/^(\([^)]*\))\s*(.*)$/);
    if (p && p[2]) { paren = p[1]; words = p[2]; }
    // `written`: the speaker as the Script tab reads it (`JAWIHP`, `Prime`).
    return { type: 'dialogue', speaker: shownSpeaker(d.speaker), written: d.speaker, ext: d.note, paren, text: unquote(words) };
  }
  return { type: 'narration', text: t };
}

/**
 * The script's beats as the tab numbers them: a canonical header
 * `## BEAT: 5 · Reveal` names beat 5, `## BEAT: TRANSFORMATION` beat 8; any
 * other header falls back to its position. Text before the first header is the preamble. A script with
 * no headers is one section with no number (it is not cut into 14 here).
 * Returns { preamble: string[], beats: [{ number, name, label, lines }] }.
 */
export function scriptSections(scriptText) {
  const lines = normalizeBeatHeaders(scriptText || '').split('\n');
  const preamble = [];
  const beats = [];
  for (const line of lines) {
    const h = line.match(BEAT_HEADER);
    if (h) {
      const label = h[1].trim();
      const m = label.match(/^(\d{1,3})\b\s*(?:[·:.\-–—]\s*)?(.*)$/);
      // A number (of any size), or a canonical beat's name (`## BEAT: TRANSFORMATION`), as the tab reads it.
      const n = headerNumber(label);
      const canon = n != null && n <= 14;
      const number = n != null ? n : beats.length + 1;
      // Beats 1-14 take today's name, as the page shows it: a saved
      // `## BEAT: 11 · Event Outcome` reads "The Event" (Script page audit 3,
      // 2026-10-19: Table read and the export kept the old names).
      const name = (canon ? beatName(n) : null) || (m && n != null && m[2].trim()) || (n == null && beats.length < 14 ? beatName(beats.length + 1) : label) || `Beat ${number}`;
      beats.push({ number, name, label, lines: [] });
    } else if (line.trim()) {
      (beats.length ? beats[beats.length - 1].lines : preamble).push(line);
    }
  }
  if (!beats.length && preamble.length) return { preamble: [], beats: [{ number: null, name: null, label: '', lines: preamble }] };
  return { preamble, beats };
}

/**
 * Who is in the script's cast, for a name written in lower case: everyone
 * it names as a speaker with a capital, and `extra` (the episode's own
 * people, when the caller has them).
 */
export function castOf(preamble = [], beats = [], extra = null) {
  const out = scriptCast([...preamble, ...beats.flatMap((b) => b.lines)]);
  for (const n of extra || []) if (typeof n === 'string' && n.trim()) out.add(n.trim());
  return out;
}

// A scene name the beat gives itself, when the scene plan has none.
function sceneTag(lines) {
  for (const l of lines) {
    const r = readLine(l);
    if (r?.type === 'tag' && (r.tag === 'SCENE' || r.tag === 'LOCATION_HINT') && r.value) return r.value;
  }
  return null;
}
const sceneFor = (beat, scenes) => {
  const planned = scenes instanceof Map ? scenes.get(beat.number) : scenes?.[beat.number];
  return (typeof planned === 'string' && planned.trim()) || sceneTag(beat.lines);
};

// Fountain reads an all-caps line as a character and a leading . ! > # = ~ @
// as something else; `!` forces such a line to stay action.
function fountainAction(text) {
  const t = String(text || '').trim();
  const forced = /^[!.>#=~@]|^\[\[/.test(t) || (/[A-Z]/.test(t) && !/[a-z]/.test(t))
    || /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i.test(t);
  return forced ? `!${t}` : t;
}

function fountainElement(r) {
  switch (r.type) {
    case 'dialogue': return [`${r.speaker.toUpperCase()}${r.ext ? ` ${r.ext.toUpperCase()}` : ''}`, ...(r.paren ? [r.paren] : []), r.text].join('\n');
    case 'action': case 'narration': case 'moment': return fountainAction(r.text);
    case 'transition': return `> ${r.text.replace(/:\s*$/, '').toUpperCase()}:`;
    case 'tag': return `[[${r.tag}${r.value ? `: ${r.value.replace(/\]\]/g, '] ]')}` : ''}]]`;
    default: return null;
  }
}

/**
 * The script as Fountain: a title page, each beat a section (`# 1 · Opening
 * Ritual`) with a forced scene heading when its scene is known (options
 * `scenes`: { [beatNumber]: name } from the scene plan, else the beat's own
 * [SCENE:] or [LOCATION_HINT:] tag), then its elements, a blank line apart.
 */
export function toFountain(scriptText, { title = '', scenes = null, cast = null } = {}) {
  const { preamble, beats } = scriptSections(scriptText);
  const people = castOf(preamble, beats, cast);
  // Always a title page: without one, a first line like "On screen: Mail"
  // would be read as a title-page key.
  const out = [`Title: ${String(title || '').replace(/\s+/g, ' ').trim() || 'Untitled script'}`];
  const body = (lines) => lines.map((l) => readLine(l, null, { cast: people })).filter(Boolean).map(fountainElement).filter(Boolean);
  out.push(...body(preamble));
  for (const beat of beats) {
    if (beat.number !== null) out.push(`# ${beat.number} · ${beat.name}`);
    const scene = sceneFor(beat, scenes);
    if (scene) out.push(`.${scene.replace(/^\.+/, '').toUpperCase()}`);
    out.push(...body(beat.lines));
  }
  return `${out.join('\n\n')}\n`;
}

/**
 * The script as plain text for a printout: beat headings, each speaker's
 * name over the words, actions in parentheses, moments in brackets, and no
 * other tags.
 */
export function toPlainText(scriptText, { title = '', cast = null } = {}) {
  const { preamble, beats } = scriptSections(scriptText);
  const people = castOf(preamble, beats, cast);
  const out = [];
  const name = String(title || '').replace(/\s+/g, ' ').trim();
  if (name) out.push(`${name}\n${'='.repeat(name.length)}`);
  const body = (lines) => lines.map((l) => readLine(l, null, { cast: people })).filter(Boolean).map((r) => {
    switch (r.type) {
      case 'dialogue': return `${r.speaker.toUpperCase()}${r.ext ? ` ${r.ext.toUpperCase()}` : ''}\n${r.paren ? `  ${r.paren}\n` : ''}  ${r.text}`;
      case 'action': return `(${r.text})`;
      case 'moment': return `[${r.text}]`;
      case 'transition': return `${r.text.replace(/:\s*$/, '').toUpperCase()}:`;
      case 'narration': return r.text;
      default: return null;
    }
  }).filter(Boolean);
  out.push(...body(preamble));
  for (const beat of beats) {
    if (beat.number !== null) {
      const head = `Beat ${beat.number} · ${beat.name}`;
      out.push(`${head}\n${'-'.repeat(head.length)}`);
    }
    out.push(...body(beat.lines));
  }
  return out.length ? `${out.join('\n\n')}\n` : '';
}

/** A file name from the episode's title: "Ep 3: The Gala!" → "ep-3-the-gala". */
export function scriptFileSlug(title) {
  const slug = String(title || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || 'script';
}

/**
 * The export's file name, without its extension (Script tab audit 6,
 * 2026-10-24): `ep-<n>-<title>`, `ep-<n>-script` when untitled (or titled
 * only "Episode <n>"); the title's slug alone with no number.
 */
export function scriptFileName(title, episodeNumber = null) {
  const slug = scriptFileSlug(title);
  const fromTitle = String(title || '').match(/^\s*(?:ep|episode)\.?\s*(\d{1,4})\b/i);
  const n = Number.isInteger(Number(episodeNumber)) && Number(episodeNumber) > 0 ? Number(episodeNumber) : (fromTitle ? Number(fromTitle[1]) : null);
  if (n === null) return slug;
  const rest = slug.replace(new RegExp(`^(?:ep|episode)-${n}(?:-|$)`), '');
  return `ep-${n}-${rest || 'script'}`;
}

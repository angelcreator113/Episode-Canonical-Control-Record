/**
 * The Script tab's script as something to read or hand on (Script tab audit,
 * 2026-10-15): its beats and readable elements for the table read, a
 * Fountain screenplay (https://fountain.io/syntax) and a plain-text printout.
 * Pure: no React, no network.
 *
 * What each script line becomes:
 *   `Lala: "words"`        dialogue, the speaker's words without their quotes
 *                          ("Me" is Prime, as the tab shows it); a leading
 *                          `(softly)` is the line's parenthetical
 *   `(She sits.)`          an action
 *   `[UI:VERB Target]`     a moment on screen, in words ("Lala opens the Closet")
 *   `[TRANSITION: cut to]` a transition (`> CUT TO:` in Fountain)
 *   any other `[TAG: …]`   not spoken: a Fountain note `[[TAG: …]]`, so nothing
 *                          is lost from the export; left out of the table read
 *                          and the plain-text printout
 *   anything else          narration, read as action
 */
import { beatName } from './canonicalBeats';
import { parseMoment, resolveMoment, messageOf, verbLabel, deviceLabel } from './scriptMoments';
import { beatNumberForLabel } from './beatLabelNumber';

const BEAT_HEADER = /^\s*##\s*BEAT:\s*(.*)$/i;
const TAG_LINE = /^\s*\[\s*([A-Za-z_]+)\s*:\s*([^\]]*)\]?\s*$/;
const DIALOGUE = /^(Me|Prime|Lala|Kelli|Guest|[A-Z][a-z]+):\s*(.+)$/;
const QUOTES = /^["“”]+|["“”]+$/g;

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
 * { type: 'dialogue', speaker, paren, text } | { type: 'action', text }
 * | { type: 'moment', text } | { type: 'transition', text }
 * | { type: 'tag', tag, value, raw } | { type: 'narration', text }.
 */
export function readLine(line, on = null) {
  const t = String(line ?? '').trim();
  if (!t) return null;
  const moment = parseMoment(t);
  if (moment) return { type: 'moment', text: momentWords(moment, on ? resolveMoment(moment, on) : null) };
  const tag = t.match(TAG_LINE);
  if (tag && t.startsWith('[')) {
    const name = tag[1].toUpperCase();
    const value = tag[2].trim();
    if (name === 'TRANSITION' && value) return { type: 'transition', text: value };
    return { type: 'tag', tag: name, value, raw: t };
  }
  if (/^\(.*\)$/.test(t)) return { type: 'action', text: t.slice(1, -1).trim() };
  const d = t.match(DIALOGUE);
  if (d) {
    let words = d[2].trim();
    let paren = null;
    const p = words.match(/^(\([^)]*\))\s*(.*)$/);
    if (p && p[2]) { paren = p[1]; words = p[2]; }
    return { type: 'dialogue', speaker: d[1] === 'Me' ? 'Prime' : d[1], paren, text: words.replace(QUOTES, '').trim() };
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
  const lines = String(scriptText || '').split(/\r?\n/);
  const preamble = [];
  const beats = [];
  for (const line of lines) {
    const h = line.match(BEAT_HEADER);
    if (h) {
      const label = h[1].trim();
      const m = label.match(/^(\d{1,2})\b\s*(?:[·:.\-–—]\s*)?(.*)$/);
      // A number, or a canonical beat's name (`## BEAT: TRANSFORMATION`), as the tab reads it.
      const n = beatNumberForLabel(label);
      const canon = n != null;
      const number = canon ? n : beats.length + 1;
      const name = (m && canon && m[2].trim()) || (canon ? beatName(n) : (beats.length < 14 ? beatName(beats.length + 1) : label)) || `Beat ${number}`;
      beats.push({ number, name, label, lines: [] });
    } else if (line.trim()) {
      (beats.length ? beats[beats.length - 1].lines : preamble).push(line);
    }
  }
  if (!beats.length && preamble.length) return { preamble: [], beats: [{ number: null, name: null, label: '', lines: preamble }] };
  return { preamble, beats };
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
    case 'dialogue': return [r.speaker.toUpperCase(), ...(r.paren ? [r.paren] : []), r.text].join('\n');
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
export function toFountain(scriptText, { title = '', scenes = null } = {}) {
  const { preamble, beats } = scriptSections(scriptText);
  // Always a title page: without one, a first line like "On screen: Mail"
  // would be read as a title-page key.
  const out = [`Title: ${String(title || '').replace(/\s+/g, ' ').trim() || 'Untitled script'}`];
  const body = (lines) => lines.map((l) => readLine(l)).filter(Boolean).map(fountainElement).filter(Boolean);
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
export function toPlainText(scriptText, { title = '' } = {}) {
  const { preamble, beats } = scriptSections(scriptText);
  const out = [];
  const name = String(title || '').replace(/\s+/g, ' ').trim();
  if (name) out.push(`${name}\n${'='.repeat(name.length)}`);
  const body = (lines) => lines.map((l) => readLine(l)).filter(Boolean).map((r) => {
    switch (r.type) {
      case 'dialogue': return `${r.speaker.toUpperCase()}\n${r.paren ? `  ${r.paren}\n` : ''}  ${r.text}`;
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

// Reordering the script on the Script tab (Evoni, 2026-10-08: "drag and
// drop to the script sequence"). A beat moves with its header, so it keeps
// its number and name wherever it goes: the scene plan, the overlays and
// Production all find a beat by its number. Lines move only inside their
// own beat. Text before the first beat (an [EVENT:] tag) stays first, and
// every beat that doesn't move keeps its text exactly.

const HEADER_START = /^\s*##\s*BEAT:/i;

// { preamble, sections } where each section is one beat's text, header
// first; the same split EpisodeScriptTab's parseScriptIntoBeats uses.
export function splitSections(scriptText) {
  const parts = String(scriptText || '').split(/(?=##\s*BEAT:)/i);
  const preamble = parts.length && !HEADER_START.test(parts[0]) ? parts.shift().trimEnd() : '';
  return { preamble, sections: parts.filter((p) => HEADER_START.test(p)).map((p) => p.trimEnd()) };
}

function join({ preamble, sections }) {
  const body = sections.join('\n\n');
  return preamble ? `${preamble}\n\n${body}` : body;
}

const move = (list, from, to) => {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const inRange = (i, n) => Number.isInteger(i) && i >= 0 && i < n;

// The script with the beat at position `from` moved to position `to`
// (positions count beats only). Out-of-range or no-op moves return the
// script unchanged.
export function moveBeat(scriptText, from, to) {
  const split = splitSections(scriptText);
  const n = split.sections.length;
  if (!inRange(from, n) || !inRange(to, n) || from === to) return scriptText;
  return join({ ...split, sections: move(split.sections, from, to) });
}

// The script with line `from` of the beat at position `beatIndex` moved to
// line `to` of the same beat. Lines are counted the way the Script tab
// lists them: the beat's non-blank lines after its header.
export function moveLine(scriptText, beatIndex, from, to) {
  const split = splitSections(scriptText);
  if (!inRange(beatIndex, split.sections.length)) return scriptText;
  const [header, ...rest] = split.sections[beatIndex].split('\n');
  const lines = rest.filter((l) => l.trim());
  if (!inRange(from, lines.length) || !inRange(to, lines.length) || from === to) return scriptText;
  const sections = split.sections.slice();
  sections[beatIndex] = [header, ...move(lines, from, to)].join('\n');
  return join({ ...split, sections });
}

// The script with the beat at position `beatIndex` replaced by `text` (a
// regenerated beat, header first); every other beat and the text before the
// first beat stay exactly as they are. Out of range: unchanged.
export function replaceBeat(scriptText, beatIndex, text) {
  const split = splitSections(scriptText);
  if (!inRange(beatIndex, split.sections.length) || !HEADER_START.test(String(text || ''))) return scriptText;
  const sections = split.sections.slice();
  sections[beatIndex] = String(text).trimEnd();
  return join({ ...split, sections });
}

// The script with `line` added at the end of the beat at position
// `beatIndex` (a phone moment or an overlay, Task #2789); every other beat
// and the text before the first beat stay exactly as they are.
export function appendLine(scriptText, beatIndex, line) {
  const split = splitSections(scriptText);
  const text = String(line || '').trim();
  if (!inRange(beatIndex, split.sections.length) || !text) return scriptText;
  const sections = split.sections.slice();
  sections[beatIndex] = `${sections[beatIndex]}\n${text}`;
  return join({ ...split, sections });
}

// The script with `line` put after line `afterIndex` of the beat at position
// `beatIndex` (lines counted as moveLine counts them; -1 puts it first, past
// the end puts it last), for a moment between two lines (Task #2793).
export function insertLine(scriptText, beatIndex, afterIndex, line) {
  const split = splitSections(scriptText);
  const text = String(line || '').trim();
  if (!inRange(beatIndex, split.sections.length) || !text) return scriptText;
  const [header, ...rest] = split.sections[beatIndex].split('\n');
  const lines = rest.filter((l) => l.trim());
  const at = Math.max(0, Math.min(lines.length, Number.isInteger(afterIndex) ? afterIndex + 1 : lines.length));
  lines.splice(at, 0, text);
  const sections = split.sections.slice();
  sections[beatIndex] = [header, ...lines].join('\n');
  return join({ ...split, sections });
}

// Where a dragged item lands: dropping on the top half of a target puts it
// before the target, on the bottom half after it. Returns the index the
// item ends up at once it is taken out of its old place.
export function dropIndex(from, target, after) {
  const to = target + (after ? 1 : 0);
  return to > from ? to - 1 : to;
}

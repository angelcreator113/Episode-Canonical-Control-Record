/**
 * The editor's cue sheet: every sound, music, camera, video, edit and
 * transition note in the script, grouped by beat, for whoever cuts the
 * episode. The notes written before `## BEAT: 1` are the cold open's shot
 * list and come first. With a whole-episode take's beat markers
 * (lib/fullEpisodeTake cleanMarks), each beat carries the time it starts at
 * in that take.
 *
 *   cueSheet(scriptText, { marks }) →
 *     { coldOpen: [cue], beats: [{ number, name, start, cues: [cue] }], count }
 *   cue: { kind, label, text }   kind SFX | MUSIC | CAMERA | VIDEO | EDIT | TRANSITION
 *
 * A note can sit on its own line (`[SFX: phone buzz]`) or inside a line
 * (`Lala: Hi! [MUSIC: theme up]`). Pure: no React, no network.
 */
import { scriptSections } from './scriptExport';
import { cleanMarks, markClock } from './fullEpisodeTake';

// What the script calls each note, and the word the sheet uses for it.
const KINDS = {
  SFX: 'SFX', SOUND: 'SFX', MUSIC: 'MUSIC', CAMERA: 'CAMERA', CAM: 'CAMERA', SHOT: 'CAMERA',
  VIDEO: 'VIDEO', 'B-ROLL': 'VIDEO', BROLL: 'VIDEO', EDIT: 'EDIT', TRANSITION: 'TRANSITION',
};
export const LABELS = { SFX: 'Sound', MUSIC: 'Music', CAMERA: 'Camera', VIDEO: 'Video', EDIT: 'Edit', TRANSITION: 'Transition' };
const NOTE = /\[\s*(SFX|SOUND|MUSIC|CAMERA|CAM|SHOT|VIDEO|B-ROLL|BROLL|EDIT|TRANSITION)\s*:\s*([^\]]*?)\s*\]/gi;
// `[TRANSITION: …` with no closing bracket on its own line, as the Script tab reads it.
const OPEN_NOTE = /^\s*\[\s*(SFX|SOUND|MUSIC|CAMERA|CAM|SHOT|VIDEO|B-ROLL|BROLL|EDIT|TRANSITION)\s*:\s*([^\]]+?)\s*$/i;

/** The cue notes in one line, in the order written. */
export function lineCues(line) {
  const s = String(line ?? '');
  const out = [];
  for (const m of s.matchAll(NOTE)) {
    const kind = KINDS[m[1].toUpperCase()];
    const text = m[2].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (kind && text) out.push({ kind, label: LABELS[kind], text });
  }
  if (!out.length) {
    const open = s.match(OPEN_NOTE);
    if (open) {
      const kind = KINDS[open[1].toUpperCase()];
      const text = open[2].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      if (kind && text) out.push({ kind, label: LABELS[kind], text });
    }
  }
  return out;
}

const cuesOf = (lines) => (lines || []).flatMap(lineCues);

/** The cue sheet for a script, with each beat's start time from `marks` when given. */
export function cueSheet(scriptText, { marks = null } = {}) {
  const { preamble, beats } = scriptSections(scriptText || '');
  const starts = new Map(cleanMarks(marks).map((m) => [m.beat, m.t]));
  const out = beats.map((b) => ({
    number: b.number,
    name: b.name,
    start: b.number != null && starts.has(b.number) ? starts.get(b.number) : null,
    cues: cuesOf(b.lines),
  }));
  const coldOpen = cuesOf(preamble);
  return { coldOpen, beats: out, count: coldOpen.length + out.reduce((n, b) => n + b.cues.length, 0) };
}

const cueRow = (c) => `  [ ] ${c.label}: ${c.text}`;

/** The cue sheet as a text file: a heading, the cold open's shot list, then each beat. */
export function cueSheetText(sheet, { title = '', takeLabel = '' } = {}) {
  const lines = [`Cue sheet${title ? ` · ${title}` : ''}`];
  if (takeLabel) lines.push(`Beat times from: ${takeLabel}`);
  lines.push('');
  if (sheet.coldOpen.length) {
    lines.push('COLD OPEN SHOT LIST', ...sheet.coldOpen.map(cueRow), '');
  }
  for (const b of sheet.beats) {
    if (!b.cues.length) continue;
    const head = b.number != null ? `BEAT ${b.number}${b.name ? ` · ${b.name}` : ''}` : (b.name || 'Script');
    lines.push(`${head}${b.start != null ? ` · starts at ${markClock(b.start)}` : ''}`, ...b.cues.map(cueRow), '');
  }
  if (!sheet.count) lines.push('No sound, music, camera, video, edit or transition notes in this script yet.', '');
  return lines.join('\n');
}

/** "ep-3-the-gala-cue-sheet.txt" from the script's own file name stem. */
export const cueSheetFileName = (stem) => `${String(stem || 'script').replace(/\.[a-z0-9]+$/i, '')}-cue-sheet.txt`;

/**
 * What the teleprompter shows of a beat (Evoni, 2026-10-20: "I need a
 * teleprompter for my script and I need a way to be able to read the script
 * and record at the same time"). Every line, with hers picked out:
 *   { kind: 'mine', speaker, paren, text }   JustAWoman's line (Me / Prime /
 *                                            JustAWoman / JAWIHP), biggest
 *   { kind: 'cue', speaker, paren, text }    anyone else's, a smaller cue
 *   { kind: 'direction', text }              (actions) and narration, dim italic
 * Each line also carries `who` (JustAWoman for any of her names, else the
 * speaker, for "Read as") and `seconds`: the Script tab's own estimate
 * (lib/scriptRuntime lineSeconds: spoken words at 150 a minute, 3 seconds
 * for an action), for the silence cues and "Pace by line times".
 * [UI:…], [STAT:…], [WEAR:…], [TRANSITION:…] and every other tag are left out:
 * they are for production, not for reading aloud. With { screen: true }
 * (Evoni, 2026-10-23) a [UI:…] line is kept as an on-screen moment,
 *   { kind: 'screen', verb, target, text, icon, seconds: 3 }
 * (lib/teleprompterScreen), a cue for her to react to; the other tags stay
 * hidden. Without it the lines are exactly as before, so teleprompterIndexMap
 * (a voice clip's line index) never counts a screen moment.
 * Pure: no React, no network.
 */
import { readLine, scriptSections } from './scriptExport';
import { lineSeconds } from './scriptRuntime';
import { isBreath, markTokens } from './teleprompterMarks';
import { screenLine } from './teleprompterScreen';
import { unbold, isHerSpeaker, HER } from './scriptSpeaker';

// Her names as the script writes them: lib/scriptSpeaker's, one list for the
// teleprompter, the Table read and the export (Evoni, 2026-10-24).
export { isHerSpeaker, HER };

// `**Me:** words` and `__Me__: words`, as a pasted script can have them:
// lib/scriptSpeaker's rule, shared with the Script tab and the export.

export function teleprompterLines(lines = [], { screen = false } = {}) {
  const out = [];
  for (const line of lines) {
    const plain = unbold(line);
    const r = readLine(plain);
    if (!r) continue;
    const seconds = lineSeconds(String(plain).trim());
    if (r.type === 'dialogue') {
      const hers = isHerSpeaker(r.speaker);
      out.push({ kind: hers ? 'mine' : 'cue', who: hers ? HER : r.speaker, speaker: r.written || r.speaker, paren: r.paren || null, text: r.text, seconds });
    } else if (r.type === 'action' || r.type === 'narration') {
      // `(breath)` / `[breath]` on its own line is a breath mark (Evoni, 2026-10-20).
      out.push({ kind: isBreath(r.text) ? 'breath' : 'direction', who: null, text: r.text, seconds });
    } else if (r.type === 'moment' && screen) {
      const cue = screenLine(plain);
      if (cue) out.push(cue);
    }
    // moment (unless screen), transition, tag: hidden.
  }
  return out;
}

/**
 * A picked script for the teleprompter: { intro, beats: [{ number, name, lines }] },
 * each `lines` from teleprompterLines with its on-screen moments (beats as
 * the Script tab numbers them). Each line carries `vi`: its index among the
 * beat's lines without the screen moments (what teleprompterIndexMap gives,
 * and what a voice clip and a take's start_line name); null on a moment.
 */
export function teleprompterScript(scriptText) {
  const { preamble, beats } = scriptSections(scriptText || '');
  const indexed = (ls) => {
    let at = 0;
    return ls.map((l) => {
      if (l.kind === 'screen') return { ...l, vi: null };
      const vi = at;
      at += 1;
      return { ...l, vi };
    });
  };
  return {
    intro: indexed(teleprompterLines(preamble, { screen: true })),
    beats: beats.map((b) => ({ number: b.number, name: b.name, raw: b.lines, lines: indexed(teleprompterLines(b.lines, { screen: true })) })),
  };
}

/** A script without its on-screen moments ("Show on-screen moments" off). */
export const withoutScreen = (lines = []) => lines.filter((l) => l.kind !== 'screen');

/** Who speaks in these lines, for "Read as": JustAWoman, Lala, then the rest as they come. */
export function speakersOf(lines = []) {
  const seen = [];
  lines.forEach((l) => { if (l.who && !seen.includes(l.who)) seen.push(l.who); });
  const first = [HER, 'Lala'];
  return [...first.filter((n) => seen.includes(n)), ...seen.filter((n) => !first.includes(n))];
}

/**
 * Pasted text with speakers ("Name: words", the Script tab's rule): its
 * paragraphs as line groups, or null when no line has a speaker (then it
 * reads as written).
 */
export function pastedScript(text) {
  const groups = pastedParagraphs(text).map((p) => teleprompterLines(p.split('\n')));
  return groups.some((g) => g.some((l) => l.who)) ? groups.filter((g) => g.length) : null;
}

/** Pasted text as written: its paragraphs (a blank line apart), line breaks kept. */
export function pastedParagraphs(text) {
  return String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.replace(/^\n+|\s+$/g, '')).filter((p) => p.trim());
}

/** The take's file extension from its type. */
export const takeExtension = (type) => (/mp4/i.test(String(type || '')) ? 'mp4' : 'webm');

/** "Teleprompter take 2026-10-20 14-05.webm", a pasted-text take's file name (local time). */
export function downloadName(type, at = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Teleprompter take ${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}-${p(at.getMinutes())}.${takeExtension(type)}`;
}

/**
 * "Beat 8 · Transformation Loop · take 2", the take's name in Files;
 * fromLine (1-based) adds " · from line 4" for a take picked up mid-beat.
 */
export function takeName(beat, take, fromLine = null) {
  const head = beat?.number != null ? `Beat ${beat.number}${beat.name ? ` · ${beat.name}` : ''}` : 'Script';
  return `${head} · take ${take}${fromLine > 1 ? ` · from line ${fromLine}` : ''}`;
}

/**
 * "4 · Lala: Okay besties…", a beat line as a "Start from" choice (1-based),
 * the reading marks (`//`, `*word*`, (breath)) left out.
 */
export function lineChoice(line, i, max = 48) {
  const words = markTokens(String(line?.text || '')).map((k) => k.v || ' ').join('');
  const raw = line?.kind === 'breath' ? '(breath)' : line?.speaker ? `${line.speaker}: ${words}` : words;
  const text = raw.replace(/\s+/g, ' ').trim();
  return `${i + 1} · ${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}`;
}

/** The first type this browser records (MP4 first: Safari and iPhone play it back). */
export const RECORD_TYPES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
export function pickRecordType(Recorder = typeof window !== 'undefined' ? window.MediaRecorder : undefined) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return '';
  return RECORD_TYPES.find((t) => {
    try { return Recorder.isTypeSupported(t); } catch (err) { console.error('[teleprompter] isTypeSupported failed:', err); return false; }
  }) || '';
}

/** A camera or recording problem in plain words, or null when recording can start. */
export function recordingProblem(win = typeof window !== 'undefined' ? window : {}) {
  if (win.isSecureContext === false) return 'Recording needs a secure page (https). You can still read here.';
  if (!win.navigator?.mediaDevices?.getUserMedia) return "This browser can't use the camera here. You can still read.";
  if (typeof win.MediaRecorder === 'undefined') return "This browser can't record video. You can still read.";
  return null;
}

/** getUserMedia's error in plain words. */
export function cameraErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Camera and microphone are blocked. Allow them for this site in the browser, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera or microphone was found.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'The camera or microphone is in use by another app. Close it and try again.';
    default:
      return "The camera couldn't start. You can still read.";
  }
}

/** "1:05" for the recording timer. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Where each of a beat's script lines lands among its teleprompter lines
 * (Teleprompter batch 3: a voice clip names its line by beat and this
 * index). rawLines: the beat's non-blank script lines, as the Script tab
 * and scriptSections keep them. Returns an array as long as rawLines: the
 * teleprompter index, or null for a line the teleprompter does not show
 * (a [UI:] moment, a tag).
 */
export function teleprompterIndexMap(rawLines = []) {
  let at = 0;
  return rawLines.map((line) => {
    if (!String(line ?? '').trim()) return null;
    if (!teleprompterLines([line]).length) return null;
    const i = at;
    at += 1;
    return i;
  });
}

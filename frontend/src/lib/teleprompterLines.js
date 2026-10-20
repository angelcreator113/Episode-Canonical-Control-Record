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
 * they are for production, not for reading aloud. Pure: no React, no network.
 */
import { readLine, scriptSections } from './scriptExport';
import { lineSeconds } from './scriptRuntime';

// Her names as the script writes them (lib/scriptRuleChecks JAW_SAYS; `Me:`
// reads as Prime in lib/scriptSpeaker).
const HERS = new Set(['prime', 'me', 'justawoman', 'jawihp']);

export const isHerSpeaker = (speaker) => HERS.has(String(speaker || '').trim().toLowerCase());
export const HER = 'JustAWoman';

// `**Me:** words` and `__Me__: words`, as a pasted script can have them.
const unbold = (line) => String(line ?? '').replace(/^\s*(\*\*|__)\s*([^*_:]+?)\s*(?:\1\s*:|:\s*\1)\s*/, '$2: ');

export function teleprompterLines(lines = []) {
  const out = [];
  for (const line of lines) {
    const plain = unbold(line);
    const r = readLine(plain);
    if (!r) continue;
    const seconds = lineSeconds(String(plain).trim());
    if (r.type === 'dialogue') {
      const hers = isHerSpeaker(r.speaker);
      out.push({ kind: hers ? 'mine' : 'cue', who: hers ? HER : r.speaker, speaker: r.speaker, paren: r.paren || null, text: r.text, seconds });
    } else if (r.type === 'action' || r.type === 'narration') {
      out.push({ kind: 'direction', who: null, text: r.text, seconds });
    }
    // moment, transition, tag: hidden.
  }
  return out;
}

/**
 * A picked script for the teleprompter: { intro, beats: [{ number, name, lines }] },
 * each `lines` from teleprompterLines (beats as the Script tab numbers them).
 */
export function teleprompterScript(scriptText) {
  const { preamble, beats } = scriptSections(scriptText || '');
  return {
    intro: teleprompterLines(preamble),
    beats: beats.map((b) => ({ number: b.number, name: b.name, lines: teleprompterLines(b.lines) })),
  };
}

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

/** "Beat 8 · Transformation Loop · take 2", the take's name in Files. */
export function takeName(beat, take) {
  const head = beat?.number != null ? `Beat ${beat.number}${beat.name ? ` · ${beat.name}` : ''}` : 'Script';
  return `${head} · take ${take}`;
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

/**
 * Pacing (Evoni, 2026-10-25): roughly how long each beat plays, and where
 * viewers may drift off. Times are lib/scriptRuntime's own estimate (spoken
 * words at 150 a minute, a few seconds for each step on screen), so the
 * timings here match the beat list's. Advice, not a blocker: the rows carry
 * `advice: true`, so "Ready to film?" shows them as tips and no beat is
 * marked for revision by them.
 *
 * Warns when
 *   - the first beat (the hook) talks for more than HOOK_SECONDS before
 *     anything happens on screen,
 *   - a beat runs more than LONG_FACTOR times the average beat,
 *   - talk runs on for more than TALK_SECONDS with nothing on screen.
 * The cutscene (beats 11-13) is a video where the characters talk, so no
 * talk stretch is counted there.
 *
 * Pure: no React, no network.
 */
import { lineSeconds, formatRuntime } from './scriptRuntime';
import { speakerLine } from './scriptSpeaker';
import { parseMoment } from './scriptMoments';
import { isCutsceneBeat } from './scriptShowRules';

export const HOOK_SECONDS = 30;
export const LONG_FACTOR = 2;
export const TALK_SECONDS = 45;
// A beat this short is never "long", whatever the average.
const LONG_MIN_SECONDS = 30;

const ON_SCREEN_TAG = /^\s*\[\s*(?:WEAR|TRANSITION)\s*:/i;

/**
 * What a line is for pacing: 'screen' (something happens on screen: a [UI:]
 * step, a [WEAR:] or [TRANSITION:] cue, Lala's automatic reaction, a stage
 * direction), 'talk' (someone speaking), or 'none' (a hidden tag, a rule).
 */
export function paceKind(line) {
  const t = String(line ?? '').trim();
  if (!t) return 'none';
  if (parseMoment(t) || ON_SCREEN_TAG.test(t)) return 'screen';
  if (lineSeconds(t) === 0) return 'none';
  const sp = speakerLine(t);
  if (sp && sp.words) return sp.auto ? 'screen' : 'talk';
  if (/^\[.*\]$/.test(t)) return 'none';
  // A stage direction or narration: something is seen happening.
  return 'screen';
}

const r1 = (n) => Math.round(n);

/**
 * The script's pacing: { total, average, beats: [{ beatId, number, name,
 * seconds, label, hookSeconds? }], warnings: [{ key, beatId, text }] }.
 * `beats`: the Script tab's beats ({ id, number, name, lines }).
 */
export function scriptPacing(beats = []) {
  const list = (Array.isArray(beats) ? beats : []).filter(Boolean);
  const timed = list.map((b) => {
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const seconds = lines.reduce((s, l) => s + lineSeconds(String(l ?? '').trim()), 0);
    return { beatId: b.id || null, number: b.number, name: b.name || '', seconds: r1(seconds), label: formatRuntime(seconds), lines };
  });
  const total = timed.reduce((s, b) => s + b.seconds, 0);
  const counted = timed.filter((b) => b.seconds > 0);
  const average = counted.length ? total / counted.length : 0;
  const warnings = [];

  // The hook: talk in the first beat before anything happens on screen.
  const first = timed[0];
  if (first) {
    let talk = 0;
    for (const l of first.lines) {
      const k = paceKind(l);
      if (k === 'screen') break;
      if (k === 'talk') talk += lineSeconds(String(l).trim());
    }
    if (talk > HOOK_SECONDS) {
      warnings.push({
        key: 'pacing-hook', beatId: first.beatId,
        text: `Beat ${first.number} (the hook) talks for about ${r1(talk)} seconds before anything happens on screen. Viewers decide in the first 30 seconds: put a tap, a notification or an action earlier.`,
      });
    }
  }

  // A beat much longer than the others.
  if (counted.length >= 3) {
    for (const b of timed) {
      if (b.seconds >= LONG_MIN_SECONDS && b.seconds > LONG_FACTOR * average) {
        warnings.push({
          key: `pacing-long-${b.beatId || b.number}`, beatId: b.beatId,
          text: `Beat ${b.number} runs ${b.label}, more than twice the average beat (${formatRuntime(average)}). Think about trimming it or splitting it.`,
        });
      }
    }
  }

  // Long talk with nothing on screen, across beats, the cutscene left out.
  let run = null;
  const close = () => {
    if (run && run.seconds > TALK_SECONDS) {
      const where = run.from === run.to ? `Beat ${run.from}` : `Beats ${run.from} to ${run.to}`;
      warnings.push({
        key: `pacing-talk-${run.beatId || run.from}-${run.startLine}`, beatId: run.beatId,
        text: `${where}: about ${r1(run.seconds)} seconds of talk with nothing happening on screen. Add a tap, a reaction or an action to break it up.`,
      });
    }
    run = null;
  };
  for (const b of timed) {
    if (isCutsceneBeat(b.number)) { close(); continue; }
    b.lines.forEach((l, i) => {
      const k = paceKind(l);
      if (k === 'screen') { close(); return; }
      if (k !== 'talk') return;
      if (!run) run = { beatId: b.beatId, from: b.number, to: b.number, startLine: i, seconds: 0 };
      run.to = b.number;
      run.seconds += lineSeconds(String(l).trim());
    });
  }
  close();

  return { total, average: r1(average), beats: timed.map((b) => ({ beatId: b.beatId, number: b.number, name: b.name, seconds: b.seconds, label: b.label })), warnings };
}

/**
 * "Ready to film?" rows: the timing row (with `timings`, the per-beat list)
 * and one row per warning, every one `advice: true`. None for no beats.
 */
export function pacingRows(beats = []) {
  const p = scriptPacing(beats);
  if (!p.beats.length) return [];
  return [
    {
      key: 'pacing', ok: !p.warnings.length, advice: true, beatId: null,
      text: `Rough running time: ${formatRuntime(p.total)} (150 spoken words a minute, a few seconds per step on screen).`,
      timings: p.beats,
    },
    ...p.warnings.map((w) => ({ key: w.key, ok: false, advice: true, beatId: w.beatId, text: w.text })),
  ];
}

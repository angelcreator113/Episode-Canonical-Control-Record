// Phone paths (Evoni, 2026-10-16: the Script tab flagged "messages_page is on
// Homepage, but the phone shows closet" in beat after beat). A tap only works
// on the screen its icon sits on, and the writer tapped Homepage icons from
// wherever the last beat left the phone. Before each such tap this puts the
// phone on the icon's screen, `[UI:OPEN Homepage]`, as the phone's own Back
// or Home would. src/utils/phonePaths.js does the same on the server, after
// the writer; the Script tab's "Go home first" uses this.

import { phoneCheck, momentLine } from './scriptMoments';
import { splitSections, insertLine } from './scriptBeatOrder';
import { headerNumber } from './beatLabelNumber';
import { isCutsceneBeat } from './scriptShowRules';

const everywhere = (t) => t.onName === 'Every screen';

/**
 * One beat's lines with the steps its taps need: { lines, added: [{ at, screen }],
 * endAt }. `at` is the new line's place in `lines`. A tap whose icon sits on
 * no screen, or every screen, needs none; a step that does not make its tap
 * work is not added.
 */
export function beatWithPhonePaths(lines = [], on = {}, { startAt = null } = {}) {
  let cur = lines.slice();
  const added = [];
  const tried = new Set();
  for (let guard = 0; guard < 100; guard += 1) {
    const check = phoneCheck(cur, on, { startAt });
    const bad = check.taps.find((t) => !t.ok && t.onName && !everywhere(t) && !tried.has(`${t.i}:${t.onName}`));
    if (!bad) return { lines: cur, added, endAt: check.endAt };
    const step = momentLine('OPEN', bad.onName);
    const next = [...cur.slice(0, bad.i), step, ...cur.slice(bad.i)];
    const after = phoneCheck(next, on, { startAt }).taps.find((t) => t.i === bad.i + 1);
    if (after?.ok) { cur = next; added.push({ at: bad.i, screen: bad.onName }); }
    else tried.add(`${bad.i}:${bad.onName}`);
  }
  return { lines: cur, added, endAt: phoneCheck(cur, on, { startAt }).endAt };
}

/**
 * The script with every tap's phone step added, beat by beat, each beat
 * starting where the one before left the phone. `only`: the beat positions
 * to change (all when null); `skip`: positions never changed (approved
 * beats), read for where they leave the phone. Returns { script, added }:
 * added counts the steps.
 */
export function scriptWithPhonePaths(scriptText, on = {}, { only = null, skip = [] } = {}) {
  const { sections } = splitSections(scriptText);
  let script = scriptText;
  let at = null;
  let added = 0;
  sections.forEach((section, beatIndex) => {
    const lines = section.split('\n').slice(1).filter((l) => l.trim());
    // The cutscene, beats 11-13, has no phone (Evoni, 2026-10-19): no step
    // goes in, and beat 14 starts the phone at home.
    const label = ((section.split('\n')[0] || '').match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim();
    if (isCutsceneBeat(headerNumber(label) || beatIndex + 1)) { at = null; return; }
    const change = !skip.includes(beatIndex) && (only === null || only.includes(beatIndex));
    if (!change) { at = phoneCheck(lines, on, { startAt: at }).endAt; return; }
    const fixed = beatWithPhonePaths(lines, on, { startAt: at });
    for (const step of fixed.added) script = insertLine(script, beatIndex, step.at - 1, momentLine('OPEN', step.screen));
    added += fixed.added.length;
    at = fixed.endAt;
  });
  return { script: added ? script : scriptText, added };
}

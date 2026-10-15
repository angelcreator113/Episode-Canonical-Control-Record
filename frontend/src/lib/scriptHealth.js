/**
 * "Ready to film?" (Script tab audit, 2026-10-15): the script-wide checks the
 * Script tab already makes, in one list. Each row is { key, ok, text, beatId }
 * where beatId (or null) is the beat that fixes it. Nothing here is a new
 * rule: the rows read mustCover, phoneCheck, uncuedPieces, wearFlags and
 * dealCueFlags as the side panel does, only over every beat instead of the
 * open one.
 */
import { phoneCheck, uncuedPieces, wearFlags, dealCueFlags, lastGettingReadyIndex } from './scriptMoments';

const list = (items) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const plural = (n, one, many) => (n === 1 ? one : many);

// Flags of one kind, one row per beat: its first flag, and how many more.
function perBeat(flags, beats, keyPrefix) {
  const byBeat = new Map();
  for (const f of flags) {
    if (!byBeat.has(f.beatIndex)) byBeat.set(f.beatIndex, []);
    byBeat.get(f.beatIndex).push(f.text);
  }
  return [...byBeat.entries()].sort((a, b) => a[0] - b[0]).map(([i, texts]) => {
    const beat = beats[i];
    return {
      key: `${keyPrefix}-${beat?.id || i}`, ok: false, beatId: beat?.id || null,
      text: `Beat ${beat?.number ?? i + 1}: ${texts[0]}${texts.length > 1 ? ` (+${texts.length - 1} more)` : ''}`,
    };
  });
}

export function scriptHealth({
  beats = [], canonical = [], cover = [], onScreen = {}, outfit = [], dealItems = [],
  closetNumber = null, dirty = false, unsaved = null,
} = {}) {
  const rows = [];

  // The canonical beats the script has no header for.
  const have = new Set(beats.map((b) => b.number));
  const gone = canonical.filter((c) => !have.has(c.number));
  rows.push(gone.length
    ? { key: 'beats', ok: false, beatId: null, text: `${plural(gone.length, 'Beat', 'Beats')} ${list(gone.map((c) => `${c.number} (${c.name})`))} ${plural(gone.length, "isn't", "aren't")} in the script.` }
    : { key: 'beats', ok: true, beatId: null, text: `All ${canonical.length} beats are in the script.` });

  // What the episode must cover, from the event and the brief.
  if (cover.length) {
    const open = cover.filter((c) => !c.beat);
    if (!open.length) rows.push({ key: 'cover', ok: true, beatId: null, text: 'Everything the episode must cover is in the script.' });
    for (const c of open) rows.push({ key: `cover-${c.key}`, ok: false, beatId: null, text: `${c.source} not in the script yet: ${c.label}` });
  }

  // Phone check, every beat (the side panel checks the open one).
  let moments = 0;
  const phoneFlags = [];
  // Each beat starts where the one before left the phone, as the side panel reads it.
  let at = null;
  beats.forEach((b, beatIndex) => {
    const check = phoneCheck(b.lines, onScreen, { startAt: at });
    at = check.endAt;
    moments += check.moments;
    for (const t of check.taps) if (!t.ok) phoneFlags.push({ beatIndex, text: t.why });
    for (const m of check.missing) phoneFlags.push({ beatIndex, text: `${m.name} isn't made yet` });
  });
  if (phoneFlags.length) rows.push(...perBeat(phoneFlags, beats, 'phone'));
  else if (moments) rows.push({ key: 'phone', ok: true, beatId: null, text: 'Every phone and overlay moment points at something made.' });

  // The locked look: pieces never put on, and wear cues that name no piece.
  if (Array.isArray(outfit) && outfit.length) {
    const uncued = uncuedPieces(beats, outfit);
    const wear = wearFlags(beats, outfit);
    if (uncued.length) {
      const at = beats[Math.max(0, lastGettingReadyIndex(beats, outfit, closetNumber))] || null;
      rows.push({
        key: 'uncued', ok: false, beatId: at?.id || null,
        text: `${uncued.length} ${plural(uncued.length, 'piece', 'pieces')} of the look ${plural(uncued.length, 'is', 'are')} never put on screen: ${list(uncued.map((p) => p.name || p.id))}.`,
      });
    }
    rows.push(...perBeat(wear, beats, 'wear'));
    if (!uncued.length && !wear.length) rows.push({ key: 'look', ok: true, beatId: null, text: 'Every piece of the look is put on in the script.' });
  }

  // [DELIVER] and [TODO_MODE] cues that do nothing.
  rows.push(...perBeat(dealCueFlags(beats, dealItems), beats, 'deal'));

  const approved = beats.filter((b) => b.approved).length;
  rows.push({ key: 'approved', ok: beats.length > 0 && approved === beats.length, beatId: null, text: `${approved} of ${beats.length} ${plural(beats.length, 'beat', 'beats')} approved.` });

  rows.push(unsaved
    ? { key: 'saved', ok: false, beatId: null, text: 'Generated but not saved: Save keeps it.' }
    : dirty
      ? { key: 'saved', ok: false, beatId: null, text: 'Unsaved changes.' }
      : { key: 'saved', ok: true, beatId: null, text: 'Saved.' });

  return rows;
}

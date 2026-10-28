/**
 * The Teleprompter's voice when Voice Studio is on (B2b; Evoni, 2026-10-28):
 * only the current approved takes from the playable list
 * (/api/v1/voice-studio/:episodeId/playable) play, each from its own trim
 * (in_ms to out_ms). A line is found by its beat and its index alone, the
 * one line rule (voiceLineContext); never by its words, and never from the
 * old voice clips. Every other line is silent, and says why.
 *
 * studioVoice(playable, scriptRevision) → { byLine, notes, stale }:
 *   byLine  lineKey → a clip for useLineVoice: { id, url, in_ms, out_ms, duration_seconds }
 *   notes   lineKey → why that line is silent (an approval held, or no audio)
 *   stale   the list was made for another script than the one on screen:
 *           nothing plays (byLine is empty)
 */
import { lineKey } from './voiceClipsApi';
import { STATE_INFO } from './voiceStudioView';

export const SILENT = Object.freeze({
  loading: 'Checking which voice takes are approved…',
  unknown: "Couldn't check whether Voice Studio is on, so no voice plays. Reload to try again.",
  failed: "The approved takes couldn't be loaded, so no voice plays. Reload to try again.",
  stale: 'The script changed since this page loaded, so no voice plays. Reload to play the approved takes.',
  none: 'No approved take for this line, so it stays silent.',
  missing: "This line's approved take has no audio file, so it stays silent.",
  playFailed: "This line's approved take couldn't be played.",
});

// A held approval's note: what Voice Studio calls its state, and what to do.
const heldNote = (h) => {
  const info = STATE_INFO[h.state];
  return `Silent · ${info ? info.label : h.state} in Voice Studio: ${h.reason_text || info?.help || 'not approved now.'}`;
};
// Revoked and invalid approvals never hold a line; one still in force says more.
const RANK = { revoked: 0, invalid: 1 };

export function studioVoice(playable, scriptRevision) {
  const byLine = new Map();
  const notes = new Map();
  if (!playable) return { byLine, notes, stale: false };
  const stale = !scriptRevision || playable.script_revision !== scriptRevision;
  if (stale) return { byLine, notes, stale: true };
  for (const h of playable.held || []) {
    const key = lineKey(h.beat_number, h.line_index);
    const had = notes.get(key);
    if (!had || (RANK[had.state] ?? 9) < (RANK[h.state] ?? 9)) notes.set(key, h);
  }
  for (const [key, h] of notes) notes.set(key, { state: h.state, text: heldNote(h) });
  for (const t of playable.takes || []) {
    const key = lineKey(t.beat_number, t.line_index);
    const inMs = Number(t.in_ms);
    const outMs = Number(t.out_ms);
    if (!t.audio_url || !Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) {
      notes.set(key, { state: 'missing', text: SILENT.missing });
      continue;
    }
    notes.delete(key);
    byLine.set(key, {
      id: `vs-${t.approval_id}`, approval_id: t.approval_id, url: t.audio_url,
      in_ms: inMs, out_ms: outMs, duration_seconds: (outMs - inMs) / 1000,
    });
  }
  return { byLine, notes, stale: false };
}

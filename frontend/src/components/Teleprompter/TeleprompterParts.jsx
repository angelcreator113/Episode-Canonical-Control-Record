// frontend/src/components/Teleprompter/TeleprompterParts.jsx
// Pieces of the teleprompter reader (Evoni, 2026-10-20): text with its
// reading marks, the mic meter, the framing grid and the rehearsal summary.

import { Pause as PauseIcon, Wind, Mic, RotateCcw, Save } from 'lucide-react';
import { markTokens, normWord } from '../../lib/teleprompterMarks';
import { durationText, diffText } from '../../lib/rehearsal';

/**
 * The text with `//` as a pause mark, `*word*` in the accent colour and
 * `(breath)` / `[breath]` as a breath mark; never their characters. With
 * `wordStart`, each spoken word is a span numbered from it (Follow my
 * voice scrolls to them), and the words from `from` to `cursor` read as said.
 */
export function MarkedText({ text, wordStart = null, cursor = -1, from = 0 }) {
  let n = wordStart ?? 0;
  const words = (v, key) => {
    if (wordStart == null) return v;
    return v.split(/(\s+)/).map((piece, i) => {
      if (!piece || /^\s+$/.test(piece) || !normWord(piece)) return piece;
      const at = n;
      n += 1;
      return <span key={`${key}-${i}`} className={`stp-w${at >= from && at < cursor ? ' is-said' : ''}`} data-vw={at}>{piece}</span>;
    });
  };
  return markTokens(text).map((k, i) => {
    if (k.t === 'pause') return <span key={i} className="stp-mark-pause" role="img" aria-label="pause" data-testid="stp-mark-pause"><PauseIcon size="0.55em" aria-hidden="true" /></span>;
    if (k.t === 'breath') return <span key={i} className="stp-mark-breath" role="img" aria-label="breath" data-testid="stp-mark-breath"><Wind size="0.6em" aria-hidden="true" /></span>;
    if (k.t === 'em') return <em key={i} className="stp-em" data-testid="stp-em">{words(k.v, i)}</em>;
    return <span key={i}>{words(k.v, i)}</span>;
  });
}

/** The mic's level as a bar; `silent` ('never' or 'lost') adds the no-sound warning. */
const SILENT_SAYS = { never: "No sound from your mic yet — check it's on", lost: 'No sound from your mic' };
export function MicMeter({ level = 0, silent = false }) {
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  return (
    <div className={`stp-meter${silent ? ' is-silent' : ''}`} data-testid="stp-meter" data-level={pct}>
      <Mic size={14} aria-hidden="true" />
      <span className="stp-meter-track" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
      {silent && <span className="stp-meter-warn" role="alert" data-testid="stp-silent" data-silent={silent}>{SILENT_SAYS[silent] || SILENT_SAYS.lost}</span>}
    </div>
  );
}

/** Rule-of-thirds lines over the camera preview. */
export const FramingGrid = () => <span className="stp-grid" aria-hidden="true" data-testid="stp-grid" />;

/**
 * The rehearsal summary: each beat she spent time on, against the
 * estimate; Reset, and Save rehearsal times (this device only).
 */
export function RehearsalPanel({ rows, onReset, onSave, savedAt = null }) {
  return (
    <div className="stp-rehearsal" role="region" aria-label="Rehearsal times" data-testid="stp-rehearsal">
      <p className="stp-rehearsal-title">Rehearsal times</p>
      {rows.length ? (
        <ul className="stp-rehearsal-list">
          {rows.map((r) => (
            <li key={r.key} data-testid="stp-rehearsal-row" className={r.current ? 'is-current' : ''}>
              Beat {r.number}: {durationText(r.actual)} · est. {durationText(r.estimate)} · <span className={r.actual > r.estimate ? 'is-over' : 'is-under'}>{diffText(r.actual, r.estimate)}</span>
              {r.saved != null && <span className="stp-rehearsal-saved"> · last saved {durationText(r.saved)}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="stp-rehearsal-empty">Press Play: the time on each beat shows here.</p>}
      <div className="stp-rehearsal-actions">
        <button type="button" className="stp-btn" data-testid="stp-rehearsal-reset" disabled={!rows.length} onClick={onReset}><RotateCcw size={16} aria-hidden="true" /> Reset</button>
        <button type="button" className="stp-btn" data-testid="stp-rehearsal-save" disabled={!rows.length} onClick={onSave}><Save size={16} aria-hidden="true" /> Save rehearsal times</button>
      </div>
      {savedAt && <p className="stp-rehearsal-note" data-testid="stp-rehearsal-note">Saved on this device {savedAt}.</p>}
    </div>
  );
}

// frontend/src/components/Teleprompter/StudioRecord.jsx
// Voice Studio recording from the teleprompter (B2b; Evoni, 2026-10-28): with
// Voice Studio on, "Record a take" records the line on the reading line as a
// new, unapproved Voice Studio take (useTakeSave: source → take → tie, each
// once), and links to Voice Studio to review and approve it. Nothing is
// approved here, and the old voice clips are neither recorded nor played.
// Voice Studio is for admins only; the server refuses anyone else, and the
// refusal is shown as it is. vr-* classes, as VoiceRecord (Teleprompter.css).

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw, Check, X, ExternalLink } from 'lucide-react';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';
import useTakeSave from '../../hooks/useTakeSave';
import { clock } from '../../lib/teleprompterLines';

export const studioLink = (episodeId, beatNumber, lineIndex) =>
  `/episodes/${encodeURIComponent(episodeId)}/voice?beat=${encodeURIComponent(beatNumber)}&line=${encodeURIComponent(lineIndex)}`;

/**
 * line: { beatNumber, lineIndex, speaker, text }; scriptRevision: the saved
 * script on screen. onBusy(busy) as VoiceRecordPanel's; onSaved() after a
 * take is saved (tied or not).
 */
export default function StudioRecordPanel({ episodeId, line, scriptRevision, onClose, onBusy, onSaved, note = null, testId = 'stp-studio-record' }) {
  const rec = useVoiceRecorder();
  const takes = useTakeSave(episodeId);
  const [result, setResult] = useState(null); // { tone, message, link }
  const busy = rec.status === 'starting' || rec.status === 'recording' || (rec.status === 'review' && !!rec.take) || !!takes.pending;
  const onBusyRef = useRef(onBusy);
  onBusyRef.current = onBusy;
  useEffect(() => { onBusyRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyRef.current?.(false), []);
  const where = `beat ${line.beatNumber}, line ${line.lineIndex + 1}`;
  const link = studioLink(episodeId, line.beatNumber, line.lineIndex);

  const save = async (start) => {
    setResult(null);
    const out = await takes.save(start, { scriptRevision, beatNumber: line.beatNumber, lineIndex: line.lineIndex });
    if (out.status === 'tied') {
      rec.discard();
      setResult({ tone: 'ok', message: 'Saved as a new take for this line. It is not approved and does not play until you approve it in Voice Studio.' });
      onSaved?.();
    } else if (out.status === 'untied') {
      rec.discard();
      setResult({ tone: 'warn', message: `The take was saved, but not tied to this line: ${out.error?.message || 'the line changed since it was recorded.'} Tie it to the right line in Voice Studio.` });
      onSaved?.();
    } else if (out.status === 'refused') {
      setResult({ tone: 'bad', message: `${out.error.message} Nothing was saved; record the line again.` });
    } else {
      const done = out.done === 'take' ? ' The take is saved; only tying it to the line is left.' : out.done === 'source' ? ' The audio is saved; only making it a take is left.' : '';
      setResult({ tone: 'bad', message: `${out.error.message}${done}`, retry: true });
    }
  };
  const recordingNow = rec.status === 'recording' || rec.status === 'starting';
  const saving = takes.busy;

  return (
    <div className="vr-panel" role="region" aria-label={`Record a Voice Studio take for ${line.speaker}, ${where}`} data-testid={testId}>
      <div className="vr-head">
        <p className="vr-title"><Mic size={14} aria-hidden="true" /> New take · {line.speaker} · {where}</p>
        <button type="button" className="vr-btn is-icon" aria-label="Close the recorder" data-testid="stp-studio-close" disabled={recordingNow || saving} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="vr-line">“{line.text}”</p>
      {takes.pending && !saving ? (
        <div className="vr-actions">
          <button type="button" className="vr-btn is-primary" data-testid="stp-studio-retry" onClick={() => save(takes.pending)}><RotateCcw size={16} aria-hidden="true" /> Try again</button>
          <button type="button" className="vr-btn" data-testid="stp-studio-giveup" onClick={() => { takes.clear(); rec.discard(); setResult(null); }}>Give up</button>
        </div>
      ) : rec.status === 'review' && rec.take ? (
        <>
          {/* The recording just made, from this browser only; never a saved source. */}
          <audio className="vr-audio" src={rec.take.url} controls data-testid="stp-studio-take-audio" />
          <p className="vr-meta">New take · {clock(rec.take.seconds)}</p>
          <div className="vr-actions">
            <button type="button" className="vr-btn" data-testid="stp-studio-rerecord" disabled={saving} onClick={() => { rec.discard(); rec.start(); }}><RotateCcw size={16} aria-hidden="true" /> Re-record</button>
            <button type="button" className="vr-btn is-primary" data-testid="stp-studio-save" disabled={saving}
              onClick={() => save({ kind: 'recorded', media: { blob: rec.take.blob, type: rec.take.type } })}>
              <Check size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save as a new take'}
            </button>
            <button type="button" className="vr-btn" data-testid="stp-studio-discard" disabled={saving} onClick={rec.discard}>Cancel</button>
          </div>
        </>
      ) : recordingNow ? (
        <div className="vr-actions">
          <span className="vr-rec" role="status" data-testid="stp-studio-recording"><span className="vr-dot" aria-hidden="true" /> {rec.status === 'starting' ? 'Starting the mic…' : `Recording ${clock(rec.elapsed)}`}</span>
          <button type="button" className="vr-btn is-rec" data-testid="stp-studio-stop" disabled={rec.status !== 'recording'} onClick={rec.stop}><Square size={16} aria-hidden="true" /> Stop</button>
        </div>
      ) : (
        <div className="vr-actions">
          <button type="button" className="vr-btn is-rec" data-testid="stp-studio-start" disabled={saving} onClick={rec.start}><Mic size={16} aria-hidden="true" /> Record</button>
        </div>
      )}
      {saving && <p className="vr-meta" role="status">Saving the take…</p>}
      {result && <p className={`vr-${result.tone === 'ok' ? 'meta' : 'error'}`} role={result.tone === 'ok' ? 'status' : 'alert'} data-testid="stp-studio-result">{result.message}</p>}
      <p className="vr-note">
        <a href={link} target="_blank" rel="noopener noreferrer" data-testid="stp-studio-link"><ExternalLink size={12} aria-hidden="true" /> Review and approve in Voice Studio</a>
      </p>
      {note && <p className="vr-note">{note}</p>}
      {rec.error && <p className="vr-error" role="alert">{rec.error}</p>}
    </div>
  );
}

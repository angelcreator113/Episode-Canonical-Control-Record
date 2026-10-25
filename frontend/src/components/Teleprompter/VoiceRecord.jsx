// frontend/src/components/Teleprompter/VoiceRecord.jsx
// Voice clips (Teleprompter batch 3; Evoni, 2026-10-20): she records a line
// in Lala's voice (or anyone's but her own), and the teleprompter plays it
// when she reads opposite it. Used on the Script tab (beside each line) and
// in the teleprompter (the line on the reading line). Recording never
// touches the script itself, so it never makes the Script tab unsaved.
// vr-* classes, styled by each page's own stylesheet (EpisodeScriptPage.css,
// Teleprompter.css).

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, RotateCcw, Check, Trash2, X, AlertTriangle } from 'lucide-react';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';
import { voiceClipsApi, isStale, isNotReady, VOICE_NOT_READY, clipSeconds } from '../../lib/voiceClipsApi';
import { clock } from '../../lib/teleprompterLines';

/** "voice ✓", or "line changed since recorded" when the words moved on. */
export function VoiceBadge({ clip, text }) {
  if (!clip) return null;
  const stale = isStale(clip, text);
  return stale
    ? <span className="vr-badge is-stale" data-testid="vr-badge-stale" title={`Recorded for: “${clip.line_text}”`}><AlertTriangle size={12} aria-hidden="true" /> line changed since recorded</span>
    : <span className="vr-badge" data-testid="vr-badge">voice ✓</span>;
}

/** The small mic beside a line: opens its recorder. */
export function VoiceMicButton({ clip, open, onClick, speaker, disabled = false, testId = 'vr-mic' }) {
  return (
    <button type="button" className={`vr-mic${clip ? ' has-clip' : ''}`} data-testid={testId} aria-expanded={open} disabled={disabled}
      aria-label={clip ? `Voice clip for this ${speaker} line: play or record again` : `Record ${speaker}'s voice for this line`}
      title={clip ? 'Voice clip: play or record again' : 'Record voice'} onClick={onClick}>
      <Mic size={16} aria-hidden="true" />
    </button>
  );
}

/**
 * The recorder for one line. line: { beatNumber, lineIndex, speaker, text }.
 * clip: the line's saved clip, or null. onSaved(clip), onRemoved(clipId),
 * onNotReady() (the database update has not run), onClose(). note: a line
 * under the buttons (the teleprompter's headphones note). onBusy(busy): told
 * whenever a clip starts recording or waits unsaved, and when it no longer
 * does (and on closing), so the teleprompter can ask before it is lost
 * (Teleprompter audit 11).
 */
export default function VoiceRecordPanel({ episodeId, line, clip = null, onSaved, onRemoved, onNotReady, onClose, onBusy, note = null, testId = 'vr-panel' }) {
  const rec = useVoiceRecorder();
  const busy = rec.status === 'starting' || rec.status === 'recording' || (rec.status === 'review' && !!rec.take);
  const onBusyRef = useRef(onBusy);
  onBusyRef.current = onBusy;
  useEffect(() => { onBusyRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyRef.current?.(false), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const stale = isStale(clip, line.text);
  const where = `beat ${line.beatNumber}, line ${line.lineIndex + 1}`;

  const fail = (err, fallback) => {
    if (isNotReady(err)) { onNotReady?.(); setError(VOICE_NOT_READY); return; }
    setError(err?.response?.status === 413 ? 'The clip is too big to upload.' : (err?.response?.data?.error || fallback));
  };

  const save = async () => {
    if (!rec.take || saving) return;
    setSaving(true);
    setError(null);
    try {
      const row = await voiceClipsApi.upload(episodeId, rec.take, line);
      onSaved?.({ ...row, duration_seconds: row?.duration_seconds ?? rec.take.seconds });
      rec.discard();
    } catch (err) {
      console.error('[VoiceRecord] clip not saved:', err);
      fail(err, 'The clip was not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!clip || saving || !window.confirm('Remove this voice clip?')) return;
    setSaving(true);
    setError(null);
    try {
      await voiceClipsApi.remove(episodeId, clip.id);
      onRemoved?.(clip.id);
    } catch (err) {
      console.error('[VoiceRecord] clip not removed:', err);
      fail(err, 'The clip was not removed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const recording = rec.status === 'recording' || rec.status === 'starting';
  const len = clipSeconds(clip);
  return (
    <div className="vr-panel" role="region" aria-label={`Voice for ${line.speaker}, ${where}`} data-testid={testId}>
      <div className="vr-head">
        <p className="vr-title"><Mic size={14} aria-hidden="true" /> Voice · {line.speaker} · {where}</p>
        <button type="button" className="vr-btn is-icon" aria-label="Close the voice recorder" data-testid="vr-close" disabled={recording || saving} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="vr-line">“{line.text}”</p>

      {rec.status === 'review' && rec.take ? (
        <>
          <audio className="vr-audio" src={rec.take.url} controls data-testid="vr-take-audio" />
          <p className="vr-meta">New take · {clock(rec.take.seconds)}</p>
          <div className="vr-actions">
            <button type="button" className="vr-btn" data-testid="vr-rerecord" disabled={saving} onClick={() => { rec.discard(); rec.start(); }}><RotateCcw size={16} aria-hidden="true" /> Re-record</button>
            <button type="button" className="vr-btn is-primary" data-testid="vr-save" disabled={saving} onClick={save}><Check size={16} aria-hidden="true" /> {saving ? 'Saving…' : clip ? 'Save, replacing the old clip' : 'Save'}</button>
            <button type="button" className="vr-btn" data-testid="vr-discard" disabled={saving} onClick={rec.discard}>Cancel</button>
          </div>
        </>
      ) : recording ? (
        <div className="vr-actions">
          <span className="vr-rec" role="status" data-testid="vr-recording"><span className="vr-dot" aria-hidden="true" /> {rec.status === 'starting' ? 'Starting the mic…' : `Recording ${clock(rec.elapsed)}`}</span>
          <button type="button" className="vr-btn is-rec" data-testid="vr-stop" disabled={rec.status !== 'recording'} onClick={rec.stop}><Square size={16} aria-hidden="true" /> Stop</button>
        </div>
      ) : (
        <>
          {clip && (
            <>
              <audio className="vr-audio" src={clip.url} controls data-testid="vr-clip-audio" />
              <p className="vr-meta">{stale ? <span className="vr-stale" data-testid="vr-stale"><AlertTriangle size={14} aria-hidden="true" /> The line changed since this was recorded. It was: “{clip.line_text}”</span> : <>Saved clip{len ? ` · ${clock(len)}` : ''}</>}</p>
            </>
          )}
          <div className="vr-actions">
            <button type="button" className="vr-btn is-rec" data-testid="vr-record" disabled={saving} onClick={rec.start}><Mic size={16} aria-hidden="true" /> {clip ? 'Record again' : 'Record'}</button>
            {clip && <button type="button" className="vr-btn" data-testid="vr-remove" disabled={saving} onClick={remove}><Trash2 size={16} aria-hidden="true" /> Remove</button>}
          </div>
        </>
      )}
      {note && <p className="vr-note" data-testid="vr-note">{note}</p>}
      {(error || rec.error) && <p className="vr-error" role="alert" data-testid="vr-error">{error || rec.error}</p>}
    </div>
  );
}

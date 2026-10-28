/**
 * Voice Studio (B2): one script line — its approval state, its takes, and
 * recording or uploading a new take for it. Every write goes through the B1
 * services with what this page read (script revision, take revision, the
 * approval seen at the line), so a change made elsewhere is refused, never
 * merged. A new take is saved in three steps (source, take, tie); a failed
 * step keeps what is done and the retry carries on from there, so nothing
 * is uploaded twice and a recording is never lost on this page.
 */
import { useRef, useState } from 'react';
import { Mic, Square, Upload, Play, Pause, Check, RotateCcw, Trash2, SlidersHorizontal } from 'lucide-react';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';
import { voiceStudioApi, explainError } from '../../lib/voiceStudioApi';
import useTakeSave from '../../hooks/useTakeSave';
import { STATE_INFO, takeRange, formatMs } from '../../lib/voiceStudioView';

const ACCEPT = '.m4a,.mp3,.wav,.webm,.ogg,.oga,.opus,.aac,.mp4,audio/*';
// The server refused the file itself (type, no audio, unreadable, too long, too big).

function StateCard({ line, onRevoke, canEdit, busy }) {
  const a = line.approval;
  const [confirming, setConfirming] = useState(false);
  if (line.prime) return <p className="vs-note">Prime&apos;s voice comes from her own take on the Timeline, not a voice take.</p>;
  if (!line.spoken) return <p className="vs-note">This line isn&apos;t spoken, so it takes no voice take.</p>;
  if (!a) {
    return (
      <div className="vs-state vs-state--none" data-testid="vs-state">
        <strong>No approved take</strong>
        {line.lastClosed && <span> · the last approval was withdrawn{line.lastClosed.revoked_by ? ` by ${line.lastClosed.revoked_by}` : ''}. It stays withdrawn: approve a take to use one.</span>}
      </div>
    );
  }
  const info = STATE_INFO[a.state] || { label: a.state, tone: 'muted', help: '' };
  return (
    <div className={`vs-state vs-state--${info.tone}`} data-testid="vs-state">
      <strong>{info.label}</strong>
      <span> · {a.reason_text || info.help}</span>
      {a.approved_by && <span className="vs-faint"> (approved by {a.approved_by})</span>}
      {canEdit && (confirming ? (
        <span className="vs-confirm">
          Withdraw this approval? The line will have no approved take.
          <button type="button" className="vs-btn vs-btn--danger" disabled={busy} onClick={() => { setConfirming(false); onRevoke(a); }}>Withdraw</button>
          <button type="button" className="vs-btn" onClick={() => setConfirming(false)}>Keep</button>
        </span>
      ) : (
        <button type="button" className="vs-btn vs-btn--quiet" disabled={busy} onClick={() => setConfirming(true)}>Withdraw approval</button>
      ))}
    </div>
  );
}

function TrimForm({ take, approved, onSave, onCancel, busy }) {
  const [v, setV] = useState({
    in_s: ((take.in_ms || 0) / 1000).toFixed(2), out_s: ((take.out_ms || 0) / 1000).toFixed(2),
    gain_db: String(Number(take.gain_db) || 0), fade_in_ms: String(take.fade_in_ms || 0), fade_out_ms: String(take.fade_out_ms || 0),
    normalise: Boolean(take.normalise),
  });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSave({
      in_ms: Math.round(Number(v.in_s) * 1000), out_ms: Math.round(Number(v.out_s) * 1000), gain_db: Number(v.gain_db),
      fade_in_ms: Math.round(Number(v.fade_in_ms)), fade_out_ms: Math.round(Number(v.fade_out_ms)), normalise: v.normalise,
    });
  };
  return (
    <form className="vs-trim" onSubmit={submit} data-testid="vs-trim">
      <label>In (s)<input type="number" step="0.01" min="0" value={v.in_s} onChange={set('in_s')} /></label>
      <label>Out (s)<input type="number" step="0.01" min="0" max={(take.source_duration_ms || 0) / 1000} value={v.out_s} onChange={set('out_s')} /></label>
      <label>Level (dB)<input type="number" step="0.1" min="-24" max="12" value={v.gain_db} onChange={set('gain_db')} /></label>
      <label>Fade in (ms)<input type="number" step="10" min="0" max="2000" value={v.fade_in_ms} onChange={set('fade_in_ms')} /></label>
      <label>Fade out (ms)<input type="number" step="10" min="0" max="2000" value={v.fade_out_ms} onChange={set('fade_out_ms')} /></label>
      <label className="vs-check"><input type="checkbox" checked={v.normalise} onChange={set('normalise')} /> Normalise</label>
      {approved && <p className="vs-warn">This take is approved. Saving a new trim or level makes that approval outdated until you approve the new version.</p>}
      <div className="vs-row">
        <button type="submit" className="vs-btn vs-btn--gold" disabled={busy}>Save as a new version</button>
        <button type="button" className="vs-btn" onClick={onCancel}>Cancel</button>
      </div>
      <p className="vs-faint">The source file is never changed; each save is a new version of the take (whole source: {formatMs(take.source_duration_ms)}).</p>
    </form>
  );
}

function TakeRow({ take, n, line, approvable, canEdit, audition, onApprove, onRevise, onRemove, busy }) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const a = line.approval;
  const isApprovedTake = a && a.candidate_id === take.id;
  const isCurrent = isApprovedTake && a.state === 'current' && a.candidate_revision_id === take.revision_id;
  const range = takeRange(take);
  const playing = audition.playingId === take.id;
  const kind = { recorded: 'recorded', uploaded: 'uploaded', legacy: 'old clip', extracted: 'from a take' }[take.source_kind] || take.source_kind;
  return (
    <li className={`vs-take${isApprovedTake ? ' vs-take--approved' : ''}`} data-testid={`vs-take-${take.id}`}>
      <div className="vs-take-head">
        <button type="button" className="vs-icon" aria-label={playing ? 'Stop' : 'Play this take'}
          onClick={() => (playing ? audition.stop() : audition.play(take.id, take.audio_url, take.in_ms, take.out_ms))}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="vs-take-meta">
          <strong>{take.label || `Take ${n}`}</strong>
          <span className="vs-faint"> · {kind}{take.source_kind === 'uploaded' && take.original_filename ? ` · ${take.original_filename}` : ''} · {formatMs(range.ms)}{take.revision_no > 1 ? ` · version ${take.revision_no}` : ''}</span>
        </div>
        {isCurrent && <span className="vs-badge vs-badge--ok"><Check size={12} /> Approved</span>}
        {isApprovedTake && !isCurrent && <span className="vs-badge vs-badge--warn">{(STATE_INFO[a.state] || {}).label || a.state}</span>}
      </div>
      {canEdit && (
        <div className="vs-row">
          {approvable && !isCurrent && (
            <button type="button" className="vs-btn vs-btn--gold" disabled={busy || !take.revision_id} onClick={() => onApprove(take)} data-testid="vs-approve">
              {isApprovedTake ? 'Approve this version' : a ? 'Approve instead' : 'Approve'}
            </button>
          )}
          <button type="button" className="vs-btn vs-btn--quiet" onClick={() => setEditing((x) => !x)}><SlidersHorizontal size={14} /> Trim and level</button>
          {removing ? (
            <span className="vs-confirm">
              Remove this take?{isApprovedTake ? ' Its approval stops counting.' : ''}
              <button type="button" className="vs-btn vs-btn--danger" disabled={busy} onClick={() => { setRemoving(false); onRemove(take); }}>Remove</button>
              <button type="button" className="vs-btn" onClick={() => setRemoving(false)}>Keep</button>
            </span>
          ) : (
            <button type="button" className="vs-btn vs-btn--quiet" onClick={() => setRemoving(true)}><Trash2 size={14} /> Remove</button>
          )}
        </div>
      )}
      {editing && <TrimForm take={take} approved={isApprovedTake} busy={busy} onCancel={() => setEditing(false)} onSave={async (settings) => { if (await onRevise(take, settings)) setEditing(false); }} />}
    </li>
  );
}

export default function LineDetail({ episodeId, line, beat, scriptRevision, canEdit, audition, onChanged, onMessage }) {
  const rec = useVoiceRecorder();
  const fileRef = useRef(null);
  const [requesting, setBusy] = useState(false);
  // A new take on its way: what is done so far, so a retry carries on (never uploads twice).
  const takes = useTakeSave(episodeId);
  const { pending } = takes;
  const busy = requesting || takes.busy;
  const approvable = line.spoken && beat.usable;
  const lineForRows = { ...line, scriptRevision };

  const run = async (fn, fallback) => {
    setBusy(true);
    try { await fn(); return true; } catch (err) {
      console.error('[VoiceStudio] request failed:', err);
      onMessage(explainError(err, fallback));
      return false;
    } finally { setBusy(false); }
  };

  /** source → take → tie, each step once (useTakeSave); what happened, in words. */
  const saveTake = async (start) => {
    const out = await takes.save(start, { scriptRevision, beatNumber: line.beat_number, lineIndex: line.line_index, contextHash: line.context_hash });
    if (out.status === 'tied') {
      rec.discard();
      onMessage({ tone: 'ok', message: 'Take saved for this line. Audition it, then approve it.' });
      await onChanged();
    } else if (out.status === 'untied' && out.reason === 'line_changed') {
      rec.discard();
      onMessage({ tone: 'warn', message: 'The take was saved, but not tied: this line changed since it was recorded. It is under "Takes not tied to a line"; tie it to the right line from there.' });
      await onChanged();
    } else if (out.status === 'untied') {
      // The take is saved; only the tie was refused. It waits in "Takes not tied to a line".
      rec.discard();
      onMessage({ ...out.error, message: `The take was saved, but not tied to this line: ${out.error.message} It is under "Takes not tied to a line"; tie it from there after reloading.` });
      await onChanged();
    } else if (out.status === 'refused') {
      // The file itself was refused: trying it again cannot help.
      onMessage({ ...out.error, message: `${out.error.message} Nothing was saved; choose another file or record the line.` });
    } else {
      const done = out.done === 'take' ? ' The take is saved; only tying it to the line is left.' : out.done === 'source' ? ' The audio is saved; only making it a take is left.' : '';
      onMessage({ ...out.error, message: `${out.error.message}${done} Press "Try again" to carry on.`, retry: true });
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) saveTake({ kind: 'uploaded', media: { file }, contextHash: line.context_hash });
  };

  const approve = (take) => run(async () => {
    await voiceStudioApi.approve(episodeId, take.id, { revisionId: take.revision_id, scriptRevision, expectedApprovalId: line.inForce?.approval_id ?? null });
    onMessage({ tone: 'ok', message: 'Approved. This take now plays for the line.' });
    await onChanged();
  }, 'The take was not approved.');
  const revoke = (a) => run(async () => {
    await voiceStudioApi.revoke(episodeId, a.approval_id);
    onMessage({ tone: 'ok', message: 'Approval withdrawn. The line has no approved take now.' });
    await onChanged();
  }, 'The approval was not withdrawn.');
  const revise = (take, settings) => run(async () => {
    await voiceStudioApi.revise(episodeId, take.id, settings);
    onMessage({ tone: 'ok', message: 'Saved as a new version of the take.' });
    await onChanged();
  }, 'The new trim was not saved.');
  const remove = (take) => run(async () => {
    await voiceStudioApi.removeTake(episodeId, take.id);
    onMessage({ tone: 'ok', message: 'Take removed. Its audio is kept on the server.' });
    await onChanged();
  }, 'The take was not removed.');

  return (
    <section className="vs-detail" aria-label="Line" data-testid="vs-detail">
      <header className="vs-detail-head">
        <span className="vs-speaker">{line.speaker_written || (line.spoken ? line.speaker_key : '—')}</span>
        {line.delivery_note && <span className="vs-faint"> {line.delivery_note}</span>}
        <p className="vs-words">{line.words}</p>
        <span className="vs-faint">Beat {line.beat_number} · line {line.line_index + 1}{line.occurrence > 1 ? ` · the same words as an earlier line in this beat (#${line.occurrence})` : ''}</span>
      </header>

      <StateCard line={line} canEdit={canEdit} busy={busy} onRevoke={revoke} />

      {approvable && canEdit && (
        <div className="vs-capture" data-testid="vs-capture">
          {rec.status === 'recording' ? (
            <button type="button" className="vs-btn vs-btn--rec" onClick={rec.stop}><Square size={14} /> Stop ({rec.elapsed.toFixed(0)} s)</button>
          ) : rec.status === 'review' && rec.take ? (
            <span className="vs-row">
              <audio controls src={rec.take.url} className="vs-review-audio" />
              <button type="button" className="vs-btn vs-btn--gold" disabled={busy} onClick={() => saveTake({ kind: 'recorded', media: { blob: rec.take.blob, type: rec.take.type }, contextHash: line.context_hash })} data-testid="vs-save-recording">Save take</button>
              <button type="button" className="vs-btn" disabled={busy} onClick={rec.discard}>Discard</button>
            </span>
          ) : (
            <button type="button" className="vs-btn" disabled={busy || rec.status === 'starting'} onClick={rec.start}><Mic size={14} /> Record</button>
          )}
          {rec.status !== 'recording' && rec.status !== 'review' && (
            <>
              <button type="button" className="vs-btn" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload</button>
              <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={onFile} data-testid="vs-file" />
            </>
          )}
          {rec.error && <p className="vs-warn" role="alert">{rec.error}</p>}
          {pending && !busy && (
            <span className="vs-row">
              <button type="button" className="vs-btn vs-btn--gold" onClick={() => saveTake(pending)} data-testid="vs-retry"><RotateCcw size={14} /> Try again</button>
              <button type="button" className="vs-btn" onClick={() => { takes.clear(); rec.discard(); }}>Give up</button>
            </span>
          )}
          {busy && pending && <span className="vs-faint" role="status">Saving the take…</span>}
        </div>
      )}
      {line.spoken && !beat.usable && (
        <p className="vs-warn">{beat.duplicate ? 'The script has two beats with this number, so lines in it can\'t be tied safely. Fix the beat numbers in the Script tab.' : 'Only beats 1 to 14 take voice takes.'}</p>
      )}

      {line.spoken && (
        <>
          <h3 className="vs-h3">Takes ({line.takes.length})</h3>
          {audition.error && <p className="vs-warn" role="alert">{audition.error}</p>}
          {line.takes.length ? (
            <ul className="vs-takes">
              {line.takes.map((t, i) => (
                <TakeRow key={t.id} take={t} n={i + 1} line={lineForRows} approvable={approvable} canEdit={canEdit} audition={audition}
                  busy={busy} onApprove={approve} onRevise={revise} onRemove={remove} />
              ))}
            </ul>
          ) : <p className="vs-note">No takes yet.{canEdit && approvable ? ' Record one or upload a file.' : ''}</p>}
        </>
      )}
    </section>
  );
}

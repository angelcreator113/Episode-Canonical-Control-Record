/**
 * Voice Studio (B2): what a beat's approvals need from a person.
 *
 * ReviewPanel — approvals the script save put up for review (needs_review).
 * Each shows what was approved beside the line as it is now; nothing is
 * pre-checked; "Re-confirm" opens a confirmation, and only pressing Confirm
 * sends them (design R5.2). The server checks each again and answers with
 * the confirmed and the refused; the page shows both and assumes nothing.
 *
 * AttentionList — approvals whose line moved or is ambiguous (a person
 * confirms or picks the line, or withdraws the approval), and those that are
 * unbound or invalid (they never play again; a take is approved afresh).
 * Nothing here is restored or moved without a press.
 */
import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { voiceStudioApi, explainError } from '../../lib/voiceStudioApi';
import { STATE_INFO } from '../../lib/voiceStudioView';

const said = (speaker, words) => `${speaker ? `${speaker}: ` : ''}“${words || ''}”`;

export function ReviewPanel({ episodeId, beat, scriptRevision, scriptSeq, canEdit, onChanged, onMessage, onOpenLine }) {
  const [picked, setPicked] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  if (!beat.review.length) return null;
  const lineAt = (i) => beat.lines[i] || null;
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const items = beat.review.filter((a) => picked.has(a.approval_id)).map((a) => ({ approval_id: a.approval_id, context_hash: a.context_hash }));
      const out = await voiceStudioApi.reconfirm(episodeId, scriptRevision, items);
      setResult(out);
      setPicked(new Set());
      setConfirming(false);
      const n = out.confirmed.length;
      onMessage({ tone: out.refused.length ? 'warn' : 'ok', message: `${n} take${n === 1 ? '' : 's'} re-confirmed${out.refused.length ? `; ${out.refused.length} not (see the list)` : ''}.` });
      await onChanged();
    } catch (err) {
      console.error('[VoiceStudio] re-confirm failed:', err);
      onMessage(explainError(err, 'Nothing was re-confirmed.'));
      setConfirming(false);
    } finally { setBusy(false); }
  };

  return (
    <section className="vs-panel vs-panel--review" data-testid="vs-review">
      <h3 className="vs-h3">Needs review ({beat.review.length})</h3>
      <p className="vs-faint">The script was saved since these were approved. Check each take still fits its line as it is now. Nothing is re-confirmed until you choose it and confirm.</p>
      <ul className="vs-review-list">
        {beat.review.map((a) => {
          const now = lineAt(a.resolution?.line_index ?? a.line_index);
          const prev = now ? lineAt(now.line_index - 1) : null;
          const next = now ? lineAt(now.line_index + 1) : null;
          return (
            <li key={a.approval_id} className="vs-review-item">
              {canEdit && (
                <input type="checkbox" aria-label={`Re-confirm line ${(now?.line_index ?? a.line_index) + 1}`} checked={picked.has(a.approval_id)} onChange={() => toggle(a.approval_id)} />
              )}
              <div className="vs-compare">
                <div><span className="vs-faint">Approved</span> {said(a.speaker, a.words)}</div>
                <div><span className="vs-faint">Now</span> {now ? said(now.speaker_written, now.words) : '—'}</div>
                <div className="vs-faint">{a.reason_text || STATE_INFO.needs_review.help}</div>
                {(prev || next) && <div className="vs-faint">Around it now: {prev ? said(prev.speaker_written, prev.words) : 'beat start'} · {next ? said(next.speaker_written, next.words) : 'beat end'}</div>}
                <button type="button" className="vs-link" onClick={() => onOpenLine(now?.line_index ?? a.line_index)}>Open the line and audition</button>
              </div>
            </li>
          );
        })}
      </ul>
      {canEdit && (confirming ? (
        <div className="vs-confirm" role="alertdialog" aria-label="Confirm re-confirmation">
          Confirm {picked.size} take{picked.size === 1 ? '' : 's'} still match{picked.size === 1 ? 'es' : ''} {picked.size === 1 ? 'its line' : 'their lines'} as of the script&apos;s save #{scriptSeq}?
          <button type="button" className="vs-btn vs-btn--gold" disabled={busy} onClick={send} data-testid="vs-reconfirm-confirm">Confirm</button>
          <button type="button" className="vs-btn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <div className="vs-row">
          <button type="button" className="vs-btn" onClick={() => setPicked(new Set(beat.review.map((a) => a.approval_id)))}>Select all {beat.review.length}</button>
          <button type="button" className="vs-btn vs-btn--gold" disabled={!picked.size} onClick={() => setConfirming(true)} data-testid="vs-reconfirm">Re-confirm {picked.size || ''}</button>
        </div>
      ))}
      {result?.refused?.length > 0 && (
        <ul className="vs-refused" data-testid="vs-refused">
          {result.refused.map((r) => <li key={r.approval_id}>Not re-confirmed: {r.reason_text || r.reason}</li>)}
        </ul>
      )}
    </section>
  );
}

export function AttentionList({ episodeId, beat, scriptRevision, canEdit, onChanged, onMessage }) {
  const [busy, setBusy] = useState(false);
  if (!beat.attention.length) return null;
  const run = async (fn, ok, fallback) => {
    setBusy(true);
    try { await fn(); onMessage({ tone: 'ok', message: ok }); await onChanged(); } catch (err) {
      console.error('[VoiceStudio] request failed:', err);
      onMessage(explainError(err, fallback));
    } finally { setBusy(false); }
  };
  const confirmAt = (a, index) => {
    // The approval in force at the target line, as this page saw it (null for none).
    const target = beat.lines[index];
    return run(() => voiceStudioApi.resolve(episodeId, a.approval_id, { scriptRevision, lineIndex: index, expectedApprovalId: target?.inForce && target.inForce.approval_id !== a.approval_id ? target.inForce.approval_id : null }),
      `The take is approved for line ${index + 1}.`, 'The line was not confirmed.');
  };
  const withdraw = (a) => run(() => voiceStudioApi.revoke(episodeId, a.approval_id), 'Approval withdrawn.', 'The approval was not withdrawn.');

  return (
    <section className="vs-panel vs-panel--attention" data-testid="vs-attention">
      <h3 className="vs-h3">Needs attention ({beat.attention.length})</h3>
      <ul className="vs-review-list">
        {beat.attention.map((a) => {
          const info = STATE_INFO[a.state] || { label: a.state, tone: 'muted' };
          const choices = (a.resolution?.candidates || []).filter((i) => beat.lines[i]);
          return (
            <li key={a.approval_id} className="vs-review-item" data-testid={`vs-attention-${a.state}`}>
              <div className="vs-compare">
                <div><span className={`vs-badge vs-badge--${info.tone}`}>{info.label}</span> {said(a.speaker, a.words)} <span className="vs-faint">(approved at line {a.line_index + 1})</span></div>
                <div className="vs-faint">{a.reason_text || info.help}</div>
                {canEdit && (a.state === 'moved' || a.state === 'ambiguous') && (
                  <div className="vs-row">
                    {choices.map((i) => (
                      <button key={i} type="button" className="vs-btn" disabled={busy} onClick={() => confirmAt(a, i)}>
                        {a.state === 'moved' ? 'Confirm' : 'Pick'} line {i + 1}: {said(beat.lines[i].speaker_written, beat.lines[i].words)}
                      </button>
                    ))}
                    <button type="button" className="vs-btn vs-btn--quiet" disabled={busy} onClick={() => withdraw(a)}>Withdraw</button>
                  </div>
                )}
                {canEdit && a.state === 'unbound' && (
                  <div className="vs-row"><button type="button" className="vs-btn vs-btn--quiet" disabled={busy} onClick={() => withdraw(a)}>Withdraw</button></div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const UNTIED_HELP = 'Old clips brought in, and takes whose tie was refused. They play nowhere until tied to a line and approved.';
const DRIFTED_HELP = "These takes' lines moved, are ambiguous or changed since they were tied. They are not shown at any line, and play nowhere, until you tie each to the line it is for.";

export function UnassignedTakes({ episodeId, takes, line, beat, scriptRevision, canEdit, audition, onChanged, onMessage, drifted = false }) {
  const [busy, setBusy] = useState(false);
  if (!takes.length) return null;
  const canTie = canEdit && line && line.spoken && beat?.usable;
  const tie = async (t) => {
    setBusy(true);
    try {
      await voiceStudioApi.tie(episodeId, t.id, { scriptRevision, beatNumber: line.beat_number, lineIndex: line.line_index });
      onMessage({ tone: 'ok', message: `Tied to beat ${line.beat_number}, line ${line.line_index + 1}. It is not approved until you approve it.` });
      await onChanged();
    } catch (err) {
      console.error('[VoiceStudio] tie failed:', err);
      onMessage(explainError(err, 'The take was not tied.'));
    } finally { setBusy(false); }
  };
  return (
    <section className={`vs-panel${drifted ? ' vs-panel--attention' : ''}`} data-testid={drifted ? 'vs-drifted' : 'vs-unassigned'}>
      <h3 className="vs-h3">{drifted ? `Takes whose line changed (${takes.length})` : `Takes not tied to a line (${takes.length})`}</h3>
      <p className="vs-faint">{drifted ? DRIFTED_HELP : UNTIED_HELP}{canTie ? '' : ' Open a spoken line to tie one to it.'}</p>
      <ul className="vs-takes">
        {takes.map((t) => (
          <li key={t.id} className="vs-take">
            <div className="vs-take-head">
              <button type="button" className="vs-icon" aria-label="Play this take" onClick={() => (audition.playingId === t.id ? audition.stop() : audition.play(t.id, t.audio_url, t.in_ms, t.out_ms))}>{audition.playingId === t.id ? <Pause size={16} /> : <Play size={16} />}</button>
              <div className="vs-take-meta">
                <strong>{t.label || t.original_filename || 'Take'}</strong>
                {drifted && <span className="vs-faint"> · tied to line {t.line_index + 1}: {said(t.speaker_written, t.words)}</span>}
                {drifted && t.binding?.reason_text && <div className="vs-faint">{t.binding.reason_text}</div>}
              </div>
              {canTie && <button type="button" className="vs-btn" disabled={busy} onClick={() => tie(t)}>Tie to line {line.line_index + 1}</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

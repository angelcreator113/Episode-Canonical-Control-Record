/**
 * Voice Studio's Dialogue Library (S1; Evoni, 2026-10-30): every spoken
 * line of this episode with its takes, which one is approved, and the
 * line's approval history. Read and listen only: approving, withdrawing,
 * trimming and re-confirming stay in Needs Attention under their existing
 * rules ("Open in Needs Attention" goes to the line there).
 *
 * Scope: This Episode. All Episodes is shown but not offered until the
 * library across episodes (S6) exists.
 */
import { useEffect, useMemo, useState } from 'react';
import { Play, Square, ArrowRight } from 'lucide-react';
import { voiceStudioApi, explainError } from '../../lib/voiceStudioApi';
import { takeRange, formatMs } from '../../lib/voiceStudioView';

const STATUS_FILTERS = [
  { key: 'all', label: 'Every status' },
  { key: 'approved', label: 'Approved' },
  { key: 'review', label: 'Needs review' },
  { key: 'outdated', label: 'Outdated' },
  { key: 'takes', label: 'Takes, none approved' },
  { key: 'none', label: 'No take' },
];

/** What happened to an approval since, in words. */
function outcome(a) {
  if (a.revoked_at) return `withdrawn${a.revoked_by ? ` by ${a.revoked_by}` : ''}`;
  if (a.invalidated_at) return `no longer valid (${String(a.invalidated_reason || 'changed').replace(/_/g, ' ')})`;
  if (a.superseded_at) return 'replaced by a later approval';
  return 'in force';
}
const when = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function DialogueLibrary({ episodeId, arranged, statusLabel, audition, onOpenLine }) {
  const [speaker, setSpeaker] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let live = true;
    voiceStudioApi.history(episodeId).then((h) => { if (live) setHistory(Array.isArray(h) ? h : []); }, (err) => {
      console.error('[VoiceStudio] approval history not read:', err);
      if (live) setHistoryError(explainError(err, "The approval history couldn't be read."));
    });
    return () => { live = false; };
  }, [episodeId]);

  const historyByLine = useMemo(() => {
    const m = new Map();
    for (const a of history || []) {
      const k = `${a.beat_number}:${a.line_index}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    return m;
  }, [history]);

  const q = query.trim().toLowerCase();
  const beats = arranged.beats.map((b) => ({
    ...b,
    shown: b.lines.filter((l) => l.spoken
      && (speaker === 'all' || l.speaker_key === speaker)
      && (status === 'all' || l.status === status)
      && (!q || String(l.words || '').toLowerCase().includes(q))),
  })).filter((b) => b.shown.length);
  const count = beats.reduce((n, b) => n + b.shown.length, 0);

  return (
    <section className="vs-library" aria-label="Dialogue Library" data-testid="vs-library">
      <div className="vs-library-tools">
        <div className="vs-scope" role="group" aria-label="Scope">
          <button type="button" className="vs-chip vs-chip--on" aria-pressed="true" data-testid="vs-scope-episode">This Episode</button>
          <button type="button" className="vs-chip" aria-pressed="false" disabled title="Coming with the library across episodes (S6)" data-testid="vs-scope-all">
            All Episodes · coming later
          </button>
        </div>
        <label className="vs-filter">
          <span>Character</span>
          <select value={speaker} onChange={(e) => setSpeaker(e.target.value)} data-testid="vs-lib-speaker">
            <option value="all">Everyone</option>
            {arranged.speakers.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        <label className="vs-filter">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="vs-lib-status">
            {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="vs-filter vs-filter--grow">
          <span>Search the words</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a line" data-testid="vs-lib-search" />
        </label>
      </div>
      <p className="vs-note" data-testid="vs-lib-count">{count} {count === 1 ? 'line' : 'lines'}</p>
      {historyError && <p className="vs-warn" role="alert">{historyError.message}</p>}
      {!beats.length && <p className="vs-note">No lines match.</p>}
      {beats.map((b) => (
        <div key={String(b.beat_number)} className="vs-lib-beat">
          <h3 className="vs-h3">Beat {b.beat_number}</h3>
          <ul className="vs-lib-lines">
            {b.shown.map((l) => {
              const approved = l.approval?.state === 'current' ? l.takes.find((t) => t.id === l.approval.candidate_id) : null;
              const past = historyByLine.get(l.key) || [];
              const playing = approved && audition.playingId === approved.id;
              const isOpen = open === l.key;
              return (
                <li key={l.key} className="vs-lib-line" data-testid={`vs-lib-line-${l.key}`}>
                  <div className="vs-lib-line-head">
                    <span className="vs-line-who">{l.speaker_written || l.speaker_key}</span>
                    <span className={`vs-line-status vs-line-status--${l.status}`}>{statusLabel[l.status]}</span>
                  </div>
                  <p className="vs-lib-words">{l.words}</p>
                  <div className="vs-row">
                    {approved ? (
                      <span className="vs-lib-approved">
                        <button type="button" className="vs-icon" aria-label={playing ? 'Stop' : 'Play the approved take'}
                          onClick={() => (playing ? audition.stop() : audition.play(approved.id, approved.audio_url, approved.in_ms, approved.out_ms))}>
                          {playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                        </button>
                        Approved take: {approved.label || 'take'} · {formatMs(takeRange(approved).ms)}
                      </span>
                    ) : <span className="vs-faint">No approved take</span>}
                    <span className="vs-faint">{l.takes.length} {l.takes.length === 1 ? 'take' : 'takes'}</span>
                    {past.length > 0 && (
                      <button type="button" className="vs-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.key)} data-testid={`vs-lib-history-${l.key}`}>
                        History ({past.length})
                      </button>
                    )}
                    <button type="button" className="vs-btn vs-btn--quiet" onClick={() => onOpenLine(l)} data-testid={`vs-lib-open-${l.key}`}>
                      Open in Needs Attention <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {isOpen && (
                    <ol className="vs-lib-history">
                      {past.map((a) => (
                        <li key={a.id}>Approved by {a.approved_by || 'someone'} on {when(a.approved_at)}: {outcome(a)}</li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {audition.error && <p className="vs-warn" role="alert">{audition.error}</p>}
    </section>
  );
}

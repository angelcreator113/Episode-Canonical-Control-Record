/**
 * Canon approval for the episode's short stories (Evoni, 2026-10-17, stage
 * D): what each story adds is proposed, not canon. Secrets it hints at or
 * reveals (marked when it goes past what a short story may do with that
 * secret), new facts, threads, and where it goes against the episode's
 * record. Accept makes it canon: the secret moves on, the thread opens or
 * advances, the fact is something the chapter writer may build on.
 * Dismiss keeps it out. Results → Story, under the story record
 * (services/storyCanon).
 *
 * Props: episodeId, refreshKey (changes when a short story was just written).
 */
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Sparkles, Check, X, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import './EpisodeStoryRecord.css';

const GROUPS = [
  ['secret', 'Secrets'],
  ['fact', 'New facts'],
  ['thread', 'Threads'],
  ['contradiction', 'Against the record'],
];
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const when = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

function Proposal({ p, busy, onAccept, onDismiss }) {
  const decided = p.status !== 'pending';
  let main;
  if (p.kind === 'secret') main = <><strong>{p.what === 'revealed' ? 'Reveals' : 'Hints at'}:</strong> {p.text}{p.how ? <span className="esr-how"> ({p.how})</span> : null}</>;
  else if (p.kind === 'thread') main = <><strong>{p.thread_id ? 'Moves on' : 'Opens'}:</strong> {p.title}{p.note ? <span className="esr-how"> ({p.note})</span> : null}</>;
  else main = p.text;
  return (
    <li className={`esr-prop is-${p.kind}${decided ? ` is-${p.status}` : ''}`} data-testid={`esr-prop-${p.id}`}>
      <p className="esr-prop-text">{main}</p>
      {p.kind === 'secret' && p.over_budget && !decided && (
        <p className="esr-warn"><AlertTriangle size={13} aria-hidden="true" /> Goes past what a short story may do with this secret ({p.permission === 'hidden' ? 'keep hidden' : 'hint only'}).</p>
      )}
      {decided ? (
        <span className={`esr-badge is-${p.status === 'accepted' ? 'approved' : 'draft'}`}>{p.status === 'accepted' ? 'Canon' : p.kind === 'contradiction' ? 'Noted' : 'Not canon'}</span>
      ) : (
        <div className="esr-actions">
          {p.kind !== 'contradiction' && (
            <button type="button" className="esr-btn" disabled={busy} onClick={onAccept}><Check size={14} aria-hidden="true" /> Accept</button>
          )}
          <button type="button" className="esr-btn-soft" disabled={busy} onClick={onDismiss}>
            <X size={14} aria-hidden="true" /> {p.kind === 'contradiction' ? 'Noted' : 'Dismiss'}
          </button>
        </div>
      )}
    </li>
  );
}

export default function EpisodeStoryCanon({ episodeId, refreshKey = 0 }) {
  const base = '/api/v1/book-from-show';
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      setData((await api.get(`${base}/episodes/${episodeId}/canon`)).data);
    } catch (err) {
      console.error('[EpisodeStoryCanon] load failed:', err);
      setData({ stories: [], pending: 0 });
      setNote({ error: true, text: errorOf(err, 'Canon approval could not be loaded.') });
    }
  }, [episodeId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const run = async (key, fn, failed) => {
    setBusy(key); setNote(null);
    try { setData((await fn()).data); } catch (err) {
      console.error('[EpisodeStoryCanon] request failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
    } finally { setBusy(null); }
  };
  const review = (id) => run(id, () => api.post(`${base}/stories/${id}/canon/review`, {}, { timeout: 180000 }), 'The story could not be read.');
  const decide = (id, how) => run(id, () => api.post(`${base}/canon/${id}/${how}`), how === 'accept' ? 'It was not accepted.' : 'It was not dismissed.');

  if (!data) return <section className="esr" aria-busy="true"><p className="esr-note">Loading canon approval…</p></section>;
  if (!data.stories.length) return null;

  return (
    <section className="esr" aria-labelledby="esr-canon-title" data-testid="episode-story-canon">
      <header className="esr-head">
        <ShieldCheck size={18} aria-hidden="true" className="esr-icon" />
        <h3 id="esr-canon-title" className="esr-title">Short story canon</h3>
        {data.pending > 0 && <span className="esr-badge is-draft">{data.pending} to decide</span>}
      </header>
      <p className="esr-note">
        A short story may go beneath the episode, never against it. What it adds is proposed here, not canon:
        accept what is true and the chapter writer builds on it; dismiss the rest and it is kept out.
      </p>
      {note && <p className={`esr-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}

      {data.stories.map((s) => (
        <article key={s.id} className="esr-group" data-testid={`esr-story-${s.id}`}>
          <div className="esr-row-head">
            <span className="esr-name">{s.title || 'Short story'} <span className="esr-how">· {when(s.created_at)}{s.word_count ? ` · ${s.word_count} words` : ''}</span></span>
            <button type="button" className="esr-btn-soft" disabled={!!busy} onClick={() => review(s.id)}>
              <Sparkles size={14} aria-hidden="true" /> {busy === s.id ? 'Reading the story…' : s.reviewed_at ? 'Read it again' : 'Check this story'}
            </button>
          </div>
          {!s.reviewed_at && <p className="esr-note">Not checked yet.</p>}
          {s.reviewed_at && !s.proposals.length && <p className="esr-note">It adds nothing to canon and nothing goes against the record.</p>}
          {GROUPS.map(([kind, label]) => {
            const list = s.proposals.filter((p) => p.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind} className="esr-prop-group">
                <span className="esr-label">{label}</span>
                <ul className="esr-props">
                  {list.map((p) => (
                    <Proposal key={p.id} p={p} busy={!!busy} onAccept={() => decide(p.id, 'accept')} onDismiss={() => decide(p.id, 'dismiss')} />
                  ))}
                </ul>
              </div>
            );
          })}
        </article>
      ))}
    </section>
  );
}

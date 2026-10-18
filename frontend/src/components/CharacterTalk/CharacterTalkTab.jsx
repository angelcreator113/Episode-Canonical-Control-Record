/**
 * Talk (Evoni, 2026-10-18): a confidential session with a character in
 * Lala's world, as Dr. Amara Sinclair, their therapist at The Quiet Room.
 * "You become someone they trust with their secrets. Not their creator."
 *
 *   The session: Dr. Sinclair's lines and the character's answers, saved
 *     (GET/POST /api/v1/cast/characters/:id/talk, services/characterTalk).
 *   What came out of this (POST /cast/talk/:sessionId/review): her session
 *     note, and suggestions only Evoni sees: an inner-life change (Apply),
 *     a candidate secret (Send to their secrets), a Producer Insight (Keep).
 *     Nothing reaches The Pulse, the press or a writer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Plus, Send, Sparkles, Lock } from 'lucide-react';
import api from '../../services/api';
import './CharacterTalkTab.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export const FIELD_LABELS = Object.freeze({
  core_desire: 'What they want most',
  core_fear: 'What they fear',
  core_wound: 'Their wound',
  hidden_want: 'What they want and hide',
  blind_spot: 'Their blind spot',
  self_narrative: 'The story they tell about themselves',
});

const ACTIONS = Object.freeze({
  inner: [['apply', 'Apply to their inner life'], ['dismiss', 'Dismiss']],
  secret: [['send', 'Send to their secrets'], ['dismiss', 'Dismiss']],
  insight: [['keep', 'Keep'], ['dismiss', 'Dismiss']],
});
const STATUS = Object.freeze({ applied: 'Applied', sent: 'Sent to their secrets, as a candidate', kept: 'Kept', dismissed: 'Dismissed' });

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

function Suggestion({ item, busy, onAct }) {
  return (
    <li className="talk-item" data-testid={`talk-item-${item.id}`}>
      {item.kind === 'inner' ? (
        <>
          <span className="talk-item-label">{FIELD_LABELS[item.field] || item.field}</span>
          {item.current && <p className="talk-item-was">Now: {item.current}</p>}
          <p className="talk-item-text">{item.value}</p>
        </>
      ) : <p className="talk-item-text">{item.text}</p>}
      {item.why && <p className="talk-item-why">From the session: {item.why}</p>}
      {item.status === 'open' ? (
        <div className="talk-actions">
          {ACTIONS[item.kind].map(([action, label]) => (
            <button key={action} type="button" className={`talk-btn${action === 'dismiss' ? ' is-quiet' : ''}`} disabled={busy}
              onClick={() => onAct(item, action)}>{label}</button>
          ))}
        </div>
      ) : <p className="talk-item-status">{STATUS[item.status] || item.status}</p>}
    </li>
  );
}

function Review({ review, busy, onAct }) {
  const groups = [
    ['inner', 'Their inner life'],
    ['secret', 'Secrets'],
    ['insight', 'Producer Insights (only you see these)'],
  ];
  return (
    <section className="talk-review" data-testid="talk-review">
      {review.session_note && <p className="talk-note"><strong>Dr. Sinclair's note:</strong> {review.session_note}</p>}
      {groups.map(([kind, title]) => {
        const items = (review.items || []).filter((i) => i.kind === kind);
        return items.length ? (
          <div key={kind}>
            <h4 className="talk-review-title">{title}</h4>
            <ul className="talk-items">{items.map((i) => <Suggestion key={i.id} item={i} busy={busy} onAct={onAct} />)}</ul>
          </div>
        ) : null;
      })}
      {!(review.items || []).length && <p className="talk-muted">Nothing new came out of this session.</p>}
    </section>
  );
}

export default function CharacterTalkTab({ character, onSaved }) {
  const [state, setState] = useState({ loading: true, canTalk: false, sessions: [] });
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const name = character.selected_name || character.display_name;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/cast/characters/${character.id}/talk`);
      setState({ loading: false, canTalk: !!data.can_talk, sessions: data.sessions || [] });
    } catch (err) {
      console.error('[CharacterTalkTab] the sessions could not be read:', err);
      setState({ loading: false, canTalk: false, sessions: [] });
      setError(errorText(err, 'The sessions could not be loaded.'));
    }
  }, [character.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [session?.messages?.length]);

  const keep = (next) => {
    setSession(next);
    setState((s) => ({ ...s, sessions: [next, ...s.sessions.filter((x) => x.id !== next.id)] }));
  };

  const say = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text) return;
    setBusy('say'); setError(null);
    try {
      const { data } = await api.post(`/api/v1/cast/characters/${character.id}/talk`, { session_id: session?.id || null, text });
      setDraft('');
      keep(data.session);
    } catch (err) {
      console.error('[CharacterTalkTab] the line could not be sent:', err);
      setError(errorText(err, `${name} could not answer. Try again.`));
    } finally { setBusy(null); }
  };

  const review = async () => {
    setBusy('review'); setError(null);
    try {
      const { data } = await api.post(`/api/v1/cast/talk/${session.id}/review`);
      keep(data.session);
    } catch (err) {
      console.error('[CharacterTalkTab] the review failed:', err);
      setError(errorText(err, 'The session could not be reviewed. Try again.'));
    } finally { setBusy(null); }
  };

  const act = async (item, action) => {
    setBusy(item.id); setError(null);
    try {
      const { data } = await api.post(`/api/v1/cast/talk/${session.id}/items/${item.id}`, { action });
      keep(data.session);
      if (action === 'apply') onSaved?.({ [item.field]: item.value });
    } catch (err) {
      console.error('[CharacterTalkTab] the suggestion could not be decided:', err);
      setError(errorText(err, 'That did not save. Try again.'));
    } finally { setBusy(null); }
  };

  if (state.loading) return <p className="talk-muted">Loading…</p>;
  if (!state.canTalk) {
    return (
      <div className="talk" data-testid="talk-unavailable">
        <p className="talk-muted">Talk is for characters in Lala's world. Dr. Sinclair does not see JustAWoman's people, and does not have sessions with herself.</p>
      </div>
    );
  }

  return (
    <div className="talk" data-testid="character-talk">
      <header className="talk-head">
        <h3><MessageCircle size={18} aria-hidden /> The Quiet Room</h3>
        <p className="talk-muted"><Lock size={13} aria-hidden /> You are Dr. Amara Sinclair, {name}'s therapist. Sessions are confidential: nothing here reaches The Pulse, the press or a writer.</p>
      </header>

      <div className="talk-sessions">
        <button type="button" className={`talk-chip${!session ? ' is-on' : ''}`} onClick={() => setSession(null)}><Plus size={13} aria-hidden /> New session</button>
        {state.sessions.map((s) => (
          <button key={s.id} type="button" className={`talk-chip${session?.id === s.id ? ' is-on' : ''}`} onClick={() => setSession(s)}>
            {when(s.created_at)}
          </button>
        ))}
      </div>

      <ol className="talk-log" aria-live="polite">
        {(session?.messages || []).map((m, i) => (
          <li key={`${i}-${m.at}`} className={`talk-line ${m.from === 'dr_sinclair' ? 'is-you' : 'is-them'}`}>
            <span className="talk-who">{m.from === 'dr_sinclair' ? 'Dr. Sinclair' : name}</span>
            <p>{m.text}</p>
          </li>
        ))}
        {!session && <li className="talk-muted">A new session. What would you like to ask {name}?</li>}
        <li ref={endRef} aria-hidden />
      </ol>

      <form className="talk-say" onSubmit={say}>
        <label className="talk-label" htmlFor="talk-draft">Dr. Sinclair</label>
        <textarea id="talk-draft" className="talk-input" rows={3} value={draft} maxLength={2000}
          placeholder={`What would you like to ask ${name}?`} onChange={(e) => setDraft(e.target.value)} />
        <div className="talk-actions">
          <button type="submit" className="talk-btn" disabled={!!busy || !draft.trim()}>
            <Send size={14} aria-hidden /> {busy === 'say' ? `${name} is answering…` : 'Say it'}
          </button>
          {session?.messages?.length > 0 && (
            <button type="button" className="talk-btn is-quiet" disabled={!!busy} onClick={review} data-testid="talk-review-run">
              <Sparkles size={14} aria-hidden /> {busy === 'review' ? 'Reading the session…' : 'What came out of this'}
            </button>
          )}
        </div>
      </form>

      {error && <p className="talk-error" role="alert">{error}</p>}
      {session?.review && <Review review={session.review} busy={!!busy} onAct={act} />}
    </div>
  );
}

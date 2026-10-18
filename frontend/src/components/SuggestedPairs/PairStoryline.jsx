/**
 * A storyline from a kept pair, on the Relationship Map (Evoni's idea 4,
 * PR 3, 2026-10-17; services/pairStorylines). Opening it asks for one
 * suggestion: a title and premise for a Pulse storyline between the two,
 * with who of them can post in this show yet. Nothing is saved until Evoni
 * presses Start: that makes the storyline on The Pulse, where Suggest beats
 * plans its plants, builds and payoff. Lala's relationships never get one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './SuggestedPairs.css';

const STORYLINES = '/admin?tab=pulse&sub=storylines';
const at = (h) => `@${String(h || '').replace(/^@+/, '')}`;

export default function PairStoryline({ relationshipId, showId, onClose }) {
  const [seed, setSeed] = useState(null);
  const [form, setForm] = useState({ title: '', premise: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(null);

  const suggest = useCallback(async () => {
    setBusy('suggest');
    setError(null);
    try {
      const res = await api.post(`/api/v1/feed-relationships/${relationshipId}/storyline-seed`, { show_id: showId });
      setSeed(res.data);
      setForm({ title: res.data?.title || '', premise: res.data?.premise || '' });
    } catch (err) {
      console.error('[PairStoryline] suggesting a storyline failed:', err);
      setError(err.response?.data?.error || 'Suggesting a storyline failed. Try again.');
    } finally {
      setBusy(null);
    }
  }, [relationshipId, showId]);
  // One suggestion on opening (the ref keeps a dev double-mount from asking twice).
  const asked = useRef(false);
  useEffect(() => {
    if (!showId || asked.current) return;
    asked.current = true;
    suggest();
  }, [suggest, showId]);

  const start = async () => {
    setBusy('start');
    setError(null);
    try {
      const res = await api.post('/api/v1/pulse-storylines', { show_id: showId, title: form.title.trim(), premise: form.premise.trim() });
      setStarted(res.data?.storyline || {});
    } catch (err) {
      console.error('[PairStoryline] starting the storyline failed:', err);
      setError(err.response?.data?.error || 'Starting the storyline failed.');
    } finally {
      setBusy(null);
    }
  };

  const pair = seed?.pair;
  return (
    <section className="sp sp-story" data-testid="pair-storyline" aria-label="A storyline for this pair">
      <div className="sp-head">
        <strong className="sp-who">{pair ? `A storyline for ${at(pair.a.handle)} and ${at(pair.b.handle)}` : 'A storyline for this pair'}</strong>
        <button type="button" className="sp-btn" onClick={onClose}>Close</button>
      </div>
      {!showId && <p className="sp-note">Choose a show first: a storyline runs on that show's Pulse.</p>}
      {busy === 'suggest' && <p className="sp-note" role="status">Suggesting a storyline…</p>}
      {started ? (
        <p className="sp-note" role="status">
          Started “{started.title || form.title}”. <Link to={STORYLINES}>Plan its beats on The Pulse</Link>.
        </p>
      ) : seed && (
        <>
          <label className="sp-field">Title
            <input value={form.title} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="sp-field">Premise
            <textarea rows={4} value={form.premise} maxLength={4000} onChange={(e) => setForm((f) => ({ ...f, premise: e.target.value }))} />
          </label>
          <p className="sp-note">
            {seed.can_post?.length ? `Can post in this show now: ${seed.can_post.join(', ')}.` : 'Neither can post in this show yet.'}
            {seed.note ? ` ${seed.note}` : ''}
          </p>
          <span className="sp-actions">
            <button type="button" className="sp-btn is-primary" disabled={!!busy || !form.title.trim()} onClick={start}>
              {busy === 'start' ? 'Starting…' : 'Start this storyline'}
            </button>
            <button type="button" className="sp-btn" disabled={!!busy} onClick={suggest}>Suggest another</button>
          </span>
        </>
      )}
      {error && <p className="sp-note is-error" role="alert">{error}</p>}
    </section>
  );
}

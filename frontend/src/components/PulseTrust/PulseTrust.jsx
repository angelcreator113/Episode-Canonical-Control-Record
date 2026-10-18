/**
 * Trust per character (Evoni, 2026-10-18: "yes start trust per character"):
 * how much of their everyday posting waits for her
 * (GET/PUT /api/v1/pulse-trust/profiles/:id; services/pulseTrust).
 * Some things always wait, at any level.
 */
import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import './PulseTrust.css';

export const TRUST_LEVELS = Object.freeze([
  ['review_all', 'Review everything', 'Every post waits for you, even one that passed.'],
  ['trusted', 'Trusted', 'Posts that pass review go out; flagged ones wait for you.'],
  ['full', 'Fully trusted', 'A post flagged only for how it reads goes out too. It shows in the daily update with Undo.'],
]);
const ALWAYS = Object.freeze([
  'Deal announcements',
  'Anything that reveals a secret or a story turn',
  'Anything about Lala',
  'New canon facts',
]);
const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export default function PulseTrust({ profileId }) {
  const [level, setLevel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const base = `/api/v1/pulse-trust/profiles/${profileId}`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(base);
      setLevel(data.level || 'trusted');
    } catch (err) {
      console.error('[PulseTrust] trust could not be read:', err);
      setError(errorText(err, 'Their trust could not be loaded.'));
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const choose = async (next) => {
    if (next === level) return;
    setBusy(true); setError(null); setNote(null);
    try {
      await api.put(base, { level: next });
      setLevel(next);
      setNote('Saved.');
    } catch (err) {
      console.error('[PulseTrust] trust could not be saved:', err);
      setError(errorText(err, 'That did not save. Try again.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="pt" data-testid="pulse-trust" aria-labelledby={`pt-h-${profileId}`}>
      <h4 id={`pt-h-${profileId}`} className="pt-title"><ShieldCheck size={15} aria-hidden /> Trust on The Pulse</h4>
      {level === null && !error && <p className="pt-muted">Loading…</p>}
      {level !== null && (
        <div className="pt-levels" role="radiogroup" aria-label="Trust on The Pulse">
          {TRUST_LEVELS.map(([key, label, why]) => (
            <label key={key} className={`pt-level${level === key ? ' is-on' : ''}`}>
              <input type="radio" name={`pt-${profileId}`} value={key} checked={level === key} disabled={busy} onChange={() => choose(key)} />
              <span className="pt-label">{label}</span>
              <span className="pt-why">{why}</span>
            </label>
          ))}
        </div>
      )}
      <p className="pt-muted">Always waits for you, at any level: {ALWAYS.join('; ')}.</p>
      {note && <p className="pt-muted" role="status">{note}</p>}
      {error && <p className="pt-error" role="alert">{error}</p>}
    </section>
  );
}

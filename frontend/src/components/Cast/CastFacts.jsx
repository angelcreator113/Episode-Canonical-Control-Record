/**
 * The cast rollout (Character Consistency Engine; Evoni, 2026-10-17: "start
 * the cast rollout"): on The Cast page, every character's facts, check
 * findings, voice and type, with what is left for each, the next step
 * first, so the cast can be worked through the way Maren was. Each name
 * opens the character's page, where every step is taken.
 * Read from GET /api/v1/cast/consistency (services/castConsistency); it runs
 * every character's check, so it loads when opened. Styles: TheCast.css
 * (cast-facts-*). Fix what can be fixed runs the steps for her: CastFixAll.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import CastFixAll from './CastFixAll';

const FACT_ORDER = [
  ['handle', 'Handle'], ['followers', 'Followers'], ['account_status', 'Status'],
  ['occupation', 'Work'], ['income', 'Income'], ['major_possessions', 'Owns'],
];
const STATE_WORDS = { set: 'set', estimate: 'estimate', undecided: 'not decided', missing: 'missing' };
const VOICE_WORDS = { none: 'No voice', built: 'Voice built', approved: 'Voice approved' };

export default function CastFacts({ registryIds }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const key = (registryIds || []).join(',');
  // Another registry in view: the old results are not its.
  useEffect(() => { setData(null); setError(null); }, [key]);

  const load = async () => {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/cast/consistency?registry_id=${encodeURIComponent(key)}`);
      setData(res.data);
    } catch (err) {
      console.error('[CastFacts] the cast check failed:', err);
      setError(err.response?.data?.error || 'Could not check the cast.');
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.characters || [];
  const s = data?.summary;
  return (
    <section className="cast-world" aria-labelledby="cast-facts-heading" data-testid="cast-facts">
      <div className="cast-section-head">
        <h2 id="cast-facts-heading" className="cast-h2">Facts &amp; checks</h2>
        <span className="cast-note">Every character&rsquo;s facts, findings and voice, with what is left. Open a name to do it.</span>
      </div>
      <button type="button" className="cast-btn-soft cast-facts-run" disabled={busy || !key} onClick={load}>
        {busy ? 'Checking the cast…' : data ? 'Check again' : 'Check the whole cast'}
      </button>
      <CastFixAll registryIds={registryIds} onDone={load} />
      {error && <p className="cast-note" role="alert">{error}</p>}
      {s && (
        <p className="cast-note" data-testid="cast-facts-summary">
          {s.characters} character{s.characters === 1 ? '' : 's'} · {s.ready} ready · {s.with_findings} with findings · {s.without_voice} without a voice
        </p>
      )}
      {rows.length > 0 && (
        <ul className="cast-facts-list">
          {rows.map((r) => (
            <li key={r.id} className="cast-facts-row" data-testid="cast-facts-row">
              <span className="cast-facts-who">
                <Link to={`/character/${r.id}`}><strong>{r.name}</strong></Link>
                {r.handle && <span className="cast-note"> {r.handle}</span>}
              </span>
              {r.ready
                ? <span className="cast-chip is-green">Ready</span>
                : (
                  <span className="cast-facts-todo">
                    <strong>Next: {r.todo[0]}</strong>
                    {r.todo.length > 1 && <span className="cast-note">Then: {r.todo.slice(1).join(' · ')}</span>}
                  </span>
                )}
              <span className="cast-chips">
                {r.findings != null && (
                  <span className={r.findings ? 'cast-chip is-gold' : 'cast-chip is-green'}>
                    {r.findings ? `${r.findings} finding${r.findings === 1 ? '' : 's'}` : 'No findings'}
                  </span>
                )}
                <span className={r.voice === 'none' ? 'cast-chip is-gold' : 'cast-chip is-lavender'}>{VOICE_WORDS[r.voice]}</span>
                <span className="cast-chip is-lavender">{r.typology || 'No type yet'}</span>
              </span>
              <span className="cast-facts-facts">
                {FACT_ORDER.map(([k, label]) => (
                  <span key={k} className={`cast-facts-fact is-${r.facts[k]}`}>{label}: {STATE_WORDS[r.facts[k]]}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

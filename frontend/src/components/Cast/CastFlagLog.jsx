/**
 * Where profiles break most (Character Consistency Engine, the spec's #4;
 * Evoni, 2026-10-17: "start the fact history and flag log"): every flag the
 * consistency check has raised across the cast, resolved ones too, counted
 * by check, by field and by character, so the generators can be improved
 * where they actually break. Read from GET /api/v1/cast/flag-log
 * (services/flagLog); it loads when asked. The log fills as checks run (on
 * a character's page, or "Check the whole cast"). Styles: TheCast.css
 * (cast-log-*).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const CHECK_LABELS = {
  followers: 'Follower count', account_status: 'Account status', handle: 'Handle',
  social_name: 'Social media name', affordability: 'Can afford',
};

function Counts({ row }) {
  return (
    <span className="cast-note">
      {row.total} raised · {row.open} open · {row.resolved} resolved{row.intentional ? ` · ${row.intentional} intentional` : ''}
    </span>
  );
}

export default function CastFlagLog({ registryIds }) {
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
      const res = await api.get(`/api/v1/cast/flag-log?registry_id=${encodeURIComponent(key)}`);
      setData(res.data);
    } catch (err) {
      console.error('[CastFlagLog] the flag log could not be read:', err);
      setError(err.response?.data?.error || 'Could not read the flag log.');
    } finally {
      setBusy(false);
    }
  };

  const t = data?.totals;
  return (
    <section className="cast-world" aria-labelledby="cast-log-heading" data-testid="cast-log">
      <div className="cast-section-head">
        <h2 id="cast-log-heading" className="cast-h2">Where profiles break most</h2>
        <span className="cast-note">Every finding the check has raised, fixed ones too, so the generators can be fixed where they go wrong.</span>
      </div>
      <button type="button" className="cast-btn-soft cast-facts-run" disabled={busy || !key} onClick={load}>
        {busy ? 'Reading the log…' : data ? 'Read again' : 'Show the flag log'}
      </button>
      {error && <p className="cast-note" role="alert">{error}</p>}
      {t && (
        <p className="cast-note" data-testid="cast-log-summary">
          {t.total === 0
            ? 'Nothing logged yet. Each check, on a character’s page or across the whole cast, adds what it finds.'
            : `${t.total} finding${t.total === 1 ? '' : 's'} logged: ${t.open} open, ${t.resolved} resolved, ${t.intentional} intentional.`}
        </p>
      )}
      {t && t.total > 0 && (
        <div className="cast-log-grid">
          <div className="cast-log-col" data-testid="cast-log-checks">
            <h3 className="cast-log-h">By check</h3>
            <ol className="cast-log-list">
              {data.by_check.map((r) => (
                <li key={r.check_key}><strong>{CHECK_LABELS[r.check_key] || r.check_key}</strong><Counts row={r} /></li>
              ))}
            </ol>
          </div>
          <div className="cast-log-col" data-testid="cast-log-fields">
            <h3 className="cast-log-h">By field</h3>
            <ol className="cast-log-list">
              {data.by_field.map((r) => (
                <li key={r.field}><strong>{r.field}</strong><Counts row={r} /></li>
              ))}
            </ol>
          </div>
          <div className="cast-log-col" data-testid="cast-log-characters">
            <h3 className="cast-log-h">By character</h3>
            <ol className="cast-log-list">
              {data.by_character.map((r) => (
                <li key={r.id}><Link to={`/character/${r.id}`}><strong>{r.name || 'Unnamed'}</strong></Link><Counts row={r} /></li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

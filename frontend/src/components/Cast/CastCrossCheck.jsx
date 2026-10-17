/**
 * Across the cast (Character Consistency Engine, the spec's #2; Evoni,
 * 2026-10-17: "start the cross-character checks"): contradictions between
 * characters, not within one. A post that puts someone at an event they
 * were not at, or names one they could not know about yet; one character's
 * profile giving another the wrong follower count or account status.
 * Flag-only: each finding names whose post or profile says it and opens
 * their page, where it is changed. Read from GET /api/v1/cast/cross-check
 * (services/castCrossCheck); it loads when asked. Styles: TheCast.css
 * (cast-cross-*).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const CHECK_LABELS = {
  at_event: 'At an event they weren’t at',
  knows_event: 'Knows what they couldn’t know',
  other_followers: 'Another character’s followers',
  other_status: 'Another character’s status',
};

export default function CastCrossCheck({ registryIds }) {
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
      const res = await api.get(`/api/v1/cast/cross-check?registry_id=${encodeURIComponent(key)}`);
      setData(res.data);
    } catch (err) {
      console.error('[CastCrossCheck] the check across the cast failed:', err);
      setError(err.response?.data?.error || 'Could not check across the cast.');
    } finally {
      setBusy(false);
    }
  };

  const flags = data?.flags || [];
  const s = data?.summary;
  return (
    <section className="cast-world" aria-labelledby="cast-cross-heading" data-testid="cast-cross">
      <div className="cast-section-head">
        <h2 id="cast-cross-heading" className="cast-h2">Across the cast</h2>
        <span className="cast-note">Where characters contradict each other: who was where, who knew what, and what one says about another.</span>
      </div>
      <button type="button" className="cast-btn-soft cast-facts-run" disabled={busy || !key} onClick={load}>
        {busy ? 'Checking across the cast…' : data ? 'Check again' : 'Check across the cast'}
      </button>
      {error && <p className="cast-note" role="alert">{error}</p>}
      {s && (
        <p className="cast-note" data-testid="cast-cross-summary">
          {s.flags === 0
            ? `No contradictions between ${s.characters} character${s.characters === 1 ? '' : 's'} (${s.posts_checked} post${s.posts_checked === 1 ? '' : 's'} checked).`
            : `${s.flags} contradiction${s.flags === 1 ? '' : 's'} involving ${s.characters_flagged} character${s.characters_flagged === 1 ? '' : 's'} (${s.characters} checked, ${s.posts_checked} post${s.posts_checked === 1 ? '' : 's'}).`}
        </p>
      )}
      {flags.length > 0 && (
        <ul className="cast-facts-list">
          {flags.map((f) => (
            <li key={f.id} className="cast-facts-row cast-cross-row" data-testid="cast-cross-row">
              <span className="cast-chips">
                <span className="cast-chip is-gold">{CHECK_LABELS[f.check] || f.check}</span>
                <span className="cast-note">{f.where}</span>
              </span>
              <span className="cast-cross-what">
                <Link to={`/character/${f.character_id}`}><strong>{f.character_name}</strong></Link>
                {': '}{f.found}; but {f.expected}.
              </span>
              {f.excerpt && <span className="cast-cross-excerpt">&ldquo;{f.excerpt}&rdquo;</span>}
              {f.other_id && (
                <span className="cast-note">
                  About <Link to={`/character/${f.other_id}`}>{f.other_name}</Link>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

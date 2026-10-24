/**
 * Season Plan › What the season knows (Evoni's review, 2026-10-24, item
 * 19): what the season's AI (the slot drafter, Draft the season, the
 * proposals) already reads of the story so far: the latest approved "What
 * changed" record and the open follow-ups (GET /season/knows, the same
 * reads as services/storyCarryForward). A small fold; read-only.
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import './SeasonKnows.css';

const words = (v) => String(v || '').replace(/_/g, ' ');

/** The fold's summary line: the record's episode and how many follow-ups. */
export function knowsSummary({ record, follow_ups: followUps = [] } = {}) {
  const parts = [];
  if (record) parts.push(`Episode ${record.episode_number ?? '?'}`);
  if (followUps.length) parts.push(`${followUps.length} ${followUps.length === 1 ? 'follow-up' : 'follow-ups'}`);
  return parts.length ? parts.join(' · ') : 'nothing yet';
}

export default function SeasonKnows({ showId, api }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/knows`);
      setData({ record: r.data?.record || null, follow_ups: r.data?.follow_ups || [] });
      setFailed(null);
    } catch (err) {
      console.error('[SeasonKnows] load failed:', err);
      setFailed(err.response?.data?.error || err.message || 'failed');
    }
  }, [api, showId]);
  useEffect(() => { load(); }, [load]);

  const record = data?.record;
  const followUps = data?.follow_ups || [];
  return (
    <details className="skn-card" data-testid="season-knows">
      <summary className="skn-summary">
        <BookOpenCheck size={16} aria-hidden="true" />
        <span className="skn-title">What the season knows</span>
        <span className="skn-count">{data ? knowsSummary(data) : failed ? 'not loaded' : '…'}</span>
      </summary>
      <div className="skn-body">
        <p className="skn-about">What the season&apos;s AI reads before it drafts a slot, drafts the season or proposes changes.</p>
        {failed && (
          <p className="skn-note is-error" role="alert">
            It did not load ({failed}). <button type="button" className="skn-btn" onClick={load}>Retry</button>
          </p>
        )}
        {data && !record && !followUps.length && (
          <p className="skn-note">Nothing yet. Once an episode&apos;s What changed record is approved, its story and what Lala still owes people show here.</p>
        )}
        {record && (
          <section className="skn-part" data-testid="season-knows-record">
            <h4 className="skn-h">Last approved: Episode {record.episode_number ?? '?'}{record.title ? `, “${record.title}”` : ''}</h4>
            {record.what_happened && <p className="skn-text">{record.what_happened}</p>}
            {record.relationships?.length > 0 && (
              <ul className="skn-list" aria-label="Where relationships stand">
                {record.relationships.map((r, i) => (
                  <li key={i}>{r.a_name || '?'} and {r.b_name || '?'}{r.type ? `: ${r.is_romantic ? 'love interest' : words(r.type)}` : ''}{r.stage_after ? `, now ${words(r.stage_after)}` : ''}</li>
                ))}
              </ul>
            )}
            {record.threads?.length > 0 && <p className="skn-text"><strong>Left open:</strong> {record.threads.map((t) => t.title).filter(Boolean).join('; ')}</p>}
          </section>
        )}
        {followUps.length > 0 && (
          <section className="skn-part" data-testid="season-knows-follow-ups">
            <h4 className="skn-h">What Lala still owes people</h4>
            <ul className="skn-list">
              {followUps.map((f) => (
                <li key={f.id}>{f.text}{f.due_hint ? <span className="skn-meta"> · due {f.due_hint}</span> : null}{f.episode_number != null ? <span className="skn-meta"> · from Episode {f.episode_number}</span> : null}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}

/**
 * Production coverage (docs/EVENT_EPISODE_FLOW.md §8(o) item 2; Evoni,
 * 2026-10-03, episode creation step 8): per canonical beat, Environment,
 * JustAWoman clip, Lala clip and Interface, each required, not required or
 * decided per episode, and whether it is met. One Continue opens where the
 * first missing thing is made: the Scenes tab for a set, the Overlays tab
 * for an interface asset.
 *
 * Reads GET /episode-brief/:episodeId/production-coverage. Performance
 * clips have no live home yet, so those two indicators read "not tracked
 * yet" rather than missing. Nothing here writes.
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';

const INDICATORS = [
  { key: 'environment', short: 'Set' },
  { key: 'host', short: 'JAW' },
  { key: 'character', short: 'Lala' },
  { key: 'interface', short: 'UI' },
];
const CONTINUE_TAB = { environment: 'scenes', interface: 'overlays' };
const TEAL = '#2F7F76';
const PINK = '#C06E87';

function cell(ind) {
  if (ind.requirement === 'not_required') return { mark: '—', title: 'Not required', color: '#b8b0a6' };
  if (ind.requirement === 'per_episode' && ind.met !== true) return { mark: 'ep', title: 'Decided per episode', color: '#7a6d62' };
  if (ind.met === true) return { mark: '✓', title: ind.text || 'Ready', color: TEAL };
  if (ind.met === null) return { mark: '?', title: ind.text || 'Not tracked yet', color: '#7a6d62' };
  return { mark: '○', title: ind.text || 'Missing', color: PINK };
}

export default function ProductionCoveragePanel({ episodeId }) {
  const [coverage, setCoverage] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/episode-brief/${episodeId}/production-coverage`)
      .then((res) => { if (!cancelled) setCoverage(res.data?.data || null); })
      .catch((err) => {
        console.error('[ProductionCoverage] load failed:', err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [episodeId]);

  if (failed) return <div data-testid="coverage-failed" style={{ fontSize: 12, color: PINK, marginBottom: 8 }}>Production coverage could not be loaded.</div>;
  if (!coverage) return null;
  const { required, met, untracked, covered, total, next, beats } = coverage;
  const tab = next ? CONTINUE_TAB[next.indicator] : null;

  return (
    <div data-testid="production-coverage" style={{
      marginBottom: 8, padding: '8px 10px', borderRadius: 8,
      background: '#FBEFF3', border: '1px solid #F5D5DF', fontSize: 12, color: '#2C2C2C',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }}>
        <strong>Production coverage</strong>
        <span data-testid="coverage-summary">
          {met} of {required} required ready{untracked ? ` · ${untracked} not tracked yet (clips have no home yet)` : ''} · {covered} of {total} beats covered
        </span>
      </div>
      {next ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span data-testid="coverage-next" style={{ flex: '1 1 180px', minWidth: 0 }}>
            <strong>Next:</strong> Beat {next.beat_number} · {next.beat_name}: {next.label}{next.text ? ` (${next.text})` : ''}
          </span>
          {tab && (
            <a
              data-testid="coverage-continue" href={`/episodes/${episodeId}?tab=${tab}`}
              style={{ padding: '3px 10px', borderRadius: 6, background: TEAL, color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
            >
              Continue →
            </a>
          )}
        </div>
      ) : (
        <div data-testid="coverage-next-none" style={{ marginTop: 6, color: TEAL }}>Everything that can be checked is ready.</div>
      )}
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="coverage-toggle"
        style={{ marginTop: 6, padding: 0, border: 'none', background: 'none', color: TEAL, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
      >
        {open ? 'Hide beats' : 'Show beats'}
      </button>
      {open && (
        <table data-testid="coverage-grid" style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 4px' }}>Beat</th>
              {INDICATORS.map((i) => <th key={i.key} style={{ fontWeight: 600, padding: '2px 4px' }}>{i.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {beats.map((b) => (
              <tr key={b.number} data-testid={`coverage-beat-${b.number}`} data-covered={b.covered ? 'true' : 'false'}>
                <td style={{ padding: '2px 4px' }}>{b.number}. {b.name}</td>
                {INDICATORS.map((i) => {
                  const c = cell(b.indicators[i.key]);
                  return (
                    <td key={i.key} title={c.title} data-testid={`coverage-${b.number}-${i.key}`} style={{ textAlign: 'center', color: c.color, fontWeight: 700, padding: '2px 4px' }}>
                      {c.mark}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

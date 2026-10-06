/**
 * Production → Checklist as a hub (Evoni's Episode mock, 2026-10-05): the
 * progress card, the episode timeline (a row per kind of piece, a column
 * per beat, from GET /episode-brief/:id/production-coverage) and a card per
 * checklist section. Helpers: lib/checklistHub.js.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import api from '../../services/api';
import { timelineGrid, CELL_LEGEND } from '../../lib/checklistHub';
import './ChecklistHub.css';

export function ProductionSummary({ done, total, loading, onRefresh }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <section className="ckh-summary" data-testid="checklist-summary">
      <div className="ckh-summary-head">
        <h2 className="ckh-summary-title">Production</h2>
        <span className="ckh-summary-sub">Everything this episode needs before it can be finalized</span>
        <span className="ckh-summary-count" data-testid="checklist-count"><strong>{done}</strong> of {total}</span>
        <button type="button" className="ckh-refresh" onClick={onRefresh} disabled={loading} aria-label="Check again">↻</button>
      </div>
      <div className="ckh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="ckh-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

export function EpisodeTimeline({ episodeId, lookReady, version = 0 }) {
  const [coverage, setCoverage] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/episode-brief/${episodeId}/production-coverage`)
      .then((res) => { if (!cancelled) { setCoverage(res.data?.data || null); setFailed(false); } })
      .catch((err) => { console.error('[ChecklistHub] coverage load failed:', err); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [episodeId, version]);
  const grid = timelineGrid(coverage, { lookReady });
  return (
    <section className="ckh-timeline" data-testid="episode-timeline">
      <div className="ckh-timeline-head">
        <h2 className="ckh-card-title">Episode timeline</h2>
        <span className="ckh-timeline-sub">What each beat has so far.{grid && grid.covered != null ? ` ${grid.covered} of ${grid.total} beats covered.` : ''}</span>
        <Link className="ckh-timeline-open" to={`/episodes/${episodeId}/timeline`} data-testid="episode-timeline-open">
          Open in Timeline Editor <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {!grid ? (
        <p className="ckh-muted">{failed ? 'The timeline could not be read.' : 'No beat plan yet.'}</p>
      ) : (
        <>
          <div className="ckh-grid-scroll">
            <table className="ckh-grid">
              <thead>
                <tr>
                  <th scope="col"><span className="ckh-sr">Piece</span></th>
                  {grid.beats.map((b) => <th key={b.number} scope="col" title={b.name}>Beat {b.number}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.key} data-testid={`episode-timeline-row-${row.key}`}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((c, i) => (
                      <td key={grid.beats[i].number}>
                        <span className={`ckh-cell is-${c.state}`} data-state={c.state} title={`Beat ${grid.beats[i].number} · ${grid.beats[i].name}${c.text ? ` · ${c.text}` : ''}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ckh-legend">
            {CELL_LEGEND.map((l) => <li key={l.state}><span className={`ckh-cell is-${l.state}`} aria-hidden="true" /> {l.label}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

const TONE = { complete: 'is-complete', in_progress: 'is-progress', needs_setup: 'is-setup', unavailable: 'is-unavailable' };

export function SectionCard({ section, state, chip, count, guide, children, open }) {
  return (
    <section className={`ckh-card ${TONE[state.state] || ''}`} data-testid={`checklist-section-${section.id}`}>
      <div className="ckh-card-head">
        <h3 className="ckh-card-title">{section.label}</h3>
        <span className={`ckh-chip ${TONE[state.state] || ''}`}>{chip}</span>
      </div>
      <p className="ckh-card-text">{guide?.text || state.why}</p>
      {guide?.text && <p className="ckh-card-why">{state.why} · {count[0]} of {count[1]}</p>}
      {children}
      {open}
    </section>
  );
}

export function CheckBox({ checked, required = false }) {
  return (
    <span className={`ckh-box${checked ? ' is-on' : required ? ' is-required' : ''}`} aria-hidden="true">{checked && <Check size={11} />}</span>
  );
}

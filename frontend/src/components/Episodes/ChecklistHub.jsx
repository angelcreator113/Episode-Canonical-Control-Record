/**
 * Production → Checklist as a command center: the summary (what is required,
 * what is preparation, what could not be read, where to go next), the beat
 * problems that stop filming, the episode timeline (a row per kind of piece,
 * a column per beat, from GET /episode-brief/:id/production-coverage), and a
 * card per checklist section inside its stage. Helpers: lib/checklistHub.js.
 *
 * Presentation only. Every number and every destination comes from an
 * authority that already existed — productionSteps, episodeOverview.nextStep,
 * planReadiness, computeSectionState, checklistProgress, checklistReadability
 * — and nothing here computes readiness, completion or production state.
 */
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Lock } from 'lucide-react';
import api from '../../services/api';
import { timelineGrid, CELL_LEGEND, beatList } from '../../lib/checklistHub';
import './ChecklistHub.css';

/**
 * What this episode needs, in the three kinds Evoni ruled apart (2026-11-27):
 *   requirements  the eight required checklist items. They are NOT a gate:
 *                 production continues with them outstanding, and the card
 *                 says so rather than implying a lock that does not exist.
 *   preparation   the sixteen optional items.
 *   couldn't check  checklistReadability's unreadable count — an answer whose
 *                 source could not be read, which is not missing work.
 * `currentStep` is productionSteps' current step and `recommended` is
 * episodeOverview.nextStep: two different questions, kept apart, with no
 * third opinion formed here.
 */
/**
 * `answered` is whether any answers have been read yet. Without it the
 * counts would read 0 of 8 before anything had been checked — "nothing is
 * done" stated as fact, when the truth is "not known yet" (Evoni,
 * 2026-11-27: readiness that is not current is never presented as verified).
 * The totals are the checklist's own fixed shape, so "— of 8" is honest.
 */
export function ProductionSummary({
  requirements, preparation, unreadable = 0, currentStep = null, recommended = null,
  loading, refreshing = false, stale = false, answered = true, onRefresh,
}) {
  const [rDone, rTotal] = requirements;
  const [pDone, pTotal] = preparation;
  const total = rTotal + pTotal;
  const pct = answered && total > 0 ? Math.round(((rDone + pDone) / total) * 100) : 0;
  const currency = stale ? 'stale' : refreshing ? 'updating' : 'current';
  // What the numbers are replaced by while there is no answer to show. There
  // is only ever one such moment: `answered` is false only before the first
  // result lands, and a read is in flight for the whole of it — a read that
  // FAILS still writes an answer per item (the unreadable ones are marked as
  // such), so "nothing read yet" and "nothing in flight" never coincide.
  const blank = 'checking…';
  const score = (done, of) => (answered
    ? <><strong>{done}</strong> of {of}</>
    : <><span className="ckh-score-blank">—</span> of {of}</>);
  return (
    <section className={`ckh-summary is-${currency}`} data-testid="checklist-summary" data-currency={currency}>
      <div className="ckh-summary-head">
        <h2 className="ckh-summary-title">This episode's checklist</h2>
        <span className="ckh-summary-count" data-testid="checklist-count">{score(rDone + pDone, total)}</span>
        <button type="button" className="ckh-refresh" onClick={onRefresh} disabled={loading} aria-label="Check again">↻</button>
      </div>

      <div className="ckh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total}
        aria-valuenow={answered ? rDone + pDone : undefined}
        aria-valuetext={answered ? undefined : blank}>
        <div className="ckh-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <dl className="ckh-kinds">
        <div className="ckh-kind is-required" data-testid="ckh-kind-required">
          <dt>Requirements</dt>
          <dd>{score(rDone, rTotal)}</dd>
          <p className="ckh-kind-note">
            {!answered
              ? 'Still checking…'
              : rDone === rTotal
                ? 'All of them are done.'
                : 'These need attention. They do not stop you continuing production.'}
          </p>
        </div>
        <div className="ckh-kind is-optional" data-testid="ckh-kind-preparation">
          <dt>Preparation</dt>
          <dd>{score(pDone, pTotal)}</dd>
          <p className="ckh-kind-note">Worth doing; none of it is required.</p>
        </div>
        {unreadable > 0 && (
          <div className="ckh-kind is-unreadable" data-testid="ckh-kind-unreadable">
            <dt>Couldn't check</dt>
            <dd><strong>{unreadable}</strong></dd>
            <p className="ckh-kind-note">Not missing work — these could not be read just now.</p>
          </div>
        )}
      </dl>

      {/* The checklist is not the whole of production: these two lines are the
          only place a next step is named here, and each quotes its own
          authority rather than deciding between them. */}
      {(currentStep || recommended) && (
        <div className="ckh-next-pair" data-testid="ckh-next-pair">
          {currentStep && (
            <p className="ckh-next-line" data-testid="ckh-current-step">
              <span className="ckh-next-label">Production step</span>
              {currentStep.open?.href
                ? <Link to={currentStep.open.href}>{currentStep.label}</Link>
                : <button type="button" className="ckh-linklike" onClick={currentStep.onOpen}>{currentStep.label}</button>}
              {currentStep.detail ? <span className="ckh-next-detail"> · {currentStep.detail}</span> : null}
            </p>
          )}
          {recommended && (
            <p className="ckh-next-line" data-testid="ckh-recommended">
              <span className="ckh-next-label">Suggested next</span>
              {recommended.onOpen
                ? <button type="button" className="ckh-linklike" onClick={recommended.onOpen}>{recommended.title}</button>
                : <span>{recommended.title}</span>}
              {recommended.why ? <span className="ckh-next-detail"> · {recommended.why}</span> : null}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The beats that have a problem, as planReadiness already reported them.
 * Blocking and advisory are shown apart and counted apart: an advisory
 * picture problem is never added to the blocking count, and nothing here
 * restricts an action. Both this and the rows inside Scene Plan read the
 * same `not_ready` list.
 */
export function BeatProblemSummary({ blocking, advisory, onOpenScenePlan }) {
  if (!blocking.length && !advisory.length) return null;
  const beats = (list) => [...new Set(list.map((p) => p.beat))];
  return (
    <section className="ckh-problems" data-testid="ckh-beat-problems" aria-label="Beats that need attention">
      {blocking.length > 0 && (
        <p className="ckh-problem-line is-blocking" data-testid="ckh-problems-blocking">
          <strong>{beats(blocking).length} {beats(blocking).length === 1 ? 'beat needs' : 'beats need'} a usable location</strong>
          <span className="ckh-problem-beats"> — {beatList(beats(blocking))}</span>
          <button type="button" className="ckh-linklike" onClick={onOpenScenePlan} data-testid="ckh-problems-blocking-open">
            See them in Scene Plan
          </button>
        </p>
      )}
      {advisory.length > 0 && (
        <p className="ckh-problem-line is-advisory" data-testid="ckh-problems-advisory">
          <span>{beats(advisory).length} {beats(advisory).length === 1 ? 'beat is' : 'beats are'} waiting on a picture</span>
          <span className="ckh-problem-beats"> — {beatList(beats(advisory))}</span>
          <button type="button" className="ckh-linklike" onClick={onOpenScenePlan} data-testid="ckh-problems-advisory-open">
            See them in Scene Plan
          </button>
        </p>
      )}
    </section>
  );
}

/** An accepted episode refuses the setup writes this page can start. */
export function FrozenNotice({ reason }) {
  return (
    <section className="ckh-frozen" role="status" data-testid="ckh-frozen-notice">
      <Lock size={14} aria-hidden="true" />
      <span>{reason}</span>
    </section>
  );
}

export function EpisodeTimeline({ episodeId, lookReady, lookBeat = null, version = 0 }) {
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
  const grid = timelineGrid(coverage, { lookReady, lookBeat });
  return (
    <section className="ckh-timeline" data-testid="episode-timeline">
      <div className="ckh-timeline-head">
        <h2 className="ckh-card-title">Episode timeline</h2>
        <span className="ckh-timeline-sub">What each beat has so far.{grid && grid.covered != null ? ` ${grid.covered} of ${grid.total} beats covered.` : ''}</span>
        <Link className="ckh-timeline-open" to={`/episodes/${episodeId}/editor`} data-testid="episode-timeline-open">
          Open in the editor <ArrowRight size={14} aria-hidden="true" />
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

/**
 * One stage: a way in to each of its production steps, then its sections.
 *
 * These are NAVIGATION, not status. Step status needs the episode's clips and
 * thumbnail, which this tab does not read — computing it here would either
 * duplicate the production strip's own read or show a second, disagreeing
 * answer. So the strip above the tab stays the one place a step's status and
 * current-step mark live, and this band only offers the step's existing
 * destination (productionSteps' own `open`). Every one of the seven steps
 * appears in its stage, including the four with no checklist section.
 */
export function StageBand({ stage, steps, onOpenStep, children }) {
  return (
    <section className="ckh-stage" data-testid={`ckh-stage-${stage.key}`} aria-label={stage.label}>
      <div className="ckh-stage-head">
        <h2 className="ckh-stage-title">{stage.label}</h2>
        <ul className="ckh-stage-steps" aria-label={`Go to a ${stage.label.toLowerCase()} step`}>
          {steps.map((s) => (
            <li key={s.key} className="ckh-stage-step" data-testid={`ckh-stage-step-${s.key}`}>
              {s.open?.href
                ? <Link to={s.open.href}><span className="ckh-stage-step-n" aria-hidden="true">{s.number}</span>{s.label}</Link>
                : <button type="button" onClick={() => onOpenStep?.(s)}><span className="ckh-stage-step-n" aria-hidden="true">{s.number}</span>{s.label}</button>}
            </li>
          ))}
        </ul>
      </div>
      <div className="ckh-stage-cards">{children}</div>
    </section>
  );
}

export function SectionCard({
  section, state, chip, count, guide, children, open,
  optional = null, optionalCount = null, folded = true, onToggle = null,
}) {
  const bodyId = `${useId()}-optional`;
  const [rDone, rTotal] = count;
  const hasOptional = Boolean(optional) && optionalCount && optionalCount[1] > 0;
  return (
    <section className={`ckh-card ${TONE[state.state] || ''}`} data-testid={`checklist-section-${section.id}`}>
      <div className="ckh-card-head">
        <h3 className="ckh-card-title">{section.label}</h3>
        <span className={`ckh-chip ${TONE[state.state] || ''}`}>{chip}</span>
      </div>
      <p className="ckh-card-text">{guide?.text || state.why}</p>
      <p className="ckh-card-why" data-testid={`ckh-card-counts-${section.id}`}>
        {rTotal > 0 ? <span className="ckh-count-required">{rDone} of {rTotal} required</span> : <span className="ckh-count-required">nothing required</span>}
        {hasOptional && <span className="ckh-count-optional"> · {optionalCount[0]} of {optionalCount[1]} optional</span>}
      </p>
      {children}
      {hasOptional && (
        <>
          <button type="button" className="ckh-fold" aria-expanded={!folded} aria-controls={bodyId}
            data-testid={`ckh-fold-${section.id}`} onClick={onToggle}>
            <ChevronDown size={13} aria-hidden="true" className={folded ? 'is-folded' : ''} />
            {folded ? `Show ${optionalCount[1]} optional` : 'Hide optional'}
          </button>
          <div id={bodyId} hidden={folded} data-testid={`ckh-optional-${section.id}`}>{optional}</div>
        </>
      )}
      {open}
    </section>
  );
}

export function CheckBox({ checked, required = false, unreadable = false }) {
  if (unreadable) return <span className="ckh-box is-unknown" aria-hidden="true">?</span>;
  return (
    <span className={`ckh-box${checked ? ' is-on' : required ? ' is-required' : ''}`} aria-hidden="true">{checked && <Check size={11} />}</span>
  );
}

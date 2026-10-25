/**
 * EventStakesSection — section 6, Story Stakes (Task #1771): career,
 * relationship and the projected challenge in plain words, with the
 * numbers behind View details.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { useState } from 'react';
import {
  Pencil, TrendingUp, HeartHandshake, Gauge, CircleDashed, ChevronDown, ChevronRight, CheckCircle2, Lock, Info,
} from 'lucide-react';
import { COST_READ_ONLY_REASON, STORED_ORIGIN_NOTE } from '../../utils/eventStakes';

export default function EventStakesSection({ used, stakes, projection, fold, openStakesEditor, hints = null }) {
  const [stakesDetailsOpen, setStakesDetailsOpen] = useState(false);
  return (
    <section id="epp-sec-stakes" className={fold.cls('stakes', 'epp-stakes')} data-testid="stakes-section">
      <div className="epp-section-header">
        <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">6.</span> Story Stakes</h2><p className="epp-section-sub">What this night means for her story.</p></div>
        {fold.button('stakes', 'Story Stakes')}
        {!used && (
          <button className="epp-btn epp-btn-small" onClick={openStakesEditor} data-testid="stakes-edit">
            <Pencil size={14} /> Edit stakes
          </button>
        )}
      </div>
      {fold.line('stakes')}
      <div id="epp-body-stakes" className="epp-section-body" hidden={!fold.isOpen('stakes')}>
      {/* The host's usual prestige (EventFieldHints). */}
      {hints}
      <div className="epp-stakes-summary" data-testid="stakes-summary">
        <div className="epp-stake">
          <div className="epp-stake-head"><TrendingUp size={14} aria-hidden="true" /> Career opportunity</div>
          {stakes.career.missing ? (
            <div className="epp-basic-unset">Not set</div>
          ) : (
            <>
              {stakes.career.summary && <p className="epp-stake-text">{stakes.career.summary}</p>}
              {stakes.career.milestone && <p className="epp-stake-text"><span className="epp-stake-lead">Milestone:</span> {stakes.career.milestone}</p>}
              {stakes.career.successUnlock && <p className="epp-stake-text"><span className="epp-stake-lead">If it goes well:</span> {stakes.career.successUnlock}</p>}
            </>
          )}
        </div>
        <div className="epp-stake">
          <div className="epp-stake-head"><HeartHandshake size={14} aria-hidden="true" /> Relationship stakes</div>
          {stakes.relationship.missing ? (
            <div className="epp-basic-unset">Not set</div>
          ) : (
            <>
              {stakes.relationship.summary && <p className="epp-stake-text epp-stake-prose">{stakes.relationship.summary}</p>}
              {stakes.relationship.failConsequence && <p className="epp-stake-text"><span className="epp-stake-lead">If it goes wrong:</span> {stakes.relationship.failConsequence}</p>}
            </>
          )}
        </div>
        <div className="epp-stake" data-testid="stakes-challenge" data-complete={projection.complete ? 'true' : 'false'}>
          <div className="epp-stake-head"><Gauge size={14} aria-hidden="true" /> Challenge</div>
          {projection.complete ? (
            <p className="epp-stake-text">
              <span className="epp-difficulty-chip" style={{ color: projection.label.color, background: projection.label.bg }}>
                {projection.label.text}
              </span>{' '}
              <span className="epp-stake-projected">projected, not the evaluation&apos;s number</span>
            </p>
          ) : (
            <p className="epp-stake-text epp-stake-incomplete">
              <CircleDashed size={13} aria-hidden="true" /> Projection incomplete: {projection.missing.map((m) => m.label).join(', ')} not set.
            </p>
          )}
          {stakes.challenge.pressure && <p className="epp-stake-text">{stakes.challenge.pressure}</p>}
        </div>
      </div>

      <button
        type="button" className="epp-stakes-toggle" aria-expanded={stakesDetailsOpen}
        aria-controls="epp-stakes-details" data-testid="stakes-details-toggle"
        onClick={() => setStakesDetailsOpen((o) => !o)}
      >
        {stakesDetailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {stakesDetailsOpen ? 'Hide details' : 'View details'}
      </button>
      {stakesDetailsOpen && (
        <div id="epp-stakes-details" className="epp-stakes-details" data-testid="stakes-details">
          <dl className="epp-fields">
            {stakes.details.map((d) => (
              <div key={d.key} className={`epp-basic is-${d.state === 'stored' ? 'stored' : 'missing'}`} data-testid={`stakes-detail-${d.key}`} data-state={d.state}>
                <dt>
                  {d.label}
                  <span className="epp-basic-state">
                    {d.state === 'stored' ? <CheckCircle2 size={11} aria-hidden="true" /> : <CircleDashed size={11} aria-hidden="true" />}
                    {' '}{d.state === 'stored' ? 'Stored' : 'Missing'}
                  </span>
                  {d.readOnly && <span className="epp-stake-readonly" title={d.key === 'cost_coins' ? COST_READ_ONLY_REASON : 'Not edited here'}><Lock size={9} aria-hidden="true" /> Read-only</span>}
                </dt>
                <dd>
                  {d.display ? <span className="epp-basic-value">{d.display}</span> : <span className="epp-basic-unset">Not set</span>}
                  {d.note && <div className="epp-stake-note">{d.note}</div>}
                </dd>
              </div>
            ))}
            <div className="epp-basic is-projected" data-testid="stakes-detail-difficulty">
              <dt>Projected difficulty</dt>
              <dd>
                {projection.complete
                  ? <span className="epp-basic-value">{projection.score} of 10 ({projection.label.text})</span>
                  : <span className="epp-basic-unset">Incomplete: {projection.missing.map((m) => m.label).join(', ')} not set</span>}
                <div className="epp-stake-note">
                  A planning projection, not the evaluation&apos;s number. Evaluation reads prestige and deadline type directly and never reads this score.
                </div>
                {projection.notes.map((n) => <div key={n} className="epp-stake-note">{n}</div>)}
              </dd>
            </div>
          </dl>
          <p className="epp-stakes-origin"><Info size={13} aria-hidden="true" /> {STORED_ORIGIN_NOTE}</p>
          <p className="epp-stakes-origin"><Lock size={13} aria-hidden="true" /> {COST_READ_ONLY_REASON}</p>
        </div>
      )}
              </div>
    </section>
  );
}

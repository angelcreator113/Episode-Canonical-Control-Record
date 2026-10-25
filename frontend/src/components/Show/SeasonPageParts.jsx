/**
 * Small pieces the Season page's tabs share (pages/SeasonPage.jsx): the
 * progress bar, a slot's status chip, and a card with its "See all" and add
 * actions. Styled by SeasonPage.css (szn-*).
 */
import { SLOT_STATUS } from '../../lib/seasonPage';

export function SeasonBar({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="szn-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

export function StatusChip({ state }) {
  return <span className={`szn-chip is-${state || 'needs_event'}`}>{SLOT_STATUS[state] || SLOT_STATUS.needs_event}</span>;
}

/** A summary card: a serif title, "See all" (switches tab), the body, and its add button. */
export function SummaryCard({ title, testId, onSeeAll, seeAllLabel = 'See all', add = null, children }) {
  return (
    <section className="szn-card szn-summary" data-testid={testId} aria-label={title}>
      <header className="szn-card-head">
        <h3 className="szn-card-title">{title}</h3>
        {onSeeAll && <button type="button" className="szn-link" onClick={onSeeAll}>{seeAllLabel}</button>}
      </header>
      <div className="szn-summary-body">{children}</div>
      {add}
    </section>
  );
}

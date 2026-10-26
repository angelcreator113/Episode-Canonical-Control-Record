/**
 * "Needs attention" at the top of the Season page's Overview (Evoni,
 * 2026-10-25): one short list of what is waiting, most urgent first, each
 * row a link straight to where it is fixed (a tab, a slot's panel, an
 * event's package, the Release tab). Six rows, then "+N more"; a calm
 * "Nothing waiting" when the season is clear. The items are
 * lib/seasonAttention's attentionItems; nothing is loaded here.
 *
 * Props: items (ranked), hrefFor(link) → the row's address, loading (a
 * source still loading: the list says so instead of "Nothing waiting"),
 * title and headingId (the daily update shows one list per show, each with
 * its own heading; 2026-10-26), testId.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Clapperboard, Gift, Target, CalendarHeart } from 'lucide-react';
import { capAttention, ATTENTION_CAP } from '../../lib/seasonAttention';
import './SeasonAttention.css';

const ICONS = { release: CalendarClock, held: Gift, slots: Clapperboard, goals: Target, events: CalendarHeart };

export default function SeasonAttention({ items = [], hrefFor, loading = false, title = 'Needs attention', headingId = 'satt-title', testId = 'szn-attention' }) {
  const [all, setAll] = useState(false);
  const { shown, more } = capAttention(items, all ? items.length : ATTENTION_CAP);
  return (
    <section className="satt" aria-labelledby={headingId} data-testid={testId}>
      <header className="satt-head">
        <h2 id={headingId} className="satt-title"><AlertCircle size={18} aria-hidden="true" /> {title}</h2>
        {items.length > 0 && <span className="satt-count" data-testid="szn-attention-count">{items.length}</span>}
      </header>
      {items.length === 0 ? (
        <p className="satt-none" data-testid="szn-attention-none" role="status">
          {loading ? 'Checking what is waiting…' : <><CheckCircle2 size={16} aria-hidden="true" /> Nothing waiting. The season is up to date.</>}
        </p>
      ) : (
        <ul className="satt-list">
          {shown.map((item) => {
            const Icon = ICONS[item.kind] || AlertCircle;
            return (
              <li key={item.key}>
                <Link to={hrefFor(item.link)} className={`satt-row is-${item.tone}`} data-testid={`szn-attention-${item.key}`}>
                  <span className="satt-icon" aria-hidden="true"><Icon size={16} /></span>
                  <span className="satt-text">
                    <span className="satt-row-title">{item.title}</span>
                    {item.detail && <span className="satt-row-detail">{item.detail}</span>}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="satt-go" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {more > 0 && (
        <button type="button" className="satt-more" onClick={() => setAll(true)} data-testid="szn-attention-more">+{more} more</button>
      )}
      {all && items.length > ATTENTION_CAP && (
        <button type="button" className="satt-more" onClick={() => setAll(false)}>Show fewer</button>
      )}
    </section>
  );
}

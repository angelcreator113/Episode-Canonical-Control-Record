/**
 * The Season calendar: the Roadmap's Calendar view (Evoni, 2026-10-25:
 * "What else can we improve on the Season page?" … "I want them all";
 * 2026-10-26, round 3). A month grid of the season's release days (the
 * weekly release schedule, as the slot cards and the Release tab show
 * them), the in-world dates of its events and the deadlines (brand deals'
 * dates, the season's start and end). Previous and next month; on a phone
 * the month reads as a list by week instead of a grid. What goes on which
 * day is lib/seasonCalendar's; nothing is loaded here.
 *
 * Props: release (the page's useReleaseSchedule), roadmap, events, opps, arc,
 * onOpenSlot(slotNumber) (a release or event opens its slot's panel).
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock, CalendarHeart, Flag } from 'lucide-react';
import {
  calendarItems, openingMonth, stepMonth, monthLabel, monthGrid, weekList, monthSummary, WEEKDAYS, KIND_LABEL,
} from '../../lib/seasonCalendar';
import { todayIso, formatDay } from '../../lib/releaseSchedule';
import './SeasonCalendar.css';

const ICONS = { release: CalendarClock, event: CalendarHeart, deadline: Flag };

function Item({ item, onOpenSlot, wide = false }) {
  const Icon = ICONS[item.kind];
  const body = (
    <>
      <Icon size={wide ? 16 : 12} aria-hidden="true" />
      <span className="scal-item-text">
        <span className="scal-item-title">{item.title}</span>
        {wide && item.detail && <span className="scal-item-detail">{item.detail}</span>}
      </span>
    </>
  );
  const cls = `scal-item is-${item.kind} is-${item.tone}`;
  const label = `${KIND_LABEL[item.kind]}: ${item.title}${item.detail ? `, ${item.detail}` : ''}`;
  return item.slot_number && onOpenSlot ? (
    <button type="button" className={cls} onClick={() => onOpenSlot(item.slot_number)} title={label} aria-label={`${label}. Open its slot`} data-testid={`scal-${item.key}`}>{body}</button>
  ) : (
    <span className={cls} title={label} data-testid={`scal-${item.key}`}>{body}</span>
  );
}

export default function SeasonCalendar({ release = null, roadmap = null, events = [], opps = [], arc = null, onOpenSlot = null }) {
  const today = todayIso();
  const { items, undated } = useMemo(() => calendarItems({ release: release?.view || null, roadmap, events, opps, arc }), [release, roadmap, events, opps, arc]);
  const [month, setMonth] = useState(null);
  const shown = month || openingMonth(items, today);
  const weeks = monthGrid(shown, items, today);
  const list = weekList(shown, items);
  return (
    <section className="scal" aria-label="Season calendar" data-testid="szn-calendar">
      <header className="scal-head">
        <button type="button" className="scal-nav" onClick={() => setMonth(stepMonth(shown, -1))} aria-label="Previous month" data-testid="scal-prev"><ChevronLeft size={18} aria-hidden="true" /></button>
        <h3 className="scal-month" data-testid="scal-month">{monthLabel(shown)}</h3>
        <button type="button" className="scal-nav" onClick={() => setMonth(stepMonth(shown, 1))} aria-label="Next month" data-testid="scal-next"><ChevronRight size={18} aria-hidden="true" /></button>
        <span className="scal-summary szn-muted" data-testid="scal-summary">{monthSummary(shown, items)}</span>
      </header>
      <ul className="scal-legend" aria-label="Key">
        <li className="is-release"><CalendarClock size={14} aria-hidden="true" /> Release</li>
        <li className="is-event"><CalendarHeart size={14} aria-hidden="true" /> In-world event</li>
        <li className="is-deadline"><Flag size={14} aria-hidden="true" /> Deadline</li>
      </ul>
      {!release?.view && !release?.error && <p className="szn-muted" role="status">Reading the release schedule…</p>}

      {/* Wide: the month grid. */}
      <table className="scal-grid" data-testid="scal-grid">
        <thead><tr>{WEEKDAYS.map((d) => <th key={d} scope="col">{d}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((d) => (
                <td key={d.date} className={`${d.inMonth ? '' : 'is-out'}${d.today ? ' is-today' : ''}`.trim() || undefined} data-testid={`scal-day-${d.date}`}>
                  <span className="scal-day">{d.day}</span>
                  <div className="scal-day-items">{d.items.map((i) => <Item key={i.key} item={i} onOpenSlot={onOpenSlot} />)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone: the month as a list by week. */}
      <div className="scal-weeks" data-testid="scal-weeks">
        {list.length === 0 ? <p className="szn-muted">Nothing dated this month.</p> : list.map((w) => (
          <section key={w.start} className="scal-week" aria-label={w.label}>
            <h4 className="scal-week-title">{w.label}</h4>
            <ul className="scal-week-list">
              {w.items.map((i) => (
                <li key={i.key}>
                  <span className="scal-week-day">{formatDay(i.date)}</span>
                  <Item item={i} onOpenSlot={onOpenSlot} wide />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {undated > 0 && (
        <p className="szn-muted scal-undated" data-testid="scal-undated">
          {undated} {undated === 1 ? 'event has its' : 'events have their'} in-world date in words, so {undated === 1 ? 'it is' : 'they are'} not on a day. Give {undated === 1 ? 'it' : 'them'} a date in the Event Package to place {undated === 1 ? 'it' : 'them'} here.
        </p>
      )}
    </section>
  );
}

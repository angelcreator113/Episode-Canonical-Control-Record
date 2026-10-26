/**
 * EventSlotNav — the events before and after this one in the season's slot
 * order, in the Event Package's header (Evoni, 2026-10-25): "‹ E4" and
 * "E6 ›", each opening that slot's event (or its episode, when the slot
 * names none) and keeping where she came from. Hidden when the event is in
 * no slot, or its slot has no neighbour either way. Open slots are skipped.
 * The order comes from GET .../season/roadmap (lib/eventFlow slotNeighbours).
 */
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './EventSlotNav.css';

export default function EventSlotNav({ neighbours }) {
  const { prev, next, current } = neighbours || {};
  if (!current || (!prev && !next)) return null;
  const label = (n, dir) => `${dir} in the season: ${n.code}${n.name ? ` · ${n.name}` : ''}`;
  return (
    <nav className="esn" aria-label="Season order" data-testid="slot-nav">
      {prev?.href ? (
        <Link className="esn-link" to={prev.href} aria-label={label(prev, 'Previous')} title={prev.name || undefined} data-testid="slot-nav-prev">
          <ChevronLeft size={16} aria-hidden="true" /> {prev.code}
        </Link>
      ) : <span className="esn-link is-none" aria-hidden="true"><ChevronLeft size={16} /></span>}
      <span className="esn-current" data-testid="slot-nav-current">{current}</span>
      {next?.href ? (
        <Link className="esn-link" to={next.href} aria-label={label(next, 'Next')} title={next.name || undefined} data-testid="slot-nav-next">
          {next.code} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : <span className="esn-link is-none" aria-hidden="true"><ChevronRight size={16} /></span>}
    </nav>
  );
}

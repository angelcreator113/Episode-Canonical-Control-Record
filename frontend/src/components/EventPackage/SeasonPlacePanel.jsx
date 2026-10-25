/**
 * SeasonPlacePanel — "Its place in the season", in the Event Package's
 * header (Evoni, 2026-10-25): under the slot line (S1 · E5 · Phase 1:
 * Foundation), the slot's story purposes, primary first, with its desired
 * pressure; the goals this event moves and by how much ("+600 coins" on the
 * goal's chip, EventGoalPins, which still pins); and its episode's release
 * day. In no slot it is one line: "Not placed in the season yet · Place it",
 * to the Season page's Events tab under Not placed yet, with the goal pins.
 *
 * Reads nothing itself: the page's useEventFlow hands it the season context
 * (from the package), the goal coverage and the release line.
 */
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import api from '../../services/api';
import { purposeLines } from '../../lib/seasonArc';
import { seasonPageHref } from '../../lib/seasonPage';
import EventGoalPins from './EventGoalPins';
import './SeasonPlacePanel.css';

export default function SeasonPlacePanel({ place, showId, eventId }) {
  const context = place?.context;
  const pins = <EventGoalPins api={api} showId={showId} eventId={eventId} coverage={place?.coverage} gains={place?.gains} />;
  if (!context) return pins;
  if (!context.in_slot) {
    return (
      <div className="esp is-unplaced" data-testid="season-place" data-placed="false">
        <p className="esp-unplaced" data-testid="season-unplaced">
          Not placed in the season yet{context.next_open ? `; the next open slot is ${context.next_open.label}` : ''}
          <span aria-hidden="true"> · </span>
          <Link className="esp-place-link" to={seasonPageHref(showId, 'events', { show: 'unplaced' })} data-testid="season-place-link">Place it</Link>
        </p>
        {pins}
      </div>
    );
  }
  const lines = purposeLines(context);
  return (
    <section className="esp" data-testid="season-place" data-placed="true" aria-label="Its place in the season">
      <p className="esp-title" aria-hidden="true">Its place in the season</p>
      {lines.length ? (
        <ul className="epp-hero-purposes" data-testid="season-purposes" aria-label="Story purposes">
          {lines.map((p, i) => (
            <li key={i} className={p.primary ? 'is-primary' : ''}>
              {lines.length > 1 && <span className="epp-hero-purpose-tag">{p.primary ? 'Primary' : 'Also'}</span>}
              <span>{p.text || `Continues ${p.thread}`}</span>
              {p.text && p.thread && <span className="epp-hero-purpose-thread"> · {p.thread}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="epp-hero-summary">No story purpose set for this slot yet.</p>}
      {context.desired_pressure && (
        <p className="epp-hero-pressure" data-testid="season-pressure">Desired pressure: <strong>{context.desired_pressure}</strong></p>
      )}
      {pins}
      {place.release && (
        <p className="esp-release" data-testid="season-release"><CalendarDays size={14} aria-hidden="true" /> {place.release}</p>
      )}
    </section>
  );
}

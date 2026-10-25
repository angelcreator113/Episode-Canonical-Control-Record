/**
 * PackageHero — the Event Package's header: back to Events, the status
 * badge, the season line and story purposes (HeroTitle), the goals this
 * event moves, the date and the five tiles, and the locked banner.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import api from '../../services/api';
import { seasonPageHref } from '../../lib/seasonPage';
import { purposeLines } from '../../lib/seasonArc';
import { heroTiles, shortDate } from '../../lib/eventPackageHero';
import { dealLabelFor, describeCompensation } from '../../utils/eventTerms';
import EventGoalPins from './EventGoalPins';

// Season Context (§8(ff) A4): read-only — "Season Arc provides intent; the
// Event Package owns the event's facts." Season, phase, slot and purpose.
// The header's title (Evoni's redesign, 2026-10-05): the season line from
// the event's slot (S1 · E3 · Season 1 · Phase 1: Foundation), the name,
// and the slot's story purposes under it, primary first, with its desired
// pressure (Evoni, 2026-10-25: it showed the first purpose only). In no
// slot, the line says so and points to the roadmap. Read-only.
function HeroTitle({ context, showId, name }) {
  const title = <h1 className="epp-title">{name}</h1>;
  if (!context) return <div className="epp-hero-title">{title}</div>;
  const roadmapLink = <Link className="epp-season-link" to={seasonPageHref(showId, 'roadmap')}>the Season page</Link>;
  if (!context.in_slot) {
    return (
      <div className="epp-hero-title" data-testid="season-context" role="group" aria-label="Season">
        <p className="epp-hero-eyebrow">Season {context.season_number}</p>
        {title}
        <p className="epp-hero-summary">
          Not on the roadmap yet{context.next_open ? `; the next open slot is ${context.next_open.label}` : ''}. Pencil it in on {roadmapLink}.
        </p>
      </div>
    );
  }
  return (
    <div className="epp-hero-title" data-testid="season-context" role="group" aria-label="Season">
      <p className="epp-hero-eyebrow">
        <span>{context.label}</span>
        <span> · Season {context.season_number}{context.phase?.title ? ` · Phase ${context.phase.number}: ${context.phase.title}` : ''}{context.via === 'pencilled' ? ' · pencilled in' : ''}</span>
      </p>
      {title}
      {(() => {
        const lines = purposeLines(context);
        if (!lines.length) return <p className="epp-hero-summary">No story purpose set for this slot yet.</p>;
        return (
          <ul className="epp-hero-purposes" data-testid="season-purposes" aria-label="Story purposes">
            {lines.map((p, i) => (
              <li key={i} className={p.primary ? 'is-primary' : ''}>
                {lines.length > 1 && <span className="epp-hero-purpose-tag">{p.primary ? 'Primary' : 'Also'}</span>}
                <span>{p.text || `Continues ${p.thread}`}</span>
                {p.text && p.thread && <span className="epp-hero-purpose-thread"> · {p.thread}</span>}
              </li>
            ))}
          </ul>
        );
      })()}
      {context.desired_pressure && (
        <p className="epp-hero-pressure" data-testid="season-pressure">Desired pressure: <strong>{context.desired_pressure}</strong></p>
      )}
    </div>
  );
}

export default function PackageHero({ showId, eventId, event, seasonContext, badge, venueDate, organizer, projection, used, lockEpisode, termsReopen }) {
  const navigate = useNavigate();
  return (
    <header className="epp-hero" data-testid="package-hero">
      <div className="epp-hero-top">
        <button className="epp-back" onClick={() => navigate(seasonPageHref(showId, 'events'))}>
          <ArrowLeft size={16} /> Events
        </button>
        <span className={`epp-status-badge epp-status-${badge.state}`} data-testid="package-status">{badge.label}</span>
      </div>
      <HeroTitle context={seasonContext} showId={showId} name={event.name} />
      {/* The goals this event moves, and pinning it to one (Evoni, 2026-10-25). */}
      <EventGoalPins api={api} showId={showId} eventId={eventId} />
      {/* On a phone the hero is one line: name, date, status (the tiles
          below hide; the readiness list is behind the bar's count). */}
      <span className="epp-hero-date" data-testid="hero-date">{shortDate(venueDate.eventDate || event.event_date) || 'No date'}</span>
      <ul className="epp-hero-tiles" aria-label="At a glance">
        {heroTiles({ event, venueDate, organizer, projection, dealLabel: dealLabelFor(event), compensation: describeCompensation(event) }).map((t) => (
          <li key={t.key} className={`epp-hero-tile${t.empty ? ' empty' : ''}`} data-testid={`hero-${t.key}`}>
            <span className="epp-hero-tile-label">{t.label}</span>
            <strong>{t.value}</strong>
            {t.sub && <span className="epp-hero-tile-sub">{t.sub}</span>}
          </li>
        ))}
      </ul>

    {used && (
      <div className="epp-used-banner" data-testid="terms-locked-banner" role="note">
        <Lock size={16} aria-hidden="true" />
        <span className="epp-used-banner-text">
          <strong>Locked at Start Episode.</strong>{' '}
          Used by Episode {lockEpisode?.episode_number ?? '—'}{lockEpisode?.title ? `: ${lockEpisode.title}` : ''}.
          {termsReopen
            ? ' Its terms are reopened; the rest of this package stays read-only.'
            : ' This package is read-only; see Terms below to reopen its terms while the episode is a draft.'}
        </span>
        {lockEpisode?.id && (
          <Link
            to={`/episodes/${lockEpisode.id}?tab=overview`}
            className="epp-used-banner-link" data-testid="terms-locked-open-episode"
          >
            Open Episode →
          </Link>
        )}
      </div>
    )}

    </header>
  );
}

/**
 * PackageHero — the Event Package's header: back to Events, the status
 * badge, the season line and story purposes (HeroTitle), the goals this
 * event moves, the date and the five tiles, and the locked banner.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 *
 * The header and navigation (Evoni, 2026-10-25, useEventFlow): the way back
 * goes where the page was opened from (`back`: "Done · back to E5 on the
 * Roadmap"), the events before and after sit beside it (`neighbours`), and
 * under the slot line the season panel (SeasonPlacePanel, `place`) holds
 * the purposes, the goals with what the event adds, and the release day.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { seasonPageHref } from '../../lib/seasonPage';
import { heroTiles, shortDate } from '../../lib/eventPackageHero';
import { dealLabelFor, describeCompensation } from '../../utils/eventTerms';
import SeasonPlacePanel from './SeasonPlacePanel';
import EventSlotNav from './EventSlotNav';
import './PackageHero.css';

// Season Context (§8(ff) A4): read-only — "Season Arc provides intent; the
// Event Package owns the event's facts." Season, phase, slot and purpose.
// The header's title (Evoni's redesign, 2026-10-05): the season line from
// the event's slot (S1 · E3 · Season 1 · Phase 1: Foundation), the name,
// and the slot's story purposes under it, primary first, with its desired
// pressure (Evoni, 2026-10-25: it showed the first purpose only). Since the
// header redesign of 2026-10-25 the purposes, the pressure and the "not
// placed yet" line are the season panel's (`panel`, SeasonPlacePanel),
// under the name. Read-only.
function HeroTitle({ context, name, panel }) {
  const title = <h1 className="epp-title">{name}</h1>;
  if (!context) return <div className="epp-hero-title">{title}{panel}</div>;
  if (!context.in_slot) {
    return (
      <div className="epp-hero-title" data-testid="season-context" role="group" aria-label="Season">
        <p className="epp-hero-eyebrow">Season {context.season_number}</p>
        {title}
        {panel}
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
      {panel}
    </div>
  );
}

export default function PackageHero({ showId, eventId, event, seasonContext, badge, venueDate, organizer, projection, used, lockEpisode, termsReopen, back = null, neighbours = null, place = null }) {
  const backLink = back || { href: seasonPageHref(showId, 'events'), label: 'Events' };
  return (
    <header className="epp-hero" data-testid="package-hero">
      <div className="epp-hero-top">
        <Link className={`epp-back${backLink.done ? ' is-done' : ''}`} to={backLink.href} data-testid="package-back">
          <ArrowLeft size={16} aria-hidden="true" /> {backLink.label}
        </Link>
        <EventSlotNav neighbours={neighbours} />
        <span className={`epp-status-badge epp-status-${badge.state}`} data-testid="package-status">{badge.label}</span>
      </div>
      {/* Its place in the season: the purposes, the goals this event moves
          (and pinning it to one) and its release day (Evoni, 2026-10-25). */}
      <HeroTitle context={seasonContext} name={event.name}
        panel={<SeasonPlacePanel place={place || { context: seasonContext }} showId={showId} eventId={eventId} />} />
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

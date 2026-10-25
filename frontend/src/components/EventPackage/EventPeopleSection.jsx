/**
 * EventPeopleSection — section 2, People: the organizer (Change
 * Organizer, the started-from suggestions, Task #1790), the featured
 * attendees (Task #1689) with their story roles and the recommendations, and
 * the Full Guest List, each name featuring or unfeaturing that guest.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { useState } from 'react';
import { User, UserPlus, Lightbulb } from 'lucide-react';
import EventGuestRecommendations from './EventGuestRecommendations';
import ShowMoreToggle from '../ShowMoreToggle';
import { visibleSlice } from '../../lib/showMore';
import { STORY_ROLES, MAX_FEATURED_GUESTS, GUESTS_SHOWN, fmtLabel } from '../../lib/eventPackageFields';

export default function EventPeopleSection({
  event, used, castLocked, organizer, sourceProfile, startedFrom, guestList, featuredGuests, featuredConsequence,
  lockEpisode, reloadTick, fold, guests, openOrganizerPicker, organizerSaving, acceptStartedFromOrganizer, acceptStartedFromAttendee,
}) {
  const { guestSaving, setGuestFeedPickerOpen, fullGuestListOpen, setFullGuestListOpen, toggleFeatured, setGuestStoryRole, featureRecommended } = guests;
  // The Full Guest List shows ten at a time; the rest fold behind Show more.
  const [allGuestsOpen, setAllGuestsOpen] = useState(false);
  const guestFold = visibleSlice(guestList, allGuestsOpen, GUESTS_SHOWN);
  return (
    <section id="epp-sec-people" className={fold.cls('people')}>
      <div className="epp-section-header">
        <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">2.</span> People</h2><p className="epp-section-sub">Who hosts it and who Lala meets there.</p></div>
        {fold.button('people', 'People')}
        {!used && (
          <button className="epp-btn epp-btn-small" onClick={openOrganizerPicker} data-testid="change-organizer">
            <UserPlus size={14} /> Change Organizer
          </button>
        )}
      </div>
      {fold.line('people')}
      <div id="epp-body-people" className="epp-section-body" hidden={!fold.isOpen('people')}>
      <div className="epp-split even">
      <div className="epp-people-card">
      <div className="epp-organizer-line" data-testid="organizer-line" data-kind={organizer.kind || 'none'}>
        {organizer.hasOrganizer ? (
          <>
            <span className="epp-fields-label">Organized by</span>{' '}
            <strong>{organizer.name || 'Unnamed'}</strong>
            <span className="epp-saved-copy">{organizer.kind === 'brand' ? 'Brand' : 'Creator'}</span>
            {organizer.handle && (
              <span className="epp-host-handle"> @{String(organizer.handle).replace(/^@/, '')}</span>
            )}
            {organizer.alsoLinkedCreator && (
              <div className="epp-organizer-also" title="Saved before the Event Package chose organizers. The brand counts as the organizer; choosing an organizer settles which one it is.">
                Also linked creator: {organizer.alsoLinkedCreator}
              </div>
            )}
          </>
        ) : (
          <span className="epp-host-unlinked">No organizer set</span>
        )}
      </div>
      {startedFrom?.suggestOrganizer && (
        <div className="epp-suggestion" data-testid="organizer-suggestion">
          <span className="epp-suggestion-text">
            <Lightbulb size={12} aria-hidden="true" /> Suggestion: <strong>{startedFrom.name}</strong> as organizer
            <span className="epp-suggestion-basis">You started this event from their Pulse profile</span>
          </span>
          <button
            type="button" className="epp-btn epp-btn-small epp-suggestion-accept" data-testid="organizer-suggestion-accept"
            onClick={acceptStartedFromOrganizer} disabled={organizerSaving}
          >
            Accept
          </button>
        </div>
      )}
      {startedFrom?.suggestAttendee && (
        <div className="epp-suggestion" data-testid="attendee-suggestion">
          <span className="epp-suggestion-text">
            <Lightbulb size={12} aria-hidden="true" /> Suggestion: <strong>{startedFrom.name}</strong> as a featured attendee
            <span className="epp-suggestion-basis">You started this event from their Pulse profile</span>
          </span>
          <button
            type="button" className="epp-btn epp-btn-small epp-suggestion-accept" data-testid="attendee-suggestion-accept"
            onClick={acceptStartedFromAttendee} disabled={guestSaving}
          >
            {startedFrom.guestIndex >= 0 ? 'Feature' : 'Add'}
          </button>
        </div>
      )}
      {/* A brand organizer with no person is complete (§8(p) ruling 2),
          so no red "not linked" host card for it. */}
      {!(organizer.kind === 'brand' && !sourceProfile && !event.host) && (
      <div className="epp-host">
        <User size={18} />
        {sourceProfile ? (
          <div>
            <div className="epp-host-name">{sourceProfile.display_name || sourceProfile.handle}</div>
            {sourceProfile.handle && <div className="epp-host-handle">@{String(sourceProfile.handle).replace(/^@/, '')}</div>}
          </div>
        ) : (
          <div>
            <div className="epp-host-name">{event.host || 'No host set'}</div>
            <div className="epp-host-unlinked">not linked</div>
          </div>
        )}
      </div>
      )}
      </div>
      <div className={`epp-guests${featuredGuests.length ? '' : ' none'}`} data-testid="featured-panel">
        <div className="epp-section-header">
          <div className="epp-fields-label">Featured Attendees ({featuredGuests.length}/{MAX_FEATURED_GUESTS})</div>
          {!used && (
            <button className="epp-btn epp-btn-small" onClick={() => setGuestFeedPickerOpen(true)}>
              <UserPlus size={14} /> Add from The Pulse
            </button>
          )}
        </div>
        {featuredGuests.length ? (
          <ul className="epp-featured-list">
            {featuredGuests.map(({ guest, index }) => (
              <li key={guest.profile_id || guest.handle || index} className="epp-featured-item">
                <div className="epp-featured-info">
                  <span className="epp-host-name">{guest.display_name || guest.handle}</span>
                  {/* A featured guest's role and Remove only steer the
                      script, so like featuring (castLocked) they stay open
                      until the episode is accepted (audit, 2026-10-23);
                      adding someone new invites them, which stays locked. */}
                  {!castLocked ? (
                    <select
                      className="epp-role-select"
                      value={guest.story_role || ''}
                      onChange={(e) => setGuestStoryRole(index, e.target.value)}
                      disabled={guestSaving}
                      aria-label={`Story role for ${guest.display_name || guest.handle}`}
                    >
                      <option value="">No role</option>
                      {STORY_ROLES.map((r) => <option key={r} value={r}>{fmtLabel(r)}</option>)}
                    </select>
                  ) : guest.story_role ? (
                    <span className="epp-saved-copy">{fmtLabel(guest.story_role)}</span>
                  ) : null}
                </div>
                {!castLocked && (
                  <button type="button" className="epp-inline-link" onClick={() => toggleFeatured(index)} disabled={guestSaving}>
                    Remove from Featured
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="epp-empty">
            No featured attendees yet{guestList.length ? ` · ${guestList.length} invited` : ''}
            {featuredConsequence && <span className="epp-guests-note" data-testid="featured-consequence"> {featuredConsequence}</span>}
          </div>
        )}

        {!used && featuredGuests.length < MAX_FEATURED_GUESTS && (
          <EventGuestRecommendations key={`guest-recs-${reloadTick}`}
            guests={guestList}
            organizerProfileId={event.source_profile_id}
            venueLocationId={event.venue_location_id}
            slots={MAX_FEATURED_GUESTS - featuredGuests.length}
            onFeature={featureRecommended}
            saving={guestSaving}
          />
        )}

        <button
          type="button" className="epp-btn epp-btn-small epp-guest-list-toggle"
          onClick={() => setFullGuestListOpen((o) => !o)}
        >
          {fullGuestListOpen ? 'Hide' : 'Show'} Full Guest List ({guestList.length})
        </button>
        {fullGuestListOpen && (
          guestList.length ? (
            <>
            {/* Each guest's name features or unfeatures them (up to
                MAX_FEATURED_GUESTS) while the package is editable; once
                Start Episode locks it the names are plain text. */}
            {castLocked ? (
              <p className="epp-guests-note epp-guest-list-note" data-testid="guest-list-locked">
                Featured attendees are locked: {lockEpisode?.episode_number ? `Episode ${lockEpisode.episode_number}` : 'the episode'} is accepted.
              </p>
            ) : featuredGuests.length >= MAX_FEATURED_GUESTS && (
              <p className="epp-guests-note epp-guest-list-note" data-testid="guest-list-full">
                {MAX_FEATURED_GUESTS} of {MAX_FEATURED_GUESTS} featured. Click a featured guest to remove them first.
              </p>
            )}
            <ul className="epp-guest-list" id="epp-guest-list">
              {guestFold.shown.map((g, i) => {
                const name = g.display_name || g.handle;
                return (
                  <li key={g.profile_id || g.handle || i} className="epp-guest-list-item">
                    {castLocked ? (
                      <>
                        <span>{name}</span>
                        {g.featured && <span className="epp-saved-copy">Featured</span>}
                      </>
                    ) : (
                      <button
                        type="button"
                        className={`epp-guest-toggle${g.featured ? ' is-featured' : ''}`}
                        aria-pressed={!!g.featured}
                        onClick={() => toggleFeatured(i)}
                        disabled={guestSaving || (!g.featured && featuredGuests.length >= MAX_FEATURED_GUESTS)}
                        title={g.featured ? `Remove ${name} from Featured` : `Feature ${name}`}
                      >
                        <span className="epp-guest-toggle-name">{name}</span>
                        <span className="epp-guest-toggle-state">{g.featured ? '✓ Featured' : 'Feature'}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <ShowMoreToggle
              open={allGuestsOpen} hidden={guestFold.hidden}
              onToggle={() => setAllGuestsOpen((o) => !o)} noun={guestFold.hidden === 1 ? 'guest' : 'guests'}
              testId="guest-list-more" controls="epp-guest-list"
            />
            </>
          ) : <div className="epp-empty">No guests yet</div>
        )}
      </div>
      </div>
              </div>
    </section>
  );
}

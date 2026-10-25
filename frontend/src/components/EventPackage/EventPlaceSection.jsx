/**
 * EventPlaceSection — section 3, Place: the look image on the venue's
 * set (L7-L9), the venue, its address and the scene set (L13: editable
 * until the episode is accepted), and how the venue is dressed (L1).
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import EventLookImage from './EventLookImage';
import EventVenueLook from './EventVenueLook';
import { sceneSetPath } from '../../utils/sceneSets';

export default function EventPlaceSection({ showId, eventId, used, placeLocked, venueDate, sceneSet, reloadTick, fold, setVenuePickerOpen, openScenePicker, setToast, load }) {
  return (
    <section id="epp-sec-place" className={fold.cls('place')}>
      <div className="epp-section-header">
        <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">3.</span> Place</h2><p className="epp-section-sub">Where it happens, and the set the episode films on.</p></div>
        {fold.button('place', 'Place')}
        {!used && (
          <button className="epp-btn epp-btn-small" onClick={() => setVenuePickerOpen(true)}>
            <MapPin size={14} /> {venueDate.venueLocationId ? 'Change venue' : 'Choose venue'}
          </button>
        )}
      </div>
      {fold.line('place')}
      <div id="epp-body-place" className="epp-section-body" hidden={!fold.isOpen('place')}>
      <div className="epp-split even epp-place">
      <div className="epp-split-side epp-place-image">
        {/* L7-L9 (§8(hh)): the look made into an image on the venue's set. */}
        <EventLookImage key={`look-image-${reloadTick}`} showId={showId} eventId={eventId} onToast={setToast} onSaved={load} />
      </div>
      <div className="epp-split-main">
      <dl className="epp-fields">
        <div>
          <dt>Venue</dt>
          <dd>
            {venueDate.venueName || 'Not set'}
            {venueDate.venueNameFromSavedCopy && (
              <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
            )}
            {!used && venueDate.venueName && !venueDate.venueLocationId && (
              <button type="button" className="epp-inline-link" onClick={() => setVenuePickerOpen(true)}>
                Pick a real location
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>
            {venueDate.venueAddress || 'Not set'}
            {venueDate.venueAddressFromSavedCopy && (
              <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Scene set</dt>
          <dd data-testid="place-scene-set">
            {sceneSet ? (
              <Link to={sceneSetPath(showId, sceneSet.id, { from: `/shows/${showId}/events/${eventId}`, fromLabel: 'Event Package' })} className="epp-scene-set-link" data-testid="place-scene-set-link">
                {sceneSet.name}
              </Link>
            ) : 'Not set'}
            {/* L13 (§8(hh)): the scene set stays editable after Start
                Episode while the episode is a draft; it locks once the
                episode is accepted (only the terms lock at Start). */}
            {!placeLocked && (
              <button
                type="button" className="epp-inline-link" data-testid="place-choose-scene-set"
                onClick={() => openScenePicker(venueDate.venueLocationId ? { id: venueDate.venueLocationId, name: venueDate.venueName } : null)}
              >
                {sceneSet ? 'Change scene set' : 'Choose scene set'}
              </button>
            )}
          </dd>
        </div>
      </dl>
      {/* L1 (§8(hh)): how the venue is dressed for this occasion. Its own
          lock (Q9): editable until the episode is accepted. */}
      <EventVenueLook key={`venue-look-${reloadTick}`} showId={showId} eventId={eventId} onToast={setToast} onSaved={load} />
      </div>
      </div>
              </div>
    </section>
  );
}

/**
 * VenuePicker — Choose Venue (Task #1674): a World Location, or a new one
 * created and chosen; choosing moves on to the scene set.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { X, Search, CheckCircle2, Plus } from 'lucide-react';
import { fmtLabel } from '../../lib/eventPackageFields';

export default function VenuePicker({ venueDate, place }) {
  const {
    closeVenuePicker, venueSearch, setVenueSearch, venueLocationsLoading, venueLocationsError, setVenueLocationsError,
    filteredVenueLocations, venueSaving, chooseVenue, locationCreateOpen, setLocationCreateOpen,
    locationCreateName, setLocationCreateName, locationCreateCity, setLocationCreateCity, locationCreateSaving, createLocation,
  } = place;
  return (
    <div className="epp-modal-backdrop" onClick={closeVenuePicker}>
      <div className="epp-modal" role="dialog" aria-modal="true" aria-label="Choose venue" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Choose Venue</h3>
          <button className="epp-icon-btn" onClick={closeVenuePicker} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="epp-modal-search">
          <Search size={14} />
          <input
            autoFocus
            aria-label="Search locations" placeholder="Search locations…"
            value={venueSearch}
            onChange={(e) => setVenueSearch(e.target.value)}
          />
        </div>
        <div className="epp-modal-results">
          {venueLocationsLoading ? (
            <div className="epp-empty">Loading locations…</div>
          ) : venueLocationsError ? (
            <div className="epp-empty" role="alert" data-testid="venue-locations-error">
              Couldn&apos;t load the locations: {venueLocationsError}{' '}
              <button type="button" className="epp-inline-link" onClick={() => setVenueLocationsError(null)}>Try again</button>
            </div>
          ) : filteredVenueLocations.length ? (
            filteredVenueLocations.map((l) => (
              <button key={l.id} className="epp-modal-result" disabled={venueSaving} onClick={() => chooseVenue(l)}>
                <div>
                  <div className="epp-host-name">{l.name}</div>
                  <div className="epp-host-handle">{[fmtLabel(l.venue_type), l.city].filter(Boolean).join(' · ') || 'No details'}</div>
                </div>
                {venueDate.venueLocationId === l.id && <CheckCircle2 size={16} />}
              </button>
            ))
          ) : (
            <div className="epp-empty">No locations found</div>
          )}
        </div>
        <div className="epp-modal-footer">
          {!locationCreateOpen ? (
            <button type="button" className="epp-btn epp-btn-small" onClick={() => setLocationCreateOpen(true)}>
              <Plus size={14} /> Create New Location
            </button>
          ) : (
            <div className="epp-inline-create">
              <input
                type="text" aria-label="Location name" placeholder="Location name" value={locationCreateName}
                onChange={(e) => setLocationCreateName(e.target.value)} maxLength={80}
              />
              <input
                type="text" aria-label="City" placeholder="City" value={locationCreateCity}
                onChange={(e) => setLocationCreateCity(e.target.value)} maxLength={80}
              />
              <div className="epp-inline-create-actions">
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary"
                  disabled={locationCreateSaving || !locationCreateName.trim() || !locationCreateCity.trim()}
                  onClick={createLocation}
                >
                  {locationCreateSaving ? 'Creating…' : 'Create & Select'}
                </button>
                <button type="button" className="epp-icon-btn" onClick={() => setLocationCreateOpen(false)} disabled={locationCreateSaving}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

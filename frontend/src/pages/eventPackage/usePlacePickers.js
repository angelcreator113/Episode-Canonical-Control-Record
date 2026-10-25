/**
 * Venue + scene-set pickers (Task #1674; the scene set S7, its search L2),
 * moved out of EventPackagePage.jsx (Task #54). venueLocations is fetched
 * once (null = not yet fetched) and reused by both pickers, since the same
 * GET already nests each location's sceneSets — no separate scene-set fetch
 * is needed for the venue picker.
 */
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { fetchAllSceneSets } from '../../lib/fetchAllPages';
import { orderSceneSetsForEvent, searchSceneSets } from '../../lib/eventPackageFields';

export default function usePlacePickers({ showId, event, putEvent, load, setToast }) {
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [venueLocations, setVenueLocations] = useState(null);
  const [venueLocationsLoading, setVenueLocationsLoading] = useState(false);
  // The locations read failed: the pickers say so with Try again, and the
  // list stays unfetched (null) so the next open reads it again.
  const [venueLocationsError, setVenueLocationsError] = useState(null);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [locationCreateOpen, setLocationCreateOpen] = useState(false);
  const [locationCreateName, setLocationCreateName] = useState('');
  const [locationCreateCity, setLocationCreateCity] = useState('');
  const [locationCreateSaving, setLocationCreateSaving] = useState(false);

  // The scene set for the event (S7): every set of the show, the venue's
  // own first; one can be created for the venue (sceneVenue).
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const [sceneVenue, setSceneVenue] = useState(null); // { id, name } | null
  const [pickerSets, setPickerSets] = useState(null);
  const [sceneSaving, setSceneSaving] = useState(false);
  const [sceneCreateOpen, setSceneCreateOpen] = useState(false);
  const [sceneCreateName, setSceneCreateName] = useState('');
  const [sceneCreateSaving, setSceneCreateSaving] = useState(false);
  // L2 (§8(hh), Q11): search by name, venue and type; the highlighted set
  // shows a strip of its angles.
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerHighlight, setPickerHighlight] = useState(null);

  // Fetched once on first use (picker open or "change scene set" click),
  // then cached — with only a handful of World Locations, no debounced
  // server search is needed; both pickers filter this same client-side.
  useEffect(() => {
    if (!venuePickerOpen || venueLocations !== null || venueLocationsError) return;
    setVenueLocationsLoading(true);
    api.get('/api/v1/world/locations')
      .then((res) => setVenueLocations(res.data?.locations || []))
      .catch((err) => {
        console.error('[EventPackage] locations load failed:', err);
        setVenueLocationsError(err.response?.data?.error || err.message || 'Could not load the locations');
      })
      .finally(() => setVenueLocationsLoading(false));
  }, [venuePickerOpen, venueLocations, venueLocationsError]);

  const closeVenuePicker = () => {
    // Not while a save runs: it would land on a closed picker and reopen
    // the scene-set one (audit, 2026-10-23).
    if (venueSaving || locationCreateSaving) return;
    setVenuePickerOpen(false);
    setVenueSearch('');
    setLocationCreateOpen(false);
    setLocationCreateName('');
    setLocationCreateCity('');
  };

  const closeScenePicker = () => {
    if (sceneSaving || sceneCreateSaving) return;
    setScenePickerOpen(false);
    setSceneVenue(null);
    setSceneCreateOpen(false);
    setSceneCreateName('');
    setPickerSearch('');
    setPickerHighlight(null);
  };

  // The scene-set picker (S7): every scene set of the show, the venue's own
  // first. venue: { id, name } of the event's venue World Location, or null
  // (then a set can be chosen but not created).
  const openScenePicker = async (venue) => {
    setSceneVenue(venue && venue.id ? venue : null);
    setSceneCreateName(venue?.name || '');
    setScenePickerOpen(true);
    setPickerSets(null);
    setPickerSearch('');
    setPickerHighlight(event?.scene_set_id || null);
    // Venue names for the search (Q11); the same cached list the venue picker uses.
    if (venueLocations === null) {
      api.get('/api/v1/world/locations')
        .then((res) => setVenueLocations(res.data?.locations || []))
        .catch((err) => { console.error('[EventPackage] locations load failed:', err); });
    }
    try {
      // Every set, not the first 200 (lib/fetchAllPages).
      setPickerSets((await fetchAllSceneSets(api, showId)).items);
    } catch (err) {
      console.error('[EventPackage] scene sets load failed:', err);
      setPickerSets([]);
      setToast(err.response?.data?.error || 'Could not load the scene sets');
    }
  };

  // Selecting a venue always sets venue_location_id (never a typed name in
  // its place, per Evoni's amendment to #1674), then moves straight into
  // the scene-set step for that location — offering "+ Create Scene Set"
  // there is what stops a scene set ever being created for a venue with no
  // World Location.
  const chooseVenue = async (location) => {
    setVenueSaving(true);
    try {
      const address = [location.street_address, location.district, location.city].filter(Boolean).join(', ');
      await putEvent({
        venue_location_id: location.id,
        venue_name: location.name,
        venue_address: address || null,
      });
      closeVenuePicker();
      setToast(`Venue changed to ${location.name}`);
      await load();
      openScenePicker({ id: location.id, name: location.name });
    } catch (err) {
      console.error('[EventPackage] chooseVenue failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to change venue');
    } finally {
      setVenueSaving(false);
    }
  };

  const createLocation = async () => {
    const name = locationCreateName.trim();
    const city = locationCreateCity.trim();
    if (!name || !city || locationCreateSaving) return;
    setLocationCreateSaving(true);
    try {
      const res = await api.post('/api/v1/world/locations', { name, city });
      const loc = res.data?.location;
      if (loc) {
        const locWithSets = { ...loc, sceneSets: [] };
        setVenueLocations((prev) => (prev ? [...prev, locWithSets] : [locWithSets]));
        await chooseVenue(locWithSets);
      }
    } catch (err) {
      console.error('[EventPackage] createLocation failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to create location');
    } finally {
      setLocationCreateSaving(false);
    }
  };

  const chooseSceneSet = async (set, { quiet = false } = {}) => {
    setSceneSaving(true);
    try {
      await putEvent({ scene_set_id: set.id });
      closeScenePicker();
      if (!quiet) setToast(`Scene set changed to ${set.name}`);
      await load();
      return true;
    } catch (err) {
      console.error('[EventPackage] chooseSceneSet failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to change scene set');
      return false;
    } finally {
      setSceneSaving(false);
    }
  };

  // Create a set for the venue (S7, S5: its World Location) and choose it
  // for this event. S8 (Evoni, 2026-10-02; §8(dd)): its base is made in
  // Scene Sets ("Open in Scene Sets →" under the look), not here.
  const createSceneSet = async () => {
    const name = sceneCreateName.trim();
    if (!name || !sceneVenue || sceneCreateSaving) return;
    setSceneCreateSaving(true);
    try {
      const res = await api.post('/api/v1/scene-sets', {
        name,
        scene_type: 'EVENT_LOCATION',
        world_location_id: sceneVenue.id,
        show_id: showId,
      });
      const set = res.data?.data;
      if (set && await chooseSceneSet(set, { quiet: true })) setToast(`${set.name} is chosen: make its base in Scene Sets`);
    } catch (err) {
      console.error('[EventPackage] createSceneSet failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to create scene set');
    } finally {
      setSceneCreateSaving(false);
    }
  };

  const filteredVenueLocations = (venueLocations || []).filter((l) => {
    if (!venueSearch.trim()) return true;
    const q = venueSearch.trim().toLowerCase();
    return (l.name || '').toLowerCase().includes(q) || (l.city || '').toLowerCase().includes(q);
  });

  const venueNames = Object.fromEntries((venueLocations || []).map((l) => [l.id, l.name]));
  const pickerGroups = searchSceneSets(orderSceneSetsForEvent(pickerSets, sceneVenue?.id || null, showId), pickerSearch, venueNames);

  return {
    venuePickerOpen, setVenuePickerOpen, venueLocationsLoading, venueLocationsError, setVenueLocationsError,
    venueSearch, setVenueSearch, venueSaving, locationCreateOpen, setLocationCreateOpen,
    locationCreateName, setLocationCreateName, locationCreateCity, setLocationCreateCity, locationCreateSaving,
    scenePickerOpen, sceneVenue, pickerSets, sceneSaving, sceneCreateOpen, setSceneCreateOpen,
    sceneCreateName, setSceneCreateName, sceneCreateSaving, pickerSearch, setPickerSearch, pickerHighlight, setPickerHighlight,
    filteredVenueLocations, venueNames, pickerGroups,
    closeVenuePicker, closeScenePicker, openScenePicker, chooseVenue, createLocation, chooseSceneSet, createSceneSet,
  };
}

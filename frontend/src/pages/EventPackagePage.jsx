/**
 * EventPackagePage.jsx — Event Package, piece 1 (Task #1642)
 *
 * Route: /shows/:showId/events/:eventId
 *
 * Six read-only summary sections (Basics, People, Place, Invitation,
 * Style & Deliverables, Review) plus a readiness count, and three actions:
 * Change Host, Edit details (opens the existing WorldAdmin editor via the
 * same ?tab=events&event=<id> deep link Task #1628/#1630 already use),
 * and Start Episode (the existing generate-episode action, gated on
 * readiness). Editing itself still happens in the existing editor —
 * later pieces replace these sections one at a time.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, UserPlus, Pencil, PlayCircle, Lock, AlertCircle,
  Search, X, CheckCircle2, Sparkles, RefreshCw, Loader2, MapPin, Plus,
} from 'lucide-react';
import api from '../services/api';
import { computeEventReadiness, calcEventDifficulty, eventDifficultyLabel, resolveEventVenueAndDate, resolveEventOrganizer } from '../utils/eventReadiness';
import { InvitationButton } from './InvitationGenerator';
import './EventPackagePage.css';

function fmtLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EventPackagePage() {
  const { showId, eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // One-time auto-generate flag (Task #1654): SocialProfileGenerator's
  // handleHostEvent navigates here with ?autoInvite=1 right after creating
  // a host-linked event. Captured once on mount, then the flag is stripped
  // from the URL below so a reload can never re-trigger it — the value
  // itself never changes again for the life of this mounted page.
  const [autoInvite] = useState(() => searchParams.get('autoInvite') === '1');
  useEffect(() => {
    if (searchParams.get('autoInvite') === '1') {
      navigate(`/shows/${showId}/events/${eventId}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState(null);
  // Owned here, not inside InvitationButton (Task #1668): load() below sets
  // loading=true while it refetches, which unmounts this page's whole JSX
  // subtree — including InvitationButton — until it resolves. Local state
  // set inside that component right before an onGenerated-triggered reload
  // would be wiped before the next render; this component's own state
  // survives, since it's never itself unmounted by its own loading toggle.
  const [invitationApprovalInfo, setInvitationApprovalInfo] = useState(null);

  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [hostSearching, setHostSearching] = useState(false);
  const [hostSaving, setHostSaving] = useState(false);

  // Suggest names (Task #1670). Nothing here fires on mount — only
  // openNameSuggest, called from a click, ever requests suggestions.
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameSuggesting, setNameSuggesting] = useState(false);
  const [nameSuggestError, setNameSuggestError] = useState(null);
  const [customName, setCustomName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Venue + scene-set pickers (Task #1674). venueLocations is fetched once
  // (null = not yet fetched) and reused by both pickers, since the same
  // GET already nests each location's sceneSets — no separate scene-set
  // fetch is needed.
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [venueLocations, setVenueLocations] = useState(null);
  const [venueLocationsLoading, setVenueLocationsLoading] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [locationCreateOpen, setLocationCreateOpen] = useState(false);
  const [locationCreateName, setLocationCreateName] = useState('');
  const [locationCreateCity, setLocationCreateCity] = useState('');
  const [locationCreateSaving, setLocationCreateSaving] = useState(false);

  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const [scenePickerLocation, setScenePickerLocation] = useState(null);
  const [sceneSaving, setSceneSaving] = useState(false);
  const [sceneCreateOpen, setSceneCreateOpen] = useState(false);
  const [sceneCreateName, setSceneCreateName] = useState('');
  const [sceneCreateSaving, setSceneCreateSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${eventId}`);
      setData(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [showId, eventId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Debounced creator search for the Change Host picker.
  useEffect(() => {
    if (!hostPickerOpen) return;
    setHostSearching(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (hostSearch.trim()) qs.set('search', hostSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => setHostResults(res.data?.profiles || []))
        .catch(() => setHostResults([]))
        .finally(() => setHostSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [hostPickerOpen, hostSearch]);

  // Fetched once on first use (picker open or "change scene set" click),
  // then cached — with only a handful of World Locations, no debounced
  // server search is needed; both pickers filter this same client-side.
  useEffect(() => {
    if (!venuePickerOpen || venueLocations !== null) return;
    setVenueLocationsLoading(true);
    api.get('/api/v1/world/locations')
      .then((res) => setVenueLocations(res.data?.locations || []))
      .catch(() => setVenueLocations([]))
      .finally(() => setVenueLocationsLoading(false));
  }, [venuePickerOpen, venueLocations]);

  if (loading) {
    return (
      <div className="epp-page epp-center">
        <div className="epp-spinner" aria-label="Loading event" />
      </div>
    );
  }

  if (loadError || !data?.event) {
    return (
      <div className="epp-page epp-center">
        <AlertCircle size={28} color="var(--lala-danger, #B84D2E)" />
        <p className="epp-error">{loadError || 'Event not found'}</p>
        <button className="epp-btn epp-btn-secondary" onClick={() => navigate(`/shows/${showId}/world?tab=events`)}>
          <ArrowLeft size={16} /> Back to Events
        </button>
      </div>
    );
  }

  const { event, sourceProfile, sceneSet, invitationAsset, usedInEpisode } = data;
  const used = !!event.used_in_episode_id;
  const { checks, allReady } = computeEventReadiness(event);
  const venueDate = resolveEventVenueAndDate(event);
  const organizer = resolveEventOrganizer(event);
  const difficulty = calcEventDifficulty(event);
  const diffLabel = eventDifficultyLabel(difficulty);

  const guestList = event.canon_consequences?.automation?.guest_profiles || [];
  const outfitPieces = Array.isArray(event.outfit_pieces) ? event.outfit_pieces : [];
  const requirementEntries = event.requirements && typeof event.requirements === 'object'
    ? Object.entries(event.requirements).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : [];

  const costLine = () => {
    if (event.is_paid) {
      return `Paid appearance: +${event.payment_amount || 0} coins when the episode is finalized`;
    }
    if (!event.cost_coins || event.cost_coins <= 0) {
      return 'Free — no cost to attend';
    }
    return `Attendance cost: ${event.cost_coins} coins — deducted when the episode is finalized`;
  };

  const openEditor = () => navigate(`/shows/${showId}/world?tab=events&event=${eventId}`);

  const selectHost = async (profile) => {
    setHostSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, {
        source_profile_id: profile.id,
        host: profile.display_name || profile.handle || null,
      });
      setHostPickerOpen(false); setHostSearch(''); setHostResults([]);
      setToast(`Host changed to ${profile.display_name || profile.handle}`);
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to change host');
    } finally {
      setHostSaving(false);
    }
  };

  const fetchNameSuggestions = async () => {
    setNameSuggesting(true);
    setNameSuggestError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/suggest-names`);
      setNameSuggestions(res.data?.names || []);
    } catch (err) {
      setNameSuggestError(err.response?.data?.error || err.message || 'Failed to suggest names');
    } finally {
      setNameSuggesting(false);
    }
  };

  const openNameSuggest = () => {
    setNameSuggestOpen(true);
    if (nameSuggestions.length === 0 && !nameSuggesting) fetchNameSuggestions();
  };

  const saveEventName = async (newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || nameSaving) return;
    setNameSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { name: trimmed });
      setToast(`Name changed to "${trimmed}"`);
      setNameSuggestOpen(false);
      setNameSuggestions([]);
      setCustomName('');
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to save name');
    } finally {
      setNameSaving(false);
    }
  };

  const closeVenuePicker = () => {
    setVenuePickerOpen(false);
    setVenueSearch('');
    setLocationCreateOpen(false);
    setLocationCreateName('');
    setLocationCreateCity('');
  };

  const closeScenePicker = () => {
    setScenePickerOpen(false);
    setScenePickerLocation(null);
    setSceneCreateOpen(false);
    setSceneCreateName('');
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
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, {
        venue_location_id: location.id,
        venue_name: location.name,
        venue_address: address || null,
      });
      closeVenuePicker();
      setToast(`Venue changed to ${location.name}`);
      await load();
      setScenePickerLocation(location);
      setScenePickerOpen(true);
    } catch (err) {
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
      setToast(err.response?.data?.error || err.message || 'Failed to create location');
    } finally {
      setLocationCreateSaving(false);
    }
  };

  // Used by the "Change/Choose scene set" link, which can be clicked
  // before the venue picker has ever been opened — loads locations on
  // demand rather than requiring the venue picker to have run first.
  const openScenePickerForLocation = async (locationId, locationNameFallback) => {
    let locations = venueLocations;
    if (locations === null) {
      setVenueLocationsLoading(true);
      try {
        const res = await api.get('/api/v1/world/locations');
        locations = res.data?.locations || [];
        setVenueLocations(locations);
      } catch {
        locations = [];
        setVenueLocations(locations);
      } finally {
        setVenueLocationsLoading(false);
      }
    }
    const loc = locations.find((l) => l.id === locationId) || { id: locationId, name: locationNameFallback, sceneSets: [] };
    setScenePickerLocation(loc);
    setScenePickerOpen(true);
  };

  const chooseSceneSet = async (set) => {
    setSceneSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { scene_set_id: set.id });
      closeScenePicker();
      setToast(`Scene set changed to ${set.name}`);
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to change scene set');
    } finally {
      setSceneSaving(false);
    }
  };

  const createSceneSet = async () => {
    const name = sceneCreateName.trim();
    if (!name || !scenePickerLocation || sceneCreateSaving) return;
    setSceneCreateSaving(true);
    try {
      const res = await api.post('/api/v1/scene-sets', {
        name,
        scene_type: 'EVENT_LOCATION',
        world_location_id: scenePickerLocation.id,
        show_id: showId,
      });
      const set = res.data?.data;
      if (set) {
        const locationId = scenePickerLocation.id;
        setVenueLocations((prev) => (prev
          ? prev.map((l) => (l.id === locationId ? { ...l, sceneSets: [...(l.sceneSets || []), set] } : l))
          : prev));
        await chooseSceneSet(set);
      }
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to create scene set');
    } finally {
      setSceneCreateSaving(false);
    }
  };

  const handleStartEpisode = async () => {
    if (!allReady || used || starting) return;
    setStarting(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-episode`, { draft_script: false });
      if (res.data.success) {
        const ep = res.data.data.episode;
        if (ep?.id) navigate(`/episodes/${ep.id}`);
        else setToast('Episode created but no episode id was returned.');
      } else {
        setToast(res.data.error || 'Failed to start episode');
      }
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to start episode');
    } finally {
      setStarting(false);
    }
  };

  const filteredVenueLocations = (venueLocations || []).filter((l) => {
    if (!venueSearch.trim()) return true;
    const q = venueSearch.trim().toLowerCase();
    return (l.name || '').toLowerCase().includes(q) || (l.city || '').toLowerCase().includes(q);
  });

  // Prefer EVENT_LOCATION scene sets, per Evoni's amendment to #1674.
  const sortedSceneSets = scenePickerLocation
    ? [...(scenePickerLocation.sceneSets || [])].sort((a, b) => {
        if (a.scene_type === 'EVENT_LOCATION' && b.scene_type !== 'EVENT_LOCATION') return -1;
        if (b.scene_type === 'EVENT_LOCATION' && a.scene_type !== 'EVENT_LOCATION') return 1;
        return 0;
      })
    : [];

  return (
    <div className="epp-page">
      <div className="epp-header">
        <button className="epp-back" onClick={() => navigate(`/shows/${showId}/world?tab=events`)}>
          <ArrowLeft size={16} /> Events
        </button>
        <h1 className="epp-title">{event.name}</h1>
        <span className={`epp-status-badge epp-status-${event.status || 'draft'}`}>{fmtLabel(event.status)}</span>
      </div>

      {toast && <div className="epp-toast">{toast}</div>}

      {used && (
        <div className="epp-used-banner">
          <Lock size={16} />
          Used by Episode {usedInEpisode?.episode_number ?? '—'}{usedInEpisode?.title ? `: ${usedInEpisode.title}` : ''}
        </div>
      )}

      <div className="epp-sections">
        <section className="epp-section">
          <div className="epp-section-header">
            <h2 className="epp-section-title">Basics</h2>
            {!used && !nameSuggestOpen && (
              <button className="epp-btn epp-btn-small" onClick={openNameSuggest}>
                <Sparkles size={14} /> Suggest names
              </button>
            )}
          </div>
          <dl className="epp-fields">
            <div><dt>Name</dt><dd>{event.name}</dd></div>
            <div>
              <dt>Date &amp; time</dt>
              <dd>
                {venueDate.eventDate ? `${venueDate.eventDate}${venueDate.eventTime ? ` · ${venueDate.eventTime}` : ''}` : 'Not set'}
                {(venueDate.eventDateFromSavedCopy || venueDate.eventTimeFromSavedCopy) && (
                  <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
                )}
              </dd>
            </div>
            <div><dt>Brand</dt><dd>{event.host_brand || 'Not set'}</dd></div>
            <div><dt>Category</dt><dd>{fmtLabel(event.category)}</dd></div>
            <div><dt>Format</dt><dd>{fmtLabel(event.format)}</dd></div>
          </dl>

          {nameSuggestOpen && (
            <div className="epp-name-suggest">
              {nameSuggesting && (
                <div className="epp-invitation-generating">
                  <Loader2 size={14} className="epp-spin-icon" /> Thinking of names…
                </div>
              )}
              {nameSuggestError && (
                <div className="epp-invitation-error">
                  <AlertCircle size={13} /> <span>{nameSuggestError}</span>
                  <button type="button" className="epp-invitation-retry" onClick={fetchNameSuggestions} disabled={nameSuggesting}>Retry</button>
                </div>
              )}
              {!nameSuggesting && nameSuggestions.length > 0 && (
                <div className="epp-name-suggest-options">
                  {nameSuggestions.map((n, i) => (
                    <button
                      key={`${n}-${i}`} type="button" className="epp-name-suggest-option"
                      onClick={() => saveEventName(n)} disabled={nameSaving}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <div className="epp-name-suggest-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={fetchNameSuggestions} disabled={nameSuggesting || nameSaving}>
                  <RefreshCw size={13} /> Regenerate
                </button>
                <input
                  type="text" className="epp-name-suggest-input" placeholder="Or type your own"
                  value={customName} onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEventName(customName); }}
                  maxLength={40}
                />
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary"
                  onClick={() => saveEventName(customName)} disabled={nameSaving || !customName.trim()}
                >
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="epp-icon-btn" title="Close" onClick={() => setNameSuggestOpen(false)} disabled={nameSaving}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="epp-section">
          <div className="epp-section-header">
            <h2 className="epp-section-title">People</h2>
            {!used && (
              <button className="epp-btn epp-btn-small" onClick={() => setHostPickerOpen(true)}>
                <UserPlus size={14} /> Change Host
              </button>
            )}
          </div>
          <div className="epp-organizer-line">
            {organizer.hasOrganizer ? (
              <>
                <span className="epp-fields-label">Organized by</span>{' '}
                <strong>{organizer.organizerKind === 'brand' ? organizer.brandName : organizer.creatorName}</strong>
                <span className="epp-saved-copy">{organizer.organizerKind === 'brand' ? 'Brand' : 'Creator'}</span>
                {organizer.organizerKind === 'brand' && organizer.hasCreator && (
                  <span> · Hosted by: {organizer.creatorName}</span>
                )}
              </>
            ) : (
              <span className="epp-host-unlinked">No organizer set</span>
            )}
          </div>
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
          <div className="epp-guests">
            <div className="epp-fields-label">Guests</div>
            {guestList.length ? (
              <ul className="epp-guest-list">
                {guestList.map((g, i) => (
                  <li key={g.profile_id || g.handle || i}>{g.display_name || g.handle}</li>
                ))}
              </ul>
            ) : <div className="epp-empty">No guests yet</div>}
          </div>
        </section>

        <section className="epp-section">
          <div className="epp-section-header">
            <h2 className="epp-section-title">Place</h2>
            {!used && (
              <button className="epp-btn epp-btn-small" onClick={() => setVenuePickerOpen(true)}>
                <MapPin size={14} /> {venueDate.venueLocationId ? 'Change venue' : 'Choose venue'}
              </button>
            )}
          </div>
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
              <dd>
                {sceneSet?.name || 'Not set'}
                {!used && venueDate.venueLocationId && (
                  <button
                    type="button" className="epp-inline-link"
                    onClick={() => openScenePickerForLocation(venueDate.venueLocationId, venueDate.venueName)}
                  >
                    {sceneSet ? 'Change scene set' : 'Choose scene set'}
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Invitation</h2>
          <InvitationButton
            mode="inline"
            autoGenerate={autoInvite}
            event={{ ...event, invitation_url: invitationAsset?.s3_url_processed || null }}
            showId={showId}
            approvalInfo={invitationApprovalInfo}
            onGenerated={(_url, _assetId, approvalDetail) => {
              if (approvalDetail) setInvitationApprovalInfo(approvalDetail);
              load();
            }}
          />
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Style &amp; Deliverables</h2>
          <dl className="epp-fields">
            <div><dt>Dress code</dt><dd>{event.dress_code || 'Not set'}</dd></div>
            <div><dt>Outfit</dt><dd>{outfitPieces.length ? `${outfitPieces.length} piece${outfitPieces.length === 1 ? '' : 's'} chosen` : 'Not chosen'}</dd></div>
            <div>
              <dt>Requirements</dt>
              <dd>
                {requirementEntries.length ? (
                  <ul className="epp-requirements-list">
                    {requirementEntries.map(([k, v]) => <li key={k}>{fmtLabel(k)}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}
                  </ul>
                ) : 'None set'}
              </dd>
            </div>
            <div><dt>Prestige</dt><dd>{event.prestige ?? 'Not set'}</dd></div>
            <div><dt>Strictness</dt><dd>{event.strictness ?? 'Not set'}</dd></div>
            <div><dt>Cost</dt><dd>{costLine()}</dd></div>
          </dl>
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Review</h2>
          <dl className="epp-fields">
            <div><dt>Career tier</dt><dd>{event.career_tier ?? 'Not set'}</dd></div>
            <div>
              <dt>Difficulty</dt>
              <dd>
                <span className="epp-difficulty-chip" style={{ color: diffLabel.color, background: diffLabel.bg }}>
                  {diffLabel.text} ({difficulty})
                </span>
              </dd>
            </div>
          </dl>
          <div className="epp-readiness">
            <span className={`epp-readiness-label ${allReady ? 'is-ready' : ''}`}>{allReady ? 'READY' : 'PRE-FLIGHT'}</span>
            {checks.map((c) => (
              <span key={c.key} className={`epp-chip ${c.ok ? 'is-ok' : ''}`} title={c.ok ? `${c.label} is set` : `${c.label} not set yet`}>
                {c.icon} {c.label} {c.ok ? '✓' : '⚠'}
              </span>
            ))}
          </div>
        </section>
      </div>

      {!used && (
        <div className="epp-actions">
          <button className="epp-btn epp-btn-secondary" onClick={openEditor}>
            <Pencil size={16} /> Edit details
          </button>
          <button
            className="epp-btn epp-btn-primary"
            disabled={!allReady || starting}
            title={allReady ? 'Start the episode' : 'Not ready yet — see Review below'}
            onClick={handleStartEpisode}
          >
            <PlayCircle size={16} /> {starting ? 'Starting…' : 'Start Episode'}
          </button>
        </div>
      )}

      {hostPickerOpen && (
        <div className="epp-modal-backdrop" onClick={() => setHostPickerOpen(false)}>
          <div className="epp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3>Change Host</h3>
              <button className="epp-icon-btn" onClick={() => setHostPickerOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="epp-modal-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="Search creators…"
                value={hostSearch}
                onChange={(e) => setHostSearch(e.target.value)}
              />
            </div>
            <div className="epp-modal-results">
              {hostSearching ? (
                <div className="epp-empty">Searching…</div>
              ) : hostResults.length ? (
                hostResults.map((p) => (
                  <button key={p.id} className="epp-modal-result" disabled={hostSaving} onClick={() => selectHost(p)}>
                    <div>
                      <div className="epp-host-name">{p.display_name || p.handle}</div>
                      {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                    </div>
                    {sourceProfile?.id === p.id && <CheckCircle2 size={16} />}
                  </button>
                ))
              ) : (
                <div className="epp-empty">No creators found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {venuePickerOpen && (
        <div className="epp-modal-backdrop" onClick={closeVenuePicker}>
          <div className="epp-modal" onClick={(e) => e.stopPropagation()}>
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
                placeholder="Search locations…"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
              />
            </div>
            <div className="epp-modal-results">
              {venueLocationsLoading ? (
                <div className="epp-empty">Loading locations…</div>
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
                    type="text" placeholder="Location name" value={locationCreateName}
                    onChange={(e) => setLocationCreateName(e.target.value)} maxLength={80}
                  />
                  <input
                    type="text" placeholder="City" value={locationCreateCity}
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
      )}

      {scenePickerOpen && scenePickerLocation && (
        <div className="epp-modal-backdrop" onClick={closeScenePicker}>
          <div className="epp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3>Scene Set — {scenePickerLocation.name}</h3>
              <button className="epp-icon-btn" onClick={closeScenePicker} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="epp-modal-results">
              {sortedSceneSets.length ? (
                sortedSceneSets.map((s) => (
                  <button key={s.id} className="epp-modal-result" disabled={sceneSaving} onClick={() => chooseSceneSet(s)}>
                    <div>
                      <div className="epp-host-name">{s.name}</div>
                      <div className="epp-host-handle">{fmtLabel(s.scene_type)}</div>
                    </div>
                    {event.scene_set_id === s.id && <CheckCircle2 size={16} />}
                  </button>
                ))
              ) : (
                <div className="epp-empty">No scene sets for this location yet</div>
              )}
            </div>
            <div className="epp-modal-footer">
              {!sceneCreateOpen ? (
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setSceneCreateOpen(true)}>
                  <Plus size={14} /> Create Scene Set
                </button>
              ) : (
                <div className="epp-inline-create">
                  <input
                    type="text" placeholder="Scene set name" value={sceneCreateName}
                    onChange={(e) => setSceneCreateName(e.target.value)} maxLength={80}
                  />
                  <div className="epp-inline-create-actions">
                    <button
                      type="button" className="epp-btn epp-btn-small epp-btn-primary"
                      disabled={sceneCreateSaving || !sceneCreateName.trim()}
                      onClick={createSceneSet}
                    >
                      {sceneCreateSaving ? 'Creating…' : 'Create & Select'}
                    </button>
                    <button type="button" className="epp-icon-btn" onClick={() => setSceneCreateOpen(false)} disabled={sceneCreateSaving}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

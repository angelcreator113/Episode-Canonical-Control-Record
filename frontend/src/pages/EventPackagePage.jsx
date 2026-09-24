/**
 * EventPackagePage.jsx — Event Package, piece 1 (Task #1642)
 *
 * Route: /shows/:showId/events/:eventId
 *
 * Six read-only summary sections (Basics, People, Place, Invitation,
 * Style & Deliverables, Review) plus a readiness count, and three actions:
 * Change Organizer (Change Host until Task #1761), Edit details (opens
 * the existing WorldAdmin editor via the same ?tab=events&event=<id> deep link Task #1628/#1630 already use),
 * and Start Episode (the existing generate-episode action, gated on
 * readiness). Editing itself still happens in the existing editor —
 * later pieces replace these sections one at a time.
 *
 * Basics (Task #1755): date, time, description and dress code are edited
 * here, one focused dialog per field, through the same event PUT. Each
 * field shows one of three states — set, suggested, missing
 * (resolveEventBasics, utils/eventBasics.js). A suggestion is shown only,
 * never saved, until Evoni accepts it.
 *
 * Organizer (Task #1761): Change Organizer picks a creator (a Social
 * Profile) or a brand (a lalaverse_brands row, written to host_brand by
 * name). Choosing one kind clears the other kind in both of its homes;
 * the exact writes are built in utils/eventOrganizer.js.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, UserPlus, Pencil, PlayCircle, Lock, AlertCircle,
  Search, X, CheckCircle2, Sparkles, RefreshCw, Loader2, MapPin, Plus,
  Lightbulb, CircleDashed, CalendarClock, Building2,
} from 'lucide-react';
import api from '../services/api';
import { computeEventReadiness, calcEventDifficulty, eventDifficultyLabel, resolveEventVenueAndDate } from '../utils/eventReadiness';
import { resolveEventBasics, AUTO_DATE_KEY } from '../utils/eventBasics';
import {
  describeEventOrganizer, buildCreatorOrganizerUpdate, buildBrandOrganizerUpdate,
  filterBrands, brandIsListed, profileName, BRAND_NAME_MAX,
} from '../utils/eventOrganizer';
import { InvitationButton } from './InvitationGenerator';
import './EventPackagePage.css';

function fmtLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Featured attendees (Task #1689) — a story role is optional, chosen from
// this fixed set; no role is forced onto a featured guest.
const STORY_ROLES = ['friend', 'tension', 'opportunity', 'wildcard', 'romantic', 'mentor', 'rival'];
const MAX_FEATURED_GUESTS = 5;

// Basics fields (Task #1755): the dialog title, the PUT column each one
// saves to, and the input it edits with. maxLength follows the column
// (event_date/event_time character varying(50), dress_code (200)).
const BASICS_FIELDS = {
  date: { label: 'Date', title: 'Event date', column: 'event_date', input: 'date', maxLength: 50 },
  time: { label: 'Time', title: 'Start time', column: 'event_time', input: 'time', maxLength: 50 },
  description: { label: 'Description', title: 'Description', column: 'description', input: 'textarea' },
  dressCode: { label: 'Dress code', title: 'Dress code', column: 'dress_code', input: 'text', maxLength: 200 },
};
const BASICS_ORDER = ['date', 'time', 'description', 'dressCode'];
const BASICS_STATE_LABEL = { set: 'Set', suggested: 'Suggested', missing: 'Missing' };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{2}:\d{2}$/;

// Display only: "2026-11-07" → "Sat, Nov 7, 2026"; "20:00" → "8:00 PM".
// Anything else (older free-text values) is shown as stored.
function fmtBasicsValue(key, value) {
  if (!value) return value;
  if (key === 'date' && ISO_DATE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
  }
  if (key === 'time' && HH_MM.test(value)) {
    const [h, m] = value.split(':').map(Number);
    if (h < 24 && m < 60) return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return value;
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

  // Change Organizer (Task #1761; was Change Host). One picker, two kinds.
  // brands: null = not fetched yet; brandsError = the list could not be
  // loaded, so the Brand tab falls back to typing a name.
  const [organizerPickerOpen, setOrganizerPickerOpen] = useState(false);
  const [organizerTab, setOrganizerTab] = useState('creator');
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [hostSearching, setHostSearching] = useState(false);
  const [brands, setBrands] = useState(null);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandFreeText, setBrandFreeText] = useState('');
  const [pendingOrganizer, setPendingOrganizer] = useState(null);
  const [organizerSaving, setOrganizerSaving] = useState(false);

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

  // Featured attendees (Task #1689). guestFeedResults mirrors the Change
  // Host picker's debounced search exactly (same endpoint, same shape).
  const [fullGuestListOpen, setFullGuestListOpen] = useState(false);
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestFeedPickerOpen, setGuestFeedPickerOpen] = useState(false);
  const [guestFeedSearch, setGuestFeedSearch] = useState('');
  const [guestFeedResults, setGuestFeedResults] = useState([]);
  const [guestFeedSearching, setGuestFeedSearching] = useState(false);

  // Basics dialog (Task #1755): which field is open, and its draft value.
  const [basicsEditing, setBasicsEditing] = useState(null);
  const [basicsDraft, setBasicsDraft] = useState('');
  const [basicsSaving, setBasicsSaving] = useState(false);

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

  // Debounced creator search for the Change Organizer picker's Creator
  // tab. "For this show": social profiles carry no show_id (the list route
  // reads none), so this uses the scope New Episode's Choose Host uses for
  // the show, feed_layer=lalaverse (NewEpisodeChooseHost in App.jsx); the
  // route also returns the real-world profiles Lala follows for that layer.
  useEffect(() => {
    if (!organizerPickerOpen || organizerTab !== 'creator') return;
    setHostSearching(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      qs.set('feed_layer', 'lalaverse');
      if (hostSearch.trim()) qs.set('search', hostSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => setHostResults(res.data?.profiles || []))
        .catch(() => setHostResults([]))
        .finally(() => setHostSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [organizerPickerOpen, organizerTab, hostSearch]);

  // Brand list for the Brand tab, fetched once on first use: GET
  // /api/v1/wardrobe-brands/brands (wardrobeBrands.js) returns every
  // lalaverse_brands row, not show-scoped; filtered here by name.
  useEffect(() => {
    if (!organizerPickerOpen || organizerTab !== 'brand' || brands !== null) return;
    setBrandsLoading(true);
    setBrandsError(null);
    api.get('/api/v1/wardrobe-brands/brands')
      .then((res) => setBrands(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('[EventPackage] brand list failed:', err);
        setBrandsError(err.response?.data?.error || err.message || 'Could not load brands');
        setBrands([]);
      })
      .finally(() => setBrandsLoading(false));
  }, [organizerPickerOpen, organizerTab, brands]);

  // Debounced creator search for "Add from Lala's Feed" — same endpoint
  // and shape as the organizer picker's Creator tab above, no show/series
  // or feed-layer scoping, matching assembleGuestList itself
  // (eventAutomationService.js), which does not scope by show either.
  useEffect(() => {
    if (!guestFeedPickerOpen) return;
    setGuestFeedSearching(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (guestFeedSearch.trim()) qs.set('search', guestFeedSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => setGuestFeedResults(res.data?.profiles || []))
        .catch(() => setGuestFeedResults([]))
        .finally(() => setGuestFeedSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [guestFeedPickerOpen, guestFeedSearch]);

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

  const { event, sourceProfile, sceneSet, venueLocation, invitationAsset, usedInEpisode } = data;
  const used = !!event.used_in_episode_id;
  const { checks, allReady } = computeEventReadiness(event);
  const basics = resolveEventBasics(event, venueLocation, { suggest: !used });
  const venueDate = resolveEventVenueAndDate(event);
  const organizer = describeEventOrganizer(event, sourceProfile);
  const difficulty = calcEventDifficulty(event);
  const diffLabel = eventDifficultyLabel(difficulty);

  const guestList = event.canon_consequences?.automation?.guest_profiles || [];
  const featuredGuests = guestList
    .map((guest, index) => ({ guest, index }))
    .filter(({ guest }) => guest.featured);
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

  // Saves one Basics field through the existing PUT (all four columns are in
  // its allowedFields). An empty value clears the column (the route turns ''
  // into NULL). Saving a date — any date, even the same one — also removes
  // automation.event_date_auto: the PUT merges canon_consequences two levels
  // deep and deletes a key sent as null (mergeCanonConsequences), so this
  // touches nothing else in canon_consequences. Time, dress code and
  // description never carry a derived value here: they are saved only from
  // what Evoni typed or a suggestion she accepted.
  const saveBasicsField = async (key, rawValue, successMessage) => {
    const spec = BASICS_FIELDS[key];
    if (!spec || used || basicsSaving) return;
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    const body = { [spec.column]: value || null };
    if (key === 'date' && event.canon_consequences?.automation?.[AUTO_DATE_KEY] !== undefined) {
      body.canon_consequences = { automation: { [AUTO_DATE_KEY]: null } };
    }
    setBasicsSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, body);
      setBasicsEditing(null);
      setBasicsDraft('');
      setToast(successMessage || (value ? `${spec.label} saved` : `${spec.label} cleared`));
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || `Failed to save ${spec.label.toLowerCase()}`);
    } finally {
      setBasicsSaving(false);
    }
  };

  const acceptBasicsSuggestion = (key) => {
    const suggestion = basics[key]?.suggestion;
    if (!suggestion) return;
    saveBasicsField(key, suggestion.value, `${BASICS_FIELDS[key].label} set to ${fmtBasicsValue(key, suggestion.value)}`);
  };

  const openBasicsEditor = (key) => {
    if (used) return;
    setBasicsDraft(basics[key]?.value || '');
    setBasicsEditing(key);
  };

  const renderBasicsRow = (key) => {
    const spec = BASICS_FIELDS[key];
    const f = basics[key];
    const StateIcon = f.state === 'set' ? CheckCircle2 : f.state === 'suggested' ? Lightbulb : CircleDashed;
    return (
      <div key={key} className={`epp-basic is-${f.state}`} data-testid={`basics-${key}`} data-state={f.state}>
        <dt>
          {spec.label}
          <span className="epp-basic-state"><StateIcon size={11} aria-hidden="true" /> {BASICS_STATE_LABEL[f.state]}</span>
        </dt>
        <dd>
          {f.state === 'set' ? (
            <span className={key === 'description' ? 'epp-basic-value epp-basic-prose' : 'epp-basic-value'}>{fmtBasicsValue(key, f.value)}</span>
          ) : (
            <span className="epp-basic-unset">Not set</span>
          )}
          {f.autoScheduled && (
            <span className="epp-auto-chip" title="System default: 45 days after the event was created. Change it to make it yours.">
              <CalendarClock size={11} aria-hidden="true" /> Auto-scheduled
            </span>
          )}
          {f.fromSavedCopy && (
            <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
          )}
          {!used && (
            <button type="button" className="epp-inline-link" onClick={() => openBasicsEditor(key)} disabled={basicsSaving}>
              {f.state === 'set' ? 'Edit' : 'Set'}
            </button>
          )}
          {f.state === 'suggested' && (
            <div className="epp-suggestion">
              <span className="epp-suggestion-text">
                <Lightbulb size={12} aria-hidden="true" /> Suggestion: <strong>{fmtBasicsValue(key, f.suggestion.value)}</strong>
                <span className="epp-suggestion-basis">{f.suggestion.basis}</span>
              </span>
              <button
                type="button" className="epp-btn epp-btn-small epp-suggestion-accept"
                onClick={() => acceptBasicsSuggestion(key)} disabled={basicsSaving}
              >
                <CheckCircle2 size={13} /> Use this
              </button>
            </div>
          )}
        </dd>
      </div>
    );
  };

  const closeOrganizerPicker = () => {
    setOrganizerPickerOpen(false);
    setHostSearch(''); setHostResults([]);
    setBrandSearch(''); setBrandFreeText('');
    setPendingOrganizer(null);
  };

  const openOrganizerPicker = () => {
    if (used) return;
    setOrganizerTab(organizer.kind === 'brand' ? 'brand' : 'creator');
    setPendingOrganizer(null);
    setOrganizerPickerOpen(true);
  };

  // Saves an organizer through the existing PUT. pending.update.body comes
  // from buildCreatorOrganizerUpdate / buildBrandOrganizerUpdate; its keys
  // (source_profile_id, host, host_brand, canon_consequences) are all in
  // the route's allowedFields.
  const saveOrganizer = async (pending) => {
    if (used || organizerSaving || !pending) return;
    if (pending.update.unchanged) {
      closeOrganizerPicker();
      setToast(`${pending.label} is already the organizer`);
      return;
    }
    setOrganizerSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, pending.update.body);
      closeOrganizerPicker();
      setToast(`Organizer set to ${pending.label} (${pending.kind})`);
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to change organizer');
    } finally {
      setOrganizerSaving(false);
    }
  };

  // A choice that clears the other kind is confirmed first, naming what
  // goes; a choice that clears nothing saves straight away.
  const chooseOrganizer = (pending) => {
    if (pending.update.clears.length) setPendingOrganizer(pending);
    else saveOrganizer(pending);
  };

  const chooseCreatorOrganizer = (profile) => {
    chooseOrganizer({
      kind: 'creator',
      label: profileName(profile) || 'Creator',
      update: buildCreatorOrganizerUpdate(event, profile),
    });
  };

  const chooseBrandOrganizer = (brandName) => {
    const update = buildBrandOrganizerUpdate(event, brandName, sourceProfile);
    if (!update) return;
    chooseOrganizer({ kind: 'brand', label: brandName.trim(), update });
  };

  const brandsListed = filterBrands(brands, brandSearch);
  const brandFallback = brands !== null && !brandsLoading && (brandsError || brands.length === 0);

  // Persists a whole new guest_profiles array through the existing event
  // PUT route. canon_consequences is a plain JSONB column overwrite there
  // (worldEvents.js's PUT allowedFields/jsonFields, confirmed in this
  // task's PR body) — not a JSONB merge — so every write here sends the
  // event's full canon_consequences with only automation.guest_profiles
  // replaced, or every other automation field (host, venue, ...) would be
  // wiped.
  const saveGuestProfiles = async (newGuestProfiles, successMessage) => {
    setGuestSaving(true);
    try {
      const updatedCC = {
        ...(event.canon_consequences || {}),
        automation: {
          ...(event.canon_consequences?.automation || {}),
          guest_profiles: newGuestProfiles,
        },
      };
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { canon_consequences: updatedCC });
      if (successMessage) setToast(successMessage);
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to update guests');
    } finally {
      setGuestSaving(false);
    }
  };

  const toggleFeatured = (index) => {
    const guest = guestList[index];
    const name = guest.display_name || guest.handle || 'Guest';
    if (!guest.featured && guestList.filter((g) => g.featured).length >= MAX_FEATURED_GUESTS) {
      setToast(`Only ${MAX_FEATURED_GUESTS} guests can be featured at once — remove one first.`);
      return;
    }
    const updated = guestList.map((g, i) => (i === index ? { ...g, featured: !g.featured } : g));
    saveGuestProfiles(updated, guest.featured ? `Removed ${name} from Featured` : `${name} is now Featured`);
  };

  const setGuestStoryRole = (index, role) => {
    const updated = guestList.map((g, i) => (i === index ? { ...g, story_role: role || null } : g));
    saveGuestProfiles(updated);
  };

  const addGuestFromFeed = (profile) => {
    if (guestList.some((g) => g.profile_id === profile.id)) {
      setToast(`${profile.display_name || profile.handle} is already on the guest list.`);
      return;
    }
    if (guestList.filter((g) => g.featured).length >= MAX_FEATURED_GUESTS) {
      setToast(`Only ${MAX_FEATURED_GUESTS} guests can be featured at once — remove one first.`);
      return;
    }
    // Same shape assembleGuestList writes (eventAutomationService.js) —
    // profile_id, not id — so relationship-sync and every other
    // profile_id-reading consumer finds this guest too (Task #1686).
    const newGuest = {
      profile_id: profile.id,
      handle: profile.handle,
      display_name: profile.display_name || profile.handle,
      featured: true,
      story_role: null,
    };
    setGuestFeedPickerOpen(false); setGuestFeedSearch(''); setGuestFeedResults([]);
    saveGuestProfiles([...guestList, newGuest], `${newGuest.display_name} added and featured`);
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
            {BASICS_ORDER.map(renderBasicsRow)}
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
              <button className="epp-btn epp-btn-small" onClick={openOrganizerPicker} data-testid="change-organizer">
                <UserPlus size={14} /> Change Organizer
              </button>
            )}
          </div>
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
          <div className="epp-guests">
            <div className="epp-section-header">
              <div className="epp-fields-label">Featured Attendees ({featuredGuests.length}/{MAX_FEATURED_GUESTS})</div>
              {!used && (
                <button className="epp-btn epp-btn-small" onClick={() => setGuestFeedPickerOpen(true)}>
                  <UserPlus size={14} /> Add from Feed
                </button>
              )}
            </div>
            {featuredGuests.length ? (
              <ul className="epp-featured-list">
                {featuredGuests.map(({ guest, index }) => (
                  <li key={guest.profile_id || guest.handle || index} className="epp-featured-item">
                    <div className="epp-featured-info">
                      <span className="epp-host-name">{guest.display_name || guest.handle}</span>
                      {!used ? (
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
                    {!used && (
                      <button type="button" className="epp-inline-link" onClick={() => toggleFeatured(index)} disabled={guestSaving}>
                        Remove from Featured
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <div className="epp-empty">No featured attendees yet</div>}

            <button
              type="button" className="epp-btn epp-btn-small epp-guest-list-toggle"
              onClick={() => setFullGuestListOpen((o) => !o)}
            >
              {fullGuestListOpen ? 'Hide' : 'Show'} Full Guest List ({guestList.length})
            </button>
            {fullGuestListOpen && (
              guestList.length ? (
                <ul className="epp-guest-list">
                  {guestList.map((g, i) => (
                    <li key={g.profile_id || g.handle || i} className="epp-guest-list-item">
                      <span>{g.display_name || g.handle}</span>
                      {g.featured ? (
                        <span className="epp-saved-copy">Featured</span>
                      ) : !used && (
                        <button
                          type="button" className="epp-inline-link"
                          onClick={() => toggleFeatured(i)}
                          disabled={guestSaving || featuredGuests.length >= MAX_FEATURED_GUESTS}
                        >
                          Make Featured
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <div className="epp-empty">No guests yet</div>
            )}
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

      {basicsEditing && !used && (() => {
        const key = basicsEditing;
        const spec = BASICS_FIELDS[key];
        const f = basics[key];
        const closeBasics = () => { if (!basicsSaving) { setBasicsEditing(null); setBasicsDraft(''); } };
        // A stored value the native date/time input can't show (older
        // free-text rows) falls back to a text input, so it isn't lost.
        const nativeOk = (spec.input === 'date' && (!basicsDraft || ISO_DATE.test(basicsDraft)))
          || (spec.input === 'time' && (!basicsDraft || HH_MM.test(basicsDraft)));
        const inputType = nativeOk ? spec.input : 'text';
        return (
          <div className="epp-modal-backdrop" onClick={closeBasics}>
            <div className="epp-modal" role="dialog" aria-label={spec.title} onClick={(e) => e.stopPropagation()}>
              <div className="epp-modal-header">
                <h3>{spec.title}</h3>
                <button className="epp-icon-btn" onClick={closeBasics} aria-label="Close" disabled={basicsSaving}>
                  <X size={16} />
                </button>
              </div>
              <div className="epp-basics-dialog">
                {key === 'date' && f.autoScheduled && (
                  <p className="epp-basics-note">
                    <CalendarClock size={13} aria-hidden="true" /> Auto-scheduled 45 days after the event was created. Saving makes this date yours.
                  </p>
                )}
                {spec.input === 'textarea' ? (
                  <textarea
                    autoFocus rows={5} value={basicsDraft}
                    onChange={(e) => setBasicsDraft(e.target.value)}
                    placeholder="What is this event?"
                    aria-label={spec.title}
                  />
                ) : (
                  <input
                    autoFocus type={inputType} value={basicsDraft} maxLength={spec.maxLength}
                    onChange={(e) => setBasicsDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveBasicsField(key, basicsDraft); }}
                    placeholder={key === 'dressCode' ? 'e.g. black tie formal' : ''}
                    aria-label={spec.title}
                  />
                )}
                {f.suggestion && (
                  <button type="button" className="epp-inline-link epp-basics-fill" onClick={() => setBasicsDraft(f.suggestion.value)}>
                    Fill in suggestion: {fmtBasicsValue(key, f.suggestion.value)}
                  </button>
                )}
              </div>
              <div className="epp-modal-footer epp-basics-actions">
                {f.value && (
                  <button type="button" className="epp-btn epp-btn-small" onClick={() => saveBasicsField(key, '')} disabled={basicsSaving}>
                    Clear
                  </button>
                )}
                <div className="epp-basics-spacer" />
                <button type="button" className="epp-btn epp-btn-small" onClick={closeBasics} disabled={basicsSaving}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary"
                  onClick={() => saveBasicsField(key, basicsDraft)} disabled={basicsSaving || !basicsDraft.trim()}
                >
                  {basicsSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {organizerPickerOpen && !used && (
        <div className="epp-modal-backdrop" onClick={() => { if (!organizerSaving) closeOrganizerPicker(); }}>
          <div className="epp-modal" role="dialog" aria-label="Change Organizer" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3>Change Organizer</h3>
              <button className="epp-icon-btn" onClick={closeOrganizerPicker} aria-label="Close" disabled={organizerSaving}>
                <X size={16} />
              </button>
            </div>

            {pendingOrganizer ? (
              <>
                <div className="epp-basics-dialog epp-organizer-confirm" data-testid="organizer-confirm">
                  <p className="epp-organizer-confirm-lead">
                    Make <strong>{pendingOrganizer.label}</strong> the organizer ({pendingOrganizer.kind})?
                  </p>
                  <ul className="epp-organizer-clears">
                    {pendingOrganizer.update.clears.map((c, i) => (
                      <li key={`${c.kind}-${i}`}>
                        {c.kind === 'brand'
                          ? <>Removes the brand <strong>{c.value}</strong> from this event.</>
                          : <>Unlinks the creator <strong>{c.value}</strong> from this event.</>}
                      </li>
                    ))}
                  </ul>
                  <p className="epp-basics-note">
                    An event has one organizer: a creator or a brand.
                    {pendingOrganizer.kind === 'creator' && ' The brand name is also used for outfit brand matching and invitation style lookups.'}
                  </p>
                </div>
                <div className="epp-modal-footer epp-basics-actions">
                  <button type="button" className="epp-btn epp-btn-small" onClick={() => setPendingOrganizer(null)} disabled={organizerSaving}>
                    Back
                  </button>
                  <div className="epp-basics-spacer" />
                  <button
                    type="button" className="epp-btn epp-btn-small epp-btn-primary"
                    onClick={() => saveOrganizer(pendingOrganizer)} disabled={organizerSaving}
                  >
                    {organizerSaving ? 'Saving…' : 'Set organizer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="epp-organizer-tabs" role="tablist">
                  <button
                    type="button" role="tab" aria-selected={organizerTab === 'creator'}
                    className={`epp-organizer-tab ${organizerTab === 'creator' ? 'is-active' : ''}`}
                    onClick={() => setOrganizerTab('creator')}
                  >
                    <User size={14} /> Creator
                  </button>
                  <button
                    type="button" role="tab" aria-selected={organizerTab === 'brand'}
                    className={`epp-organizer-tab ${organizerTab === 'brand' ? 'is-active' : ''}`}
                    onClick={() => setOrganizerTab('brand')}
                  >
                    <Building2 size={14} /> Brand
                  </button>
                </div>

                {organizerTab === 'creator' ? (
                  <>
                    <div className="epp-modal-search">
                      <Search size={14} />
                      <input
                        autoFocus
                        placeholder="Search creators…"
                        aria-label="Search creators"
                        value={hostSearch}
                        onChange={(e) => setHostSearch(e.target.value)}
                      />
                    </div>
                    <div className="epp-modal-results">
                      {hostSearching ? (
                        <div className="epp-empty">Searching…</div>
                      ) : hostResults.length ? (
                        hostResults.map((p) => (
                          <button key={p.id} className="epp-modal-result" disabled={organizerSaving} onClick={() => chooseCreatorOrganizer(p)}>
                            <div>
                              <div className="epp-host-name">{p.display_name || p.handle}</div>
                              {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                            </div>
                            {organizer.kind === 'creator' && event.source_profile_id === p.id && <CheckCircle2 size={16} />}
                          </button>
                        ))
                      ) : (
                        <div className="epp-empty">No creators found</div>
                      )}
                    </div>
                  </>
                ) : brandFallback ? (
                  <div className="epp-basics-dialog" data-testid="brand-free-text">
                    <p className="epp-basics-note">
                      <AlertCircle size={13} aria-hidden="true" />
                      {brandsError ? `The brand list could not be loaded (${brandsError}). Type the brand name instead.` : 'No LalaVerse brands exist yet. Type the brand name instead.'}
                    </p>
                    <input
                      autoFocus type="text" value={brandFreeText} maxLength={BRAND_NAME_MAX}
                      placeholder="Brand name" aria-label="Brand name"
                      onChange={(e) => setBrandFreeText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && brandFreeText.trim()) chooseBrandOrganizer(brandFreeText); }}
                    />
                    <div className="epp-basics-actions">
                      {brandsError && (
                        <button type="button" className="epp-btn epp-btn-small" onClick={() => setBrands(null)} disabled={organizerSaving}>
                          <RefreshCw size={13} /> Retry list
                        </button>
                      )}
                      <div className="epp-basics-spacer" />
                      <button
                        type="button" className="epp-btn epp-btn-small epp-btn-primary"
                        onClick={() => chooseBrandOrganizer(brandFreeText)} disabled={organizerSaving || !brandFreeText.trim()}
                      >
                        Use this brand
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="epp-modal-search">
                      <Search size={14} />
                      <input
                        autoFocus
                        placeholder="Search brands…"
                        aria-label="Search brands"
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                      />
                    </div>
                    {organizer.brandName && brands && !brandIsListed(brands, organizer.brandName) && (
                      <p className="epp-organizer-unlisted">
                        Current brand <strong>{organizer.brandName}</strong> was typed in and is not in the LalaVerse brand list.
                      </p>
                    )}
                    <div className="epp-modal-results">
                      {brandsLoading || brands === null ? (
                        <div className="epp-empty">Loading brands…</div>
                      ) : brandsListed.length ? (
                        brandsListed.map((b) => (
                          <button key={b.id} className="epp-modal-result" disabled={organizerSaving} onClick={() => chooseBrandOrganizer(b.name)}>
                            <div>
                              <div className="epp-host-name">{b.name}</div>
                              {(b.category || b.type) && <div className="epp-host-handle">{fmtLabel(b.category || b.type)}</div>}
                            </div>
                            {organizer.kind === 'brand' && organizer.brandName === b.name && <CheckCircle2 size={16} />}
                          </button>
                        ))
                      ) : (
                        <div className="epp-empty">No brands match</div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {guestFeedPickerOpen && (
        <div className="epp-modal-backdrop" onClick={() => setGuestFeedPickerOpen(false)}>
          <div className="epp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3>Add from Lala's Feed</h3>
              <button className="epp-icon-btn" onClick={() => setGuestFeedPickerOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="epp-modal-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="Search creators…"
                value={guestFeedSearch}
                onChange={(e) => setGuestFeedSearch(e.target.value)}
              />
            </div>
            <div className="epp-modal-results">
              {guestFeedSearching ? (
                <div className="epp-empty">Searching…</div>
              ) : guestFeedResults.length ? (
                guestFeedResults.map((p) => {
                  const alreadyGuest = guestList.some((g) => g.profile_id === p.id);
                  return (
                    <button
                      key={p.id} className="epp-modal-result"
                      disabled={guestSaving || alreadyGuest}
                      onClick={() => addGuestFromFeed(p)}
                    >
                      <div>
                        <div className="epp-host-name">{p.display_name || p.handle}</div>
                        {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                      </div>
                      {alreadyGuest && <CheckCircle2 size={16} />}
                    </button>
                  );
                })
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

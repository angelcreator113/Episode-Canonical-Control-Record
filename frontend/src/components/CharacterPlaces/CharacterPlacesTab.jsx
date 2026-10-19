/**
 * A character's Places tab (Evoni, 2026-10-17: "a tab inside character
 * profiles that allows me to upload Place of work scene sets and home scene
 * sets then just link to the venue scene set ... lets add hosted events
 * then add event photos there").
 *
 *   Home, Closet, Place of work: each a scene set, picked from the show's
 *     sets (a venue's set for a place of work) or made from uploaded photos.
 *     The same links as Characters' places on a scene set
 *     (characterPlacesService), seen from the character's side.
 *     Each has "Write from their profile" (PlaceDescription): its description
 *     written from their city, price range, class, style and the gap.
 *   Hosted events: the events whose host is their feed profile
 *     (characterEvents), each with its event photos (EventLookImage); add or
 *     stop hosting one (characterHostedEvents).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Home, Shirt, Briefcase, CalendarDays, Upload, Link2, X, Plus } from 'lucide-react';
import api from '../../services/api';
import { sceneSetPath } from '../../utils/sceneSets';
import EventLookImage from '../EventPackage/EventLookImage';
import SetAngles from './SetAngles';
import PlaceDescription from './PlaceDescription';
import { makeSetFromPhotos, removeSet } from './setPhotos';
import './CharacterPlacesTab.css';

const ROLES = Object.freeze([
  { role: 'home', label: 'Home', icon: Home, sceneType: 'HOME_BASE', single: true },
  { role: 'closet', label: 'Closet', icon: Shirt, sceneType: 'CLOSET', single: true },
  { role: 'work', label: 'Place of work', icon: Briefcase, sceneType: 'OTHER', single: false },
]);

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

/** One role's places: their sets, and pick or upload another. */
function RoleSection({ spec, places, linked, character, showId, sets, loadSets, onSetsStale, onChanged, onNote, anglesKey, onAnglesAdded }) {
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(null);
  const fileInput = useRef(null);
  const Icon = spec.icon;
  const name = character.selected_name || character.display_name || 'They';
  const canAdd = !spec.single || places.length === 0;

  const link = async (sceneSetId) => {
    await api.post(`/api/v1/shows/${showId}/character-places`, { character_id: character.id, scene_set_id: sceneSetId, role: spec.role });
  };
  const pick = async () => {
    if (!choice) return;
    setBusy('pick');
    try {
      await link(choice);
      setPicking(false);
      setChoice('');
      onNote({ text: `${spec.label} set` });
      onChanged();
    } catch (err) {
      console.error('[CharacterPlacesTab] link failed:', err);
      onNote({ error: true, text: errorText(err, `Could not set their ${spec.label.toLowerCase()}`) });
    } finally { setBusy(null); }
  };
  // Upload photos: one scene set from all the photos chosen, the first its
  // main photo and the others its angles, linked as this place (2026-10-17:
  // a place's angles were made into sets of their own). When the set or its
  // main photo cannot be made, or the link fails, the set is deleted again.
  const upload = async (files) => {
    if (!files.length) return;
    setBusy('upload');
    let made = null;
    try {
      made = await makeSetFromPhotos({ name: `${name}'s ${spec.label}`, sceneType: spec.sceneType, showId, files });
      await link(made.setId);
      const { done, failed } = made.angles;
      onNote({
        error: failed.length > 0,
        text: `${spec.label} made from your photos${done ? ` with ${done} angle${done === 1 ? '' : 's'}` : ''}${failed.length ? `; could not add ${failed.join(', ')}` : ''}`,
      });
      onSetsStale();
      onChanged();
    } catch (err) {
      console.error('[CharacterPlacesTab] upload failed:', err);
      if (made?.setId) await removeSet(made.setId);
      onNote({ error: true, text: errorText(err, 'Could not make the set from those photos') });
    } finally { setBusy(null); }
  };
  const unlink = async (place) => {
    setBusy(place.scene_set_id);
    try {
      await api.post(`/api/v1/shows/${showId}/character-places/unlink`, { character_id: character.id, scene_set_id: place.scene_set_id, role: place.role });
      onChanged();
    } catch (err) {
      console.error('[CharacterPlacesTab] unlink failed:', err);
      onNote({ error: true, text: errorText(err, 'Could not unlink it') });
    } finally { setBusy(null); }
  };

  return (
    <section className="cpl-role" data-testid={`places-role-${spec.role}`}>
      <h3 className="cpl-role-title"><Icon size={16} aria-hidden="true" /> {spec.label}</h3>
      {places.length === 0 && <p className="cpl-note">No {spec.label.toLowerCase()} yet.</p>}
      <ul className="cpl-cards">
        {places.map((p) => (
          <li key={`${p.role}-${p.scene_set_id}`} className="cpl-card" data-testid={`place-${spec.role}-${p.scene_set_id}`}>
            {/* A place of work shows its venue's own photo when it has one (2026-10-17). */}
            {spec.role === 'work' && p.venue_photo_url
              ? <img src={p.venue_photo_url} alt={`Venue: ${p.scene_set_name}`} data-testid={`place-venue-photo-${p.scene_set_id}`} />
              : p.image_url ? <img src={p.image_url} alt={`${spec.label}: ${p.scene_set_name}`} /> : <div className="cpl-card-empty">No picture yet</div>}
            <div className="cpl-card-text">
              <strong>{p.scene_set_name}</strong>
              {p.everyday && <span className="cpl-badge">Everyday look</span>}
              <span className="cpl-card-actions">
                <Link to={sceneSetPath(showId, p.scene_set_id)}>Open in Scene Sets</Link>
                <button type="button" className="cpl-icon-btn" disabled={busy === p.scene_set_id} onClick={() => unlink(p)}
                  aria-label={`Unlink ${p.scene_set_name}`} data-testid={`place-unlink-${spec.role}-${p.scene_set_id}`}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
            {/* Its angles, and more added to this same set (2026-10-17). */}
            <SetAngles setId={p.scene_set_id} onNote={onNote} refreshKey={anglesKey[p.scene_set_id] || 0} onAdded={onAnglesAdded} />
            <PlaceDescription characterId={character.id} setId={p.scene_set_id} setName={p.scene_set_name} role={p.role} onNote={onNote} />
          </li>
        ))}
      </ul>
      {canAdd && (picking ? (
        <div className="cpl-row">
          <select className="cpl-input" aria-label={`Their ${spec.label.toLowerCase()} set`} value={choice} onChange={(e) => setChoice(e.target.value)}
            data-testid={`place-pick-select-${spec.role}`}>
            <option value="">{sets ? 'Choose a scene set…' : 'Loading…'}</option>
            {/* A set already one of their places is shown, not offered: picking
                it moved it from that role without a word (fifth audit). */}
            {(sets || []).map((s) => (
              <option key={s.id} value={s.id} disabled={linked.has(String(s.id))}>
                {s.name}{linked.has(String(s.id)) ? ` (their ${linked.get(String(s.id))})` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="cpl-btn" disabled={!choice || busy === 'pick'} onClick={pick} data-testid={`place-pick-save-${spec.role}`}>
            {busy === 'pick' ? 'Saving…' : `Make it their ${spec.label.toLowerCase()}`}
          </button>
          <button type="button" className="cpl-btn is-soft" onClick={() => setPicking(false)}>Cancel</button>
        </div>
      ) : (
        <div className="cpl-row">
          <button type="button" className="cpl-btn is-soft" onClick={() => { setPicking(true); loadSets(); }} data-testid={`place-pick-${spec.role}`}>
            <Link2 size={14} aria-hidden="true" /> Pick a set
          </button>
          <button type="button" className="cpl-btn is-soft" disabled={busy === 'upload'} onClick={() => fileInput.current?.click()} data-testid={`place-upload-${spec.role}`}>
            <Upload size={14} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : 'Upload photos'}
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid={`place-upload-input-${spec.role}`}
            onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; upload(files); }} />
          <span className="cpl-note">Choose all its photos at once: the first is the main photo, the others its angles.</span>
        </div>
      ))}
    </section>
  );
}

/**
 * An event's own photos and angles: the place it is held at, dressed for
 * this event, kept as one set (an event version of that place). With none
 * yet, "Upload this event's photos" makes it from the photos chosen: the
 * first its main photo, the others its angles. An event held nowhere yet
 * chooses its place on its own page first.
 */
function EventPhotosAndAngles({ event, onNote, onChanged }) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  // Its own photos: its set when that set is an event version.
  const ownSet = event.scene_set_id && event.scene_set_version_of ? event.scene_set_id : null;

  const upload = async (files) => {
    if (!files.length) return;
    setBusy(true);
    let made = null;
    try {
      // That place dressed for it: an event version of the place it is held
      // at, linked on the empty set before the photos go up, so a refusal
      // (its place locked, another show's place) costs no upload (sixth audit).
      made = await makeSetFromPhotos({
        name: `${event.name} photos`, sceneType: 'EVENT_LOCATION', showId: event.show_id, files,
        prepare: (setId) => api.put(`/api/v1/scene-sets/${setId}/version`, { everyday_set_id: event.scene_set_id, event_id: event.id }),
        undo: (setId) => api.put(`/api/v1/scene-sets/${setId}/version`, { everyday_set_id: null, return_event: true }),
      });
      const { done, failed } = made.angles;
      onNote({
        error: failed.length > 0,
        text: `${event.name}'s photos saved${done ? ` with ${done} angle${done === 1 ? '' : 's'}` : ''}${failed.length ? `; could not add ${failed.join(', ')}` : ''}`,
      });
      onChanged();
    } catch (err) {
      console.error('[CharacterPlacesTab] event photos failed:', err);
      onNote({ error: true, text: err?.response?.data?.error || err?.message || "Could not save the event's photos" });
    } finally { setBusy(false); }
  };

  return (
    <div className="cpl-event-photos" data-testid={`event-photos-angles-${event.id}`}>
      <span className="cpl-event-photos-title">Event photos and angles</span>
      {ownSet ? (
        <SetAngles setId={ownSet} onNote={onNote} label={`${event.scene_set_name || 'Event photos'} · angles`} />
      ) : !event.scene_set_id ? (
        <span className="cpl-note" data-testid={`event-photos-no-place-${event.id}`}>
          Choose where it is held on <Link to={`/shows/${event.show_id}/events/${event.id}`}>the event&rsquo;s page</Link> first: its photos are that place dressed for it.
        </span>
      ) : (
        <>
          <span className="cpl-note">
            {event.scene_set_name} dressed for this event, as its own photos. Choose all of them at once: the first is the main photo, the others its angles.
          </span>
          <button type="button" className="cpl-btn is-soft is-small" disabled={busy} onClick={() => fileInput.current?.click()} data-testid={`event-photos-upload-${event.id}`}>
            <Upload size={14} aria-hidden="true" /> {busy ? 'Uploading…' : "Upload this event's photos"}
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid={`event-photos-input-${event.id}`}
            onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; upload(files); }} />
        </>
      )}
    </div>
  );
}

/** Hosted events, each with its photos; add or stop hosting one. */
function HostedEvents({ character, showId, onNote, appearances = null }) {
  const hostsIn = (data) => (data?.events || []).filter((e) => e.role === 'host');
  // The page's own appearances, when it has them, instead of a second
  // request for the same thing (the profile audit, 2026-10-19); a change
  // here reads them again.
  const [events, setEvents] = useState(appearances ? hostsIn(appearances) : null);
  const [all, setAll] = useState(null);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/cast/characters/${character.id}/appearances`);
      setEvents(hostsIn(res.data));
    } catch (err) {
      console.error('[CharacterPlacesTab] hosted events failed:', err);
      setEvents([]);
      onNote({ error: true, text: errorText(err, 'Could not load their events') });
    }
  }, [character.id, onNote]);
  const given = Boolean(appearances);
  useEffect(() => { if (!given) load(); }, [load, given]);

  const startAdd = async () => {
    setAdding(true);
    if (all) return;
    try {
      const res = await api.get(`/api/v1/world/${showId}/events`);
      setAll(res.data?.events || []);
    } catch (err) {
      console.error('[CharacterPlacesTab] show events failed:', err);
      setAll([]);
      onNote({ error: true, text: errorText(err, "Could not load the show's events") });
    }
  };
  const add = async () => {
    if (!choice) return;
    setBusy('add');
    try {
      await api.post(`/api/v1/cast/characters/${character.id}/hosted-events`, { event_id: choice });
      setAdding(false);
      setChoice('');
      await load();
    } catch (err) {
      console.error('[CharacterPlacesTab] host failed:', err);
      onNote({ error: true, text: errorText(err, 'Could not add that event') });
    } finally { setBusy(null); }
  };
  const stop = async (ev) => {
    setBusy(ev.id);
    try {
      await api.delete(`/api/v1/cast/characters/${character.id}/hosted-events/${ev.id}`);
      await load();
    } catch (err) {
      console.error('[CharacterPlacesTab] unhost failed:', err);
      onNote({ error: true, text: errorText(err, 'Could not change the host') });
    } finally { setBusy(null); }
  };

  const hostedIds = new Set((events || []).map((e) => String(e.id)));
  // Another creator hosting an event is never replaced by a click (fifth
  // audit); a brand's event they co-host, the brand staying (Evoni,
  // 2026-10-17: "let them co-host brand events").
  const otherHost = (e) => (e.source_profile_id != null && Number(e.source_profile_id) !== Number(character.feed_profile_id) ? 'someone else' : '');
  const brandOf = (e) => String(e.host_brand || '').trim();
  const offered = (all || []).filter((e) => !hostedIds.has(String(e.id)));
  const open = offered.filter((e) => !otherHost(e));
  const taken = offered.length - open.length;
  return (
    <section className="cpl-role" data-testid="places-hosted-events">
      <h3 className="cpl-role-title"><CalendarDays size={16} aria-hidden="true" /> Hosted events</h3>
      {!character.feed_profile_id ? (
        <p className="cpl-note">Hosting events needs a feed profile. Match them to a feed person on The cast.</p>
      ) : (
        <>
          {events === null && <p className="cpl-note">Loading…</p>}
          {events?.length === 0 && <p className="cpl-note">They host no events yet.</p>}
          {(events || []).map((ev) => (
            <article key={ev.id} className="cpl-event" data-testid={`hosted-event-${ev.id}`}>
              <div className="cpl-event-head">
                <Link to={`/shows/${ev.show_id}/events/${ev.id}`} className="cpl-event-name">{ev.name}</Link>
                <span className="cpl-note">{[ev.event_date, ev.venue_name, ev.host_brand && `co-hosting with ${ev.host_brand}`].filter(Boolean).join(' · ')}</span>
                <button type="button" className="cpl-btn is-soft is-small" disabled={busy === ev.id} onClick={() => stop(ev)} data-testid={`hosted-event-stop-${ev.id}`}>
                  Not hosting
                </button>
              </div>
              {/* The event's photos: its look at the venue, made or uploaded here. */}
              {/* Read again when the event moves onto its own photos (seventh audit). */}
              <EventLookImage showId={ev.show_id} eventId={ev.id} canGenerate onToast={(text, kind) => onNote({ text, error: kind === 'error' })} refreshKey={ev.scene_set_id || ''} />
              {/* The event's own photos and angles (2026-10-17: "when I'm trying
                  to add angles to events, I'm not able to upload any images"). */}
              <EventPhotosAndAngles event={ev} onNote={onNote} onChanged={load} />
            </article>
          ))}
          {adding ? (
            <div className="cpl-row">
              <select className="cpl-input" aria-label="Event they host" value={choice} onChange={(e) => setChoice(e.target.value)} data-testid="hosted-event-select">
                <option value="">{all ? 'Choose an event…' : 'Loading…'}</option>
                {/* An event someone else hosts is shown, not offered (fifth audit). */}
                {open.map((e) => <option key={e.id} value={e.id}>{e.name}{brandOf(e) ? ` (co-host with ${brandOf(e)})` : ''}</option>)}
                {taken > 0 && (
                  <optgroup label="Already hosted by someone else">
                    {offered.filter((e) => otherHost(e)).map((e) => (
                      <option key={e.id} value={e.id} disabled>{e.name} (hosted by {otherHost(e)})</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button type="button" className="cpl-btn" disabled={!choice || busy === 'add'} onClick={add} data-testid="hosted-event-add-save">
                {busy === 'add' ? 'Saving…' : 'They host it'}
              </button>
              <button type="button" className="cpl-btn is-soft" onClick={() => setAdding(false)}>Cancel</button>
              {all && (
                <p className="cpl-note cpl-row-note" data-testid="hosted-event-note">
                  {open.length === 0
                    ? `Every event already has a host${taken ? ` (${taken} hosted by another creator)` : ''}. Create a new event in Producer Mode, or free one up on the event's page.`
                    : taken > 0 ? `${taken} more ${taken === 1 ? 'event is' : 'events are'} hosted by another creator, so ${taken === 1 ? 'it is' : 'they are'} listed but can't be chosen. A brand's event they co-host with the brand.` : null}
                </p>
              )}
            </div>
          ) : (
            <button type="button" className="cpl-btn is-soft" onClick={startAdd} data-testid="hosted-event-add">
              <Plus size={14} aria-hidden="true" /> Add a hosted event
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default function CharacterPlacesTab({ character, appearances = null }) {
  const [data, setData] = useState(null);
  const [sets, setSets] = useState(null);
  const [note, setNote] = useState(null);
  // Bumped per set when angles are added, so every card showing that set
  // reloads its angles (sixth audit).
  const [anglesKey, setAnglesKey] = useState({});
  const onAnglesAdded = useCallback((setId) => setAnglesKey((k) => ({ ...k, [setId]: (k[setId] || 0) + 1 })), []);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/cast/characters/${character.id}/places`);
      setData(res.data || { places: [] });
    } catch (err) {
      console.error('[CharacterPlacesTab] places failed:', err);
      setData({ places: [], error: errorText(err, 'Could not load their places.') });
    }
  }, [character.id]);
  useEffect(() => { load(); }, [load]);

  const loadSets = useCallback(async () => {
    if (sets || !data?.show_id) return;
    try {
      const res = await api.get('/api/v1/scene-sets', { params: { show_id: data.show_id } });
      const list = res.data?.data || [];
      setSets(list.filter((s) => s && s.id));
    } catch (err) {
      console.error('[CharacterPlacesTab] scene sets failed:', err);
      setSets([]);
      setNote({ error: true, text: 'Could not load the scene sets.' });
    }
  }, [sets, data?.show_id]);

  if (!data) return <p className="cpl-note">Loading…</p>;
  if (data.error) return <p className="cpl-note is-error">{data.error}</p>;
  if (!data.show_id) return <p className="cpl-note">Not in a show&rsquo;s cast yet, so no places to set.</p>;

  const places = data.places || [];
  const roleLabel = (role) => (ROLES.find((r) => r.role === role)?.label || 'place').toLowerCase();
  const linked = new Map(places.map((p) => [String(p.scene_set_id), roleLabel(p.role)]));
  return (
    <div className="cpl" data-testid="character-places-tab">
      {ROLES.map((spec) => (
        <RoleSection key={spec.role} spec={spec} places={places.filter((p) => p.role === spec.role)} linked={linked} character={character}
          showId={data.show_id} sets={sets} loadSets={loadSets} onSetsStale={() => setSets(null)} onChanged={load} onNote={setNote}
          anglesKey={anglesKey} onAnglesAdded={onAnglesAdded} />
      ))}
      <HostedEvents character={character} showId={data.show_id} onNote={setNote} appearances={appearances} />
      {/* Kept in view at the foot of the screen: on a phone the tab is
          several screens long, and a result below the hosted events was
          never seen (sixth audit). */}
      {note && <p className={`cpl-note cpl-toast${note.error ? ' is-error' : ''}`} role="status" data-testid="places-note">{note.text}</p>}
    </div>
  );
}

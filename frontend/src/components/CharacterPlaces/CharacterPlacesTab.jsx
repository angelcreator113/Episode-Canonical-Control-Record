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
import './CharacterPlacesTab.css';

const ROLES = Object.freeze([
  { role: 'home', label: 'Home', icon: Home, sceneType: 'HOME_BASE', single: true },
  { role: 'closet', label: 'Closet', icon: Shirt, sceneType: 'CLOSET', single: true },
  { role: 'work', label: 'Place of work', icon: Briefcase, sceneType: 'OTHER', single: false },
]);

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

/** One role's places: their sets, and pick or upload another. */
function RoleSection({ spec, places, character, showId, sets, loadSets, onChanged, onNote }) {
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
  // Upload photos: a new scene set from the first photo, linked as this place.
  const upload = async (file) => {
    if (!file) return;
    setBusy('upload');
    try {
      const created = await api.post('/api/v1/scene-sets', { name: `${name}'s ${spec.label}`, scene_type: spec.sceneType, show_id: showId });
      const setId = created.data?.data?.id;
      if (!setId) throw new Error('The scene set was not made');
      const form = new FormData();
      form.append('image', file);
      await api.post(`/api/v1/scene-sets/${setId}/upload-base`, form);
      await link(setId);
      onNote({ text: `${spec.label} made from your photo` });
      onChanged();
    } catch (err) {
      console.error('[CharacterPlacesTab] upload failed:', err);
      onNote({ error: true, text: errorText(err, 'Could not make the set from that photo') });
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
            {p.image_url ? <img src={p.image_url} alt={`${spec.label}: ${p.scene_set_name}`} /> : <div className="cpl-card-empty">No picture yet</div>}
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
          </li>
        ))}
      </ul>
      {canAdd && (picking ? (
        <div className="cpl-row">
          <select className="cpl-input" aria-label={`Their ${spec.label.toLowerCase()} set`} value={choice} onChange={(e) => setChoice(e.target.value)}
            data-testid={`place-pick-select-${spec.role}`}>
            <option value="">{sets ? 'Choose a scene set…' : 'Loading…'}</option>
            {(sets || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid={`place-upload-input-${spec.role}`}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
        </div>
      ))}
    </section>
  );
}

/** Hosted events, each with its photos; add or stop hosting one. */
function HostedEvents({ character, showId, onNote }) {
  const [events, setEvents] = useState(null);
  const [all, setAll] = useState(null);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/cast/characters/${character.id}/appearances`);
      setEvents((res.data?.events || []).filter((e) => e.role === 'host'));
    } catch (err) {
      console.error('[CharacterPlacesTab] hosted events failed:', err);
      setEvents([]);
      onNote({ error: true, text: errorText(err, 'Could not load their events') });
    }
  }, [character.id, onNote]);
  useEffect(() => { load(); }, [load]);

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
                <span className="cpl-note">{[ev.event_date, ev.venue_name].filter(Boolean).join(' · ')}</span>
                <button type="button" className="cpl-btn is-soft is-small" disabled={busy === ev.id} onClick={() => stop(ev)} data-testid={`hosted-event-stop-${ev.id}`}>
                  Not hosting
                </button>
              </div>
              {/* The event's photos: its look at the venue, made or uploaded here. */}
              <EventLookImage showId={ev.show_id} eventId={ev.id} canGenerate onToast={(text, kind) => onNote({ text, error: kind === 'error' })} />
            </article>
          ))}
          {adding ? (
            <div className="cpl-row">
              <select className="cpl-input" aria-label="Event they host" value={choice} onChange={(e) => setChoice(e.target.value)} data-testid="hosted-event-select">
                <option value="">{all ? 'Choose an event…' : 'Loading…'}</option>
                {(all || []).filter((e) => !hostedIds.has(String(e.id))).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button type="button" className="cpl-btn" disabled={!choice || busy === 'add'} onClick={add} data-testid="hosted-event-add-save">
                {busy === 'add' ? 'Saving…' : 'They host it'}
              </button>
              <button type="button" className="cpl-btn is-soft" onClick={() => setAdding(false)}>Cancel</button>
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

export default function CharacterPlacesTab({ character }) {
  const [data, setData] = useState(null);
  const [sets, setSets] = useState(null);
  const [note, setNote] = useState(null);

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
  return (
    <div className="cpl" data-testid="character-places-tab">
      {ROLES.map((spec) => (
        <RoleSection key={spec.role} spec={spec} places={places.filter((p) => p.role === spec.role)} character={character}
          showId={data.show_id} sets={sets} loadSets={loadSets} onChanged={load} onNote={setNote} />
      ))}
      <HostedEvents character={character} showId={data.show_id} onNote={setNote} />
      {note && <p className={`cpl-note${note.error ? ' is-error' : ''}`} role="status" data-testid="places-note">{note.text}</p>}
    </div>
  );
}

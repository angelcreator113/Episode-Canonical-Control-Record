/**
 * An event's photos kept as their own set (Evoni, 2026-10-17: "for this
 * night this place is going to look different"). On the everyday place, an
 * event card can take another set's photos as the event's look ("Use photos
 * from another set"), or show the set it already uses with "Stop using these
 * photos", which brings the event back to the everyday place. The event's
 * set is linked as an event version of the everyday set
 * (PUT /scene-sets/:id/version, sceneSetVersionService).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import api from '../../services/api';
import { sceneSetPath } from '../../utils/sceneSets';
import './EventPhotos.css';

/** "Use photos from another set" for an event held at this everyday set. */
export function UsePhotosFromSet({ set, event, onToast, onSaved }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  // Why a set would be refused, shown before a try (fifth audit): one with
  // event versions of its own, or one another event is held at.
  const refusal = (o) => {
    if (o.has_versions) return 'it has event versions';
    // The location's everyday look is not one event's photos (seventh audit).
    if (o.is_everyday_look) return "it is the location's everyday look";
    const others = (o.used_by || []).filter((e) => String(e.id) !== String(event.id));
    return others.length ? `used by ${others.map((e) => e.name).join(', ')}` : null;
  };

  const start = async () => {
    setOpen(true);
    setError(null);
    if (options) return;
    try {
      const res = await api.get(`/api/v1/scene-sets/${set.id}/version-options`);
      const data = res.data?.data || {};
      setOptions(data.everyday_sets || []);
      setLocked(Boolean((data.events || []).find((e) => String(e.id) === String(event.id))?.locked));
    } catch (err) {
      console.error('[EventPhotos] options failed:', err);
      setError(err.response?.data?.error || 'Could not load the sets');
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/v1/scene-sets/${chosen}/version`, { everyday_set_id: set.id, event_id: event.id });
      const name = options.find((o) => String(o.id) === String(chosen))?.name || 'That set';
      onToast?.(`${name} is now ${event.name}'s photos`);
      setOpen(false);
      setOptions(null);
      onSaved?.();
    } catch (err) {
      console.error('[EventPhotos] link failed:', err);
      setError(err.response?.data?.error || 'Could not use that set');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="evp-btn" onClick={start} data-testid={`event-photos-use-${event.id}`}>
        <Images size={12} aria-hidden="true" /> Use photos from another set
      </button>
    );
  }
  return (
    <div className="evp-form" data-testid={`event-photos-form-${event.id}`}>
      {options && locked ? (
        <span className="evp-hint" data-testid={`event-photos-locked-${event.id}`}>Its episode is accepted: the event's place is locked.</span>
      ) : options ? (
        <>
          <select aria-label="Set with this event's photos" value={chosen} disabled={busy} onChange={(e) => setChosen(e.target.value)}
            data-testid={`event-photos-set-${event.id}`}>
            <option value="">Choose the set…</option>
            {options.map((o) => {
              const why = refusal(o);
              return <option key={o.id} value={o.id} disabled={Boolean(why)}>{o.name}{why ? ` (${why})` : ''}</option>;
            })}
          </select>
          <button type="button" className="evp-btn" disabled={busy || !chosen} onClick={save} data-testid={`event-photos-save-${event.id}`}>Use these photos</button>
        </>
      ) : !error && <span className="evp-hint">Loading the sets…</span>}
      <button type="button" className="evp-btn evp-btn-plain" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      {options && options.length === 0 && <span className="evp-hint">No other sets in this show.</span>}
      {error && <span className="evp-hint" role="alert">{error}</span>}
    </div>
  );
}

/**
 * The set an event's photos are in, with "Stop using these photos". On the
 * everyday place: the event's card. On the event's own set: from the other
 * side (everyday names the everyday place).
 *
 * Seventh audit: its links open the other set's panel (onLeave closes this
 * one; the zone opens the target's), and an event whose episode is accepted
 * is not offered "Stop using these photos": its place is locked.
 */
export function EventPhotosSet({ photosSet, showId, everyday = null, event = null, onToast, onSaved, onLeave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // keep: the set becomes its own place and the event stays on it (the old
  // chooser's "Everyday", fifth audit); else the event returns to the
  // everyday place.
  const stop = async (keep = false) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/v1/scene-sets/${photosSet.id}/version`, keep ? { everyday_set_id: null } : { everyday_set_id: null, return_event: true });
      onToast?.(keep || !event ? `${photosSet.name} is its own set` : `${event.name} uses the everyday place again`);
      onSaved?.();
    } catch (err) {
      console.error('[EventPhotos] unlink failed:', err);
      setError(err.response?.data?.error || 'Could not stop using these photos');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="evp-set" data-testid={`event-photos-set-row-${photosSet.id}`}>
      {everyday ? (
        <span>
          These are the photos for {event ? <strong>{event.name}</strong> : 'an event'} at{' '}
          <Link to={sceneSetPath(showId, everyday.id, { zone: 'place' })} onClick={() => onLeave?.()} data-testid={`event-photos-everyday-${photosSet.id}`}>{everyday.name}</Link>.
        </span>
      ) : (
        <span>
          Its photos are their own set:{' '}
          <Link to={sceneSetPath(showId, photosSet.id, { zone: 'place' })} onClick={() => onLeave?.()} data-testid={`event-photos-open-${photosSet.id}`}>{photosSet.name}</Link>
        </span>
      )}
      {event && event.locked && (
        <span className="evp-hint" data-testid={`event-photos-locked-${photosSet.id}`}>Its episode is accepted: the event&rsquo;s place is locked.</span>
      )}
      {event && !event.locked && (
        <button type="button" className="evp-btn evp-btn-plain" disabled={busy} onClick={() => stop(false)} data-testid={`event-photos-stop-${photosSet.id}`}>
          Stop using these photos
        </button>
      )}
      <button type="button" className="evp-btn evp-btn-plain" disabled={busy} onClick={() => stop(true)} data-testid={`event-photos-own-${photosSet.id}`}
        title={event ? `${photosSet.name} becomes a place of its own; ${event.name} stays on it` : `${photosSet.name} becomes a place of its own`}>
        Make it its own set
      </button>
      {error && <span className="evp-hint" role="alert">{error}</span>}
    </div>
  );
}

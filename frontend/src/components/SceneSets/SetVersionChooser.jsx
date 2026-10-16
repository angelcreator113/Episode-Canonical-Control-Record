/**
 * Everyday set or event version (Evoni, 2026-10-16: "i also need to be able
 * to choose which photo is the everyday set and which ones belong to an
 * event set"; she chose whole sets). A set is the place as it usually is
 * (Everyday) or that place dressed for one event (an event version of an
 * everyday set). The event then uses the version for its scenes and look.
 * Reads GET /scene-sets/:id/version-options; saves PUT /scene-sets/:id/version.
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import './SetVersionChooser.css';

export default function SetVersionChooser({ set, onSaved, onToast }) {
  const isVersion = Boolean(set.version_of);
  const [mode, setMode] = useState(isVersion ? 'event' : 'everyday');
  const [options, setOptions] = useState(null);
  const [everydayId, setEverydayId] = useState(set.version_of?.id || '');
  const [eventId, setEventId] = useState(set.version_event?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setMode(set.version_of ? 'event' : 'everyday');
    setEverydayId(set.version_of?.id || '');
    setEventId(set.version_event?.id || '');
  }, [set.id, set.version_of, set.version_event]);

  useEffect(() => {
    if (mode !== 'event' || options) return undefined;
    let live = true;
    api.get(`/api/v1/scene-sets/${set.id}/version-options`)
      .then((res) => { if (live) setOptions(res.data?.data || { everyday_sets: [], events: [] }); })
      .catch((err) => {
        console.error('[SetVersionChooser] options failed:', err);
        if (live) setError(err.response?.data?.error || 'Could not load the sets and events');
      });
    return () => { live = false; };
  }, [mode, options, set.id]);

  const save = async (body, toast) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/v1/scene-sets/${set.id}/version`, body);
      onToast?.(toast);
      onSaved?.();
    } catch (err) {
      console.error('[SetVersionChooser] save failed:', err);
      setError(err.response?.data?.error || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const chooseMode = (next) => {
    setMode(next);
    setError(null);
    // Back to everyday from a version: saved at once (nothing else to choose).
    if (next === 'everyday' && isVersion) save({ everyday_set_id: null }, `${set.name} is an everyday set`);
  };

  const everyday = options?.everyday_sets.find((s) => String(s.id) === String(everydayId));
  const event = options?.events.find((e) => String(e.id) === String(eventId));
  const unchanged = isVersion && String(everydayId) === String(set.version_of?.id) && String(eventId) === String(set.version_event?.id || '');
  const versions = set.event_versions || [];

  return (
    <div className="sv" data-testid={`set-version-${set.id}`}>
      <span className="sv-label">This set is</span>
      <div className="sv-now" data-testid={`set-version-now-${set.id}`}>
        {isVersion
          ? <>An event version of <strong>{set.version_of.name}</strong>{set.version_event ? <> for <strong>{set.version_event.name}</strong></> : null}</>
          : 'The everyday set: the place as it usually is'}
      </div>
      {!isVersion && versions.length > 0 && (
        <div className="sv-versions" data-testid={`set-version-list-${set.id}`}>
          Event versions: {versions.map((v) => (v.event ? `${v.name} (${v.event.name})` : v.name)).join(', ')}
        </div>
      )}
      <div className="sv-modes" role="radiogroup" aria-label="This set is">
        <label><input type="radio" name={`sv-${set.id}`} checked={mode === 'everyday'} disabled={busy} onChange={() => chooseMode('everyday')} /> Everyday</label>
        <label><input type="radio" name={`sv-${set.id}`} checked={mode === 'event'} disabled={busy || versions.length > 0} onChange={() => chooseMode('event')} /> An event version</label>
      </div>
      {versions.length > 0 && mode === 'everyday' && (
        <span className="sv-hint">It has event versions, so it stays an everyday set.</span>
      )}
      {mode === 'event' && (
        options ? (
          <div className="sv-form">
            <select aria-label="Everyday set" value={everydayId} disabled={busy} onChange={(e) => setEverydayId(e.target.value)} data-testid={`set-version-everyday-${set.id}`}>
              <option value="">Version of…</option>
              {options.everyday_sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select aria-label="Event" value={eventId} disabled={busy} onChange={(e) => setEventId(e.target.value)} data-testid={`set-version-event-${set.id}`}>
              <option value="">For the event…</option>
              {options.events.map((e) => (
                <option key={e.id} value={e.id} disabled={e.locked && String(e.id) !== String(set.version_event?.id)}>
                  {e.name}{e.locked ? ' (episode accepted)' : ''}
                </option>
              ))}
            </select>
            <button type="button" className="sv-btn" disabled={busy || !everydayId || !eventId || unchanged}
              onClick={() => save({ everyday_set_id: everydayId, event_id: eventId }, `${set.name} is ${event?.name || 'the event'}'s version of ${everyday?.name || 'the everyday set'}`)}
              data-testid={`set-version-save-${set.id}`}>
              Save
            </button>
            {options.events.length === 0 && <span className="sv-hint">This set's show has no events yet.</span>}
          </div>
        ) : !error && <span className="sv-hint">Loading the sets and events…</span>
      )}
      {mode === 'event' && <span className="sv-hint">The event then uses this set for its scenes and its look.</span>}
      {error && <span className="sv-hint" role="alert" data-testid={`set-version-error-${set.id}`}>{error}</span>}
    </div>
  );
}

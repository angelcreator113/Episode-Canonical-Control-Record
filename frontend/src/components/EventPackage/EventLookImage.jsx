/**
 * "Generate this look" in the Event Package's Place section (Evoni's
 * rulings L7-L9, 2026-10-02, and her answers 3, 4 and 6;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L7. "The Place section has one-click 'Generate this look', with its
 *   cost shown first (S2)."
 *   L8. "If the venue has no approved base, 'Generate this look' makes the
 *   base only (the empty room, no event dressing) and stops; the base waits
 *   for Evoni's approval in Scene Sets."
 *   L9. "The Place section shows the event's look thumbnail with 'Open in
 *   Scene Sets'."
 *
 * The cost is shown first in SceneBriefConfirm; after Confirm the section
 * says "Generating…" and refreshes until the image is done or failed
 * (answer 6). Several sets at the venue: Evoni chooses one (answer 3).
 *
 * Props: showId, eventId, onToast(msg, type) (type 'error' for a failure), canGenerate (the Scene Sets panel), fromLabel,
 * onSaved() (reloads the event: a set may have been created and linked;
 * also called when a look or base it saw generating finishes or fails, so
 * the page around it shows the new image),
 * pollMs (the refresh interval; tests shorten it).
 *
 * S8 (Evoni, 2026-10-02; §8(dd), answer 1): the look is made in the Scene
 * Sets panel's Looks row (canGenerate); the Place shows status only, with
 * "Open in Scene Sets →" on the event's look (zone look:<eventId>).
 *
 * DJ bug 1 (Evoni, 2026-10-02): the section refreshes whenever the server
 * says the look or the base is generating, not only after its own Confirm
 * (reloading the event can remount it mid-run), and says when it finishes
 * or fails, with the reason. A run stuck for 10 minutes is marked failed by
 * the server (GET .../look), so the refresh always ends.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import OpenInSceneSets from '../OpenInSceneSets';
import { Sparkles, Loader2, Upload } from 'lucide-react';
import api from '../../services/api';
import SceneBriefConfirm from '../SceneBriefConfirm';
import './EventLookImage.css';

export const POLL_MS = 4000;
// Longer than the server's 10-minute stuck timeout, so a stuck run is seen failing.
const POLL_MAX = 180;

const lookGenerating = (d) => d?.look?.status === 'generating';
const baseGenerating = (d) => d?.scene_set?.generation_status === 'generating';

export default function EventLookImage({ showId, eventId, onToast, onSaved, pollMs = POLL_MS, canGenerate = false, fromLabel = 'Event' }) {
  const base = `/api/v1/world/${showId}/events/${eventId}/look`;
  const [state, setState] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [choose, setChoose] = useState(null); // options
  const [chosenSet, setChosenSet] = useState(null);
  const [brief, setBrief] = useState(null); // { step, title, note }
  const [waiting, setWaiting] = useState(null); // 'look' | 'base', from Confirm until the server shows it
  const [uploading, setUploading] = useState(false);
  const pendingFile = useRef(null); // an upload waiting for the set to be chosen
  const fileInput = useRef(null);
  const polls = useRef(0);
  const last = useRef(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  // Says when a look or base this section saw generating finishes or fails.
  const announce = (prev, data) => {
    const toast = toastRef.current;
    // A failed re-run keeps the previous image: complete, with the error.
    if (lookGenerating(prev) && data?.look?.status === 'complete' && !data.look.error) toast?.('The look is ready');
    if (lookGenerating(prev) && (data?.look?.status === 'failed' || (data?.look?.status === 'complete' && data.look.error))) {
      toast?.(`The look could not be generated${data.look.error ? `: ${data.look.error}` : ''}`, 'error');
    }
    if (baseGenerating(prev) && data?.scene_set?.generation_status === 'complete') toast?.('The base is ready: approve it in Scene Sets');
    if (baseGenerating(prev) && data?.scene_set?.generation_status === 'failed') toast?.(`The base could not be generated${data.scene_set.error ? `: ${data.scene_set.error}` : ''}`, 'error');
    const finished = (lookGenerating(prev) && !lookGenerating(data)) || (baseGenerating(prev) && !baseGenerating(data));
    if (finished) Promise.resolve(savedRef.current?.()).catch((err) => console.error('[EventLookImage] refresh after a run failed:', err));
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get(base);
      const data = res.data?.data || null;
      if (last.current) announce(last.current, data);
      last.current = data;
      setState(data);
      setLoadFailed(false);
      return data;
    } catch (err) {
      console.error('[EventLookImage] load failed:', err);
      // A failed refresh keeps what is shown; a first load that fails says so.
      if (!last.current) setLoadFailed(true);
      return null;
    }
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // DJ bug 6: an approval made in Scene Sets shows when Evoni comes back.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const serverGenerating = lookGenerating(state) || baseGenerating(state);
  const generating = Boolean(waiting) || serverGenerating;

  // Refresh while anything is generating (answer 6; DJ bug 1).
  useEffect(() => {
    if (!generating) return undefined;
    polls.current = 0;
    const timer = setInterval(async () => {
      polls.current += 1;
      const data = await load();
      const still = lookGenerating(data) || baseGenerating(data);
      if (data && !still) setWaiting(null);
      if (polls.current >= POLL_MAX) {
        clearInterval(timer);
        setWaiting(null);
      }
    }, pollMs);
    return () => clearInterval(timer);
  }, [generating, load, pollMs]);

  const ask = async (setId = chosenSet) => {
    setAsking(true);
    try {
      const res = await api.post(`${base}/brief`, setId ? { scene_set_id: setId } : {});
      const data = res.data?.data || {};
      if (data.step === 'choose') {
        setChoose(data.options || []);
        return;
      }
      setChoose(null);
      if (data.step === 'awaiting_approval') {
        onToast?.('The base is waiting for your approval in Scene Sets');
        return;
      }
      const setName = data.scene_set?.name || data.creates_set?.name || 'the venue';
      setBrief(data.step === 'look'
        ? { step: 'look', title: `Generate this look on “${setName}”`, note: 'An edit of the venue\'s everyday look, dressed for this event.' }
        : { step: 'base', title: `Generate the base for “${setName}”`, note: 'The empty room, with no event dressing. It then waits for your approval in Scene Sets.' });
    } catch (err) {
      console.error('[EventLookImage] brief failed:', err);
      onToast?.(err.response?.data?.error || err.message || 'Could not prepare the look', 'error');
    } finally {
      setAsking(false);
    }
  };

  const confirm = async (overrides) => {
    const step = brief.step;
    setBrief(null);
    try {
      const body = { overrides };
      if (chosenSet) body.scene_set_id = chosenSet;
      const res = await api.post(`${base}/generate`, body);
      const data = res.data?.data || {};
      await onSaved?.();
      await load();
      if (data.step === 'awaiting_approval') {
        onToast?.('The base is waiting for your approval in Scene Sets');
        return;
      }
      setWaiting(step);
    } catch (err) {
      console.error('[EventLookImage] generate failed:', err);
      if (err.response?.data?.code === 'CHOOSE_SET') setChoose(err.response.data.options || []);
      onToast?.(err.response?.data?.error || err.message || 'Could not generate the look', 'error');
    }
  };

  // Evoni, 2026-10-15: the event's look from her own image, beside "Generate
  // this look"; several sets at the venue, she chooses one first (answer 3).
  const upload = async (file, setId = chosenSet) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      if (setId) form.append('scene_set_id', setId);
      await api.post(`${base}/upload`, form);
      pendingFile.current = null;
      setChoose(null);
      await onSaved?.();
      await load();
      onToast?.('The look is uploaded');
    } catch (err) {
      console.error('[EventLookImage] upload failed:', err);
      if (err.response?.data?.code === 'CHOOSE_SET') {
        pendingFile.current = file;
        setChoose(err.response.data.options || []);
        return;
      }
      onToast?.(err.response?.data?.error || err.message || 'Could not upload the look', 'error');
    } finally {
      setUploading(false);
    }
  };

  const set = state?.scene_set || null;
  const look = state?.look || null;
  const lookReady = look?.status === 'complete' && look.image_url;
  const approved = state?.approved_base || null;
  const baseWaiting = set && set.base_still_url && !approved;
  const baseFailed = !lookReady && set?.generation_status === 'failed';
  // L13: the Place locks when the episode is accepted.
  const locked = state?.editable === false;
  const openSetId = set?.id || approved?.scene_set_id || null;

  return (
    <div className="ell" data-testid="event-look-image">
      <div className="ell-head">
        <span className="epp-fields-label">Look image</span>
        {canGenerate && !locked && (
          <button type="button" className="epp-btn epp-btn-small" onClick={() => ask()} disabled={asking || generating} data-testid="generate-this-look">
            <Sparkles size={14} aria-hidden="true" /> {asking ? 'Preparing…' : 'Generate this look'}
          </button>
        )}
        {canGenerate && !locked && (
          <>
            <button type="button" className="epp-btn epp-btn-small" onClick={() => fileInput.current?.click()} disabled={uploading || generating} data-testid="upload-this-look">
              <Upload size={14} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Upload this look'}
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="upload-this-look-input"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
          </>
        )}
      </div>

      {generating && (
        <p className="ell-status" data-testid="event-look-generating"><Loader2 size={14} className="epp-spin-icon" aria-hidden="true" /> Generating…</p>
      )}
      {!generating && lookReady && (
        <figure className="ell-figure">
          <img src={look.image_url} alt="This event's look" data-testid="event-look-thumb" />
          {look.source === 'uploaded' && <figcaption className="ell-note" data-testid="event-look-uploaded">Uploaded</figcaption>}
          {look.stale && (
            <figcaption className="ell-error" data-testid="event-look-stale">Made from an old everyday look: episodes don't use it. Generate it again.</figcaption>
          )}
        </figure>
      )}
      {state?.venue_changed && (
        <p className="ell-error" data-testid="event-look-venue-changed">
          The event's venue changed: this look is at the old venue, and episodes don't use it. Make the look again for the new venue.
        </p>
      )}
      {!generating && (look?.status === 'failed' || (lookReady && look.error)) && (
        <p className="ell-error" data-testid="event-look-failed">The last try failed{look.error ? `: ${look.error}` : ''}.</p>
      )}
      {!generating && baseFailed && (
        <p className="ell-error" data-testid="event-look-base-failed">The base could not be generated{set.error ? `: ${set.error}` : ''}.</p>
      )}
      {!generating && !lookReady && baseWaiting && (
        <p className="ell-note" data-testid="event-look-awaiting">
          The venue's base is waiting for your approval. Approve it in Scene Sets, then {canGenerate ? 'generate this look' : 'make this look there'}.
        </p>
      )}
      {/* DJ bug 6: before the event's look exists, the venue's approved base,
          which "Generate this look" dresses for this event. */}
      {!generating && !lookReady && approved?.image_url && (
        <figure className="ell-figure" data-testid="event-look-approved-base">
          <img src={approved.image_url} alt="The venue's everyday look" />
          <figcaption className="ell-note">
            The venue's everyday look.{locked ? '' : (canGenerate ? ' Generate this look to dress it for this event.' : " Make this event's look in Scene Sets.")}
          </figcaption>
        </figure>
      )}
      {loadFailed && (
        <p className="ell-error" data-testid="event-look-load-failed">
          Couldn't load this look.{' '}
          <button type="button" className="ell-link" onClick={() => load()}>Try again</button>
        </p>
      )}
      {!loadFailed && !state && !generating && <p className="ell-note" data-testid="event-look-loading">Loading…</p>}
      {state && !generating && !lookReady && !baseWaiting && !look && !baseFailed && !approved && (
        <p className="ell-note">{canGenerate || openSetId ? 'No look image yet.' : "Choose the event's scene set, then make its look in Scene Sets."}</p>
      )}
      {locked && (
        <p className="ell-note" data-testid="event-look-locked">The episode is accepted: the Place is locked.</p>
      )}
      {!canGenerate && openSetId && (
        <OpenInSceneSets showId={showId} setId={openSetId} zone={`look:${eventId}`} fromLabel={fromLabel} need="This event's look"
          className="epp-inline-link ell-open" testId="event-look-open" />
      )}

      {choose && (
        <div className="ell-choose" role="group" aria-label="Choose the venue's scene set" data-testid="event-look-choose">
          <p className="ell-note">This venue has several scene sets. Choose the one for this look:</p>
          {choose.map((o) => (
            <button key={o.id} type="button" className="epp-btn epp-btn-small" data-testid={`event-look-choose-${o.id}`}
              onClick={() => { setChosenSet(o.id); if (pendingFile.current) upload(pendingFile.current, o.id); else ask(o.id); }}>
              {o.name}
            </button>
          ))}
        </div>
      )}

      {brief && (
        <SceneBriefConfirm
          setId={set?.id || null}
          showId={showId}
          eventId={eventId}
          title={brief.title}
          note={brief.note}
          requestBrief={(body) => api.post(`${base}/brief`, chosenSet ? { ...body, scene_set_id: chosenSet } : body)}
          onConfirm={(overrides) => confirm(overrides)}
          onCancel={() => setBrief(null)}
        />
      )}
    </div>
  );
}

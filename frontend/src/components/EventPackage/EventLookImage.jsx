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
 * Props: showId, eventId, sceneSetPath(showId, setId), onToast(msg),
 * onSaved() (reloads the event: a set may have been created and linked),
 * pollMs (the refresh interval; tests shorten it).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import api from '../../services/api';
import SceneBriefConfirm from '../SceneBriefConfirm';

export const POLL_MS = 4000;
const POLL_MAX = 45;

export default function EventLookImage({ showId, eventId, sceneSetPath, onToast, onSaved, pollMs = POLL_MS }) {
  const base = `/api/v1/world/${showId}/events/${eventId}/look`;
  const [state, setState] = useState(null);
  const [asking, setAsking] = useState(false);
  const [choose, setChoose] = useState(null); // options
  const [chosenSet, setChosenSet] = useState(null);
  const [brief, setBrief] = useState(null); // { step, title, note }
  const [waiting, setWaiting] = useState(null); // 'look' | 'base'
  const polls = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get(base);
      const data = res.data?.data || null;
      setState(data);
      return data;
    } catch (err) {
      console.error('[EventLookImage] load failed:', err);
      return null;
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  // Refresh until the look (or the base) is done or failed (answer 6).
  useEffect(() => {
    if (!waiting) return undefined;
    polls.current = 0;
    const timer = setInterval(async () => {
      polls.current += 1;
      const data = await load();
      const status = waiting === 'look' ? data?.look?.status : data?.scene_set?.generation_status;
      if (status === 'complete' || status === 'failed' || polls.current >= POLL_MAX) {
        setWaiting(null);
        if (status === 'failed') onToast?.(waiting === 'look' ? 'The look could not be generated' : 'The base could not be generated');
        if (status === 'complete') onToast?.(waiting === 'look' ? 'The look is ready' : 'The base is ready: approve it in Scene Sets');
      }
    }, pollMs);
    return () => clearInterval(timer);
  }, [waiting, load, onToast, pollMs]);

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
        ? { step: 'look', title: `Generate this look on “${setName}”`, note: 'An edit of the approved base with this event\'s look.' }
        : { step: 'base', title: `Generate the base for “${setName}”`, note: 'The empty room, with no event dressing. It then waits for your approval in Scene Sets.' });
    } catch (err) {
      console.error('[EventLookImage] brief failed:', err);
      onToast?.(err.response?.data?.error || err.message || 'Could not prepare the look');
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
      onToast?.(err.response?.data?.error || err.message || 'Could not generate the look');
    }
  };

  const set = state?.scene_set || null;
  const look = state?.look || null;
  const lookReady = look?.status === 'complete' && look.image_url;
  const baseWaiting = set && set.base_still_url && !state?.approved_base;
  const generating = Boolean(waiting) || look?.status === 'generating' || set?.generation_status === 'generating';

  return (
    <div className="ell" data-testid="event-look-image">
      <div className="ell-head">
        <span className="epp-fields-label">Look image</span>
        <button type="button" className="epp-btn epp-btn-small" onClick={() => ask()} disabled={asking || generating} data-testid="generate-this-look">
          <Sparkles size={14} aria-hidden="true" /> {asking ? 'Preparing…' : 'Generate this look'}
        </button>
      </div>

      {generating && (
        <p className="ell-status" data-testid="event-look-generating"><Loader2 size={14} className="epp-spin-icon" aria-hidden="true" /> Generating…</p>
      )}
      {!generating && lookReady && (
        <figure className="ell-figure">
          <img src={look.image_url} alt="This event's look" data-testid="event-look-thumb" />
        </figure>
      )}
      {!generating && look?.status === 'failed' && (
        <p className="ell-error" data-testid="event-look-failed">The last try failed{look.error ? `: ${look.error}` : ''}.</p>
      )}
      {!generating && !lookReady && baseWaiting && (
        <p className="ell-note" data-testid="event-look-awaiting">
          The venue's base is waiting for your approval. Approve it in Scene Sets, then generate this look.
        </p>
      )}
      {!generating && !lookReady && !baseWaiting && !look && (
        <p className="ell-note">No look image yet.</p>
      )}
      {set && (
        <Link className="epp-inline-link ell-open" to={sceneSetPath(showId, set.id)} data-testid="event-look-open">Open in Scene Sets</Link>
      )}

      {choose && (
        <div className="ell-choose" role="group" aria-label="Choose the venue's scene set" data-testid="event-look-choose">
          <p className="ell-note">This venue has several scene sets. Choose the one for this look:</p>
          {choose.map((o) => (
            <button key={o.id} type="button" className="epp-btn epp-btn-small" data-testid={`event-look-choose-${o.id}`}
              onClick={() => { setChosenSet(o.id); ask(o.id); }}>
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

// The show tab's opportunities and beat 14 (Evoni, 2026-10-19: "for beat 14
// we have opportunities currently available in the show tab but when i
// clicked it to try and attach it to the show it marked it as complete
// instead of allowing me to set it up"). An open opportunity can be attached
// to an episode's beat 14 from its card: pick the episode, then who at that
// episode's event offers it (GET/PUT …/episode/:episodeId/beat14,
// services/beat14Opportunity). One held for beat 14 says which episode, with
// a link to its Script tab.
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, ClipboardCheck } from 'lucide-react';
import { episodeCode, seasonContextOf } from '../../lib/episodePipeline';
import './OpportunityBeat14.css';

/** The statuses beat 14 can take (services/beat14Opportunity OPEN_STATUSES). */
export const BEAT14_OPEN = ['offered', 'considering', 'negotiating'];

export const canAttachToBeat14 = (opp) => !!opp && BEAT14_OPEN.includes(opp.status) && !opp.offered_in_episode_id;

/**
 * Whether the card offers Undo: a step back is there to take. Mirrors the
 * server's rule (routes/opportunityRoutes statusBeforeLastStep and the undo
 * route): nothing held or expired, and nothing whose last step came from
 * beat 14 (attached, let go, or decided at completion), which the server
 * refuses (Script page re-audit, 2026-10-19: Undo showed and always failed).
 */
export function statusBeforeLastStep(history, current) {
  const stack = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || typeof h.status !== 'string') continue;
    if (h.note === 'Undone' && h.undone_from) { stack.pop(); if (stack[stack.length - 1] !== h.status) stack.push(h.status); continue; }
    stack.push(h.status);
  }
  if (stack.length && stack[stack.length - 1] !== current) return stack[stack.length - 1];
  for (let i = stack.length - 2; i >= 0; i -= 1) if (stack[i] !== current) return stack[i];
  return null;
}
export const canUndo = (opp) => {
  if (!opp || ['held', 'expired'].includes(opp.status) || !Array.isArray(opp.status_history) || opp.status_history.length < 2) return false;
  const back = statusBeforeLastStep(opp.status_history, opp.status);
  return !!back && back !== 'held';
};

/** Completed episodes (evaluation_status 'accepted', services/beat14Opportunity isCompleted) take no new beat 14 opportunity. */
export const isCompletedEpisode = (ep) => ep?.evaluation_status === 'accepted';

/**
 * A held one's status chip. Which episode it waits for, and its link, are
 * on the card's "Offered in" line (OfferedInEpisode; Evoni, 2026-10-25),
 * so the chip no longer repeats the episode's title.
 */
export function HeldForBeat14({ opp }) {
  if (!opp?.beat14_episode && !opp?.offered_in_episode_id) return null;
  return <span className="ob14-held" data-testid={`opp-held-${opp.id}`}><Gift size={12} aria-hidden="true" />held for beat 14</span>;
}

/**
 * Where it stands in its episode's beat 14 (Evoni, 2026-10-25): held until
 * the episode is done, offered, or expired. Offered once completion (or a
 * release by hand) offered it, whatever step it took after.
 */
export function offeredInState(opp) {
  if (opp?.status === 'held') return "held until it's done";
  if (opp?.status === 'expired') return 'expired';
  return 'offered';
}

/** "Offered in S1 E5 · held until it's done", linking to that episode's Script tab. */
export function OfferedInEpisode({ opp }) {
  const ep = opp?.beat14_episode || (opp?.offered_in_episode_id ? { id: opp.offered_in_episode_id } : null);
  if (!ep) return null;
  // Its code ("S1 E5", or the slot's "S2 · E1"); without a number, its title.
  const b = opp.beat14_episode;
  const code = b && (b.episode_number || seasonContextOf(b)?.label) ? episodeCode(b) : (b?.title || 'its episode');
  return (
    <p className="ob14-offered" data-testid={`opp-offered-in-${opp.id}`}>
      <Gift size={12} aria-hidden="true" />
      <Link to={`/episodes/${ep.id}?tab=scripts`} title={ep.title ? `Beat 14 of ${ep.title}` : undefined}>Offered in {code}</Link>
      <span className={`ob14-offered-state is-${opp.status === 'held' ? 'held' : opp.status === 'expired' ? 'expired' : 'offered'}`}> · {offeredInState(opp)}</span>
    </p>
  );
}

/** The episode a held one waits for, by title or number. */
export const heldEpisodeName = (opp) => {
  const ep = opp?.beat14_episode;
  if (ep?.title) return ep.title;
  if (ep?.episode_number != null) return `Episode ${ep.episode_number}`;
  return 'its episode';
};

/**
 * Why a held one has no Schedule as Event (Evoni, 2026-10-23: "I can't turn
 * it into an event, how should that work?"): it waits for its episode, or
 * that episode was completed without settling it. Links to the episode's
 * evaluation, where it is completed.
 */
export function heldWhyText(opp) {
  const name = heldEpisodeName(opp);
  return isCompletedEpisode(opp?.beat14_episode)
    ? `${name} is completed but this was never settled.`
    : `Waits for ${name} to be completed. Offered if it lands, gone if it fails.`;
}

export function HeldWhy({ opp }) {
  const ep = opp?.beat14_episode || (opp?.offered_in_episode_id ? { id: opp.offered_in_episode_id } : null);
  if (!ep) return null;
  return (
    <p className="ob14-why" data-testid={`opp-held-why-${opp.id}`}>
      <span data-testid={`opp-held-why-text-${opp.id}`}>{heldWhyText(opp)}</span>{' '}
      <Link to={`/episodes/${ep.id}/evaluate`} className="ob14-why-link">
        <ClipboardCheck size={12} aria-hidden="true" />
        {isCompletedEpisode(opp.beat14_episode) ? 'See its evaluation' : 'Go to its evaluation'}
      </Link>
    </p>
  );
}

/** The confirm for Schedule as Event now on a held one. */
export const scheduleEarlyText = (opp) => `Schedule ${opp.name} as an event now? It is offered and its event is created now, without waiting for ${heldEpisodeName(opp)}'s result. Beat 14 of ${heldEpisodeName(opp)} still delivers it as the invitation.`;

/** The confirm for Release offer on a held one whose episode is not completed (none is asked for a completed one). */
export const releaseText = (opp) => `Offer ${opp.name} now? It is offered without waiting for ${heldEpisodeName(opp)}'s result. Beat 14 of ${heldEpisodeName(opp)} still delivers it as the invitation.`;

// The GET payload does not say whether the attached one was made for beat 14
// (then removed when replaced) or brought from the list (then put back).
// Shared with the Script page's beat 14 panel, so Remove and Change say the
// same (Script page audit 3, 2026-10-19).
export const letGoText = (cur) => `${cur.name} goes back to its earlier status, or is deleted if it was made for beat 14.`;
export const replaceText = (epName, cur) => `Beat 14 of ${epName} already offers ${cur.name}; attaching replaces it. ${letGoText(cur)}`;

/**
 * The inline form: episode, then who at its event offers it, then attach.
 * `episodes` is the show's episodes the page already read.
 */
export function Beat14AttachForm({ showId, opp, episodes = [], api, onDone, onCancel }) {
  const [episodeId, setEpisodeId] = useState('');
  const [people, setPeople] = useState(null);
  // What the chosen episode's beat 14 already offers: attaching replaces it
  // (Script page re-audit, 2026-10-19: it was let go, or deleted, unasked).
  const [current, setCurrent] = useState(null);
  // The latest episode chosen: an earlier read answering late is dropped.
  const readRef = useRef(0);
  const open = episodes.filter((ep) => !isCompletedEpisode(ep));
  const chosen = episodes.find((ep) => String(ep.id) === String(episodeId)) || null;
  const epName = chosen ? (chosen.title || (chosen.episode_number != null ? `Episode ${chosen.episode_number}` : 'the episode')) : 'the episode';
  const replacing = current && String(current.id) !== String(opp.id) ? current : null;
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const url = (id) => `/api/v1/opportunities/${showId}/episode/${id}/beat14`;
  // Focus goes into the form when it opens (Script page audit 3, 2026-10-19:
  // the button that opened it went away and focus fell to the page).
  const episodeRef = useRef(null);
  useEffect(() => { episodeRef.current?.focus(); }, []);

  const chooseEpisode = async (id) => {
    const seq = readRef.current + 1;
    readRef.current = seq;
    setEpisodeId(id); setPeople(null); setCurrent(null); setFrom(''); setError(null);
    if (!id) return;
    try {
      const res = await api.get(url(id));
      if (seq !== readRef.current) return;
      setPeople(res?.data?.data?.people || []);
      setCurrent(res?.data?.data?.opportunity || null);
    } catch (err) {
      console.error('[OpportunityBeat14] the episode\'s beat 14 could not be read:', err);
      if (seq === readRef.current) setError(err?.response?.data?.error || "Couldn't read that episode's beat 14.");
    }
  };

  const attach = async () => {
    setError(null);
    if (!episodeId) { setError('Choose the episode.'); return; }
    if (!from) { setError('Choose who at the event offers it.'); return; }
    if (replacing && !window.confirm(`${replaceText(epName, replacing)} Attach ${opp.name} instead?`)) return;
    setBusy(true);
    try {
      await api.put(url(episodeId), { opportunity_id: opp.id, connector_profile_id: Number(from) });
      await onDone?.(chosen);
    } catch (err) {
      console.error('[OpportunityBeat14] attach failed:', err);
      setError(err?.response?.data?.error || 'Could not attach it to beat 14.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ob14-form" data-testid={`opp-beat14-form-${opp.id}`}>
      <label className="ob14-field">Episode
        <select ref={episodeRef} value={episodeId} onChange={(e) => chooseEpisode(e.target.value)} data-testid="opp-beat14-episode">
          <option value="">Choose…</option>
          {/* Completed episodes are left out: their beat 14 was already decided (Script page re-audit, 2026-10-19). */}
          {open.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.episode_number != null ? `${ep.episode_number}. ` : ''}{ep.title || 'Untitled episode'}</option>
          ))}
        </select>
      </label>
      {replacing && <p className="ob14-note ob14-warn" role="status" data-testid="opp-beat14-replacing">{replaceText(epName, replacing)}</p>}
      {episodeId && people && (people.length ? (
        <label className="ob14-field">From
          <select value={from} onChange={(e) => setFrom(e.target.value)} data-testid="opp-beat14-from">
            <option value="">Who at the event…</option>
            {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.name}{p.role === 'host' ? ' (host)' : ''}</option>)}
          </select>
        </label>
      ) : (
        <p className="ob14-note" data-testid="opp-beat14-nobody">Nobody at this episode&apos;s event can offer it yet: add the host or guests in the Event Package.</p>
      ))}
      <div className="ob14-actions">
        <button type="button" className="ob14-btn is-primary" disabled={busy} onClick={attach} data-testid="opp-beat14-attach">Attach to beat 14</button>
        <button type="button" className="ob14-btn" disabled={busy} onClick={onCancel} data-testid="opp-beat14-cancel">Cancel</button>
      </div>
      {error && <p className="ob14-error" role="alert" data-testid="opp-beat14-error">{error}</p>}
    </div>
  );
}

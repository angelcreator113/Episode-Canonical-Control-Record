/**
 * Episode title approval and title card (Task #2386, ruling P11, Evoni
 * 2026-09-30): "An episode title can be approved. Approving it offers
 * "Design title card" with its cost shown. ... Changing an approved title
 * marks the card outdated and offers a redesign."
 *
 * Rendered under the episode title in EpisodeDetail's header. All state comes
 * from GET /api/v1/episodes/:id/title-card (episodeTitleCardService):
 *   - not approved           → "Approve title"
 *   - approved, no card      → "Design title card — est. $0.04"
 *   - card current           → the card thumbnail
 *   - card outdated          → "Title changed — card outdated" and
 *                              "Approve title & redesign (est. $0.04)"
 * The estimate is the server's, priced from the same options the card is
 * generated with; an unpriced model reads "price not set".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clapperboard, RefreshCw, TriangleAlert } from 'lucide-react';
import api from '../../services/api';
import './EpisodeTitleCard.css';

export const getTitleCardApi = async (episodeId) =>
  (await api.get(`/api/v1/episodes/${episodeId}/title-card`))?.data?.data;
export const approveTitleApi = async (episodeId, title) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title/approve`, { title }))?.data?.data;
export const designTitleCardApi = async (episodeId) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title-card`))?.data?.data;

export function formatEstimate(estimate) {
  if (!estimate || typeof estimate.usd !== 'number') return 'price not set';
  return `$${estimate.usd.toFixed(2)}`;
}

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

export default function EpisodeTitleCard({ episode }) {
  const episodeId = episode?.id;
  const title = episode?.title || '';
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null); // 'approve' | 'design' | null
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!episodeId) return;
    getTitleCardApi(episodeId)
      .then((data) => { setState(data && typeof data === 'object' && 'approved' in data ? data : null); setError(null); })
      .catch((err) => {
        console.error('[EpisodeTitleCard] load failed:', err);
        setError(errorText(err));
      });
  }, [episodeId]);

  // Reload when the title changes (an edit makes the card outdated).
  useEffect(() => { load(); }, [load, title]);

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      setState(await approveTitleApi(episodeId, title));
    } catch (err) {
      console.error('[EpisodeTitleCard] approve failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const design = async () => {
    setBusy('design');
    setError(null);
    try {
      if (state?.offer?.requires_approval) await approveTitleApi(episodeId, title);
      const data = await designTitleCardApi(episodeId);
      setState(data?.state || null);
      if (!data?.state) load();
    } catch (err) {
      console.error('[EpisodeTitleCard] design failed:', err);
      // A budget refusal (429) or an unapproved title (409) says why.
      setError(errorText(err));
      load();
    } finally {
      setBusy(null);
    }
  };

  if (!episodeId || !state) {
    return error ? <div className="etc-panel"><p className="etc-error" role="alert">{error}</p></div> : null;
  }

  const { approved, card, offer } = state;
  const outdated = Boolean(card?.outdated);
  const cost = formatEstimate(offer?.estimate);

  return (
    <div className="etc-panel" data-testid="episode-title-card">
      <div className="etc-row">
        {approved ? (
          <span className="etc-approved" data-testid="etc-approved">
            <BadgeCheck size={14} aria-hidden="true" /> Title approved
          </span>
        ) : !outdated && (
          <button type="button" className="etc-btn" onClick={approve} disabled={busy !== null || !title.trim()}>
            <BadgeCheck size={14} aria-hidden="true" />
            {busy === 'approve' ? 'Approving…' : 'Approve title'}
          </button>
        )}

        {outdated && (
          <span className="etc-outdated" data-testid="etc-outdated">
            <TriangleAlert size={14} aria-hidden="true" /> Title changed — card outdated
          </span>
        )}

        {offer?.offered && (
          <button type="button" className="etc-btn etc-btn-primary" onClick={design} disabled={busy !== null}>
            {offer.kind === 'redesign' ? <RefreshCw size={14} aria-hidden="true" /> : <Clapperboard size={14} aria-hidden="true" />}
            {busy === 'design'
              ? 'Designing…'
              : offer.kind === 'redesign'
                ? `${offer.requires_approval ? 'Approve title & redesign' : 'Redesign title card'} (est. ${cost})`
                : `Design title card — est. ${cost}`}
          </button>
        )}
      </div>

      {card?.image_url && (
        <img
          className={`etc-thumb${outdated ? ' etc-thumb-outdated' : ''}`}
          src={card.image_url}
          alt={`Title card for “${card.designed_for || ''}”`}
          data-testid="etc-thumb"
        />
      )}

      {error && <p className="etc-error" role="alert">{error}</p>}
    </div>
  );
}

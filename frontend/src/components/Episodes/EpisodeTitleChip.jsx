/**
 * The banner's title status chip (P15, Evoni 2026-09-30; EVENT_EPISODE_FLOW.md
 * §8(w)): "The banner shows a small title status chip that opens the tab
 * instead of the card image."
 *
 * Its status is the title overlay's (approved, outdated, not made), else the
 * framed card's when only the card was made (episodeOverlaysService
 * titleChip). It lives in its own module so the episode page loads it
 * without the lazily loaded Overlays tab; its styles are EpisodeDetail.css's
 * `.ed-title-chip`.
 */

import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export const getEpisodeOverlaysApi = async (episodeId) =>
  (await api.get(`/api/v1/episodes/${episodeId}/overlays`)).data?.data || null;

export const STATUS_LABELS = Object.freeze({ approved: 'Approved', outdated: 'Outdated', not_made: 'Not made' });

/**
 * @param {string} episodeId
 * @param {string} [title]   — reloads when the title changes
 * @param {number} [version] — bumped when the Overlays tab changes a piece
 * @param {Function} onOpen  — opens Production → Overlays
 */
export default function EpisodeTitleChip({ episodeId, title, version = 0, onOpen }) {
  const [chip, setChip] = useState(null);
  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    getEpisodeOverlaysApi(episodeId)
      .then((d) => { if (!cancelled) setChip(d?.title_chip || null); })
      .catch((err) => { console.error('[EpisodeTitleChip] load failed:', err); });
    return () => { cancelled = true; };
  }, [episodeId, title, version]);
  if (!chip) return null;
  return (
    <button
      type="button"
      className={`ed-title-chip ed-title-chip-${chip.status}`}
      onClick={onOpen}
      title="Open this episode's overlays"
      data-testid="ed-title-chip"
    >
      Title · {STATUS_LABELS[chip.status] || chip.status}
    </button>
  );
}

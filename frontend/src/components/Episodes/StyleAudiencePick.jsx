/**
 * The audience's pick on the Style Page (Task #3007; The Pulse spec §11 "a
 * public poll ... whose result is offered to Evoni as a choice on the Style
 * Page"; docs/reads/2026-10-12-pulse-public-extras-read.md §2). Shown in the
 * Pieces spot. Reads the show's polls (GET /api/v1/pulse-polls, #3005) and
 * keeps the ones about this episode or its anchor event:
 *   closed  "The audience picked <option> (N of M votes)", and Use this look,
 *           which opens Producer Mode's look builder for this episode with
 *           those pieces chosen. Nothing is saved there until Evoni saves:
 *           the save buys unowned pieces with Lala's coins and replaces the
 *           episode's look, so the choice stays hers (the read's §2).
 *   open    "Poll open: N votes so far".
 * Drafts, and no poll, show nothing.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The poll that speaks for this episode: the latest closed, else an open one. */
export function pollFor(polls, episodeId, eventId) {
  const mine = (polls || []).filter((p) => p.status !== 'draft'
    && ((episodeId && p.episode_id === episodeId) || (eventId && p.world_event_id === eventId)));
  return mine.find((p) => p.status === 'closed') || mine.find((p) => p.status === 'open') || null;
}

/** The winning options of a closed poll (more than one on a tie); [] with no votes. */
export function winnersOf(poll) {
  const top = Math.max(0, ...poll.options.map((o) => o.votes || 0));
  return top > 0 ? poll.options.filter((o) => (o.votes || 0) === top) : [];
}

/** Producer Mode's closet with the look builder on this episode and the pick's pieces chosen. */
export const lookBuilderLink = (showId, episodeId, wardrobeIds) =>
  `/shows/${encodeURIComponent(showId)}/world?tab=wardrobe-items&look_episode=${encodeURIComponent(episodeId)}&look_pieces=${wardrobeIds.map(encodeURIComponent).join(',')}`;

export default function StyleAudiencePick({ episode }) {
  const [poll, setPoll] = useState(null);
  const showId = episode?.show_id;
  const episodeId = episode?.id;

  useEffect(() => {
    if (!showId || !episodeId) return undefined;
    let alive = true;
    Promise.all([
      api.get(`/api/v1/pulse-polls?show_id=${encodeURIComponent(showId)}`).then((r) => r.data?.polls || []),
      getEpisodeAnchorEvent(episodeId).catch((err) => { console.error('[StyleAudiencePick] the event could not be read:', err.response?.status || err.message); return null; }),
    ]).then(([polls, anchor]) => { if (alive) setPoll(pollFor(polls, episodeId, anchor?.id || null)); })
      .catch((err) => console.error('[StyleAudiencePick] the polls could not be read:', err.response?.status || err.message));
    return () => { alive = false; };
  }, [showId, episodeId]);

  if (!poll) return null;
  if (poll.status === 'open') {
    return (
      <p className="esp2-audience" data-testid="esp2-audience">
        Poll open: {plural(poll.total || 0, 'vote', 'votes')} so far on “{poll.question}”.
      </p>
    );
  }
  const winners = winnersOf(poll);
  return (
    <div className="esp2-audience" data-testid="esp2-audience">
      {winners.length === 0 && <p>“{poll.question}” closed with no votes.</p>}
      {winners.length === 1 && (
        <p>The audience picked <b>{winners[0].label}</b> ({winners[0].votes} of {plural(poll.total, 'vote', 'votes')}).</p>
      )}
      {winners.length > 1 && (
        <p>A tie: {winners.map((w) => w.label).join(' and ')} ({winners[0].votes} votes each, of {poll.total}).</p>
      )}
      {winners.map((w) => (w.wardrobe_ids.length ? (
        <Link key={w.id} className="esp2-btn" to={lookBuilderLink(showId, episodeId, w.wardrobe_ids)}>
          Use this look{winners.length > 1 ? `: ${w.label}` : ''}
        </Link>
      ) : <p key={w.id} className="esp2-hint">{w.label} has no pieces attached.</p>))}
      {winners.some((w) => w.wardrobe_ids.length) && (
        <p className="esp2-hint">Opens the look builder with these pieces chosen. Nothing changes until you save there: you'll see what Lala spends first.</p>
      )}
    </div>
  );
}

/**
 * Production → Overlays (P15, Evoni 2026-09-30; EVENT_EPISODE_FLOW.md §8(w)):
 * "Production gains an Overlays tab holding every on-screen piece of the
 * episode: the title overlay and full-screen framed card, the invitation,
 * and the task-list overlay, each with its preview, status (approved,
 * outdated, not made), placed beat, and actions with costs shown; the
 * show-wide overlays the episode uses are listed read-only with a link to
 * the Phone Hub. The banner shows a small title status chip that opens the
 * tab instead of the card image."
 *
 * State comes from GET /api/v1/episodes/:id/overlays (episodeOverlaysService).
 * Actions reuse each piece's own panel: EpisodeTitleCard (approve, lettering
 * styles, flourish, framed card), EpisodeTaskListOverlay (approve, design);
 * the invitation is made in its Event Package. The show-wide list is
 * GET /api/v1/ui-overlays/:showId?episode_id= (the Lala's Phone tab's read).
 *
 * Evoni's Episode mock (2026-10-06): the tab opens on a preview with "Add an
 * overlay" (from a document, from Lala's Feed, a notification or stat pop),
 * then "Overlays by beat", a row per piece in beat order with Edit or Add
 * (lib/episodeOverlays). The pieces' own panels follow as Details.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ImageOff, Layers } from 'lucide-react';
import { getEpisodeOverlaysApi, STATUS_LABELS } from './EpisodeTitleChip';
import EpisodeTitleCard, { formatEstimate } from './EpisodeTitleCard';
import EpisodeTaskListOverlay from './EpisodeTaskListOverlay';
import { listEpisodePhoneOverlaysApi } from './EpisodeLalasPhoneTab';
import { overlayRows, beatLabel, pieceBeat, previewPiece } from '../../lib/episodeOverlays';
import './EpisodeOverlaysTab.css';


const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/** "Beat 5: Reveal", or null. */
export function beatText(beat) {
  if (!beat?.number) return null;
  return `Beat ${beat.number}${beat.name ? `: ${beat.name}` : ''}`;
}

/** The show-wide overlays an episode uses: made, and not the episode's own. */
export function showWideOverlays(list) {
  return (list || []).filter((o) => o && o.generated && !o.is_episode_override
    && !o.is_episode_invitation && !o.is_episode_task_list);
}

function StatusPill({ status, testid }) {
  return (
    <span className={`eot-status eot-status-${status}`} data-testid={testid}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PieceCard({ piece, children }) {
  const placed = beatText(piece.beat);
  const expected = beatText(piece.expected_beat);
  const paid = piece.cost?.paid;
  return (
    <article className="eot-piece" data-testid={`eot-piece-${piece.key}`}>
      <div className="eot-preview">
        {piece.image_url ? (
          <img
            src={piece.image_url}
            alt={`${piece.label} preview`}
            className={piece.status === 'outdated' ? 'eot-preview-outdated' : ''}
          />
        ) : (
          <span className="eot-preview-empty"><ImageOff size={18} aria-hidden="true" /> No preview</span>
        )}
      </div>
      <div className="eot-piece-body">
        <div className="eot-piece-head">
          <h3 className="eot-piece-title">{piece.label}</h3>
          <StatusPill status={piece.status} testid={`eot-status-${piece.key}`} />
        </div>
        <p className="eot-beat" data-testid={`eot-beat-${piece.key}`}>
          {placed ? `Placed on ${placed}` : `Not placed${expected ? ` (goes on ${expected})` : ''}`}
        </p>
        {piece.status === 'outdated' && piece.made_for && (
          <p className="eot-note">Made for “{piece.made_for}”.</p>
        )}
        {piece.cost?.free && <p className="eot-note">{piece.cost.free}</p>}
        {paid && (
          <p className="eot-cost" data-testid={`eot-cost-${piece.key}`}>
            {paid.action} — est. {formatEstimate(paid.estimate)}
          </p>
        )}
        {children}
      </div>
    </article>
  );
}

export default function EpisodeOverlaysTab({ episode, showId, onChanged }) {
  const episodeId = episode?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showWide, setShowWide] = useState(null);
  const [chosen, setChosen] = useState(null);

  const load = useCallback(() => {
    if (!episodeId) return;
    getEpisodeOverlaysApi(episodeId)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => {
        console.error('[EpisodeOverlaysTab] load failed:', err);
        setError(errorText(err));
      });
  }, [episodeId]);

  useEffect(() => { load(); }, [load, episode?.title]);

  useEffect(() => {
    if (!showId || !episodeId) return undefined;
    let cancelled = false;
    listEpisodePhoneOverlaysApi(showId, episodeId)
      .then((list) => { if (!cancelled) setShowWide(showWideOverlays(list)); })
      .catch((err) => {
        console.error('[EpisodeOverlaysTab] show-wide overlays load failed:', err);
        if (!cancelled) setShowWide([]);
      });
    return () => { cancelled = true; };
  }, [showId, episodeId]);

  // An action in a piece's panel changes the summary and the banner chip.
  const changed = useCallback(() => { load(); onChanged?.(); }, [load, onChanged]);

  if (!episodeId) return null;
  const pieces = data?.pieces || [];
  const byKey = Object.fromEntries(pieces.map((p) => [p.key, p]));
  const invitation = byKey.invitation;
  const phoneHubPath = showId ? `/shows/${showId}/world?tab=overlays-tab` : '/phone-hub';
  const feedPath = showId ? `/shows/${showId}/world?tab=feed` : null;
  const rows = overlayRows(pieces, showWide || []);
  const needed = rows.filter((r) => r.needed).length;
  const shown = previewPiece(pieces, chosen);
  // A row (or Add an overlay) opens its piece's panel under Details, and
  // shows the piece in the preview.
  const openPiece = (key) => {
    setChosen(key);
    const el = typeof document !== 'undefined' && document.querySelector(`[data-testid="eot-piece-${key}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="eot-tab" data-testid="episode-overlays-tab">
      {error && <p className="eot-error" role="alert">{error}</p>}
      {!data && !error && <p className="eot-loading">Loading overlays…</p>}

      {data && (
        <section className="eot-stage" aria-label="Preview and add an overlay">
          <div className="eot-stage-preview" data-testid="eot-stage-preview">
            {shown ? (
              <img src={shown.image_url} alt={`Preview: ${shown.label}`} />
            ) : (
              <span className="eot-preview-empty"><ImageOff size={18} aria-hidden="true" /> Nothing made yet to preview</span>
            )}
            {shown && (
              <span className="eot-stage-tag" data-testid="eot-stage-tag">
                Preview · {pieceBeat(shown) ? beatLabel(pieceBeat(shown)) : shown.label}
              </span>
            )}
          </div>
          <div className="eot-add">
            <h2 className="eot-add-title">Add an overlay</h2>
            <button type="button" className="eot-add-option is-document" onClick={() => openPiece(byKey.task_list?.status === 'not_made' ? 'task_list' : 'invitation')}>
              <strong>From a document</strong> <span>the invitation, the shopping list</span>
            </button>
            {feedPath && (
              <Link className="eot-add-option is-feed" to={feedPath}>
                <strong>From Lala&apos;s Feed</strong> <span>a post, comment or friend request</span>
              </Link>
            )}
            <Link className="eot-add-option is-pop" to={phoneHubPath}>
              <strong>Notification or stat pop</strong> <span>made in the Phone Hub</span>
            </Link>
          </div>
        </section>
      )}

      {data && (
        <section className="eot-bybeat" aria-labelledby="eot-bybeat-title" data-testid="eot-bybeat">
          <div className="eot-bybeat-head">
            <h2 id="eot-bybeat-title" className="eot-add-title">Overlays by beat</h2>
            <span className="eot-bybeat-needed" data-testid="eot-still-needed">
              {needed === 0 ? 'all made' : `${needed} still needed`}
            </span>
          </div>
          <ul className="eot-rows">
            {rows.map((r) => (
              <li key={r.key} className={`eot-row${r.needed ? ' is-needed' : ''}`} data-testid={`eot-row-${r.key}`}>
                <span className="eot-row-beat">{beatLabel(r.beat)}</span>
                <span className={`eot-kind eot-kind-${r.kind === 'Document' ? 'doc' : r.kind === 'Phone Hub' ? 'hub' : 'title'}`}>{r.kind}</span>
                <span className="eot-row-text">{r.text}</span>
                {r.showWide ? (
                  <Link className="eot-row-action" to={phoneHubPath}>{r.action}</Link>
                ) : (
                  <button type="button" className="eot-row-action" onClick={() => openPiece(r.key)}>{r.action}</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <>
          <h3 className="eot-details-title"><Layers size={14} aria-hidden="true" /> Details</h3>
          <section className="eot-group" aria-label="Title">
            <div className="eot-pieces">
              {byKey.title_overlay && <PieceCard piece={byKey.title_overlay} />}
              {byKey.framed_card && <PieceCard piece={byKey.framed_card} />}
            </div>
            <EpisodeTitleCard episode={episode} showCardImage={false} onChange={changed} />
          </section>

          {invitation && (
            <section className="eot-group" aria-label="Invitation">
              <PieceCard piece={invitation}>
                {invitation.event ? (
                  <Link
                    className="eot-link"
                    to={`/shows/${invitation.event.show_id || showId}/events/${invitation.event.id}`}
                    data-testid="eot-invitation-link"
                  >
                    {invitation.status === 'not_made' ? 'Make it' : 'Change it'} in the Event Package
                    {invitation.event.name ? ` (${invitation.event.name})` : ''} <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="eot-note">No event started this episode, so it has no invitation.</p>
                )}
              </PieceCard>
            </section>
          )}

          {byKey.task_list && (
            <section className="eot-group" aria-label="Task list">
              <PieceCard piece={byKey.task_list}>
                {byKey.task_list.task_count === 0 && (
                  <p className="eot-note">The episode has no task list yet; it is built on the Assets tab.</p>
                )}
              </PieceCard>
              <EpisodeTaskListOverlay episodeId={episodeId} showPreview={false} onChange={changed} />
            </section>
          )}
        </>
      )}

      <section className="eot-group eot-show-wide" aria-label="Show-wide overlays" data-testid="eot-show-wide">
        <div className="eot-show-wide-head">
          <h3 className="eot-piece-title">Show-wide overlays this episode uses</h3>
          <Link className="eot-link" to={phoneHubPath} data-testid="eot-phone-hub-link">
            Edit in the Phone Hub <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
        {showWide === null && <p className="eot-loading">Loading…</p>}
        {showWide && showWide.length === 0 && <p className="eot-note">None yet.</p>}
        {showWide && showWide.length > 0 && (
          <ul className="eot-show-wide-list">
            {showWide.map((o) => (
              <li key={o.asset_id || o.id} className="eot-show-wide-item" data-testid="eot-show-wide-item">
                {o.url ? <img src={o.url} alt="" /> : <span className="eot-show-wide-blank" />}
                <span className="eot-show-wide-name">{o.name || o.id}</span>
                {o.beat ? <span className="eot-show-wide-beat">Beat {typeof o.beat === 'object' ? o.beat.number : o.beat}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

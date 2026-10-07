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
 * then the episode's overlays, a row per piece with Edit or Add
 * (lib/episodeOverlays). The pieces' own panels follow as Details.
 *
 * Kept off beats for now (Evoni, 2026-10-07: "none of the overlays should
 * be beats for now"): nothing here shows or picks a beat, and making an
 * overlay no longer places it (episodeBeatPlacement).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff, Layers } from 'lucide-react';
import { getEpisodeOverlaysApi, STATUS_LABELS } from './EpisodeTitleChip';
import EpisodeTitleCard, { formatEstimate } from './EpisodeTitleCard';
import EpisodeTaskListOverlay from './EpisodeTaskListOverlay';
import EpisodeLibraryOverlays from './EpisodeLibraryOverlays';
import EventDocuments from '../EventPackage/EventDocuments';
import { overlayRows, previewPiece } from '../../lib/episodeOverlays';
import './EpisodeOverlaysTab.css';


const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

function StatusPill({ status, testid }) {
  return (
    <span className={`eot-status eot-status-${status}`} data-testid={testid}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PieceCard({ piece, children }) {
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

const DOC_STATE = { approved: ['is-approved', 'Approved'], outdated: ['is-draft', 'Outdated'], not_made: ['is-none', 'Not made'] };

/**
 * The invitation as one of the episode's in-world documents (Evoni's mock,
 * 2026-10-07): its image, its state, and the Event Package where it is
 * made. Shown first among the event's documents.
 */
function InvitationDocCard({ piece, showId }) {
  const [stateClass, stateLabel] = DOC_STATE[piece.status] || DOC_STATE.not_made;
  const paid = piece.cost?.paid;
  return (
    <article className="evd-card eot-doc-invite" data-testid="eot-doc-invitation">
      <h3 className="evd-title">Invitation</h3>
      <p className="evd-from">From the event: date, venue, host, dress code, pay</p>
      <div className="evd-stage">
        {piece.image_url ? (
          <span className="eot-invite-frame">
            <img src={piece.image_url} alt="Invitation preview" className={piece.status === 'outdated' ? 'eot-preview-outdated' : ''} />
          </span>
        ) : (
          <span className="eot-preview-empty"><ImageOff size={18} aria-hidden="true" /> Not made yet</span>
        )}
      </div>
      <div className="evd-actions">
        <span className={`evd-state ${stateClass}`} data-testid="eot-status-invitation">{stateLabel}</span>
        {piece.image_url && (
          <a className="evd-link" href={piece.image_url} target="_blank" rel="noreferrer">View full size</a>
        )}
        {piece.event && (
          <Link className="evd-link" to={`/shows/${piece.event.show_id || showId}/events/${piece.event.id}`} data-testid="eot-invitation-link">
            {piece.status === 'not_made' ? 'Make it' : 'Change it'} in the Event Package{piece.event.name ? ` (${piece.event.name})` : ''}
          </Link>
        )}
      </div>
      {paid && <p className="eot-cost" data-testid="eot-cost-invitation">{paid.action} — est. {formatEstimate(paid.estimate)}</p>}
    </article>
  );
}

const scrollToId = (id) => {
  const el = typeof document !== 'undefined' && document.getElementById(id);
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function EpisodeOverlaysTab({ episode, showId, onChanged }) {
  const episodeId = episode?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
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

  // An action in a piece's panel changes the summary and the banner chip.
  const changed = useCallback(() => { load(); onChanged?.(); }, [load, onChanged]);

  if (!episodeId) return null;
  const pieces = data?.pieces || [];
  const byKey = Object.fromEntries(pieces.map((p) => [p.key, p]));
  const invitation = byKey.invitation;
  const event = data?.event || invitation?.event || null;
  const phoneHubPath = showId ? `/shows/${showId}/world?tab=overlays-tab` : '/phone-hub';
  const feedPath = showId ? `/shows/${showId}/world?tab=feed` : null;
  const rows = overlayRows(pieces);
  const needed = rows.filter((r) => r.needed).length;
  const shown = previewPiece(pieces, chosen);
  // A row opens its piece (and shows it in the preview); a document row
  // goes to the documents.
  const openPiece = (key) => {
    setChosen(key);
    if (key === 'invitation') { scrollToId('eot-docs'); return; }
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
                Preview · {shown.label}
              </span>
            )}
          </div>
          <div className="eot-add">
            <h2 className="eot-add-title">Add an overlay</h2>
            <button type="button" className="eot-add-option is-document" onClick={() => scrollToId('eot-docs')}>
              <strong>From a document</strong> <span>the invitation, the shopping list, the career plan</span>
            </button>
            <button type="button" className="eot-add-option is-library" onClick={() => scrollToId('eot-library')}>
              <strong>From the show library</strong> <span>the show&apos;s title, lower thirds, buttons</span>
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
            <h2 id="eot-bybeat-title" className="eot-add-title">This episode&apos;s overlays</h2>
            <span className="eot-bybeat-needed" data-testid="eot-still-needed">
              {needed === 0 ? 'all made' : `${needed} still needed`}
            </span>
          </div>
          <ul className="eot-rows">
            {rows.map((r) => (
              <li key={r.key} className={`eot-row${r.needed ? ' is-needed' : ''}`} data-testid={`eot-row-${r.key}`}>
                <span className={`eot-kind eot-kind-${r.kind === 'Document' ? 'doc' : 'title'}`}>{r.kind}</span>
                <span className="eot-row-text">{r.text}</span>
                <button type="button" className="eot-row-action" onClick={() => openPiece(r.key)}>{r.action}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <section className="eot-section eot-docs" id="eot-docs" aria-labelledby="eot-docs-title" data-testid="eot-docs">
          <div className="eot-section-head">
            <div>
              <h2 id="eot-docs-title" className="eot-section-title">In-world documents</h2>
              <p className="eot-section-sub">
                One system, three looks. Each document fills itself from the event and goes through the same steps
                (Draft, Edit, Redraft, Approve). Approved, the invitation is an overlay for this episode; the shopping
                list and the career plan go on the episode&apos;s lists.
              </p>
            </div>
          </div>
          {event ? (
            <EventDocuments
              showId={event.show_id || showId}
              eventId={event.id}
              event={{ id: event.id, name: event.name }}
              intro={false}
              lead={invitation ? <InvitationDocCard piece={invitation} showId={showId} /> : null}
            />
          ) : (
            <p className="eot-note" data-testid="eot-docs-none">No event started this episode, so it has no documents.</p>
          )}
        </section>
      )}

      {data && (
        <section className="eot-section" aria-labelledby="eot-own-title" data-testid="eot-own">
          <div className="eot-section-head">
            <div>
              <h2 id="eot-own-title" className="eot-section-title"><Layers size={16} aria-hidden="true" /> This episode only</h2>
              <p className="eot-section-sub">Made for this episode and used nowhere else: its title and its task list.</p>
            </div>
          </div>
          <div className="eot-group" aria-label="Title">
            <div className="eot-pieces">
              {byKey.title_overlay && <PieceCard piece={byKey.title_overlay} />}
              {byKey.framed_card && <PieceCard piece={byKey.framed_card} />}
            </div>
            <EpisodeTitleCard episode={episode} showCardImage={false} onChange={changed} />
          </div>
          {byKey.task_list && (
            <div className="eot-group" aria-label="Task list">
              <PieceCard piece={byKey.task_list}>
                {byKey.task_list.task_count === 0 && (
                  <p className="eot-note">The episode has no task list yet; it is built on the Assets tab.</p>
                )}
              </PieceCard>
              <EpisodeTaskListOverlay episodeId={episodeId} showPreview={false} onChange={changed} />
            </div>
          )}
        </section>
      )}

      {data && (
        <EpisodeLibraryOverlays showId={data.show_id || showId} />
      )}
    </div>
  );
}

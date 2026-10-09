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
 * styles, flourish, framed card); the invitation, shopping list and career
 * plan are made in In-world documents. The AI task-list overlay is retired
 * (Evoni, 2026-10-07). The show-wide list is
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
 *
 * Redone as one card per overlay (Evoni's screenshot, 2026-10-07: "we
 * redesigned episode overlays but i think we need to do it again"): the
 * Title overlay, the Full-screen framed card, the Invitation, the Shopping
 * list and the Career plan, each a wide card with its preview on the left
 * and its status, what it is and its actions on the right; "+ New overlay"
 * holds the ways to add one; the show-wide overlays follow as chips.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff, Plus } from 'lucide-react';
import { getEpisodeOverlaysApi, STATUS_LABELS } from './EpisodeTitleChip';
import EpisodeTitleCard, { formatEstimate } from './EpisodeTitleCard';
import EpisodeLibraryOverlays from './EpisodeLibraryOverlays';
import EventDocuments from '../EventPackage/EventDocuments';
import { overlayRows } from '../../lib/episodeOverlays';
import './EpisodeOverlaysTab.css';


const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

function StatusPill({ status, testid }) {
  return (
    <span className={`eot-status eot-status-${status}`} data-testid={testid}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// What each of the episode's own pieces is, in a line (Evoni's screenshot).
const PIECE_LINES = {
  title_overlay: 'The episode title set in real lettering, over the opening.',
  framed_card: 'The opening title card, full screen in the black-and-gold frame.',
};

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
        {PIECE_LINES[piece.key] && <p className="eot-piece-line">{PIECE_LINES[piece.key]}</p>}
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

/** "+ New overlay": the ways to add one (Evoni's mock, 2026-10-06), in a menu. */
function NewOverlayMenu({ feedPath, phoneHubPath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const go = (id) => { setOpen(false); scrollToId(id); };
  return (
    <div className="eot-new" ref={ref}>
      <button type="button" className="eot-new-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" data-testid="eot-new">
        <Plus size={14} aria-hidden="true" /> New overlay
      </button>
      {open && (
        <div className="eot-new-menu" role="menu" data-testid="eot-new-menu">
          <button type="button" role="menuitem" className="eot-add-option is-document" onClick={() => go('eot-docs')}>
            <strong>From a document</strong> <span>the invitation, the shopping list, the career plan</span>
          </button>
          <button type="button" role="menuitem" className="eot-add-option is-library" onClick={() => go('eot-library')}>
            <strong>From the show library</strong> <span>the show&apos;s title, lower thirds, buttons</span>
          </button>
          {feedPath && (
            <Link role="menuitem" className="eot-add-option is-feed" to={feedPath}>
              <strong>From Lala&apos;s Feed</strong> <span>a post, comment or friend request</span>
            </Link>
          )}
          <Link role="menuitem" className="eot-add-option is-pop" to={phoneHubPath}>
            <strong>Notification or stat pop</strong> <span>made in Lala&apos;s Phone</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function EpisodeOverlaysTab({ episode, showId, onChanged }) {
  const episodeId = episode?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // The title overlay and the framed card each read the title's state; a
  // change in one remounts both, so neither shows a stale approval.
  const [titleVersion, setTitleVersion] = useState(0);

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

  // An action on a card changes the summary and the banner chip.
  const changed = useCallback(() => { load(); setTitleVersion((v) => v + 1); onChanged?.(); }, [load, onChanged]);

  if (!episodeId) return null;
  const pieces = data?.pieces || [];
  const byKey = Object.fromEntries(pieces.map((p) => [p.key, p]));
  const invitation = byKey.invitation;
  const event = data?.event || invitation?.event || null;
  const phoneHubPath = showId ? `/shows/${showId}/world?tab=overlays-tab` : '/phone-hub';
  const feedPath = showId ? `/shows/${showId}/world?tab=feed` : null;
  const needed = overlayRows(pieces).filter((r) => r.needed).length;

  return (
    <div className="eot-tab" data-testid="episode-overlays-tab">
      {error && <p className="eot-error" role="alert">{error}</p>}
      {!data && !error && <p className="eot-loading">Loading overlays…</p>}

      {data && (
        <section className="eot-cards" aria-labelledby="eot-cards-title" data-testid="eot-bybeat">
          <div className="eot-cards-head">
            <h2 id="eot-cards-title" className="eot-kicker">This episode&apos;s overlays</h2>
            <span className="eot-bybeat-needed" data-testid="eot-still-needed">
              {needed === 0 ? 'all made' : `${needed} still needed`}
            </span>
            <span className="eot-grow" />
            <NewOverlayMenu feedPath={feedPath} phoneHubPath={phoneHubPath} />
          </div>

          <div className="eot-card-list">
            {byKey.title_overlay && (
              <PieceCard piece={byKey.title_overlay}>
                <EpisodeTitleCard key={`overlay-${titleVersion}`} part="overlay" episode={episode} showCardImage={false} onChange={changed} />
              </PieceCard>
            )}
            {byKey.framed_card && (
              <PieceCard piece={byKey.framed_card}>
                <EpisodeTitleCard key={`card-${titleVersion}`} part="card" episode={episode} showCardImage={false} onChange={changed} />
              </PieceCard>
            )}
          </div>

          <div id="eot-docs" className="eot-docs" data-testid="eot-docs">
            {event ? (
              <EventDocuments
                showId={event.show_id || showId}
                eventId={event.id}
                event={{ id: event.id, name: event.name }}
                intro={false}
                layout="wide"
                lead={invitation ? <InvitationDocCard piece={invitation} showId={showId} /> : null}
              />
            ) : (
              <p className="eot-note" data-testid="eot-docs-none">No event started this episode, so it has no invitation, shopping list or career plan.</p>
            )}
          </div>

          {/* The look's approved wardrobe pieces, each an overlay (Evoni,
              2026-10-09; Task #2791): the Script tab puts them on screen. */}
          <div className="eot-look" data-testid="eot-look">
            <h3 className="eot-look-title">Lala&apos;s look</h3>
            {(data.wardrobe || []).length ? (
              <ul className="eot-look-list">
                {data.wardrobe.map((w) => (
                  <li key={w.key} className="eot-look-piece" data-testid={`eot-look-${w.key}`}>
                    <span className="eot-look-img">{w.image_url ? <img src={w.image_url} alt="" loading="lazy" /> : null}</span>
                    <span className="eot-look-name">{w.label}</span>
                    {w.category && <span className="eot-look-cat">{w.category}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="eot-note" data-testid="eot-look-none">No wardrobe pieces approved for this episode yet. Lock the look on the <Link to="?tab=wardrobe">Wardrobe tab</Link>; each piece then shows here as an overlay.</p>
            )}
            <p className="eot-look-hint">Put a piece on screen from the Script tab: a beat&apos;s Phone / overlay button.</p>
          </div>
        </section>
      )}

      {data && (
        <EpisodeLibraryOverlays showId={data.show_id || showId} />
      )}
    </div>
  );
}

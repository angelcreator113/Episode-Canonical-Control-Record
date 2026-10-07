/**
 * Production → Overlays → From the show library (Evoni, 2026-10-07: "show
 * level overlays hold overlays that can be used for any episode while
 * episode overlays are for that episode only").
 *
 * The show's ready overlays (GET /ui-overlays/:showId, category
 * 'production'), each with where this episode uses it (library, from GET
 * /episodes/:id/overlays) and a beat to put it on: Use on this beat, Move,
 * Remove (POST / DELETE /episodes/:id/overlays/library). The image itself
 * is edited in the show's Overlays (Assets → Overlays).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ImageOff, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { overlayAssetIds } from '../../lib/showOverlays';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/** "Beat 5 · Reveal", or "Beat 5". */
export const beatName = (beat) => (beat ? `Beat ${beat.number}${beat.name ? ` · ${beat.name}` : ''}` : '');

/** Where the episode places this overlay (any of its images), or null. */
export function placementOf(overlay, library) {
  const ids = new Set(overlayAssetIds(overlay));
  return (library || []).find((p) => ids.has(p.asset_id)) || null;
}

export default function EpisodeLibraryOverlays({ episodeId, showId, beats = [], library = [], onChanged }) {
  const [overlays, setOverlays] = useState(null);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!showId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then((r) => {
        if (cancelled) return;
        setOverlays((r.data?.data || []).filter((o) => o.category === 'production' && o.generated && o.url && o.asset_id));
      })
      .catch((err) => {
        console.error('[EpisodeLibraryOverlays] show overlays load failed:', err);
        if (!cancelled) setOverlays([]);
      });
    return () => { cancelled = true; };
  }, [showId]);

  const act = async (overlay, kind, request) => {
    setBusy(`${overlay.asset_id}:${kind}`);
    setError(null);
    try {
      await request();
      onChanged?.();
    } catch (err) {
      console.error(`[EpisodeLibraryOverlays] ${kind} failed:`, err);
      setError(errorText(err));
    }
    setBusy(null);
  };

  const libraryPath = `/shows/${showId}/world?tab=production-overlays`;

  return (
    <section className="eot-section eot-library" id="eot-library" aria-labelledby="eot-library-title" data-testid="eot-library">
      <div className="eot-section-head">
        <div>
          <h2 id="eot-library-title" className="eot-section-title">From the show library</h2>
          <p className="eot-section-sub">The show&apos;s own overlays, made once for every episode. Put one on a beat of this episode; change the image in the show&apos;s Overlays.</p>
        </div>
        {showId && (
          <Link className="eot-link" to={libraryPath} data-testid="eot-library-link">
            The show&apos;s Overlays <ExternalLink size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
      {error && <p className="eot-error" role="alert">{error}</p>}
      {overlays === null && <p className="eot-loading">Loading the show&apos;s overlays…</p>}
      {overlays && overlays.length === 0 && (
        <p className="eot-note" data-testid="eot-library-empty">The show has no ready overlays yet. Make them in the show&apos;s Overlays.</p>
      )}
      {overlays && overlays.length > 0 && !beats.length && (
        <p className="eot-note">This episode has no beats yet, so nothing can be placed. Plan its beats first.</p>
      )}
      {overlays && overlays.length > 0 && (
        <ul className="eot-lib-list">
          {overlays.map((o) => {
            const placed = placementOf(o, library);
            const selected = Number(choice[o.asset_id] ?? placed?.beat?.number ?? beats[0]?.number ?? 0);
            const onPlacedBeat = placed?.beat?.number === selected;
            const isBusy = (k) => busy === `${o.asset_id}:${k}`;
            return (
              <li key={o.asset_id} className={`eot-lib-item${placed ? ' is-placed' : ''}`} data-testid={`eot-lib-${o.id}`}>
                <span className="eot-lib-thumb">
                  {o.url ? <img src={o.url} alt="" /> : <ImageOff size={16} aria-hidden="true" />}
                </span>
                <span className="eot-lib-text">
                  <strong className="eot-lib-name">{String(o.name || o.id).replace(/^UI Overlay:\s*/i, '')}</strong>
                  <span className="eot-lib-where" data-testid={`eot-lib-where-${o.id}`}>
                    {placed?.beat ? `On ${beatName(placed.beat)}` : 'Not in this episode'}
                  </span>
                </span>
                {beats.length > 0 && (
                  <span className="eot-lib-actions">
                    <select
                      className="eot-lib-beat" aria-label={`Beat for ${o.name}`} value={selected || ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [o.asset_id]: Number(e.target.value) }))}
                      disabled={!!busy}
                    >
                      {beats.map((b) => <option key={b.number} value={b.number}>{beatName(b)}</option>)}
                    </select>
                    <button
                      type="button" className="eot-btn" data-testid={`eot-lib-place-${o.id}`}
                      disabled={!!busy || onPlacedBeat || !selected}
                      onClick={() => act(o, 'place', () => api.post(`/api/v1/episodes/${episodeId}/overlays/library`, { asset_id: placed?.asset_id || o.asset_id, beat_number: selected }))}
                    >
                      {isBusy('place') && <Loader2 size={13} className="eot-spin" aria-hidden="true" />}
                      {placed ? (onPlacedBeat ? 'On this beat' : 'Move here') : 'Use on this beat'}
                    </button>
                    {placed && (
                      <button
                        type="button" className="eot-btn is-quiet" data-testid={`eot-lib-remove-${o.id}`} disabled={!!busy}
                        onClick={() => act(o, 'remove', () => api.delete(`/api/v1/episodes/${episodeId}/overlays/library/${placed.asset_id}`))}
                      >
                        {isBusy('remove') && <Loader2 size={13} className="eot-spin" aria-hidden="true" />} Remove
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Production → Overlays → From the show library (Evoni, 2026-10-07: "show
 * level overlays hold overlays that can be used for any episode while
 * episode overlays are for that episode only").
 *
 * The show's ready overlays (GET /ui-overlays/:showId, category
 * 'production'), each with its image: every episode can use them. None is
 * put on a beat ("none of the overlays should be beats for now"); the
 * images are made and changed in the show's Overlays (Assets → Overlays).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ImageOff } from 'lucide-react';
import api from '../../services/api';

export default function EpisodeLibraryOverlays({ showId }) {
  const [overlays, setOverlays] = useState(null);

  useEffect(() => {
    if (!showId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then((r) => {
        if (cancelled) return;
        setOverlays((r.data?.data || []).filter((o) => o.category === 'production' && o.generated && o.url));
      })
      .catch((err) => {
        console.error('[EpisodeLibraryOverlays] show overlays load failed:', err);
        if (!cancelled) setOverlays([]);
      });
    return () => { cancelled = true; };
  }, [showId]);

  const libraryPath = `/shows/${showId}/world?tab=production-overlays`;

  return (
    <section className="eot-section eot-library" id="eot-library" aria-labelledby="eot-library-title" data-testid="eot-library">
      <div className="eot-section-head">
        <div>
          <h2 id="eot-library-title" className="eot-section-title">From the show library</h2>
          <p className="eot-section-sub">The show&apos;s own overlays, made once and ready for every episode. Make or change them in the show&apos;s Overlays.</p>
        </div>
        {showId && (
          <Link className="eot-link" to={libraryPath} data-testid="eot-library-link">
            The show&apos;s Overlays <ExternalLink size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
      {overlays === null && <p className="eot-loading">Loading the show&apos;s overlays…</p>}
      {overlays && overlays.length === 0 && (
        <p className="eot-note" data-testid="eot-library-empty">The show has no ready overlays yet. Make them in the show&apos;s Overlays.</p>
      )}
      {overlays && overlays.length > 0 && (
        <ul className="eot-lib-list">
          {overlays.map((o) => (
            <li key={o.id} className="eot-lib-item" data-testid={`eot-lib-${o.id}`}>
              <span className="eot-lib-thumb">
                {o.url ? <img src={o.url} alt="" /> : <ImageOff size={16} aria-hidden="true" />}
              </span>
              <span className="eot-lib-text">
                <strong className="eot-lib-name">{String(o.name || o.id).replace(/^UI Overlay:\s*/i, '')}</strong>
                {o.description && <span className="eot-lib-where">{o.description}</span>}
              </span>
              <a className="eot-link" href={o.url} target="_blank" rel="noreferrer">View</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

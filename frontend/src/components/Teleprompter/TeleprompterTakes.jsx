// frontend/src/components/Teleprompter/TeleprompterTakes.jsx
// Teleprompter batch 2 (Evoni, 2026-10-20): the takes already saved for the
// beat on screen, from the episode's Files, with a preview and a ★ for the
// one she likes best (one per beat; the server un-stars the others). The ★
// shows only when the server sends is_favorite, i.e. once its database
// update (migration 20261020090000) has run.

import { useState } from 'react';
import { Play, Square, Star, Film } from 'lucide-react';
import { clipLength, hasTakeFields } from '../../lib/rawClipsApi';

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/**
 * takes: the beat's clips, oldest first. beatNumber: the beat on screen.
 * onFavorite(clip): star or un-star. starring: the clip id being saved.
 */
export default function TakesPanel({ takes, beatNumber, onFavorite, starring = null, error = null, loading = false }) {
  const [playing, setPlaying] = useState(null);
  const shown = takes.find((t) => t.id === playing);
  return (
    <div className="stp-takes" role="region" aria-label={`Takes for beat ${beatNumber}`} data-testid="stp-takes">
      <p className="stp-takes-title">Beat {beatNumber} · takes in Files</p>
      {takes.length ? (
        <ul className="stp-takes-list">
          {takes.map((t, i) => {
            const len = clipLength(t.duration_seconds);
            const at = when(t.created_at);
            const fav = hasTakeFields(t) && t.is_favorite;
            return (
              <li key={t.id} className={`stp-take${fav ? ' is-favorite' : ''}`} data-testid="stp-take">
                <div className="stp-take-text">
                  <span className="stp-take-name">{t.label || t.original_filename || `Take ${i + 1}`}</span>
                  {(len || at) && <span className="stp-take-meta">{[len, at].filter(Boolean).join(' · ')}</span>}
                </div>
                <button type="button" className="stp-btn is-icon" data-testid="stp-take-play" disabled={!t.url_raw}
                  aria-pressed={playing === t.id} aria-label={playing === t.id ? `Stop ${t.label || 'take'}` : `Play ${t.label || 'take'}`}
                  onClick={() => setPlaying((p) => (p === t.id ? null : t.id))}>
                  {playing === t.id ? <Square size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                </button>
                {hasTakeFields(t) && (
                  <button type="button" className={`stp-btn is-icon stp-star${fav ? ' is-on' : ''}`} data-testid="stp-take-star"
                    aria-pressed={!!fav} disabled={starring === t.id}
                    aria-label={fav ? `Favourite take: ${t.label || 'take'}. Press to un-star` : `Make ${t.label || 'this take'} the favourite for beat ${beatNumber}`}
                    onClick={() => onFavorite(t)}>
                    <Star size={18} aria-hidden="true" fill={fav ? 'currentColor' : 'none'} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="stp-takes-empty" data-testid="stp-takes-empty">
          <Film size={16} aria-hidden="true" /> {loading ? 'Loading the takes…' : 'No takes for this beat yet.'}
        </p>
      )}
      {shown && (
        <video className="stp-take-video" src={shown.url_raw} controls autoPlay playsInline data-testid="stp-take-video" onEnded={() => setPlaying(null)} />
      )}
      {error && <p className="stp-error" role="alert">{error}</p>}
    </div>
  );
}

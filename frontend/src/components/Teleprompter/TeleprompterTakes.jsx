// frontend/src/components/Teleprompter/TeleprompterTakes.jsx
// Teleprompter batch 2 (Evoni, 2026-10-20): the takes already saved for the
// beat on screen, from the episode's Files, with a preview and a ★ for the
// one she likes best (one per beat; the server un-stars the others). The ★
// shows only when the server sends is_favorite, i.e. once its database
// update (migration 20261020090000) has run.
// "Full episode" (Evoni, 2026-10-23): the whole-episode takes in their own
// group, each with its beat markers as links that play the take from that
// beat (beat_marks, once migration 20261023235900 has run).
// Where each starts and ends (Evoni, 2026-10-28): "Beats 10 → 14 · ended in
// beat 14 · Cliffhanger", and a note when two of her full takes cover the
// same beats ("Overlaps Full episode · take 1 on beats 10–11").

import { useState, useRef, useEffect } from 'react';
import { Play, Square, Star, Film, Clapperboard, MoveRight, Layers } from 'lucide-react';
import { clipLength, hasTakeFields } from '../../lib/rawClipsApi';
import { markClock, cleanMarks, hasMarksField } from '../../lib/fullEpisodeTake';
import { rangeText, rangeOverlaps, overlapText, beatNames } from '../../lib/clipRange';

/** Puts a video at `t` seconds (once it can), and plays it. */
export function seekVideo(video, t) {
  if (!video) return;
  const go = () => {
    try { video.currentTime = t; } catch (err) { console.error('[Teleprompter] could not seek the take:', err); }
    try {
      const p = video.play?.();
      // AbortError: she paused (or picked another beat) before it started; not a fault.
      if (p && typeof p.catch === 'function') p.catch((err) => (err?.name === 'AbortError' ? console.warn('[Teleprompter] take play interrupted:', err.message) : console.error('[Teleprompter] take did not play:', err)));
    } catch (err) { console.error('[Teleprompter] take did not play:', err); }
  };
  if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true });
}

/** A take's beat markers as links: "Beat 3 · 1:12.4" plays the take from there. */
export function MarkLinks({ marks, onSeek, testId = 'stp-marks', name = 'the take' }) {
  const list = cleanMarks(marks);
  if (!list.length) return null;
  return (
    <ul className="stp-marks" aria-label={`Beats in ${name}`} data-testid={testId}>
      {list.map((m) => (
        <li key={m.beat}>
          <button type="button" className="stp-btn stp-mark" data-testid="stp-mark" aria-label={`Play ${name} from beat ${m.beat}, at ${markClock(m.t)}`} onClick={() => onSeek(m.t)}>
            Beat {m.beat} · {markClock(m.t)}
          </button>
        </li>
      ))}
    </ul>
  );
}

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
export default function TakesPanel({ takes, beatNumber, onFavorite, starring = null, error = null, loading = false, fullTakes = [], names = beatNames() }) {
  const [playing, setPlaying] = useState(null);
  // A marker picked: the full take plays from { id, t }.
  const [seek, setSeek] = useState(null);
  const videoRef = useRef(null);
  const shown = takes.find((t) => t.id === playing) || fullTakes.find((t) => t.id === playing);
  useEffect(() => {
    if (seek && shown && seek.id === shown.id) seekVideo(videoRef.current, seek.t);
  }, [seek, shown]);
  const playFrom = (t, at) => { setPlaying(t.id); setSeek({ id: t.id, t: at, n: Date.now() }); };
  const overlaps = rangeOverlaps(fullTakes);
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
      {fullTakes.length > 0 && (
        <div className="stp-takes-group" role="group" aria-label="Full episode takes" data-testid="stp-full-takes">
          <p className="stp-takes-title"><Clapperboard size={14} aria-hidden="true" /> Full episode</p>
          <ul className="stp-takes-list">
            {fullTakes.map((t) => {
              const len = clipLength(t.duration_seconds);
              const at = when(t.created_at);
              const name = t.label || t.original_filename || 'Full episode take';
              const range = rangeText(t, names);
              return (
                <li key={t.id} className="stp-take is-full" data-testid="stp-full-take">
                  <div className="stp-take-row">
                    <div className="stp-take-text">
                      <span className="stp-take-name">{name}</span>
                      {(len || at) && <span className="stp-take-meta">{[len, at].filter(Boolean).join(' · ')}</span>}
                    </div>
                    <button type="button" className="stp-btn is-icon" data-testid="stp-take-play" disabled={!t.url_raw}
                      aria-pressed={playing === t.id} aria-label={playing === t.id ? `Stop ${name}` : `Play ${name}`}
                      onClick={() => setPlaying((p) => (p === t.id ? null : t.id))}>
                      {playing === t.id ? <Square size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                    </button>
                  </div>
                  {range && <span className="stp-take-range" data-testid="stp-full-range"><MoveRight size={13} aria-hidden="true" /> {range}</span>}
                  {(overlaps.get(t.id) || []).map((o) => (
                    <span key={o.clip.id} className="stp-take-meta stp-take-overlap" data-testid="stp-full-overlap"><Layers size={13} aria-hidden="true" /> {overlapText(o)}</span>
                  ))}
                  {t.url_raw && Array.isArray(t.beat_marks) && t.beat_marks.length > 0 && (
                    <MarkLinks marks={t.beat_marks} name={name} testId="stp-full-marks" onSeek={(s) => playFrom(t, s)} />
                  )}
                  {!hasMarksField(t) && <span className="stp-take-meta" data-testid="stp-marks-waiting">Beat markers show once the database update runs.</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {shown && (
        <video ref={videoRef} className="stp-take-video" src={shown.url_raw} controls autoPlay playsInline data-testid="stp-take-video" onEnded={() => setPlaying(null)} />
      )}
      {error && <p className="stp-error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * The editor's centre monitor (plan §3.5), P2: the working preview. Layers,
 * bottom to top, from the edit's own layout at the playhead (previewPlan
 * framePlan → layoutAt): the scene (an angle still, an angle video, or a
 * clip), then Prime's PIP where the edit places her, from her cutout when
 * the edit asks for it. Videos are muted: every sound plays from the mix
 * (usePreviewPlayback). Clicking the PIP selects her segment. Moving and
 * resizing in the preview arrive with editing (P3).
 */
import React, { useEffect, useRef } from 'react';
import { SkipBack, Play, Pause, SkipForward, Volume2, VolumeX, Maximize } from 'lucide-react';
import { FRAME_W, FRAME_H, timecode } from '../../lib/editorModel';

const pct = (v, of) => `${(v / of) * 100}%`;

/** A muted video held at the edit's time for its source: seeked when paused, corrected when it drifts. */
export function SyncedVideo({ src, timeMs, playing, rate, className, style, poster, onFailed, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || timeMs == null) return;
    const target = timeMs / 1000;
    try {
      el.playbackRate = rate;
      if (!playing) {
        if (!el.paused) el.pause();
        if (Math.abs((el.currentTime || 0) - target) > 0.02) el.currentTime = target;
        return;
      }
      if (Math.abs((el.currentTime || 0) - target) > 0.25) el.currentTime = target;
      if (el.paused) {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch((err) => console.warn(`[EpisodeEditor] ${label} could not play:`, err?.message));
      }
    } catch (err) {
      console.warn(`[EpisodeEditor] ${label} could not follow the clock:`, err?.message);
    }
  }, [timeMs, playing, rate, src, label]);
  return (
    <video
      ref={ref} className={className} style={style} src={src || undefined} poster={poster || undefined}
      muted playsInline preload="auto" aria-label={label} data-testid={`video-${label}`}
      onError={() => { console.error(`[EpisodeEditor] ${label} could not load`); onFailed?.(src); }}
    />
  );
}

export default function EditorPreview({
  frame, duration, selectedId, onSelect, onPrevEdit, onNextEdit, hidden,
  playing, rate, onToggle, volume, onVolume, muted, onMute, sounds, failedVideo, onVideoFailed,
}) {
  const box = useRef(null);
  const fullscreen = () => {
    const el = box.current;
    if (!el?.requestFullscreen) return;
    el.requestFullscreen().catch((err) => console.warn('[EpisodeEditor] fullscreen refused:', err?.message));
  };
  const scene = frame?.scene && !hidden.scene ? frame.scene : null;
  const pip = frame?.pip && !hidden.prime ? frame.pip : null;
  const unavailable = (sounds || []).filter((s) => !s.url || s.failed);
  const notes = [pip?.note, frame?.scene && scene && !scene.url ? `${scene.name}: no media` : null].filter(Boolean);

  return (
    <section className="tle-panel tle-preview" aria-label="Preview">
      <div className="tle-monitor-wrap">
        <div className="tle-monitor" ref={box} data-testid="editor-monitor">
          {scene && scene.kind === 'image' && scene.url && <img className="tle-monitor-scene" src={scene.url} alt={scene.name} />}
          {scene && scene.kind === 'video' && scene.url && !failedVideo[scene.url] && (
            <SyncedVideo className="tle-monitor-scene" src={scene.url} poster={scene.poster} timeMs={scene.source_time_ms} playing={playing && !scene.held} rate={rate}
              label={`Scene: ${scene.name}`} onFailed={onVideoFailed} />
          )}
          {scene && (!scene.url || failedVideo[scene.url]) && <div className="tle-monitor-msg">{scene.name}: {scene.url ? 'the video could not load' : 'no media'}</div>}
          {!frame?.scene && (
            <div className="tle-monitor-msg">{frame?.scene_gap ? 'No scene here (scene gap)' : 'No scene at the playhead'}</div>
          )}
          {pip && (
            <button
              type="button"
              className={`tle-monitor-pip${pip.cutout ? ' is-cutout' : ''}${selectedId === pip.segment_id ? ' is-selected' : ''}`}
              style={{ left: pct(pip.layout.x, FRAME_W), top: pct(pip.layout.y, FRAME_H), width: pct(pip.layout.w, FRAME_W), height: pct(pip.layout.h, FRAME_H) }}
              onClick={() => onSelect(pip.segment_id)}
              aria-label={`Prime PIP: ${pip.name}`}
              aria-pressed={selectedId === pip.segment_id}
            >
              {pip.url && !failedVideo[pip.url] ? (
                <SyncedVideo src={pip.url} poster={pip.poster} timeMs={pip.source_time_ms} playing={playing} rate={rate} label={`Prime: ${pip.name}`} onFailed={onVideoFailed} />
              ) : <span>{pip.url ? "Prime's video could not load" : "Prime's take is missing"}</span>}
            </button>
          )}
          {frame?.prime_missing && <span className="tle-monitor-badge">Prime footage missing</span>}
          <span className="tle-monitor-note">Working preview{rate !== 1 ? ` · ${rate}×` : ''}</span>
          {unavailable.length > 0 && (
            <span className="tle-monitor-sound" title={unavailable.map((s) => `${s.label}: ${s.failed ? 'could not load' : s.missing}`).join('\n')}>
              {unavailable.length} {unavailable.length === 1 ? 'sound' : 'sounds'} unavailable
            </span>
          )}
        </div>
      </div>
      {notes.length > 0 && <p className="tle-monitor-notes" role="status">{notes.join(' · ')}</p>}
      <div className="tle-transport">
        <span className="tle-timecode" data-testid="editor-timecode">{timecode(frame?.t || 0)} <span className="tle-muted">/ {timecode(duration)}</span></span>
        <div className="tle-transport-mid">
          <button type="button" className="tle-icon-btn" onClick={onPrevEdit} aria-label="Previous edit point" title="Previous edit point"><SkipBack size={18} /></button>
          <button type="button" className="tle-icon-btn tle-play" onClick={onToggle} disabled={!(duration > 0)} aria-label={playing ? 'Pause' : 'Play'} title={`${playing ? 'Pause' : 'Play'} (Space)`}>
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button type="button" className="tle-icon-btn" onClick={onNextEdit} aria-label="Next edit point" title="Next edit point"><SkipForward size={18} /></button>
        </div>
        <div className="tle-transport-end">
          <button type="button" className="tle-icon-btn" onClick={onMute} aria-pressed={muted} aria-label={muted ? 'Unmute the preview' : 'Mute the preview'} title="Preview volume only: not saved">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input type="range" className="tle-volume" min="0" max="100" value={Math.round(volume * 100)} onChange={(e) => onVolume(Number(e.target.value) / 100)} aria-label="Preview volume (not saved)" />
          <button type="button" className="tle-icon-btn" onClick={fullscreen} aria-label="Full screen" title="Full screen"><Maximize size={18} /></button>
        </div>
      </div>
    </section>
  );
}

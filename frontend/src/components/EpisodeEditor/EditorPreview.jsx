/**
 * The editor's centre monitor (plan §3.5), P1: the still frame at the
 * playhead, drawn from the edit's own layout (stillFrame → layoutAt): the
 * scene's image, and Prime's PIP box where the edit places it, with her
 * take's thumbnail. Clicking the PIP selects her segment. Playback, video and
 * audio arrive in P2; moving and resizing in the preview in P3.
 */
import React, { useRef } from 'react';
import { SkipBack, Play, SkipForward, Volume2, Maximize } from 'lucide-react';
import { FRAME_W, FRAME_H, timecode } from '../../lib/editorModel';

const pct = (v, of) => `${(v / of) * 100}%`;

export default function EditorPreview({ frame, duration, selectedId, onSelect, onPrevEdit, onNextEdit, hidden }) {
  const box = useRef(null);
  const fullscreen = () => {
    const el = box.current;
    if (!el?.requestFullscreen) return;
    el.requestFullscreen().catch((err) => console.warn('[EpisodeEditor] fullscreen refused:', err?.message));
  };
  const showScene = frame?.scene && !hidden.scene;
  const showPip = frame?.pip && !hidden.prime;

  return (
    <section className="tle-panel tle-preview" aria-label="Preview">
      <div className="tle-monitor-wrap">
        <div className="tle-monitor" ref={box} data-testid="editor-monitor">
          {showScene && frame.scene.image && <img className="tle-monitor-scene" src={frame.scene.image} alt={frame.scene.name} />}
          {showScene && !frame.scene.image && <div className="tle-monitor-msg">{frame.scene.name}: no still image</div>}
          {!frame?.scene && (
            <div className="tle-monitor-msg">{frame?.scene_gap ? 'No scene here (scene gap)' : 'No scene at the playhead'}</div>
          )}
          {showPip && (
            <button
              type="button"
              className={`tle-monitor-pip${selectedId === frame.pip.segment_id ? ' is-selected' : ''}`}
              style={{ left: pct(frame.pip.layout.x, FRAME_W), top: pct(frame.pip.layout.y, FRAME_H), width: pct(frame.pip.layout.w, FRAME_W), height: pct(frame.pip.layout.h, FRAME_H) }}
              onClick={() => onSelect(frame.pip.segment_id)}
              aria-label={`Prime PIP: ${frame.pip.name}`}
              aria-pressed={selectedId === frame.pip.segment_id}
            >
              {frame.pip.image ? <img src={frame.pip.image} alt="" /> : <span>Prime</span>}
            </button>
          )}
          {frame?.prime_missing && <span className="tle-monitor-badge">Prime footage missing</span>}
          <span className="tle-monitor-note">Still frame · playback arrives in P2</span>
        </div>
      </div>
      <div className="tle-transport">
        <span className="tle-timecode" data-testid="editor-timecode">{timecode(frame?.t || 0)} <span className="tle-muted">/ {timecode(duration)}</span></span>
        <div className="tle-transport-mid">
          <button type="button" className="tle-icon-btn" onClick={onPrevEdit} aria-label="Previous edit point" title="Previous edit point"><SkipBack size={18} /></button>
          <button type="button" className="tle-icon-btn tle-play" disabled aria-disabled="true" aria-label="Play (arrives in P2)" title="Playback arrives in P2"><Play size={22} /></button>
          <button type="button" className="tle-icon-btn" onClick={onNextEdit} aria-label="Next edit point" title="Next edit point"><SkipForward size={18} /></button>
        </div>
        <div className="tle-transport-end">
          <span className="tle-icon-btn is-off" title="Volume: playback arrives in P2" aria-hidden="true"><Volume2 size={18} /></span>
          <button type="button" className="tle-icon-btn" onClick={fullscreen} aria-label="Full screen" title="Full screen"><Maximize size={18} /></button>
        </div>
      </div>
    </section>
  );
}

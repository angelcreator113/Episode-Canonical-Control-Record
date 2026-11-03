/**
 * The editor's centre monitor (plan §3.5), P2: the working preview. Layers,
 * bottom to top, from the edit's own layout at the playhead (previewPlan
 * framePlan → layoutAt): the scene (an angle still, an angle video, or a
 * clip), then Prime's PIP where the edit places her, from her cutout when
 * the edit asks for it. Videos are muted: every sound plays from the mix
 * (usePreviewPlayback). Clicking the PIP selects her segment.
 *
 * Editing (P3): with her segment selected, Prime is dragged to move her and
 * resized from her eight handles (corners keep her proportions; Shift frees
 * them). The inspector follows the drag (onLayoutDrag); the new layout is
 * saved once, on release (onLayoutCommit).
 *
 * Gate 2a (rulings D3, D4, D5): the layers follow previewPlan framePlan →
 * layersAt: the scene, Lala and guests (their cutout once keyed) by layer,
 * Prime, then captions and titles on top. Each is drawn at its opacity. A
 * selected performer clip or caption is moved and resized like Prime, with
 * the same handles (ArrangeBox). The beat's visual mode is shown, not drawn:
 * what a mode changes on screen is the render's (Gate 3).
 */
import React, { useEffect, useRef, useState } from 'react';
import { SkipBack, Play, Pause, SkipForward, Volume2, VolumeX, Maximize } from 'lucide-react';
import { FRAME_W, FRAME_H, timecode } from '../../lib/editorModel';
import { HANDLES, dragLayout, sameLayout } from '../../lib/pipGeometry';

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

/** How a caption style is drawn in the preview: its type size is a share of its box's height. */
export const CAPTION_LOOKS = {
  caption: { cls: 'is-caption', size: 0.42 },
  title: { cls: 'is-title', size: 0.55 },
  lower_third: { cls: 'is-lower-third', size: 0.4 },
};

/**
 * One layer the producer can move and resize in the preview: Prime, a
 * performer clip or a caption. It keeps its own drag; the page hears the
 * live layout (onDrag) and, once, the layout let go of (onCommit).
 */
function ArrangeBox({
  id, layout, opacity = 1, selected, canArrange, onSelect, onDrag, onCommit, scale,
  className, testid, handlePrefix, label, title, children,
}) {
  const [drag, setDrag] = useState(null); // { handle, x0, y0, start, live, moved }
  const shown = drag ? drag.live : layout;
  const begin = (e, handle) => {
    if (!canArrange || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ handle, x0: e.clientX, y0: e.clientY, start: layout, live: layout, moved: false });
  };
  const move = (e) => {
    if (!drag) return;
    e.stopPropagation();
    const k = scale();
    const live = dragLayout(drag.start, drag.handle, (e.clientX - drag.x0) * k, (e.clientY - drag.y0) * k, { free: e.shiftKey });
    setDrag({ ...drag, live, moved: drag.moved || !sameLayout(live, drag.start) });
    onDrag?.({ id, layout: live });
  };
  const end = (e) => {
    if (!drag) return;
    e.stopPropagation();
    const { live, start, moved } = drag;
    setDrag(null);
    onDrag?.(null);
    if (moved && !sameLayout(live, start)) onCommit?.(id, live);
  };
  // Taken over by the browser or system (pointercancel, a lost capture): nothing is saved, and the
  // page's live layout is cleared so the inspector shows the stored place again.
  const cancel = (e) => {
    if (!drag) return;
    e?.stopPropagation?.();
    setDrag(null);
    onDrag?.(null);
  };
  return (
    <div
      className={`${className}${selected ? ' is-selected' : ''}${canArrange ? ' can-arrange' : ''}`}
      style={{ left: pct(shown.x, FRAME_W), top: pct(shown.y, FRAME_H), width: pct(shown.w, FRAME_W), height: pct(shown.h, FRAME_H), opacity }}
      data-testid={testid}
      onPointerDown={(e) => begin(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}
    >
      <button type="button" className="tle-monitor-pip-hit" onClick={() => onSelect(id)} aria-label={label} aria-pressed={selected}
        title={canArrange ? 'Drag to move; drag a handle to resize (Shift frees the proportions)' : title}>
        {typeof children === 'function' ? children(shown) : children}
      </button>
      {canArrange && HANDLES.map((h) => (
        <span key={h} className={`tle-pip-handle h-${h}`} data-testid={`${handlePrefix}-handle-${h}`} aria-hidden="true"
          onPointerDown={(e) => begin(e, h)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel} />
      ))}
      {drag && <span className="tle-pip-readout" aria-hidden="true">{shown.x}, {shown.y} · {shown.w}×{shown.h}</span>}
    </div>
  );
}

export default function EditorPreview({
  frame, duration, selectedId, onSelect, onPrevEdit, onNextEdit, hidden,
  playing, rate, onToggle, volume, onVolume, muted, onMute, sounds, failedVideo, onVideoFailed,
  editable = false, primeLocked = false, locked = {}, onLayoutDrag, onLayoutCommit,
}) {
  const box = useRef(null);
  const fullscreen = () => {
    const el = box.current;
    if (!el?.requestFullscreen) return;
    el.requestFullscreen().catch((err) => console.warn('[EpisodeEditor] fullscreen refused:', err?.message));
  };
  const scale = () => FRAME_W / (box.current?.clientWidth || FRAME_W);
  const scene = frame?.scene && !hidden.scene ? frame.scene : null;
  const pip = frame?.pip && !hidden.prime ? frame.pip : null;
  const performers = hidden.performer ? [] : (frame?.performers || []);
  const captions = hidden.captions ? [] : (frame?.captions || []);
  const arrange = (id, laneLocked) => editable && !laneLocked && selectedId === id && !playing;
  const boxProps = (id, laneLocked) => ({
    id, selected: selectedId === id, canArrange: arrange(id, laneLocked), onSelect, onDrag: onLayoutDrag, onCommit: onLayoutCommit, scale,
  });
  const unavailable = (sounds || []).filter((s) => !s.url || s.failed);
  const notes = [...new Set([pip?.note, ...performers.map((p) => p.note), frame?.scene && scene && !scene.url ? `${scene.name}: no media` : null].filter(Boolean))];

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
          {performers.map((p) => (
            <ArrangeBox key={p.item_id} {...boxProps(p.item_id, locked.performer)} layout={p.layout} opacity={p.opacity}
              className={`tle-monitor-pip tle-monitor-performer${p.cutout ? ' is-cutout' : ''}`} testid={`preview-performer-${p.item_id}`} handlePrefix="performer"
              label={`Performer: ${p.name}`} title="Select this clip">
              {p.url && !failedVideo[p.url] ? (
                <SyncedVideo src={p.url} poster={p.poster} timeMs={p.source_time_ms} playing={playing} rate={rate} label={`Performer: ${p.name}`} onFailed={onVideoFailed} />
              ) : <span>{p.url ? 'The video could not load' : 'The take is missing'}</span>}
            </ArrangeBox>
          ))}
          {pip && (
            <ArrangeBox key={`pip-${pip.segment_id}`} {...boxProps(pip.segment_id, primeLocked)} layout={pip.layout} opacity={pip.opacity ?? 1}
              className={`tle-monitor-pip${pip.cutout ? ' is-cutout' : ''}`} testid="preview-pip" handlePrefix="pip"
              label={`Prime PIP: ${pip.name}`} title="Select Prime">
              {pip.url && !failedVideo[pip.url] ? (
                <SyncedVideo src={pip.url} poster={pip.poster} timeMs={pip.source_time_ms} playing={playing} rate={rate} label={`Prime: ${pip.name}`} onFailed={onVideoFailed} />
              ) : <span>{pip.url ? "Prime's video could not load" : "Prime's take is missing"}</span>}
            </ArrangeBox>
          )}
          {captions.map((c) => {
            const look = CAPTION_LOOKS[c.style_key] || CAPTION_LOOKS.caption;
            return (
              <ArrangeBox key={c.item_id} {...boxProps(c.item_id, locked.captions)} layout={c.layout} opacity={c.opacity}
                className={`tle-monitor-pip tle-monitor-caption ${look.cls}`} testid={`preview-caption-${c.item_id}`} handlePrefix="caption"
                label={`Caption: ${c.text}`} title="Select this caption">
                {(l) => <span className="tle-caption-text" style={{ fontSize: `${((l.h * look.size) / FRAME_W) * 100}cqw` }}>{c.text}</span>}
              </ArrangeBox>
            );
          })}
          {frame?.mode === 'cinematic' && <span className="tle-monitor-mode" title="The beat's visual mode. What it changes on screen is drawn by the render (Gate 3).">Cinematic</span>}
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

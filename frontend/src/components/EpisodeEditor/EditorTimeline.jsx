/**
 * The editor's multitrack (plan §3.8–§3.9): the ruler with beat boundaries,
 * one lane per layer, the blocks the edit places and the playhead. Click the
 * ruler or a lane to move the playhead; click a block to select it. Lanes
 * that have no data model yet are drawn empty and say what unlocks them.
 *
 * Track header toggles are view settings in this browser, never saved to
 * the episode and never part of a render: the eye hides a lane in the
 * preview, the speaker silences it in preview playback, the lock keeps
 * it from being edited here.
 *
 * Editing (P3, P4): a Prime segment, a dialogue block or a sound is dragged
 * to move it; a scene clip is dragged to another place in its beat. The
 * handles at a selected block's edges trim it (both ends of a segment or a
 * sound, the end of a scene clip). Media dragged from the media panel is dropped on
 * the lane that takes it. Each gesture is one change, saved when the pointer
 * is released (onMoveBlock, onTrimBlock, onDropAsset).
 *
 * Gate 2a: a Lala or guest clip (Performer lane) and a caption move and trim
 * like a sound; the Performer lane takes Lala's and guests' clips. The
 * ruler marks each timed change of visual mode (gameplay ↔ cinematic).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Link2 } from 'lucide-react';
import { LANES, timecode } from '../../lib/editorModel';
import { pointerXY, pointerIn } from '../../lib/editorRotation';

export const LABEL_W = 190;

/** What can be dragged along the clock, and which edges trim. */
export const MOVABLE = new Set(['segment', 'dialogue', 'audio_item', 'scene_clip', 'performer_clip', 'caption']);
export const TRIM_EDGES = {
  segment: ['start', 'end'], scene_clip: ['end'], audio_item: ['start', 'end'], performer_clip: ['start', 'end'], caption: ['start', 'end'],
};
/** Which lane takes which media (an asset's `kind`). */
export const LANE_TAKES = {
  scene: ['angle_still', 'angle_video', 'scene_clip_source'],
  performer: ['scene_clip_source'],
  prime: ['prime_clip'],
  dialogue: ['take'],
};
/** Whether a lane takes this asset: the Performer lane only Lala's and guests' clips (D3). */
export const laneTakes = (laneKey, asset) => Boolean(asset) && (LANE_TAKES[laneKey] || []).includes(asset.kind) && (laneKey !== 'performer' || Boolean(asset.performer));

/** A tick step (ms) that keeps major ticks at least ~90 px apart. */
export function tickStep(pxPerMs) {
  const steps = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];
  return steps.find((s) => s * pxPerMs >= 90) || steps[steps.length - 1];
}

export default function EditorTimeline({
  model, pxPerMs, playhead, onSeek, selectedId, onSelect, view, onToggleView, scrollRef,
  editable = false, onMoveBlock, onTrimBlock, onDropAsset, draggingAsset,
}) {
  const [drag, setDrag] = useState(null); // { id, mode: 'move' | 'start' | 'end', x0, dx }
  const [dropLane, setDropLane] = useState(null);
  const justDragged = useRef(false);
  const width = Math.max(1, Math.ceil(model.duration * pxPerMs) + 120);
  const step = tickStep(pxPerMs);
  const ticks = useMemo(() => {
    const out = [];
    const end = Math.max(model.duration, width / pxPerMs);
    for (let t = 0; t <= end; t += step) out.push(t);
    return out;
  }, [model.duration, width, pxPerMs, step]);
  const area = useRef(null);

  const seekFromEvent = (e) => {
    const { x } = pointerIn(e, area.current);
    onSeek(Math.max(0, Math.min(model.duration, Math.round(x / pxPerMs))));
  };
  const at = (ms) => Math.round(ms * pxPerMs);
  const locked = (laneKey) => Boolean(view[laneKey]?.locked);

  const startDrag = (e, b, laneKey, mode) => {
    if (!editable || locked(laneKey) || e.button !== 0) return;
    if (mode === 'move' && !MOVABLE.has(b.kind)) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id: b.id, mode, x0: pointerXY(e).x, dx: 0, block: b });
  };
  // A trim handle sits inside its block: its events stop there, so one gesture is one change.
  const moveDrag = (e) => { if (!drag) return; e.stopPropagation(); setDrag({ ...drag, dx: pointerXY(e).x - drag.x0 }); };
  const endDrag = (e) => {
    if (!drag) return;
    e.stopPropagation();
    const { block, mode } = drag;
    const dx = pointerXY(e).x - drag.x0;
    setDrag(null);
    if (Math.abs(dx) < 3) return;
    justDragged.current = true;
    const delta = Math.round(dx / pxPerMs);
    if (mode === 'move') onMoveBlock?.(block, block.start + delta);
    else onTrimBlock?.(block, mode, mode === 'start' ? block.start + delta : block.end + delta);
  };
  // A gesture the browser or system takes over (a touch turned into a scroll, a lost capture)
  // ends with no change: the block goes back to where it is stored.
  const cancelDrag = (e) => {
    if (!drag) return;
    e?.stopPropagation?.();
    setDrag(null);
  };
  const shown = (b) => {
    if (!drag || drag.id !== b.id) return { left: at(b.start), width: Math.max(4, at(b.end) - at(b.start)) };
    if (drag.mode === 'move') return { left: at(b.start) + drag.dx, width: Math.max(4, at(b.end) - at(b.start)) };
    if (drag.mode === 'start') return { left: at(b.start) + drag.dx, width: Math.max(4, at(b.end) - at(b.start) - drag.dx) };
    return { left: at(b.start), width: Math.max(4, at(b.end) - at(b.start) + drag.dx) };
  };

  const takes = (laneKey) => laneTakes(laneKey, draggingAsset) && !locked(laneKey);
  const timeFromEvent = (e) => {
    return Math.max(0, Math.round(pointerIn(e, area.current).x / pxPerMs));
  };

  return (
    <div className="tle-tl" data-testid="editor-timeline">
      <div className="tle-tl-heads">
        <div className="tle-tl-corner" title="Eye, speaker and lock are view settings in this browser: not saved to the episode, never in the export">View only · not saved</div>
        {LANES.map((lane) => {
          const v = view[lane.key] || {};
          return (
            <div key={lane.key} className={`tle-tl-head is-${lane.kind}${lane.pending ? ' is-pending' : ''}`}>
              <div className="tle-tl-head-text">
                <span className="tle-tl-name">{lane.name}</span>
                <span className="tle-tl-sub">{lane.sub}</span>
              </div>
              <div className="tle-tl-head-btns">
                {lane.kind === 'video' ? (
                  <button type="button" className="tle-icon-btn" aria-pressed={Boolean(v.hidden)} onClick={() => onToggleView(lane.key, 'hidden')}
                    aria-label={`${v.hidden ? 'Show' : 'Hide'} ${lane.name} in the preview (view only, not saved)`} title="Hide in the preview only: not saved, the export is unchanged">
                    {v.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                ) : (
                  <button type="button" className="tle-icon-btn" aria-pressed={Boolean(v.muted)} onClick={() => onToggleView(lane.key, 'muted')}
                    aria-label={`${v.muted ? 'Unmute' : 'Mute'} ${lane.name} in preview playback (view only, not saved)`} title="Mute in preview playback only: not saved, the export is unchanged">
                    {v.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                )}
                <button type="button" className="tle-icon-btn" aria-pressed={Boolean(v.locked)} onClick={() => onToggleView(lane.key, 'locked')}
                  aria-label={`${v.locked ? 'Unlock' : 'Lock'} ${lane.name} for editing in this browser`} title="Lock against editing in this browser: not saved to the episode">
                  {v.locked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tle-tl-scroll" ref={scrollRef}>
        <div className="tle-tl-area" ref={area} style={{ width }}>
          <div className="tle-ruler" onClick={seekFromEvent} role="presentation" data-testid="editor-ruler">
            {ticks.map((t) => (
              <span key={t} className="tle-tick" style={{ left: at(t) }}><span className="tle-tick-label">{timecode(t).slice(0, 5)}</span></span>
            ))}
            {model.beats.filter((b) => b.end > b.start).map((b) => (
              <span key={b.beat} className="tle-ruler-beat" style={{ left: at(b.start), width: Math.max(1, at(b.end) - at(b.start)) }} title={`Beat ${b.beat}: ${b.name}`}>{b.beat}</span>
            ))}
            {(model.modeMarks || []).map((m) => (
              <span key={m.id} className={`tle-mode-mark is-${m.mode}`} style={{ left: at(m.at) }} data-testid={`mode-mark-${m.id}`}
                title={`Visual mode: ${m.mode} from ${timecode(m.at)} (change it on the beat card)`} aria-label={`Visual mode ${m.mode} at ${timecode(m.at)}`} />
            ))}
          </div>
          {LANES.map((lane) => (
            <div key={lane.key}
              className={`tle-lane is-${lane.kind} lane-${lane.key}${lane.pending ? ' is-pending' : ''}${locked(lane.key) ? ' is-locked' : ''}${takes(lane.key) ? ' can-drop' : ''}${dropLane === lane.key ? ' is-drop' : ''}`}
              onClick={seekFromEvent} role="presentation" data-lane={lane.key}
              onDragOver={(e) => { if (takes(lane.key)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropLane(lane.key); } }}
              onDragLeave={() => setDropLane((cur) => (cur === lane.key ? null : cur))}
              onDrop={(e) => { setDropLane(null); if (takes(lane.key)) { e.preventDefault(); onDropAsset?.(lane.key, draggingAsset, timeFromEvent(e)); } }}>
              {lane.pending && <span className="tle-lane-pending">{lane.pending}</span>}
              {(model.blocks[lane.key] || []).map((b) => {
                const selected = selectedId === b.id;
                const canMove = editable && MOVABLE.has(b.kind) && !locked(lane.key);
                const edges = editable && selected && !locked(lane.key) ? (TRIM_EDGES[b.kind] || []) : [];
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`tle-block kind-${b.kind}${selected ? ' is-selected' : ''}${b.muted ? ' is-muted' : ''}${b.problem || b.missing ? ' is-problem' : ''}${canMove ? ' can-move' : ''}${drag?.id === b.id ? ' is-dragging' : ''}`}
                    style={shown(b)}
                    onClick={(e) => { e.stopPropagation(); if (justDragged.current) { justDragged.current = false; return; } onSelect(b.id); }}
                    onPointerDown={(e) => startDrag(e, b, lane.key, 'move')}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
                    aria-pressed={selected}
                    aria-label={`${lane.name}: ${b.label}, ${timecode(b.start)} to ${timecode(b.end)}`}
                    title={`${b.label} · ${timecode(b.start)}–${timecode(b.end)}${b.muted ? ' · muted in the episode' : ''}${b.problem ? ` · will not play (${b.problem})` : ''}${canMove ? ' · drag to move' : ''}`}
                  >
                    {b.image && lane.kind === 'video' && <span className="tle-block-strip" style={{ backgroundImage: `url("${b.image}")` }} aria-hidden="true" />}
                    {lane.kind === 'audio' && <span className="tle-block-wave" aria-hidden="true" />}
                    <span className="tle-block-label">{b.linked && <Link2 size={11} aria-hidden="true" />} {b.label}</span>
                    {edges.map((edge) => (
                      <span key={edge} className={`tle-trim tle-trim-${edge}`} role="presentation" aria-hidden="true" data-testid={`trim-${edge}-${b.id}`}
                        onPointerDown={(e) => startDrag(e, b, lane.key, edge)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} />
                    ))}
                  </button>
                );
              })}
              {lane.key === 'scene' && model.transitions.map((tr) => (
                <span key={tr.id} className="tle-transition" style={{ left: at(tr.at) }} title={`Transition: ${tr.type} (stored; drawn after Gate 2)`} aria-hidden="true" />
              ))}
            </div>
          ))}
          <div className="tle-playhead" style={{ left: at(playhead) }} aria-hidden="true"><span className="tle-playhead-cap" /></div>
        </div>
      </div>
    </div>
  );
}

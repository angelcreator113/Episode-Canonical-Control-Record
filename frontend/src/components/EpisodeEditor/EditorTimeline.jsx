/**
 * The editor's multitrack (plan §3.8–§3.9): the ruler with beat boundaries,
 * one lane per layer, the blocks the edit places and the playhead. Click the
 * ruler or a lane to move the playhead; click a block to select it. Lanes
 * that have no data model yet are drawn empty and say what unlocks them.
 *
 * Track header toggles are view settings in this browser, never saved to
 * the episode and never part of a render: the eye hides a lane in the
 * preview, the speaker silences it in preview playback (P2), the lock keeps
 * it from being edited here (editing arrives in P3).
 */
import React, { useMemo, useRef } from 'react';
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Link2 } from 'lucide-react';
import { LANES, timecode } from '../../lib/editorModel';

export const LABEL_W = 190;

/** A tick step (ms) that keeps major ticks at least ~90 px apart. */
export function tickStep(pxPerMs) {
  const steps = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];
  return steps.find((s) => s * pxPerMs >= 90) || steps[steps.length - 1];
}

export default function EditorTimeline({
  model, pxPerMs, playhead, onSeek, selectedId, onSelect, view, onToggleView, scrollRef,
}) {
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
    const rect = area.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, Math.min(model.duration, Math.round(x / pxPerMs))));
  };
  const at = (ms) => Math.round(ms * pxPerMs);

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
                    aria-label={`${v.muted ? 'Unmute' : 'Mute'} ${lane.name} in preview playback (view only, not saved)`} title="Mute in preview playback only (P2): not saved, the export is unchanged">
                    {v.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                )}
                <button type="button" className="tle-icon-btn" aria-pressed={Boolean(v.locked)} onClick={() => onToggleView(lane.key, 'locked')}
                  aria-label={`${v.locked ? 'Unlock' : 'Lock'} ${lane.name} for editing in this browser`} title="Lock against editing in this browser (editing arrives in P3)">
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
          </div>
          {LANES.map((lane) => (
            <div key={lane.key} className={`tle-lane is-${lane.kind} lane-${lane.key}${lane.pending ? ' is-pending' : ''}`} onClick={seekFromEvent} role="presentation" data-lane={lane.key}>
              {lane.pending && <span className="tle-lane-pending">{lane.pending}</span>}
              {(model.blocks[lane.key] || []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`tle-block kind-${b.kind}${selectedId === b.id ? ' is-selected' : ''}${b.muted ? ' is-muted' : ''}${b.problem || b.missing ? ' is-problem' : ''}`}
                  style={{ left: at(b.start), width: Math.max(4, at(b.end) - at(b.start)) }}
                  onClick={(e) => { e.stopPropagation(); onSelect(b.id); }}
                  aria-pressed={selectedId === b.id}
                  aria-label={`${lane.name}: ${b.label}, ${timecode(b.start)} to ${timecode(b.end)}`}
                  title={`${b.label} · ${timecode(b.start)}–${timecode(b.end)}${b.muted ? ' · muted in the episode' : ''}${b.problem ? ` · will not play (${b.problem})` : ''}`}
                >
                  {b.image && lane.kind === 'video' && <span className="tle-block-strip" style={{ backgroundImage: `url("${b.image}")` }} aria-hidden="true" />}
                  {lane.kind === 'audio' && <span className="tle-block-wave" aria-hidden="true" />}
                  <span className="tle-block-label">{b.linked && <Link2 size={11} aria-hidden="true" />} {b.label}</span>
                </button>
              ))}
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

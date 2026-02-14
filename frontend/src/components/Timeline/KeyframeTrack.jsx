import React, { useCallback, useMemo } from 'react';
import './KeyframeTrack.css';

/**
 * KeyframeTrack — a timeline track that displays / edits keyframes for a
 * selected element (character, UI element, background).
 *
 * Props:
 *   keyframes        - [{id, time, properties: {x,y,scale,opacity,rotation}}]
 *   totalDuration    - timeline duration (seconds)
 *   pixelsPerSecond  - zoom-aware px/s
 *   currentTime      - playhead position (seconds)
 *   selectedKeyframe - currently selected keyframe id (or null)
 *   onAddKeyframe    - (time) => void
 *   onDeleteKeyframe - (id) => void
 *   onSelectKeyframe - (id) => void
 *   onSeek           - (time) => void
 *   onDragKeyframe   - (id, newTime) => void
 */
function KeyframeTrack({
  keyframes = [],
  totalDuration = 0,
  pixelsPerSecond = 50,
  currentTime = 0,
  selectedKeyframe = null,
  onAddKeyframe,
  onDeleteKeyframe,
  onSelectKeyframe,
  onSeek,
  onDragKeyframe
}) {
  const timelineWidth = totalDuration * pixelsPerSecond;

  // Double-click empty area → add keyframe at that time
  const handleDoubleClick = useCallback((e) => {
    if (!onAddKeyframe) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
    onAddKeyframe(time);
  }, [onAddKeyframe, pixelsPerSecond, totalDuration]);

  // Drag a keyframe diamond to a new time (pure mousedown — no HTML5 D&D)
  const handleDiamondMouseDown = useCallback((e, kf) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startTime = kf.time;
    let moved = false;

    const onMove = (ev) => {
      moved = true;
      const dx = ev.clientX - startX;
      const dt = dx / pixelsPerSecond;
      const newTime = Math.max(0, Math.min(startTime + dt, totalDuration));
      if (onDragKeyframe) onDragKeyframe(kf.id, newTime);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // If user didn't drag, treat as click → select + seek
      if (!moved) {
        if (onSelectKeyframe) onSelectKeyframe(kf.id);
        if (onSeek) onSeek(kf.time);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pixelsPerSecond, totalDuration, onDragKeyframe, onSelectKeyframe, onSeek]);

  // Interpolated value at currentTime
  const interpolated = useMemo(() => {
    if (keyframes.length === 0) return null;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    
    // Before first keyframe
    if (currentTime <= sorted[0].time) return sorted[0].properties;
    // After last keyframe
    if (currentTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].properties;

    // Find surrounding keyframes and lerp
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (currentTime >= a.time && currentTime <= b.time) {
        const t = (currentTime - a.time) / (b.time - a.time);
        const props = {};
        for (const key of Object.keys(a.properties)) {
          const va = parseFloat(a.properties[key]) || 0;
          const vb = parseFloat(b.properties[key]) || 0;
          props[key] = va + (vb - va) * t;
        }
        return props;
      }
    }
    return null;
  }, [keyframes, currentTime]);

  return (
    <div className="kft-track" onDoubleClick={handleDoubleClick}>
      {/* Interpolation curve visualization */}
      {keyframes.length >= 2 && (
        <svg className="kft-curve" viewBox={`0 0 ${timelineWidth} 48`} preserveAspectRatio="none">
          <polyline
            className="kft-curve-line"
            points={
              [...keyframes]
                .sort((a, b) => a.time - b.time)
                .map(kf => `${kf.time * pixelsPerSecond},${48 - (kf.properties.opacity ?? 1) * 40 - 4}`)
                .join(' ')
            }
          />
        </svg>
      )}

      {/* Keyframe diamonds */}
      {keyframes.map(kf => {
        const leftPx = kf.time * pixelsPerSecond;
        const isSelected = selectedKeyframe === kf.id;
        return (
          <div
            key={kf.id}
            className={`kft-diamond ${isSelected ? 'kft-diamond-selected' : ''}`}
            style={{ left: `${leftPx}px` }}
            onMouseDown={(e) => handleDiamondMouseDown(e, kf)}
            title={`t=${kf.time.toFixed(2)}s | opacity=${(kf.properties.opacity ?? 1).toFixed(2)} scale=${(kf.properties.scale ?? 1).toFixed(2)}`}
          >
            <span className="kft-diamond-icon">◆</span>
            {isSelected && onDeleteKeyframe && (
              <button
                className="kft-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteKeyframe(kf.id);
                }}
                title="Delete keyframe"
              >×</button>
            )}
          </div>
        );
      })}

      {/* Current interpolated value indicator */}
      {interpolated && (
        <div
          className="kft-current"
          style={{ left: `${currentTime * pixelsPerSecond}px` }}
          title={`Interpolated: opacity ${(interpolated.opacity ?? 1).toFixed(2)}, scale ${(interpolated.scale ?? 1).toFixed(2)}`}
        >
          <span className="kft-current-dot" />
        </div>
      )}

      {/* Empty state hint */}
      {keyframes.length === 0 && (
        <div className="kft-empty">
          Double-click to add keyframes
        </div>
      )}
    </div>
  );
}

export default KeyframeTrack;

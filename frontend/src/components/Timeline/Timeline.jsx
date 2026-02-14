import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import AudioWaveform from './AudioWaveform';
import KeyframeTrack from './KeyframeTrack';
import './Timeline.css';

function Timeline({
  scenes = [],
  beats = [],
  characterClips = [],
  audioClips = [],
  markers = [],
  keyframes = [],
  currentTime = 0,
  totalDuration = 0,
  zoom = 1.0,
  isPlaying = false,
  onSeek,
  onSceneSelect,
  onSceneDelete,
  onSceneDurationChange,
  onBeatSelect,
  onBeatDelete,
  onMarkerDrag,
  onMarkerDelete,
  onSceneReorder,
  onSceneResize,
  onAddKeyframe,
  onDeleteKeyframe,
  onSelectKeyframe,
  onDragKeyframe,
  selectedKeyframe,
  selectedScene,
  snapToBeat = false
}) {
  const timelineRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Resize state
  const resizeRef = useRef(null); // { sceneId, startX, startDuration, pixelsPerSecond }
  const scrubRef = useRef(false); // playhead scrubbing active
  const markerDragRef = useRef(null); // { markerId } for marker dragging
  const wasDraggingRef = useRef(false); // prevents click-after-drag from seeking

  // Measure the scroll container so zoom=1.0 fits the full timeline
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width || 800);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  // Calculate pixel width based on zoom — zoom=1.0 (100%) fits entire timeline
  const basePixelsPerSecond = totalDuration > 0 ? containerWidth / totalDuration : 50;
  const pixelsPerSecond = basePixelsPerSecond * zoom;
  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, containerWidth);

  // Time ruler markers — adaptive density based on zoom (major + minor ticks)
  const getTimeMarkers = () => {
    const major = [];
    const minor = [];
    let majorInterval, minorInterval;

    // Adapt tick density based on how many pixels each second gets
    if (pixelsPerSecond >= 120) {
      majorInterval = 1;
      minorInterval = 0.5;
    } else if (pixelsPerSecond >= 60) {
      majorInterval = 2;
      minorInterval = 1;
    } else if (pixelsPerSecond >= 25) {
      majorInterval = 5;
      minorInterval = 1;
    } else if (pixelsPerSecond >= 10) {
      majorInterval = 10;
      minorInterval = 5;
    } else {
      majorInterval = 30;
      minorInterval = 10;
    }

    for (let i = 0; i <= totalDuration; i += minorInterval) {
      const rounded = Math.round(i * 100) / 100;
      if (Math.abs(rounded % majorInterval) < 0.01) {
        major.push(rounded);
      } else {
        minor.push(rounded);
      }
    }
    return { major, minor };
  };

  const { major: majorMarkers, minor: minorMarkers } = getTimeMarkers();

  // Scene boundary times (for ruler indicators)
  const sceneBoundaries = useMemo(() => {
    const boundaries = [];
    let time = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (i > 0) boundaries.push(time);
      time += parseFloat(scenes[i].duration_seconds) || 0;
    }
    return boundaries;
  }, [scenes]);

  // Handle timeline click (seek) — skipped after any drag operation
  const handleTimelineClick = (e) => {
    // Don't seek if any drag just ended (click fires after mouseup)
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (resizeRef.current || scrubRef.current || markerDragRef.current) return;
    if (!timelineRef.current || !onSeek) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const clickedTime = (x / timelineWidth) * totalDuration;
    
    onSeek(Math.max(0, Math.min(clickedTime, totalDuration)));
  };

  // ---- RESIZE HANDLING ----
  const handleResizeStart = useCallback((e, sceneId, currentDuration) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      sceneId,
      startX: e.clientX,
      startDuration: currentDuration,
      pixelsPerSecond
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [pixelsPerSecond]);

  // ---- PLAYHEAD SCRUB ----
  const handlePlayheadMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    scrubRef.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // ---- MARKER DRAG ----
  const handleMarkerMouseDown = useCallback((e, markerId) => {
    e.stopPropagation();
    e.preventDefault();
    markerDragRef.current = { markerId };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  // Window-level mouse listeners for resize + playhead scrub + marker drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Only one drag type at a time (exclusive if-else)
      if (resizeRef.current) {
        // Handle scene resize
        const { sceneId, startX, startDuration, pixelsPerSecond: pps } = resizeRef.current;
        const deltaX = e.clientX - startX;
        const deltaSec = deltaX / pps;
        let newDuration = Math.max(0.5, startDuration + deltaSec);

        // Snap-to-beat: if Shift is held, snap the scene's end to nearest beat
        if (e.shiftKey && snapToBeat && beats.length > 0) {
          // Find this scene's start time to compute end time
          let sceneStart = 0;
          for (const s of scenes) {
            if (s.id === sceneId) break;
            sceneStart += parseFloat(s.duration_seconds) || 0;
          }
          const proposedEnd = sceneStart + newDuration;
          const SNAP_THRESHOLD_PX = 12;
          const snapThresholdSec = SNAP_THRESHOLD_PX / pps;

          let nearestBeat = null;
          let nearestDist = Infinity;
          for (const beat of beats) {
            const dist = Math.abs(beat.time - proposedEnd);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestBeat = beat;
            }
          }
          if (nearestBeat && nearestDist < snapThresholdSec) {
            newDuration = nearestBeat.time - sceneStart;
            if (newDuration < 0.5) newDuration = 0.5;
          }
        }

        if (onSceneResize) {
          onSceneResize(sceneId, newDuration);
        }
      } else if (markerDragRef.current && timelineRef.current && onMarkerDrag && totalDuration > 0) {
        // Handle marker drag
        const scrollEl = timelineRef.current;
        const rect = scrollEl.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollEl.scrollLeft;
        const tracksEl = scrollEl.querySelector('.timeline-tracks');
        const contentWidth = tracksEl ? tracksEl.offsetWidth : timelineWidth;
        const time = (x / contentWidth) * totalDuration;
        onMarkerDrag(markerDragRef.current.markerId, { time: Math.max(0, Math.min(time, totalDuration)) });
      } else if (scrubRef.current && timelineRef.current && onSeek && totalDuration > 0) {
        // Handle playhead scrub
        const scrollEl = timelineRef.current;
        const rect = scrollEl.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollEl.scrollLeft;
        const tracksEl = scrollEl.querySelector('.timeline-tracks');
        const contentWidth = tracksEl ? tracksEl.offsetWidth : timelineWidth;
        const time = (x / contentWidth) * totalDuration;
        onSeek(Math.max(0, Math.min(time, totalDuration)));
      }
    };

    const handleMouseUp = () => {
      const wasDragging = !!(resizeRef.current || scrubRef.current || markerDragRef.current);
      if (resizeRef.current) {
        resizeRef.current = null;
      }
      if (scrubRef.current) {
        scrubRef.current = false;
      }
      if (markerDragRef.current) {
        markerDragRef.current = null;
      }
      if (wasDragging) {
        wasDraggingRef.current = true; // block the next click event
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onSceneResize, onSeek, onMarkerDrag, totalDuration, timelineWidth]);

  // ---- AUTO-SCROLL to keep playhead in view during playback ----
  useEffect(() => {
    if (!isPlaying || !timelineRef.current || totalDuration <= 0) return;
    const scrollEl = timelineRef.current;
    const playheadX = (currentTime / totalDuration) * timelineWidth;
    const viewLeft = scrollEl.scrollLeft;
    const viewRight = viewLeft + scrollEl.clientWidth;
    const margin = scrollEl.clientWidth * 0.15; // 15% lookahead margin

    if (playheadX > viewRight - margin) {
      // Playhead approaching right edge — scroll to keep it ~30% from left
      scrollEl.scrollLeft = playheadX - scrollEl.clientWidth * 0.3;
    } else if (playheadX < viewLeft + margin) {
      // Playhead behind left edge (e.g. after loop) — scroll to show it
      scrollEl.scrollLeft = Math.max(0, playheadX - scrollEl.clientWidth * 0.3);
    }
  }, [isPlaying, currentTime, totalDuration, timelineWidth]);

  // ---- DRAG AND DROP (REORDER) ----
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make drag image semi-transparent
    if (e.target) {
      e.target.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e) => {
    if (e.target) {
      e.target.style.opacity = '1';
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (fromIndex !== null && fromIndex !== toIndex && onSceneReorder) {
      onSceneReorder(fromIndex, toIndex);
    }
  };

  // Handle scene click
  const handleSceneClick = (sceneId, e) => {
    e.stopPropagation();
    if (onSceneSelect) {
      onSceneSelect(sceneId);
    }
  };

  // Handle beat click
  const handleBeatClick = (beatId, e) => {
    e.stopPropagation();
    if (onBeatSelect) {
      onBeatSelect(beatId);
    }
  };

  // Calculate scene positions
  const getScenePosition = (sceneIndex) => {
    let position = 0;
    for (let i = 0; i < sceneIndex; i++) {
      position += parseFloat(scenes[i].duration_seconds) || 0;
    }
    return position;
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timeline-container">
      <div className="timeline-vertical-scroll">
        <div className="timeline-row">
          {/* Labels Column */}
          <div className="timeline-labels">
            <div className="labels-spacer"></div>
            <div className="track-label scenes-label">
              <span className="track-icon">🎬</span>
              <span className="track-name">Scenes</span>
            </div>
            <div className="track-label beats-label">
              <span className="track-icon">✨</span>
              <span className="track-name">Beats</span>
            </div>
            <div className="track-label characters-label">
              <span className="track-icon">👤</span>
              <span className="track-name">Characters</span>
            </div>
            <div className="track-label audio-label">
              <span className="track-icon">🎵</span>
              <span className="track-name">Audio</span>
            </div>
            <div className="track-label keyframe-label">
              <span className="track-icon">🔑</span>
              <span className="track-name">Keyframes</span>
            </div>
          </div>

          {/* Shared Horizontal Scroll for Ruler + Tracks */}
          <div
            ref={timelineRef}
            className="timeline-scroll-x"
            onClick={handleTimelineClick}
          >
            {/* Inner wrapper — full timeline width, positions playhead */}
            <div className="timeline-scroll-content" style={{ width: `${timelineWidth}px`, position: 'relative' }}>
              {/* Playhead — spans ruler + all tracks, scrolls with content */}
              <div
                className="playhead"
                style={{ left: `${currentTime * pixelsPerSecond}px` }}
              >
                <div className="playhead-line"></div>
                <div 
                  className="playhead-handle"
                  onMouseDown={handlePlayheadMouseDown}
                ></div>
              </div>

              <div className="timeline-ruler-sticky" style={{ width: `${timelineWidth}px` }}>
              <div className="time-ruler">
                {/* Major time markers */}
                {majorMarkers.map(time => (
                  <div
                    key={`major-${time}`}
                    className="time-marker major"
                    style={{ left: `${time * pixelsPerSecond}px` }}
                  >
                    <span className="time-label">{formatTime(time)}</span>
                    <div className="time-tick"></div>
                  </div>
                ))}
                {/* Minor time ticks */}
                {minorMarkers.map(time => (
                  <div
                    key={`minor-${time}`}
                    className="time-marker minor"
                    style={{ left: `${time * pixelsPerSecond}px` }}
                  >
                    <div className="time-tick minor-tick"></div>
                  </div>
                ))}
                {/* Scene boundary indicators */}
                {sceneBoundaries.map((time, i) => (
                  <div
                    key={`boundary-${i}`}
                    className="scene-boundary-mark"
                    style={{ left: `${time * pixelsPerSecond}px` }}
                  >
                    <div className="boundary-tick"></div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="timeline-tracks"
              style={{ width: `${timelineWidth}px` }}
            >
              <div className="timeline-track scenes-track">
                <div className="track-content">
                  {scenes.length === 0 ? (
                    <div className="track-empty">No scenes yet</div>
                  ) : (
                    scenes.map((scene, index) => {
                      const startTime = getScenePosition(index);
                      const duration = parseFloat(scene.duration_seconds) || 0;
                      const leftPx = startTime * pixelsPerSecond;
                      const widthPx = duration * pixelsPerSecond;
                      const isSelected = selectedScene === scene.id;
                      const isDragOver = dragOverIndex === index;
                      const isDragging = draggedIndex === index;

                      return (
                        <div
                          key={scene.id}
                          className={`scene-block ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onClick={(e) => handleSceneClick(scene.id, e)}
                        >
                          <div className="scene-drag-handle" title="Drag to reorder">⠿</div>
                          <span className="scene-title">{scene.title}</span>
                          <span className="scene-duration-label">{duration.toFixed(1)}s</span>
                          {onSceneDelete && (
                            <button
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${scene.title}"?`)) {
                                  onSceneDelete(scene.id);
                                }
                              }}
                              title="Delete scene"
                            >
                              ×
                            </button>
                          )}
                          {/* Right-edge resize handle */}
                          <div
                            className="scene-resize-handle"
                            onMouseDown={(e) => handleResizeStart(e, scene.id, duration)}
                            title="Drag to resize"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Track 2: Beats */}
              <div className="timeline-track beats-track">
                <div className="track-content">
                  {beats.length === 0 ? (
                    <div className="track-empty">No beats yet - click "+ Beat" to add</div>
                  ) : (
                    beats.map(beat => (
                      <div
                        key={beat.id}
                        className="beat-marker"
                        style={{ left: `${beat.time * pixelsPerSecond}px` }}
                        onClick={(e) => handleBeatClick(beat.id, e)}
                      >
                        <div className="marker-flag">
                          <span>{beat.title}</span>
                          {onBeatDelete && (
                            <button
                              className="marker-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBeatDelete(beat.id);
                              }}
                              title="Delete beat"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Track 3: Character Clips */}
              <div className="timeline-track characters-track">
                <div className="track-content">
                  {characterClips.length === 0 ? (
                    <div className="track-empty">No character clips</div>
                  ) : (
                    characterClips.map(clip => {
                      const leftPx = clip.startTime * pixelsPerSecond;
                      const widthPx = clip.duration * pixelsPerSecond;
                      return (
                        <div
                          key={clip.id}
                          className="character-clip"
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`
                          }}
                        >
                          <span>{clip.character}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Track 4: Audio (with waveform visualization) */}
              <div className="timeline-track audio-track">
                <div className="track-content">
                  {audioClips.length === 0 ? (
                    <div className="track-empty">No audio clips - click "+ Audio" to add</div>
                  ) : (
                    audioClips.map(clip => {
                      const leftPx = clip.startTime * pixelsPerSecond;
                      const widthPx = clip.duration * pixelsPerSecond;
                      return (
                        <div
                          key={clip.id}
                          className="audio-clip"
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`
                          }}
                        >
                          {clip.audioUrl ? (
                            <AudioWaveform
                              audioUrl={clip.audioUrl}
                              currentTime={currentTime}
                              totalDuration={totalDuration}
                              pixelsPerSecond={pixelsPerSecond}
                              clipStartTime={clip.startTime}
                              clipDuration={clip.duration}
                              volume={clip.volume ?? 1.0}
                              onSeek={onSeek}
                              isPlaying={isPlaying}
                            />
                          ) : (
                            <span>{clip.name || 'Audio'}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Track 5: Keyframes */}
              <div className="timeline-track keyframe-track">
                <div className="track-content">
                  <KeyframeTrack
                    keyframes={keyframes}
                    totalDuration={totalDuration}
                    pixelsPerSecond={pixelsPerSecond}
                    currentTime={currentTime}
                    selectedKeyframe={selectedKeyframe}
                    onAddKeyframe={onAddKeyframe}
                    onDeleteKeyframe={onDeleteKeyframe}
                    onSelectKeyframe={onSelectKeyframe}
                    onSeek={onSeek}
                    onDragKeyframe={onDragKeyframe}
                  />
                </div>
              </div>

              {/* Scene boundary lines through all tracks */}
              {sceneBoundaries.map((time, i) => (
                <div
                  key={`track-boundary-${i}`}
                  className="track-boundary-line"
                  style={{ left: `${time * pixelsPerSecond}px` }}
                />
              ))}

              {/* Markers (overlay) — draggable, with optional snapshot thumbnails */}
              {markers.map(marker => (
                <div
                  key={marker.id}
                  className="timeline-marker"
                  style={{
                    left: `${marker.time * pixelsPerSecond}px`,
                    color: marker.color
                  }}
                  onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                >
                  <div className="marker-label">
                    {marker.snapshot && (
                      <img
                        className="marker-snapshot"
                        src={marker.snapshot}
                        alt={marker.label}
                        draggable={false}
                      />
                    )}
                    {marker.label}
                    {onMarkerDelete && (
                      <button
                        className="marker-label-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkerDelete(marker.id);
                        }}
                        title="Delete marker"
                      >×</button>
                    )}
                    {marker.notes && (
                      <span className="marker-notes" title={marker.notes}>📝</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>{/* end timeline-scroll-content */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Timeline;
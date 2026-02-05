import React, { useState, useRef } from 'react';
import './Timeline.css';

/**
 * TimelineRuler - Shows time markers along the timeline with playhead
 */
const TimelineRuler = ({ totalDuration, zoom, currentTime = 0, onSeek, scenes = [] }) => {
  const rulerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);

  // Calculate intervals based on zoom and duration
  const getIntervals = () => {
    const zoomFactor = zoom / 100;
    const baseDuration = totalDuration / zoomFactor;

    let majorInterval, minorInterval;
    
    if (baseDuration <= 60) {
      majorInterval = 10;
      minorInterval = 2;
    } else if (baseDuration <= 180) {
      majorInterval = 30;
      minorInterval = 10;
    } else if (baseDuration <= 600) {
      majorInterval = 60;
      minorInterval = 15;
    } else {
      majorInterval = 300;
      minorInterval = 60;
    }

    return { majorInterval, minorInterval };
  };

  const { majorInterval, minorInterval } = getIntervals();
  
  // Generate major markers
  const majorMarkers = [];
  for (let time = 0; time <= totalDuration; time += majorInterval) {
    const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
    majorMarkers.push({
      time,
      position,
      label: formatTime(time)
    });
  }

  // Generate minor markers
  const minorMarkers = [];
  for (let time = minorInterval; time <= totalDuration; time += minorInterval) {
    if (time % majorInterval !== 0) {
      const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
      minorMarkers.push({
        time,
        position
      });
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const handleMouseDown = (e) => {
    if (!onSeek || !rulerRef.current) return;
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e) => {
    if (!rulerRef.current) return;
    
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const time = (percent / 100) * totalDuration;
    setHoverTime(time);

    if (isDragging && onSeek) {
      handleSeek(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setIsDragging(false);
  };

  const handleSeek = (e) => {
    if (!onSeek || !rulerRef.current) return;
    
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const time = (percent / 100) * totalDuration;
    onSeek(time);
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const hoverPosition = hoverTime !== null && totalDuration > 0 ? (hoverTime / totalDuration) * 100 : null;

  // Generate scene markers
  const sceneMarkers = scenes.map(scene => {
    const startTime = scene.start_time_seconds || 0;
    const position = totalDuration > 0 ? (startTime / totalDuration) * 100 : 0;
    return {
      scene,
      position,
      label: `Scene ${scene.scene_order}`
    };
  });

  return (
    <div className="timeline-ruler-split">
      {/* Left Spacer - 180px to match track headers */}
      <div className="ruler-spacer">
        {/* Reserved for compact global controls (timecode/zoom) */}
      </div>

      {/* Right: Ruler Ticks Area - Scrolls horizontally, aligns with clips */}
      <div 
        ref={rulerRef}
        className={`timeline-ruler ${isDragging ? 'scrubbing' : ''}`}
        style={{ width: `${zoom}%` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Scene markers (thin vertical lines) */}
        {sceneMarkers.map((marker, index) => (
          <div 
            key={`scene-${index}`}
            className="timeline-scene-marker"
            style={{ left: `${marker.position}%` }}
          >
            <div className="scene-marker-line"></div>
          </div>
        ))}

        {/* Minor markers */}
        {minorMarkers.map((marker, index) => (
          <div 
            key={`minor-${index}`}
            className="timeline-marker minor"
            style={{ left: `${marker.position}%` }}
          >
            <div className="marker-tick"></div>
          </div>
        ))}
        
        {/* Major markers */}
        {majorMarkers.map((marker, index) => (
          <div 
            key={`major-${index}`}
            className="timeline-marker major"
            style={{ left: `${marker.position}%` }}
          >
            <div className="marker-tick"></div>
            <div className="marker-label">{marker.label}</div>
          </div>
        ))}

        {/* Hover time indicator */}
        {hoverPosition !== null && (
          <div 
            className="timeline-hover-indicator"
            style={{ left: `${hoverPosition}%` }}
          >
            <div className="hover-line"></div>
            <div className="hover-time">{formatTime(hoverTime)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineRuler;

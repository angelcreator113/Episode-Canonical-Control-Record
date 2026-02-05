import React, { useRef, useEffect } from 'react';
import './TimelinePlayhead.css';

/**
 * TimelinePlayhead - Visual playhead indicator and playback controls
 */
const TimelinePlayhead = ({ 
  currentTime, 
  totalDuration, 
  zoom, 
  isPlaying,
  onSeek, 
  onPlayPause,
  onStepForward,
  onStepBackward 
}) => {
  const playheadRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Calculate position percentage
  const position = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Handle scrubbing
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    handleScrub(e);
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) {
      handleScrub(e);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleScrub = (e) => {
    const container = e.currentTarget.closest('.timeline-scroll-area');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newTime = (percentage / 100) * totalDuration;
    
    onSeek(newTime);
  };

  useEffect(() => {
    if (isDraggingRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, []);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timeline-playback-controls">
      <button 
        onClick={onStepBackward}
        className="playback-btn"
        title="Previous frame (Left Arrow)"
      >
        ⏮
      </button>
      <button 
        onClick={onPlayPause}
        className="playback-btn play-pause-btn"
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button 
        onClick={onStepForward}
        className="playback-btn"
        title="Next frame (Right Arrow)"
      >
        ⏭
      </button>
      <div className="timecode-display" title="Current time">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </div>
    </div>
  );
};

/**
 * TimelinePlayheadLine - Vertical playhead line (rendered in canvas)
 * Positioned using percentage like clips, works with zoom transform
 */
export const TimelinePlayheadLine = ({ currentTime, totalDuration, onSeek }) => {
  const playheadRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Calculate position percentage (same as clips)
  const position = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Handle scrubbing
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    handleScrub(e);
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) {
      handleScrub(e);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleScrub = (e) => {
    // Get the scrollable clips area container
    const container = e.currentTarget.closest('.timeline-clips-area');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    
    // Calculate position accounting for scroll
    const x = e.clientX - rect.left + scrollLeft;
    const containerWidth = container.scrollWidth;
    const percentage = Math.max(0, Math.min(100, (x / containerWidth) * 100));
    const newTime = (percentage / 100) * totalDuration;
    
    onSeek(newTime);
  };

  useEffect(() => {
    if (isDraggingRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, []);

  return (
    <div 
      ref={playheadRef}
      className="timeline-playhead-line"
      style={{ left: `${position}%` }}
      onMouseDown={handleMouseDown}
    >
      <div className="playhead-handle" title="Drag to scrub">
        <div className="playhead-triangle" />
      </div>
      <div className="playhead-line" />
    </div>
  );
};

export default TimelinePlayhead;

import React from 'react';
import './Timeline.css';

/**
 * TimelineRuler - Shows time markers along the timeline
 * Enhanced with minor ticks and better formatting
 */
const TimelineRuler = ({ totalDuration, zoom, currentTime }) => {
  // Calculate interval based on total duration and zoom
  const getInterval = () => {
    const visibleDuration = totalDuration / (zoom / 100);
    
    if (visibleDuration <= 60) return 10;    // 10s intervals for ≤1 min visible
    if (visibleDuration <= 120) return 15;   // 15s intervals for ≤2 min
    if (visibleDuration <= 300) return 30;   // 30s intervals for ≤5 min
    if (visibleDuration <= 600) return 60;   // 1 min intervals for ≤10 min
    if (visibleDuration <= 1800) return 120; // 2 min intervals for ≤30 min
    return 300; // 5 min intervals for >30 min
  };

  const interval = getInterval();
  const majorMarkers = [];
  const minorMarkers = [];
  
  // Generate major markers
  for (let time = 0; time <= totalDuration; time += interval) {
    const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
    majorMarkers.push({
      time,
      position,
      label: formatTime(time)
    });
  }

  // Generate minor markers (halfway between major)
  for (let i = 0; i < majorMarkers.length - 1; i++) {
    const midTime = (majorMarkers[i].time + majorMarkers[i + 1].time) / 2;
    const position = totalDuration > 0 ? (midTime / totalDuration) * 100 : 0;
    minorMarkers.push({ time: midTime, position });
  }

  // Add final marker if needed
  if (majorMarkers.length === 0 || majorMarkers[majorMarkers.length - 1].time < totalDuration) {
    const position = 100;
    majorMarkers.push({
      time: totalDuration,
      position,
      label: formatTime(totalDuration)
    });
  }

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="timeline-ruler" style={{ width: `${zoom}%` }}>
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

      {/* Playhead (current time indicator) */}
      {currentTime !== null && currentTime !== undefined && (
        <div 
          className="timeline-playhead"
          style={{ 
            left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` 
          }}
        >
          <div className="playhead-line"></div>
          <div className="playhead-handle"></div>
        </div>
      )}
    </div>
  );
};

export default TimelineRuler;

import React from 'react';
import './Timeline.css';

/**
 * TimelineRuler - Shows time markers along the timeline
 */
const TimelineRuler = ({ totalDuration, zoom }) => {
  // Calculate interval based on total duration
  const getInterval = () => {
    if (totalDuration <= 120) return 30; // 30 second intervals for ≤2 min
    if (totalDuration <= 300) return 60; // 1 min intervals for ≤5 min
    if (totalDuration <= 600) return 120; // 2 min intervals for ≤10 min
    return 300; // 5 min intervals for >10 min
  };

  const interval = getInterval();
  const markers = [];
  
  for (let time = 0; time <= totalDuration; time += interval) {
    const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
    markers.push({
      time,
      position,
      label: formatTime(time)
    });
  }

  // Add final marker if needed
  if (markers.length === 0 || markers[markers.length - 1].time < totalDuration) {
    markers.push({
      time: totalDuration,
      position: 100,
      label: formatTime(totalDuration)
    });
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="timeline-ruler" style={{ width: `${zoom}%` }}>
      {markers.map((marker, index) => (
        <div 
          key={index}
          className="timeline-marker"
          style={{ left: `${marker.position}%` }}
        >
          <div className="marker-tick"></div>
          <div className="marker-label">{marker.label}</div>
        </div>
      ))}
    </div>
  );
};

export default TimelineRuler;

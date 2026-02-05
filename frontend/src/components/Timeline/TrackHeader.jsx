import React from 'react';
import './TrackHeader.css';

/**
 * TrackHeader - Professional track controls like Premiere Pro
 * Shows track name, mute, solo, lock buttons
 */
const TrackHeader = ({ 
  trackName, 
  trackType, 
  isMuted = false, 
  isLocked = false, 
  onToggleMute, 
  onToggleLock,
  trackColor 
}) => {
  const getTrackIcon = () => {
    switch (trackType) {
      case 'video': return '🎬';
      case 'overlays': return '🎨';
      case 'voice': return '🎤';
      case 'music': return '🎵';
      case 'sfx': return '🔊';
      default: return '📁';
    }
  };

  return (
    <div className="track-header" style={{ borderLeftColor: trackColor }}>
      <div className="track-header-main">
        <span className="track-icon">{getTrackIcon()}</span>
        <span className="track-name">{trackName}</span>
      </div>
      
      <div className="track-header-controls">
        <button
          className={`track-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button
          className={`track-control-btn ${isLocked ? 'active' : ''}`}
          onClick={onToggleLock}
          title={isLocked ? 'Unlock' : 'Lock'}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
      </div>
    </div>
  );
};

export default TrackHeader;

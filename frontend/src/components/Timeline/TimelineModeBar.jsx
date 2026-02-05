import React from 'react';
import './TimelineModeBar.css';

/**
 * TimelineModeBar - Tool dock for switching editing modes
 * Responsive: Vertical icon-only dock (desktop), Bottom tab bar (mobile)
 */
const TimelineModeBar = ({ activeMode, onModeChange, showContextPanel }) => {
  const modes = [
    { id: 'timeline', icon: '🎬', label: 'Timeline', hint: 'Edit timeline' },
    { id: 'assets', icon: '📦', label: 'Assets', hint: 'Browse and place assets' },
    { id: 'wardrobe', icon: '👗', label: 'Wardrobe', hint: 'Outfit continuity' },
    { id: 'voice', icon: '🎤', label: 'Voice', hint: 'Audio tracks' },
    { id: 'effects', icon: '✨', label: 'Effects', hint: 'Visual effects' },
    { id: 'properties', icon: '⚙️', label: 'Properties', hint: 'Selection properties' },
  ];

  return (
    <div className="timeline-mode-bar">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`mode-button ${activeMode === mode.id ? 'active' : ''}`}
          onClick={() => onModeChange(mode.id)}
          title={mode.hint}
        >
          <span className="mode-icon">{mode.icon}</span>
          <span className="mode-label">{mode.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TimelineModeBar;

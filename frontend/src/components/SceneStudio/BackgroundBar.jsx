import React, { useState } from 'react';
import { Image, RefreshCw, Sun, Moon, Sunrise, Sunset, Loader2 } from 'lucide-react';

/**
 * BackgroundBar — Contextual bar for background editing.
 * Shows above the canvas when background exists or to invite background setup.
 * Controls: Change background, regenerate variation, time-of-day, mood.
 */

const TIME_OPTIONS = [
  { key: 'dawn', label: 'Dawn', icon: Sunrise },
  { key: 'day', label: 'Day', icon: Sun },
  { key: 'golden', label: 'Golden Hour', icon: Sunset },
  { key: 'night', label: 'Night', icon: Moon },
];

const MOOD_OPTIONS = [
  { key: 'warm', label: 'Warm', color: '#E8A87C' },
  { key: 'dramatic', label: 'Dramatic', color: '#6C5B7B' },
  { key: 'soft', label: 'Soft', color: '#F8C3CD' },
  { key: 'moody', label: 'Moody', color: '#355C7D' },
  { key: 'ethereal', label: 'Ethereal', color: '#C3AED6' },
];

export default function BackgroundBar({
  backgroundUrl,
  mood,
  timeOfDay,
  onChangeMood,
  onChangeTimeOfDay,
  onChangeBackground,
  onRegenerateVariation,
  isRegenerating,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="scene-studio-bg-bar">
      <div className="scene-studio-bg-bar-main">
        {backgroundUrl ? (
          <div className="scene-studio-bg-bar-thumb">
            <img src={backgroundUrl} alt="" />
          </div>
        ) : (
          <div className="scene-studio-bg-bar-empty">
            <Image size={14} />
          </div>
        )}

        <div className="scene-studio-bg-bar-actions">
          <button
            className="scene-studio-chip"
            onClick={onChangeBackground}
            title="Browse library for objects"
          >
            <Image size={12} /> {backgroundUrl ? 'Change' : 'Set Background'}
          </button>

          {backgroundUrl && (
            <button
              className="scene-studio-chip"
              onClick={onRegenerateVariation}
              disabled={isRegenerating}
              title="Generate a variation of this background"
            >
              {isRegenerating ? (
                <><Loader2 size={12} className="scene-studio-spin-icon" /> Generating...</>
              ) : (
                <><RefreshCw size={12} /> Variation</>
              )}
            </button>
          )}

          <div className="scene-studio-bg-bar-divider" />

          {/* Time of Day */}
          <div className="scene-studio-bg-bar-group">
            {TIME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  className={`scene-studio-bg-chip ${timeOfDay === opt.key ? 'active' : ''}`}
                  onClick={() => onChangeTimeOfDay(opt.key === timeOfDay ? null : opt.key)}
                  title={opt.label}
                >
                  <Icon size={11} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="scene-studio-bg-bar-divider" />

          {/* Mood chips */}
          <div className="scene-studio-bg-bar-group">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`scene-studio-bg-chip ${mood === opt.key ? 'active' : ''}`}
                onClick={() => onChangeMood(opt.key === mood ? null : opt.key)}
                title={opt.label}
              >
                <span
                  className="scene-studio-mood-dot"
                  style={{ backgroundColor: opt.color }}
                />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

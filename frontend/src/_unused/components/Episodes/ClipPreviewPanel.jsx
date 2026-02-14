import React, { useState } from 'react';
import VideoPlayer from '../VideoPlayer';
import './ClipPreviewPanel.css';

const ClipPreviewPanel = ({ clip, onClose, onUpdateTrim }) => {
  const libraryScene = clip.libraryScene || clip.library_scene;
  const isNote = clip.type === 'note';
  const videoUrl = libraryScene?.videoAssetUrl || libraryScene?.video_asset_url;
  const thumbnailUrl = libraryScene?.thumbnailUrl || libraryScene?.thumbnail_url;
  const title = clip.displayTitle || libraryScene?.title || 'Untitled Clip';
  const description = libraryScene?.description;
  
  const [trimStart, setTrimStart] = useState(clip.trimStart || clip.trim_start || 0);
  const [trimEnd, setTrimEnd] = useState(clip.trimEnd || clip.trim_end || 0);
  const [isEditingTrim, setIsEditingTrim] = useState(false);
  const [saving, setSaving] = useState(false);

  const duration = trimEnd - trimStart;

  const handleSaveTrim = async () => {
    setSaving(true);
    try {
      await onUpdateTrim(clip.id, trimStart, trimEnd);
      setIsEditingTrim(false);
    } catch (err) {
      alert('Failed to save trim changes');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  if (isNote) {
    return (
      <div className="clip-preview-panel">
        <div className="cpp-header">
          <h3>📝 Note</h3>
          <button onClick={onClose} className="btn-close" title="Close preview">
            ✕
          </button>
        </div>
        <div className="cpp-content">
          <div className="cpp-note">
            <h4>{title}</h4>
            {clip.noteText && <p className="note-text">{clip.noteText}</p>}
            <div className="note-duration">
              Duration: {formatTime(clip.manualDurationSeconds || clip.manual_duration_seconds || 0)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clip-preview-panel">
      <div className="cpp-header">
        <h3>🎬 Preview</h3>
        <button onClick={onClose} className="btn-close" title="Close preview">
          ✕
        </button>
      </div>

      <div className="cpp-content">
        {/* Video player */}
        {videoUrl && (
          <div className="cpp-player">
            <VideoPlayer
              videoUrl={videoUrl}
              thumbnailUrl={thumbnailUrl}
              trimStart={trimStart}
              trimEnd={trimEnd}
              showTrimControls={false}
              autoPlay={false}
            />
          </div>
        )}

        {/* Clip details */}
        <div className="cpp-details">
          <h4>{title}</h4>
          {description && <p className="clip-description">{description}</p>}
          
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Duration</span>
              <span className="value">{formatTime(duration)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Resolution</span>
              <span className="value">
                {libraryScene?.resolutionWidth || libraryScene?.resolution_width}×{libraryScene?.resolutionHeight || libraryScene?.resolution_height}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Status</span>
              <span className="value">
                <span className={`badge status-${libraryScene?.processingStatus || libraryScene?.processing_status}`}>
                  {libraryScene?.processingStatus || libraryScene?.processing_status}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Trim controls */}
        <div className="cpp-trim">
          <div className="trim-header">
            <h4>✂️ Trim Settings</h4>
            {!isEditingTrim && (
              <button
                onClick={() => setIsEditingTrim(true)}
                className="btn-edit"
              >
                Edit
              </button>
            )}
          </div>
          
          {!isEditingTrim ? (
            <div className="trim-display">
              <div className="trim-range">
                <span className="trim-label">Start:</span>
                <span className="trim-value">{formatTime(trimStart)}</span>
              </div>
              <div className="trim-range">
                <span className="trim-label">End:</span>
                <span className="trim-value">{formatTime(trimEnd)}</span>
              </div>
            </div>
          ) : (
            <div className="trim-edit">
              <div className="trim-input-group">
                <label>Start Time (seconds)</label>
                <input
                  type="number"
                  value={trimStart}
                  onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="trim-input-group">
                <label>End Time (seconds)</label>
                <input
                  type="number"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="trim-actions">
                <button
                  onClick={handleSaveTrim}
                  disabled={saving}
                  className="btn-save"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setTrimStart(clip.trimStart || clip.trim_start || 0);
                    setTrimEnd(clip.trimEnd || clip.trim_end || 0);
                    setIsEditingTrim(false);
                  }}
                  disabled={saving}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipPreviewPanel;

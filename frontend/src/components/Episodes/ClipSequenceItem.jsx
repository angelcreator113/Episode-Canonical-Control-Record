import React, { useState } from 'react';
import './ClipSequenceItem.css';

const ClipSequenceItem = ({
  clip,
  index,
  isSelected,
  isDragging,
  onSelect,
  onRemove,
  onUpdateTrim,
  dragHandleProps,
  innerRef,
  draggableProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [trimStart, setTrimStart] = useState(clip.trimStart || clip.trim_start || 0);
  const [trimEnd, setTrimEnd] = useState(clip.trimEnd || clip.trim_end || 0);
  const [saving, setSaving] = useState(false);

  const libraryScene = clip.libraryScene || clip.library_scene;
  const isNote = clip.type === 'note';
  const clipStatus = clip.clipStatus || 'ready';
  const processingStatus = libraryScene?.processingStatus || libraryScene?.processing_status;
  const thumbnailUrl = libraryScene?.thumbnailUrl || libraryScene?.thumbnail_url;
  const title = clip.displayTitle || clip.title_override || libraryScene?.title || 'Untitled Clip';
  const duration = trimEnd - trimStart;
  const isMissing = clipStatus === 'missing';

  const handleSaveTrim = async () => {
    setSaving(true);
    try {
      await onUpdateTrim(clip.id, trimStart, trimEnd);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to save trim changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTrimStart(clip.trimStart || clip.trim_start || 0);
    setTrimEnd(clip.trimEnd || clip.trim_end || 0);
    setIsEditing(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`clip-sequence-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isMissing ? 'missing' : ''} ${isNote ? 'note' : ''}`}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div className="clip-drag-handle" {...dragHandleProps}>
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/>
          <circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/>
          <circle cx="9" cy="13" r="1.5"/>
        </svg>
      </div>

      {/* Order number */}
      <div className="clip-order">#{index + 1}</div>

      {/* Thumbnail */}
      <div className="clip-thumbnail">
        {thumbnailUrl && !isMissing && !isNote ? (
          <img src={thumbnailUrl} alt={title} />
        ) : (
          <div className="thumbnail-placeholder">
            {isNote ? '📝' : isMissing ? '❌' : '🎥'}
          </div>
        )}
        {processingStatus && processingStatus !== 'ready' && (
          <div className={`processing-badge ${processingStatus}`}>
            {processingStatus === 'processing' && '⏳'}
            {processingStatus === 'uploading' && '⬆️'}
            {processingStatus === 'failed' && '⚠️'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="clip-info">
        <div className="clip-title">{isMissing ? '⚠️ Missing Clip' : title}</div>
        <div className="clip-meta">
          <span className="clip-duration">{formatTime(duration)}</span>
          {!isMissing && !isNote && libraryScene?.resolutionWidth && (
            <>
              <span className="meta-dot">·</span>
              <span className="clip-resolution">
                {libraryScene.resolutionWidth}×{libraryScene.resolutionHeight || libraryScene.resolution_height}
              </span>
            </>
          )}
          {isEditing && (
            <>
              <span className="meta-dot">·</span>
              <span className="editing-badge">✏️ Editing trim</span>
            </>
          )}
        </div>
      </div>

      {/* Trim controls */}
      {!isMissing && !isNote && (
        <div className="clip-trim" onClick={(e) => e.stopPropagation()}>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-edit-trim"
              title="Edit trim"
            >
              ✂️ Trim
            </button>
          ) : (
            <div className="trim-inputs">
              <input
                type="number"
                value={trimStart}
                onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
                placeholder="Start"
              />
              <span className="trim-separator">→</span>
              <input
                type="number"
                value={trimEnd}
                onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
                placeholder="End"
              />
              <button
                onClick={handleSaveTrim}
                disabled={saving}
                className="btn-save-trim"
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="btn-cancel-trim"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="clip-actions" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onRemove}
          className="btn-remove-clip"
          title="Remove from sequence"
        >
          🗑️
        </button>
      </div>

      {/* Status indicator */}
      <div className="clip-status">
        {clipStatus === 'ready' && <span className="status-dot ready" title="Ready"></span>}
        {clipStatus === 'processing' && <span className="status-dot processing" title="Processing"></span>}
        {clipStatus === 'failed' && <span className="status-dot failed" title="Failed"></span>}
        {isMissing && <span className="status-dot missing" title="Missing"></span>}
        {isNote && <span className="status-dot note" title="Note"></span>}
      </div>
    </div>
  );
};

export default ClipSequenceItem;

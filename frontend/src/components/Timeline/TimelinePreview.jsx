import React, { useState, useRef, useEffect } from 'react';
import './TimelinePreview.css';

/**
 * TimelinePreview - Video CANVAS showing current frame + overlays
 * This is THE EDITING CANVAS - not just a player
 */
const TimelinePreview = ({ 
  scenes, 
  placements = [],
  selectedScene,
  selectedPlacement,
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  onPlayPause,
  onStepForward,
  onStepBackward
}) => {
  const videoRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the current scene based on currentTime (not selectedScene)
  const getCurrentScene = () => {
    let timeAccumulator = 0;
    for (const scene of scenes) {
      const sceneDuration = scene.duration_seconds || 0;
      if (currentTime >= timeAccumulator && currentTime < timeAccumulator + sceneDuration) {
        return scene;
      }
      timeAccumulator += sceneDuration;
    }
    return scenes[scenes.length - 1]; // Last scene if beyond end
  };

  // Get overlays visible at current time
  const getVisibleOverlays = () => {
    return placements.filter(placement => {
      const startTime = placement.start_time_seconds || 0;
      const duration = placement.duration_seconds || 0;
      const endTime = startTime + duration;
      return currentTime >= startTime && currentTime < endTime;
    });
  };

  const currentScene = getCurrentScene();
  const visibleOverlays = getVisibleOverlays();

  const getCanvasContent = () => {
    if (!currentScene) return null;

    // Priority: video > thumbnail > placeholder
    if (currentScene.libraryScene) {
      return {
        type: 'scene',
        url: currentScene.libraryScene.video_asset_url,
        thumbnail: currentScene.libraryScene.thumbnail_url,
        label: currentScene.title_override || currentScene.libraryScene.title || `Scene ${currentScene.scene_order}`,
      };
    }

    return {
      type: 'empty',
      label: `Scene ${currentScene.scene_order} - No media yet`
    };
  };

  const content = getCanvasContent();

  useEffect(() => {
    if (videoRef.current && content?.url) {
      videoRef.current.load();
    }
  }, [content?.url]);

  if (!content) {
    return (
      <div className="timeline-preview empty">
        <div className="preview-empty-state">
          <div className="empty-icon">🎬</div>
          <p>No preview available</p>
          <span className="empty-hint">Add scenes to see preview</span>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-preview">
      {/* Preview Header - Minimal Context */}
      <div className="preview-header">
        <div className="preview-title">
          <span className="preview-label">Canvas</span>
          <span className="preview-separator">—</span>
          <span className="scene-context">{content.label}</span>
        </div>
      </div>

      {/* CANVAS - 16:9 Fixed Aspect Ratio with Overlays */}
      <div className="preview-content">
        <div className="preview-canvas-container">
          {/* Base Layer: Video or Thumbnail */}
          {content.url ? (
            <video
              ref={videoRef}
              className="preview-video"
              poster={content.thumbnail}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            >
              <source src={content.url} type="video/mp4" />
            </video>
          ) : content.thumbnail ? (
            <img 
              src={content.thumbnail} 
              alt={content.label}
              className="preview-image"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div className="preview-placeholder">
              <div className="placeholder-icon">🎥</div>
              <p>{content.label}</p>
            </div>
          )}

          {/* Overlay Layer: Render visible overlays */}
          {visibleOverlays.map(overlay => {
            const asset = overlay.asset || overlay.wardrobeItem;
            if (!asset) return null;

            const imageUrl = asset.s3_url_processed || asset.s3_url_raw || asset.thumbnail_url;
            if (!imageUrl) return null;

            // Calculate position (placeholder - needs proper positioning logic)
            const isSelected = selectedPlacement?.id === overlay.id;

            return (
              <div
                key={overlay.id}
                className={`canvas-overlay ${isSelected ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
                  top: '20%',
                  left: '20%',
                  width: '30%',
                  height: 'auto',
                  zIndex: 10,
                  border: isSelected ? '3px solid #3b82f6' : '2px solid transparent',
                  boxShadow: isSelected ? '0 0 0 4px rgba(59, 130, 246, 0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <img 
                  src={imageUrl} 
                  alt={asset.name}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Playback Controls - Below Canvas */}
      <div className="preview-playback-controls">
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
    </div>
  );
};

export default TimelinePreview;

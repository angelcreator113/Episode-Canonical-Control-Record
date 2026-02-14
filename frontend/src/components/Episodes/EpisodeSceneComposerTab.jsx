// frontend/src/components/Episodes/EpisodeSceneComposerTab.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './EpisodeSceneComposerTab.css';

/**
 * EpisodeSceneComposerTab - Enhanced wrapper for Scene Composer
 * 
 * Philosophy: "This is where the episode comes alive"
 * Design: Prominent, powerful, intentional - THE ENGINE
 * 
 * This tab wraps the existing Scene Composer with:
 * - Prominent header
 * - Clear current scene indicator
 * - Better visual hierarchy
 * - Quick actions
 */

function EpisodeSceneComposerTab({ episode, show }) {
  const navigate = useNavigate();
  
  const handleOpenSceneComposer = () => {
    // Navigate to full Scene Composer
    navigate(`/episodes/${episode.id}/scene-composer`);
  };
  
  const sceneCount = episode.scene_count || 0;
  const hasScenes = sceneCount > 0;
  
  return (
    <div className="scene-composer-tab">
      {/* Prominent Header */}
      <div className="composer-hero">
        <div className="hero-content">
          <div className="hero-icon">🎬</div>
          <div className="hero-text">
            <h1 className="hero-title">Scene Composer</h1>
            <p className="hero-subtitle">
              This is where the episode comes alive
            </p>
          </div>
        </div>
        
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">{sceneCount}</div>
            <div className="stat-label">Scenes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{episode.duration_seconds || 0}s</div>
            <div className="stat-label">Duration</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{episode.beat_count || 0}</div>
            <div className="stat-label">Beats</div>
          </div>
        </div>
      </div>
      
      {/* Quick Actions Bar */}
      <div className="composer-actions">
        <button
          className="btn-primary btn-open-composer"
          onClick={handleOpenSceneComposer}
        >
          🚀 Open Scene Composer
        </button>
        
        {hasScenes && (
          <>
            <button className="btn-action">
              ➕ Add Scene
            </button>
            <button className="btn-action">
              👁️ Preview All
            </button>
            <button className="btn-action">
              📋 Manage Beats
            </button>
          </>
        )}
      </div>
      
      {/* Main Content */}
      {!hasScenes ? (
        /* Empty State - First Time */
        <div className="composer-empty-state">
          <div className="empty-illustration">
            <div className="illustration-icon">🎬</div>
            <div className="illustration-text">
              <h2>Design Your First Scene</h2>
              <p>
                Scene Composer lets you spatially arrange characters, backgrounds,
                UI elements, and camera angles to bring your episode to life.
              </p>
            </div>
          </div>
          
          <div className="empty-features">
            <div className="feature-card">
              <span className="feature-icon">👥</span>
              <h3>Place Characters</h3>
              <p>Position LaLa and guests in your scene</p>
            </div>
            
            <div className="feature-card">
              <span className="feature-icon">🖼️</span>
              <h3>Select Backgrounds</h3>
              <p>Choose from your show asset library</p>
            </div>
            
            <div className="feature-card">
              <span className="feature-icon">✨</span>
              <h3>Add UI Elements</h3>
              <p>Trigger overlays, text, and effects</p>
            </div>
            
            <div className="feature-card">
              <span className="feature-icon">⏱️</span>
              <h3>Set Timing</h3>
              <p>Control scene duration and pacing</p>
            </div>
          </div>
          
          <button
            className="btn-primary btn-large btn-get-started"
            onClick={handleOpenSceneComposer}
          >
            🎨 Get Started with Scene Composer
          </button>
        </div>
      ) : (
        /* Scene Overview - Has Scenes */
        <div className="composer-overview">
          <div className="overview-header">
            <h2>Scene Overview</h2>
            <button
              className="btn-secondary"
              onClick={handleOpenSceneComposer}
            >
              View Full Composer →
            </button>
          </div>
          
          {/* Scene List Preview */}
          <div className="scene-list-preview">
            <div className="scene-preview-card">
              <div className="scene-number">Scene 1</div>
              <div className="scene-thumbnail">
                <span className="thumbnail-placeholder">🎬</span>
              </div>
              <div className="scene-info">
                <h4>Opening Scene</h4>
                <p>Duration: 15s</p>
              </div>
            </div>
            
            <div className="scene-preview-card">
              <div className="scene-number">Scene 2</div>
              <div className="scene-thumbnail">
                <span className="thumbnail-placeholder">🎬</span>
              </div>
              <div className="scene-info">
                <h4>Main Content</h4>
                <p>Duration: {episode.duration_seconds - 15}s</p>
              </div>
            </div>
            
            <button className="scene-add-card" onClick={handleOpenSceneComposer}>
              <span className="add-icon">+</span>
              <span>Add Scene</span>
            </button>
          </div>
          
          {/* Quick Tips */}
          <div className="composer-tips">
            <div className="tip-icon">💡</div>
            <div className="tip-content">
              <strong>Pro Tip:</strong> Open Scene Composer to spatially design each scene,
              arrange characters and backgrounds, and set precise timing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EpisodeSceneComposerTab;

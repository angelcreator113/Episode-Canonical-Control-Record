/**
 * SceneControlsPanel - Unified controls for editing scenes
 * 
 * Used by both Build Scene and Timeline (when in Edit Layout mode)
 * Provides controls for:
 * - Background (add/change)
 * - Characters (add/modify)
 * - UI Elements (add/modify)
 * - Duration adjustment
 */

import React from 'react';

function SceneControlsPanel({
  currentScene,
  scenes,
  currentSceneIndex,
  onSetBackground,
  onAddCharacter,
  onAddUIElement,
  onAssignWardrobe,
  onDurationChange,
  selected,
  isCompact = false,
  showSafeZones = true,
  onToggleSafeZones
}) {
  if (!currentScene) {
    return null;
  }

  return (
    <aside 
      className={`scene-controls-panel ${isCompact ? 'compact' : ''}`}
      style={{
        opacity: 1,
        transform: 'translateX(0)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Scene Selection Summary */}
      <div className="control-section">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
          {currentScene.title || `Scene ${currentSceneIndex + 1}`}
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
          {currentSceneIndex + 1} of {scenes.length}
        </p>
      </div>

      {/* Background Control */}
      <div className="control-section">
        <button 
          className="control-action"
          onClick={onSetBackground}
          style={{
            border: selected?.type === 'background' ? '1px solid #667eea' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selected?.type === 'background' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.03)'
          }}
        >
          <span className="action-icon">🎨</span>
          <div className="action-text">
            <div className="action-label">Set Background</div>
            <div className="action-hint">{currentScene.background_url ? 'Change' : 'Add'} background</div>
          </div>
        </button>
      </div>

      {/* Character Control */}
      <div className="control-section">
        <button 
          className="control-action"
          onClick={onAddCharacter}
          style={{
            border: selected?.type === 'character' ? '1px solid #667eea' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selected?.type === 'character' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.03)'
          }}
        >
          <span className="action-icon">👤</span>
          <div className="action-text">
            <div className="action-label">Add Character</div>
            <div className="action-hint">{currentScene.characters?.length || 0} character{(currentScene.characters?.length || 0) !== 1 ? 's' : ''}</div>
          </div>
        </button>
      </div>

      {/* UI Element Control */}
      <div className="control-section">
        <button 
          className="control-action"
          onClick={onAddUIElement}
          style={{
            border: selected?.type === 'ui' ? '1px solid #667eea' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selected?.type === 'ui' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.03)'
          }}
        >
          <span className="action-icon">📝</span>
          <div className="action-text">
            <div className="action-label">Add UI Element</div>
            <div className="action-hint">{currentScene.ui_elements?.length || 0} element{(currentScene.ui_elements?.length || 0) !== 1 ? 's' : ''}</div>
          </div>
        </button>
      </div>

      {/* Wardrobe Control */}
      {onAssignWardrobe && (
        <div className="control-section">
          <button
            className="control-action"
            onClick={onAssignWardrobe}
            style={{
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.03)'
            }}
          >
            <span className="action-icon">👗</span>
            <div className="action-text">
              <div className="action-label">Assign Wardrobe</div>
              <div className="action-hint">{currentScene?.characters?.length || 0} character{currentScene?.characters?.length !== 1 ? 's' : ''}</div>
            </div>
          </button>
        </div>
      )}

      {/* Safe Zones Toggle */}
      {onToggleSafeZones && (
        <div className="control-section">
          <button 
            className="control-action"
            onClick={onToggleSafeZones}
            style={{
              border: showSafeZones ? '1px solid #667eea' : '1px solid rgba(255, 255, 255, 0.08)',
              background: showSafeZones ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.03)'
            }}
          >
            <span className="action-icon">📐</span>
            <div className="action-text">
              <div className="action-label">Safe Zones</div>
              <div className="action-hint">{showSafeZones ? 'Visible' : 'Hidden'}</div>
            </div>
          </button>
        </div>
      )}

      {/* Duration Control */}
      <div className="control-section">
        <div className="duration-control">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '12px' }}>
            ⏱ Duration
          </label>
          <input 
            type="number"
            value={currentScene.duration_seconds || 5}
            onChange={onDurationChange}
            min="1"
            max="60"
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 700,
              textAlign: 'center'
            }}
          />
          <span style={{ display: 'block', textAlign: 'center', marginTop: '6px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
            seconds
          </span>
        </div>
      </div>
    </aside>
  );
}

export default SceneControlsPanel;

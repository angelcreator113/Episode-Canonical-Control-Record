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
  onUploadBackground,
  onUploadCharacter,
  onUploadUIElement,
  onAssignWardrobe,
  onDeleteElement,
  onDurationChange,
  onResizeElement,
  onRotateElement,
  onLayerChange,
  selected,
  isCompact = false,
  showSafeZones = true,
  onToggleSafeZones,
  showSubtitles = true,
  onToggleSubtitles,
  showCharacterLabels = true,
  onToggleCharacterLabels,
  snapEnabled = true,
  onToggleSnap,
}) {
  if (!currentScene) {
    return null;
  }

  // Find the selected element for size/layer controls
  let selectedElement = null;
  if (selected && (selected.type === 'character' || selected.type === 'ui')) {
    const list = selected.type === 'character' ? currentScene.characters : currentScene.ui_elements;
    selectedElement = (list || []).find((el, i) => (el.id || `${selected.type === 'character' ? 'char' : 'ui'}-${i}`) === selected.id);
  }

  const selectedW = selectedElement ? parseInt(selectedElement.width) || (selected.type === 'character' ? 100 : 120) : 0;
  const selectedH = selectedElement ? parseInt(selectedElement.height) || (selected.type === 'character' ? 150 : 50) : 0;
  const selectedLayer = selectedElement?.layer ?? (selected?.type === 'character' ? 5 : selected?.type === 'ui' ? 4 : 1);
  const selectedRotation = selectedElement?.rotation ?? 0;

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

      {/* Selected Element Actions */}
      {selected && onDeleteElement && (
        <div className="control-section">
          <div style={{
            padding: '8px 12px',
            background: 'rgba(255, 75, 75, 0.08)',
            border: '1px solid rgba(255, 75, 75, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {selected.type === 'character' ? '👤' : selected.type === 'ui' ? '📝' : '🎨'}
              {' '}{selected.type} selected
            </span>
            <button
              onClick={() => onDeleteElement(selected.type, selected.id)}
              style={{
                padding: '4px 12px',
                background: 'rgba(255, 75, 75, 0.15)',
                border: '1px solid rgba(255, 75, 75, 0.3)',
                borderRadius: '6px',
                color: '#ff4b4b',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Delete (Del key)"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}

      {/* Size & Layer Controls — visible when a character or UI element is selected */}
      {selected && selectedElement && (selected.type === 'character' || selected.type === 'ui') && (
        <div className="control-section">
          {/* Exact size inputs */}
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
            📐 Size (px)
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: '4px' }}>W</label>
              <input
                type="number"
                value={selectedW}
                min={20}
                max={1920}
                step={1}
                onChange={(e) => {
                  const v = Math.max(20, Math.min(1920, parseInt(e.target.value) || 20));
                  onResizeElement && onResizeElement(selected.type, selected.id, { width: `${v}px`, height: `${selectedH}px` });
                }}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
                  color: '#fff', fontSize: '14px', fontWeight: 600, textAlign: 'center',
                }}
              />
            </div>
            <span style={{ alignSelf: 'flex-end', color: 'rgba(255,255,255,0.3)', fontSize: '14px', paddingBottom: '6px' }}>×</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: '4px' }}>H</label>
              <input
                type="number"
                value={selectedH}
                min={20}
                max={1920}
                step={1}
                onChange={(e) => {
                  const v = Math.max(20, Math.min(1920, parseInt(e.target.value) || 20));
                  onResizeElement && onResizeElement(selected.type, selected.id, { width: `${selectedW}px`, height: `${v}px` });
                }}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
                  color: '#fff', fontSize: '14px', fontWeight: 600, textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Layer (z-index) controls */}
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
            🗂 Layer
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => onLayerChange && onLayerChange(selected.type, selected.id, 'back')}
              title="Send to Back"
              style={{
                flex: 1, padding: '6px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
              }}
            >⇊ Back</button>
            <button
              onClick={() => onLayerChange && onLayerChange(selected.type, selected.id, 'down')}
              title="Move Down"
              style={{
                flex: 1, padding: '6px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
              }}
            >↓ Down</button>
            <button
              onClick={() => onLayerChange && onLayerChange(selected.type, selected.id, 'up')}
              title="Move Up"
              style={{
                flex: 1, padding: '6px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
              }}
            >↑ Up</button>
            <button
              onClick={() => onLayerChange && onLayerChange(selected.type, selected.id, 'front')}
              title="Bring to Front"
              style={{
                flex: 1, padding: '6px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
              }}
            >⇈ Front</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
            Layer: {selectedLayer}
          </div>

          {/* Rotation control */}
          {onRotateElement && (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: '12px', marginBottom: '8px' }}>
                🔄 Rotation
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedRotation}
                  onChange={(e) => onRotateElement(selected.type, selected.id, parseInt(e.target.value) || 0)}
                  style={{ flex: 1, accentColor: '#667eea' }}
                />
                <input
                  type="number"
                  value={selectedRotation}
                  min={-360}
                  max={360}
                  step={1}
                  onChange={(e) => onRotateElement(selected.type, selected.id, parseInt(e.target.value) || 0)}
                  style={{
                    width: '56px', padding: '4px 6px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
                    color: '#fff', fontSize: '12px', fontWeight: 600, textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>°</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                {[0, 90, 180, 270].map(angle => (
                  <button
                    key={angle}
                    onClick={() => onRotateElement(selected.type, selected.id, angle)}
                    style={{
                      flex: 1, padding: '4px 0', background: selectedRotation === angle ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.04)',
                      border: selectedRotation === angle ? '1px solid rgba(102,126,234,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
            <div className="action-hint">{currentScene.background_url ? 'Browse library' : 'Browse library'}</div>
          </div>
        </button>
        {onUploadBackground && (
          <button
            className="control-upload-link"
            onClick={onUploadBackground}
          >
            📤 Upload New
          </button>
        )}
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
        {onUploadCharacter && (
          <button
            className="control-upload-link"
            onClick={onUploadCharacter}
          >
            📤 Upload New
          </button>
        )}
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
        {onUploadUIElement && (
          <button
            className="control-upload-link"
            onClick={onUploadUIElement}
          >
            📤 Upload New
          </button>
        )}
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
              <div className="action-label">Add Wardrobe</div>
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

      {/* Stage Overlay Toggles */}
      <div className="control-section">
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
          🎛 Stage Overlays
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {onToggleSubtitles && (
            <button
              className="control-action"
              onClick={onToggleSubtitles}
              style={{
                border: showSubtitles ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(255,255,255,0.08)',
                background: showSubtitles ? 'rgba(102,126,234,0.08)' : 'rgba(255,255,255,0.03)',
                padding: '6px 10px',
              }}
            >
              <span className="action-icon" style={{ fontSize: '14px' }}>💬</span>
              <div className="action-text">
                <div className="action-label" style={{ fontSize: '12px' }}>Subtitles</div>
                <div className="action-hint">{showSubtitles ? 'On' : 'Off'}</div>
              </div>
            </button>
          )}
          {onToggleCharacterLabels && (
            <button
              className="control-action"
              onClick={onToggleCharacterLabels}
              style={{
                border: showCharacterLabels ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(255,255,255,0.08)',
                background: showCharacterLabels ? 'rgba(102,126,234,0.08)' : 'rgba(255,255,255,0.03)',
                padding: '6px 10px',
              }}
            >
              <span className="action-icon" style={{ fontSize: '14px' }}>🏷</span>
              <div className="action-text">
                <div className="action-label" style={{ fontSize: '12px' }}>Char Labels</div>
                <div className="action-hint">{showCharacterLabels ? 'On' : 'Off'}</div>
              </div>
            </button>
          )}
          {onToggleSnap && (
            <button
              className="control-action"
              onClick={onToggleSnap}
              style={{
                border: snapEnabled ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(255,255,255,0.08)',
                background: snapEnabled ? 'rgba(102,126,234,0.08)' : 'rgba(255,255,255,0.03)',
                padding: '6px 10px',
              }}
            >
              <span className="action-icon" style={{ fontSize: '14px' }}>🧲</span>
              <div className="action-text">
                <div className="action-label" style={{ fontSize: '12px' }}>Snap to Grid</div>
                <div className="action-hint">{snapEnabled ? 'On' : 'Off'}</div>
              </div>
            </button>
          )}
        </div>
      </div>

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

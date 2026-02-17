/**
 * Stage - Reusable canvas component
 * 
 * Composed of:
 * - StageFrame: Chrome/frame styling
 * - StageRenderer: Scene rendering
 * 
 * Usage in both Build Scene and Timeline modes
 * Ensures pixel-perfect identical appearance
 */

import React from 'react';
import StageFrame from './StageFrame';
import StageRenderer from './StageRenderer';
import './stage.css';

function Stage({
  platform,
  scene,
  currentTime,
  interactionMode = 'view', // 'view' or 'edit'
  selected,
  onSelect,
  onUpdatePosition,
  onResizeElement,
  onDeleteElement,
  showPlatformBadge = true,
  showSafeZones = false,
  className = ''
}) {
  const isEditMode = interactionMode === 'edit';
  const isEmpty = !scene?.background_url;

  return (
    <div className={`stage-container ${className}`}>
      <StageFrame 
        platform={platform} 
        showPlatformBadge={showPlatformBadge}
        showSafeZones={showSafeZones}
        isEditMode={isEditMode}
        isEmpty={isEmpty}
      >
        <StageRenderer 
          platform={platform}
          scene={scene}
          currentTime={currentTime}
          interactionMode={interactionMode}
          selected={selected}
          onSelect={onSelect}
          onUpdatePosition={onUpdatePosition}
          onResizeElement={onResizeElement}
          onDeleteElement={onDeleteElement}
        />
      </StageFrame>
    </div>
  );
}

export default Stage;

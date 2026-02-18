/**
 * Stage - Reusable canvas component
 * 
 * Composed of:
 * - StageFrame: Chrome/frame styling + safe zones
 * - StageRenderer: Scene rendering with drag/resize/rotate
 * - StageAlignmentGuides: Snap-to-grid visual guides
 * - StageSubtitles: Dialogue clip subtitle overlay
 * 
 * Features:
 * - Multi-platform aspect ratio locking
 * - Drag-to-move, resize handles, rotation handles
 * - Snap-to-grid (center, thirds, edges) with visual guides
 * - Timeline-based element visibility (enter/exit times)
 * - Dialogue subtitle rendering
 * - Character name labels
 * - Copy/paste support (via parent callbacks)
 * 
 * Usage in both Build Scene and Timeline modes
 * Ensures pixel-perfect identical appearance
 */

import React from 'react';
import StageFrame from './StageFrame';
import StageRenderer from './StageRenderer';
import StageAlignmentGuides from './StageAlignmentGuides';
import StageSubtitles from './StageSubtitles';
import useSnapEngine from './useSnapEngine';
import './stage.css';

function Stage({
  platform,
  scene,
  currentTime = 0,
  interactionMode = 'view', // 'view' or 'edit'
  selected,
  onSelect,
  onUpdatePosition,
  onResizeElement,
  onRotateElement,
  onDeleteElement,
  showPlatformBadge = true,
  showSafeZones = false,
  showSubtitles = true,
  showAlignmentGuides = true,
  showCharacterLabels = true,
  snapEnabled = true,
  className = ''
}) {
  const isEditMode = interactionMode === 'edit';
  const isEmpty = !scene?.background_url;

  const { activeGuides, snapPosition, clearGuides } = useSnapEngine({
    enabled: snapEnabled && isEditMode,
  });

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
          onRotateElement={onRotateElement}
          onDeleteElement={onDeleteElement}
          snapPosition={snapPosition}
          onDragEnd={clearGuides}
          showCharacterLabels={showCharacterLabels}
        />

        {/* Alignment Guide Overlay */}
        {isEditMode && showAlignmentGuides && (
          <StageAlignmentGuides activeGuides={activeGuides} />
        )}

        {/* Dialogue Subtitles */}
        {showSubtitles && scene?.dialogue_clips?.length > 0 && (
          <StageSubtitles
            dialogueClips={scene.dialogue_clips}
            currentTime={currentTime}
            duration={scene.duration_seconds || 5}
          />
        )}
      </StageFrame>
    </div>
  );
}

export default Stage;

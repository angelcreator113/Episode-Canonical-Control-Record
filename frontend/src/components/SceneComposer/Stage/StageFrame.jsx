/**
 * StageFrame - The outer chrome/frame for the canvas
 * 
 * Responsible for:
 * - Workspace wrapper with subtle gradient
 * - Export frame with aspect ratio locking
 * - Checkerboard empty state
 * - Safe zone overlays
 * - Frame label
 * - Edit mode visual feedback
 */

import React from 'react';

function StageFrame({ 
  platform, 
  showPlatformBadge = true,
  showSafeZones = false,
  isEditMode = false,
  isEmpty = false,
  children 
}) {
  // Convert ratio like "16:9" to CSS aspect-ratio value "16 / 9"
  const aspectRatio = platform?.ratio ? platform.ratio.replace(':', ' / ') : '16 / 9';

  return (
    <div className="stage-workspace">
      <div 
        className={`stage-frame ${isEmpty ? 'empty' : ''} ${isEditMode ? 'is-editing' : ''}`}
        style={{ '--ar': aspectRatio, aspectRatio }}
      >
        {/* Safe zone overlays */}
        {showSafeZones && (
          <>
            <div className="stage-safe" />
            <div className="stage-title-safe" />
          </>
        )}

        {/* Empty state message */}
        {isEmpty && (
          <div className="stage-empty-message">
            No background set
          </div>
        )}

        {/* Frame label */}
        <div className={`stage-frame-label ${isEditMode ? 'editing' : ''}`}>
          {platform?.name || 'YouTube'} ({platform?.ratio || '16:9'})
        </div>

        {children}
      </div>
    </div>
  );
}

export default StageFrame;

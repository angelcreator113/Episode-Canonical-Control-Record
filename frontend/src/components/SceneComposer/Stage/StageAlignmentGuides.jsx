/**
 * StageAlignmentGuides - Visual snap guides rendered over the stage
 * 
 * Shows vertical/horizontal lines at snap points when an element
 * is being dragged near a grid position (center, thirds, edges).
 */

import React from 'react';

function StageAlignmentGuides({ activeGuides = { x: [], y: [] } }) {
  const hasGuides = activeGuides.x.length > 0 || activeGuides.y.length > 0;
  if (!hasGuides) return null;

  return (
    <div className="stage-alignment-guides" style={{ pointerEvents: 'none' }}>
      {/* Vertical guide lines (x positions) */}
      {activeGuides.x.map((xPos) => (
        <div
          key={`guide-x-${xPos}`}
          className="stage-guide-line stage-guide-vertical"
          style={{ left: `${xPos}%` }}
        />
      ))}
      {/* Horizontal guide lines (y positions) */}
      {activeGuides.y.map((yPos) => (
        <div
          key={`guide-y-${yPos}`}
          className="stage-guide-line stage-guide-horizontal"
          style={{ top: `${yPos}%` }}
        />
      ))}
    </div>
  );
}

export default StageAlignmentGuides;

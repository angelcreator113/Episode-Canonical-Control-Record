import React from 'react';
import './TimelinePlacementTrack.css';

/**
 * TimelinePlacementTrack - Renders Track 2 showing asset/wardrobe placements
 * Scene-confined: placements render within their scene boundaries
 */
const TimelinePlacementTrack = ({ 
  placements, 
  scenes, 
  totalDuration, 
  zoom, 
  onPlacementClick,
  selectedPlacementId 
}) => {
  // Calculate scene positions
  const scenePositions = [];
  let currentTime = 0;
  
  scenes.forEach((scene, index) => {
    const duration = scene.duration_seconds || 0;
    const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
    const leftPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
    
    scenePositions.push({
      ...scene,
      startTime: currentTime,
      endTime: currentTime + duration,
      widthPercent,
      leftPercent,
    });
    
    currentTime += duration;
  });

  // Group placements by scene
  const placementsByScene = placements.reduce((acc, placement) => {
    if (placement.scene_id) {
      if (!acc[placement.scene_id]) acc[placement.scene_id] = [];
      acc[placement.scene_id].push(placement);
    }
    return acc;
  }, {});

  return (
    <div className="timeline-placement-track" style={{ width: `${zoom}%` }}>
      {scenePositions.map((scene) => {
        const scenePlacements = placementsByScene[scene.id] || [];
        
        return (
          <div
            key={scene.id}
            className="placement-scene-container"
            style={{
              position: 'absolute',
              left: `${scene.leftPercent}%`,
              width: `${scene.widthPercent}%`,
              height: '40px',
            }}
          >
            {scenePlacements.map((placement, index) => (
              <PlacementItem
                key={placement.id}
                placement={placement}
                scene={scene}
                index={index}
                totalInScene={scenePlacements.length}
                isSelected={placement.id === selectedPlacementId}
                onClick={() => onPlacementClick(placement)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/**
 * PlacementItem - Individual asset/wardrobe placement marker
 */
const PlacementItem = ({ placement, scene, index, totalInScene, isSelected, onClick }) => {
  // Calculate position within scene based on attachment point
  let offsetPercent = 0;
  const sceneDuration = scene.endTime - scene.startTime;
  
  if (sceneDuration > 0) {
    let baseOffset = 0;
    
    switch (placement.attachment_point) {
      case 'scene-start':
        baseOffset = 0;
        break;
      case 'scene-end':
        baseOffset = sceneDuration;
        break;
      case 'scene-middle':
        baseOffset = sceneDuration / 2;
        break;
      case 'custom':
      default:
        baseOffset = 0;
    }
    
    const totalOffset = baseOffset + (parseFloat(placement.offset_seconds) || 0);
    offsetPercent = (totalOffset / sceneDuration) * 100;
  }

  // Stack multiple placements vertically
  const stackOffset = (index * 8);

  const getPlacementColor = () => {
    if (placement.placement_type === 'wardrobe') return '#ec4899'; // Pink
    if (placement.placement_type === 'asset') {
      // Color by asset type if available
      const assetType = placement.asset?.type;
      const colors = {
        'PROMO_LALA': '#ec4899',
        'PROMO_GUEST': '#f59e0b',
        'BRAND_LOGO': '#3b82f6',
        'LOWER_THIRD': '#8b5cf6',
      };
      return colors[assetType] || '#10b981';
    }
    return '#6b7280'; // Gray for audio
  };

  const getPlacementIcon = () => {
    if (placement.placement_type === 'wardrobe') return '👗';
    if (placement.placement_type === 'asset') {
      const assetType = placement.asset?.type;
      const icons = {
        'PROMO_LALA': '👗',
        'PROMO_GUEST': '🎤',
        'BRAND_LOGO': '🏷️',
        'LOWER_THIRD': '📝',
        'CTA': '👆',
      };
      return icons[assetType] || '📎';
    }
    return '🎵';
  };

  const getLabel = () => {
    if (placement.label) return placement.label;
    if (placement.placement_type === 'wardrobe') {
      return placement.wardrobeItem?.name || 'Wardrobe';
    }
    if (placement.placement_type === 'asset') {
      return placement.asset?.name || 'Asset';
    }
    return 'Placement';
  };

  return (
    <div
      className={`placement-item ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${Math.max(0, Math.min(95, offsetPercent))}%`,
        top: `${stackOffset}px`,
        background: getPlacementColor(),
      }}
      onClick={onClick}
      title={`${getLabel()} - ${placement.attachment_point || 'custom'} + ${placement.offset_seconds || 0}s`}
    >
      <span className="placement-icon">{getPlacementIcon()}</span>
      <span className="placement-label">{getLabel()}</span>
    </div>
  );
};

export default TimelinePlacementTrack;

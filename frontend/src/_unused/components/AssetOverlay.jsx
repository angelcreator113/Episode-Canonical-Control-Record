import React from 'react';
import './Timeline.css';

/**
 * AssetOverlay - Shows assets positioned on timeline
 * Displays thumbnails of assets at their assigned times
 */
const AssetOverlay = ({ assets, totalDuration, zoom }) => {
  if (!assets || assets.length === 0) {
    return null;
  }

  // Filter assets that have timeline positions
  const timelineAssets = assets.filter(asset => 
    asset.start_time !== undefined && asset.start_time !== null
  );

  if (timelineAssets.length === 0) {
    return null;
  }

  const getAssetPosition = (startTime) => {
    if (totalDuration === 0) return 0;
    return (startTime / totalDuration) * 100;
  };

  const getAssetTypeColor = (type) => {
    const colors = {
      'PROMO_LALA': '#ec4899',      // Pink
      'PROMO_GUEST': '#f59e0b',     // Orange
      'PROMO_WOMANINPRIME': '#8b5cf6', // Purple
      'BRAND_LOGO': '#3b82f6',      // Blue
      'EPISODE_FRAME': '#10b981',   // Green
    };
    return colors[type] || '#6b7280';
  };

  return (
    <div className="asset-overlay-track" style={{ width: `${zoom}%` }}>
      {timelineAssets.map((asset, index) => {
        const position = getAssetPosition(asset.start_time);
        const color = getAssetTypeColor(asset.type);

        return (
          <div
            key={asset.id || index}
            className="asset-marker"
            style={{ 
              left: `${position}%`,
              borderColor: color
            }}
            title={`${asset.name || asset.type} at ${formatTime(asset.start_time)}`}
          >
            <div className="asset-marker-icon" style={{ background: color }}>
              {getAssetIcon(asset.type)}
            </div>
            <div className="asset-marker-label">
              {asset.name?.substring(0, 15) || asset.type}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const getAssetIcon = (type) => {
  const icons = {
    'PROMO_LALA': '👗',
    'PROMO_GUEST': '🎤',
    'PROMO_WOMANINPRIME': '👸',
    'BRAND_LOGO': '🏷️',
    'EPISODE_FRAME': '🎬',
  };
  return icons[type] || '📎';
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default AssetOverlay;

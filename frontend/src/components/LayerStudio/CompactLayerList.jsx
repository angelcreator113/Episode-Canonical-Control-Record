import React, { useState } from 'react';

const LAYER_CONFIG = {
  5: { name: 'Audio/Music', icon: '🎵', color: 'purple' },
  4: { name: 'Text/Captions', icon: '📝', color: 'blue' },
  3: { name: 'Overlays/Graphics', icon: '🎨', color: 'green' },
  2: { name: 'Main Content', icon: '🎬', color: 'yellow' },
  1: { name: 'Background/B-Roll', icon: '🖼️', color: 'gray' }
};

const COLORS = {
  purple: { bg: 'bg-purple-900', border: 'border-purple-500', text: 'text-purple-300', hover: 'hover:bg-purple-800' },
  blue: { bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-300', hover: 'hover:bg-blue-800' },
  green: { bg: 'bg-green-900', border: 'border-green-500', text: 'text-green-300', hover: 'hover:bg-green-800' },
  yellow: { bg: 'bg-yellow-900', border: 'border-yellow-500', text: 'text-yellow-300', hover: 'hover:bg-yellow-800' },
  gray: { bg: 'bg-gray-700', border: 'border-gray-500', text: 'text-gray-300', hover: 'hover:bg-gray-600' }
};

const CompactLayerList = ({
  layers,
  selectedLayer,
  selectedAsset,
  onLayerSelect,
  onAssetSelect,
  onAssetDrop,
  onLayerUpdate
}) => {
  const [collapsedLayers, setCollapsedLayers] = useState({});
  const [dragOverLayer, setDragOverLayer] = useState(null);

  const sortedLayers = [...layers].sort((a, b) => b.layer_number - a.layer_number);

  const toggleCollapse = (layerId) => {
    setCollapsedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  const handleDragOver = (e, layerId) => {
    e.preventDefault();
    setDragOverLayer(layerId);
  };

  const handleDragLeave = () => {
    setDragOverLayer(null);
  };

  const handleDrop = (e, layerId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverLayer(null);
    
    const assetData = e.dataTransfer.getData('asset');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        console.log('📥 Asset dropped on layer:', layerId, asset);
        onAssetDrop(layerId, asset);
      } catch (error) {
        console.error('Failed to parse asset data:', error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-white">🎬 Layers Timeline</h3>
          <p className="text-xs text-gray-400">
            Drag assets to layers • Click to select
          </p>
        </div>
      </div>

      {/* Vertical Layer Stack */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
        {sortedLayers.map(layer => {
          const config = LAYER_CONFIG[layer.layer_number];
          const colors = COLORS[config.color];
          const isSelected = selectedLayer?.id === layer.id;
          const isCollapsed = collapsedLayers[layer.id];
          const isDragOver = dragOverLayer === layer.id;

          return (
            <div
              key={layer.id}
              className={`
                rounded-lg border-2 transition-all shadow-md hover:shadow-xl
                ${isSelected ? 'ring-2 ring-blue-500 scale-[1.01]' : ''}
                ${isDragOver ? 'border-blue-400 shadow-2xl ring-2 ring-blue-400' : colors.border}
                ${layer.is_visible ? '' : 'opacity-40 grayscale'}
                flex items-center gap-3 min-h-[70px]
              `}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, layer.id)}
            >
              {/* Layer Header */}
              <div
                className={`
                  ${colors.bg} px-4 py-3 cursor-pointer rounded-l-lg
                  ${colors.hover} transition flex-shrink-0 flex items-center gap-3
                `}
                onClick={() => onLayerSelect(layer)}
              >
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <div className="text-white font-bold text-sm">
                    L{layer.layer_number}
                  </div>
                  <div className={`${colors.text} text-xs`}>
                    {config.name}
                  </div>
                </div>
              </div>
              
              {/* Layer Controls */}
              <div className="flex items-center gap-2 px-3">

                {/* Visibility */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerUpdate(layer.id, { is_visible: !layer.is_visible });
                  }}
                  className="p-2 hover:bg-gray-700 rounded transition"
                  title={layer.is_visible ? 'Hide' : 'Show'}
                >
                  <span className="text-base">
                    {layer.is_visible ? '👁️' : '🚫'}
                  </span>
                </button>

                {/* Lock */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerUpdate(layer.id, { is_locked: !layer.is_locked });
                  }}
                  className="p-2 hover:bg-gray-700 rounded transition"
                  title={layer.is_locked ? 'Unlock' : 'Lock'}
                >
                  <span className="text-base">
                    {layer.is_locked ? '🔒' : '🔓'}
                  </span>
                </button>
                
                {/* Opacity Slider */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={layer.opacity || 1.0}
                    onChange={(e) => {
                      e.stopPropagation();
                      onLayerUpdate(layer.id, { opacity: parseFloat(e.target.value) });
                    }}
                    className="w-24 h-1"
                  />
                  <span className="text-xs text-white font-mono w-10">
                    {Math.round((layer.opacity || 1.0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Layer Assets - Horizontal scroll */}
              <div className="flex-1 bg-gray-900 p-2 rounded-r-lg overflow-x-auto overflow-y-hidden min-w-0">
                {layer.assets && layer.assets.length > 0 ? (
                  <div className="flex gap-2 h-full">
                    {layer.assets.map(layerAsset => (
                      <div
                        key={layerAsset.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssetSelect(layerAsset);
                        }}
                        className={`
                          flex-shrink-0 w-16 h-full flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer transition
                          ${selectedAsset?.id === layerAsset.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          }
                        `}
                      >
                        {layerAsset.asset?.type === 'image' ? (
                          <img
                            src={layerAsset.asset.url}
                            alt={layerAsset.asset.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-xl">
                            {layerAsset.asset?.type === 'video' ? '🎥' : 
                             layerAsset.asset?.type === 'audio' ? '🎵' : '📄'}
                          </div>
                        )}
                        <div className="text-[9px] font-medium truncate w-full text-center">
                          {layerAsset.asset?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    {isDragOver ? (
                      <span className="text-blue-400 font-semibold">📥 Drop here</span>
                    ) : (
                      <span>Drag assets here</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompactLayerList;

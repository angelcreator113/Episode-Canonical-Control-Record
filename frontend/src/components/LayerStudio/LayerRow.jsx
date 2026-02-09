import React, { useState } from 'react';

const LayerRow = ({
  layer,
  config,
  isSelected,
  selectedAssetId,
  onLayerSelect,
  onAssetSelect,
  onAssetDrop,
  onLayerUpdate,
  compactMode = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const assetData = e.dataTransfer.getData('asset');
    if (assetData) {
      const asset = JSON.parse(assetData);
      onAssetDrop(layer.id, asset);
    }
  };

  const toggleVisibility = () => {
    onLayerUpdate(layer.id, { is_visible: !layer.is_visible });
  };

  const toggleLock = () => {
    onLayerUpdate(layer.id, { is_locked: !layer.is_locked });
  };

  const handleOpacityChange = (e) => {
    const opacity = parseFloat(e.target.value);
    onLayerUpdate(layer.id, { opacity });
  };

  return (
    <div
      className={`
        border-2 rounded-xl transition-all relative overflow-hidden cursor-pointer
        ${compactMode ? 'min-h-[60px]' : 'min-h-[85px]'}
        ${isSelected ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/30 scale-[1.02]' : `${config.borderColor} border-opacity-40`}
        ${isDragOver ? 'ring-4 ring-blue-400 bg-blue-900 bg-opacity-30 scale-[1.02]' : ''}
        ${layer.is_visible ? 'bg-gradient-to-br from-gray-750 to-gray-800' : 'bg-gray-800 opacity-50'}
        hover:shadow-2xl hover:scale-[1.01] duration-200
      `}
      onClick={() => onLayerSelect(layer)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Over Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-blue-500/20 backdrop-blur-sm pointer-events-none z-10 rounded-xl">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="text-xl">📥</span>
            <span className="font-bold text-sm">Drop Asset Here</span>
          </div>
        </div>
      )}
      
      {/* Layer Header */}
      <div className={`${config.color} px-3 py-2 flex items-center justify-between border-b-2 ${config.borderColor} shadow-lg`}>
        <div className="flex items-center gap-2.5">
          <span className="text-lg drop-shadow-lg">{config.icon}</span>
          <div>
            <div className={`font-bold text-xs ${config.textColor} drop-shadow tracking-wide`}>L{layer.layer_number}</div>
            <div className="text-[10px] text-gray-300 font-medium">{config.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">{/* Visibility Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleVisibility(); }}
            className="p-1.5 rounded-lg transition text-sm bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/10 hover:scale-110"
            title={layer.is_visible ? 'Hide layer' : 'Show layer'}
          >
            {layer.is_visible ? '👁️' : '🚫'}
          </button>

          {/* Lock Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLock(); }}
            className={`p-1.5 rounded-lg transition text-sm border border-white/10 hover:scale-110 ${layer.is_locked ? 'bg-red-600/50 hover:bg-red-600/70' : 'bg-black/30 hover:bg-black/50 backdrop-blur-sm'}`}
            title={layer.is_locked ? 'Unlock layer' : 'Lock layer'}
          >
            {layer.is_locked ? '🔒' : '🔓'}
          </button>
          
          {/* Opacity */}
          {!compactMode && (
            <div className="flex items-center gap-1.5 ml-2 px-2 py-1 bg-black/30 backdrop-blur-sm rounded-lg border border-white/10">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={layer.opacity || 1.0}
                onChange={handleOpacityChange}
                className="w-16 h-1"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-[10px] text-white font-bold w-7 text-right">
                {Math.round((layer.opacity || 1.0) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Layer Assets */}
      <div className={`${compactMode ? 'p-2' : 'p-3'} bg-gradient-to-br from-gray-850 to-gray-900`}>
        {layer.assets && layer.assets.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {layer.assets.map(layerAsset => (
              <div
                key={layerAsset.id}
                onClick={(e) => { e.stopPropagation(); onAssetSelect(layerAsset); }}
                className={`
                  border-2 rounded-lg p-1.5 cursor-pointer transition-all duration-200 bg-gradient-to-br from-gray-700 to-gray-800 hover:scale-105
                  ${selectedAssetId === layerAsset.id ? 'border-blue-500 shadow-xl shadow-blue-500/50 scale-105' : 'border-gray-600/50 hover:border-blue-400/70 hover:shadow-lg'}
                `}
              >
                {layerAsset.asset?.asset_type === 'image' || layerAsset.asset?.media_type === 'image' ? (
                  <img
                    src={layerAsset.asset.s3_url_processed || layerAsset.asset.s3_url_raw || layerAsset.asset.url}
                    alt={layerAsset.asset.name}
                    className="w-full h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded flex items-center justify-center border border-gray-600/50">
                    <span className="text-2xl">
                      {layerAsset.asset?.asset_type === 'video' || layerAsset.asset?.media_type === 'video' ? '🎥' : 
                       layerAsset.asset?.asset_type === 'audio' || layerAsset.asset?.media_type === 'audio' ? '🎵' : '📄'}
                    </span>
                  </div>
                )}
                <div className="mt-1 text-[9px] text-gray-300 truncate font-semibold px-0.5">
                  {layerAsset.asset?.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-gray-400 text-xs">
            {isDragOver ? (
              <span className="text-blue-400 font-bold animate-pulse">📥 Drop asset here</span>
            ) : (
              <span className="font-medium">Drag assets from library below</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerRow;

import React, { useState, useRef } from 'react';

const BigCanvasEnhanced = ({ 
  allAssets, 
  zoom, 
  selectedAsset, 
  showGrid, 
  snapEnabled,
  canvasWidth = 1920,
  canvasHeight = 1080,
  presetName = 'YouTube',
  presetIcon = '▶️',
  onAssetSelect, 
  onAssetUpdate, 
  onAssetDrop, 
  layers 
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    
    const assetData = e.dataTransfer.getData('asset');
    if (assetData && layers.length > 0) {
      const asset = JSON.parse(assetData);
      const rect = canvasRef.current.getBoundingClientRect();
      
      const x = Math.round((e.clientX - rect.left) / zoom);
      const y = Math.round((e.clientY - rect.top) / zoom);
      
      const mainLayer = layers.find(l => l.layer_number === 2);
      if (mainLayer) {
        onAssetDrop(mainLayer.id, asset, { x, y });
      }
    }
  };

  const handleAssetMouseDown = (e, asset) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - ((asset.position_x || 0) * zoom),
      y: e.clientY - ((asset.position_y || 0) * zoom)
    });
    onAssetSelect(asset);
  };

  const handleMouseMove = (e) => {
    if (isDragging && selectedAsset) {
      const newX = Math.round((e.clientX - dragStart.x) / zoom);
      const newY = Math.round((e.clientY - dragStart.y) / zoom);
      
      onAssetUpdate(selectedAsset.id, {
        position_x: newX,
        position_y: newY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-3/5 bg-gray-900 flex flex-col">
      {/* Canvas Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{presetIcon}</span>
          <div>
            <div className="text-sm text-white font-bold">{presetName} Canvas</div>
            <div className="text-xs text-gray-400">
              {canvasWidth} × {canvasHeight} • {allAssets.length} asset{allAssets.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {snapEnabled && (
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full font-bold shadow">
              🔲 Snap: 50px
            </span>
          )}
          {showGrid && (
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold shadow">
              Grid ON
            </span>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div
        className="flex-1 flex items-center justify-center p-12 overflow-auto bg-gradient-to-br from-slate-950 to-slate-900"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className="relative bg-black shadow-2xl border-2 border-slate-700 rounded-lg overflow-hidden"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Grid Overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
                `,
                backgroundSize: `${50 * zoom}px ${50 * zoom}px`
              }}
            />
          )}

          {/* Render Assets */}
          {allAssets.map(asset => {
            if (!asset.layer_visible) return null;

            const isSelected = selectedAsset?.id === asset.id;
            const finalOpacity = (asset.opacity || 1.0) * (asset.layer_opacity || 1.0);

            return (
              <div
                key={asset.id}
                className={`
                  absolute cursor-move transition-all
                  ${isSelected ? 'ring-4 ring-blue-500 shadow-2xl z-50' : 'hover:ring-2 hover:ring-blue-300'}
                `}
                style={{
                  left: (asset.position_x || 0) * zoom,
                  top: (asset.position_y || 0) * zoom,
                  opacity: finalOpacity,
                  transform: `
                    rotate(${asset.rotation || 0}deg) 
                    scaleX(${asset.scale_x || 1.0}) 
                    scaleY(${asset.scale_y || 1.0})
                  `,
                  zIndex: asset.layer_number * 10 + (isSelected ? 100 : 0)
                }}
                onMouseDown={(e) => handleAssetMouseDown(e, asset)}
              >
                {asset.asset?.type === 'image' ? (
                  <img
                    src={asset.asset.url}
                    alt={asset.asset.name}
                    draggable={false}
                    className="select-none rounded-lg shadow-xl"
                    style={{
                      width: (asset.width || 400) * zoom,
                      height: (asset.height || 400) * zoom,
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div
                    className="bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white text-5xl rounded-lg shadow-xl border-2 border-gray-600"
                    style={{
                      width: (asset.width || 200) * zoom,
                      height: (asset.height || 200) * zoom
                    }}
                  >
                    {asset.asset?.type === 'video' ? '🎥' : '🎵'}
                  </div>
                )}

                {/* Transform Handles */}
                {isSelected && (
                  <>
                    <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-xl animate-pulse" />
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-xl animate-pulse" />
                    <div className="absolute -bottom-2 -left-2 w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-xl animate-pulse" />
                    <div className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-xl animate-pulse" />
                  </>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {allAssets.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-12 opacity-50">
              <div className="text-center text-gray-500">
                <div className="text-5xl mb-2">🎬</div>
                <div className="text-lg font-semibold mb-2">Empty Canvas</div>
                <div className="text-sm text-gray-600">Drag assets from the right panel</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transform Controls */}
      {selectedAsset && (
        <div className="bg-gray-800 border-t-2 border-purple-600 px-4 py-3 grid grid-cols-4 gap-3 text-xs shadow-xl">
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">X (px)</label>
            <input
              type="number"
              value={selectedAsset.position_x || 0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { position_x: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">Y (px)</label>
            <input
              type="number"
              value={selectedAsset.position_y || 0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { position_y: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">W (px)</label>
            <input
              type="number"
              value={selectedAsset.width || ''}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { width: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Auto"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1 font-semibold">H (px)</label>
            <input
              type="number"
              value={selectedAsset.height || ''}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { height: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Auto"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BigCanvasEnhanced;

import React, { useRef, useState } from 'react';

const PreviewCanvas = ({
  layers,
  selectedAsset,
  zoom,
  onAssetSelect,
  onAssetUpdate,
  onAssetDrop
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;

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
      
      // Drop on Layer 2 (Main Content) by default
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
      x: e.clientX - (asset.position_x * zoom),
      y: e.clientY - (asset.position_y * zoom)
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

  // Get all assets from all layers, sorted by layer number
  const allAssets = layers
    .sort((a, b) => a.layer_number - b.layer_number)
    .flatMap(layer => 
      (layer.assets || []).map(asset => ({
        ...asset,
        layer_number: layer.layer_number,
        layer_visible: layer.is_visible,
        layer_opacity: layer.opacity
      }))
    );

  return (
    <div className="flex-1 flex flex-col">
      {/* Canvas Controls */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <div className="text-sm font-semibold text-white">
            Preview Canvas
          </div>
          <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
            {CANVAS_WIDTH} × {CANVAS_HEIGHT}
          </div>
          <div className="text-xs text-gray-500">
            {allAssets.length} asset{allAssets.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${showGrid ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            `}
          >
            {showGrid ? '🔲' : '□'} Grid
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="flex-1 flex items-center justify-center p-8 overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className="relative bg-black shadow-2xl"
          style={{
            width: CANVAS_WIDTH * zoom,
            height: CANVAS_HEIGHT * zoom,
            transform: `scale(1)`,
            transformOrigin: 'center'
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Grid Overlay */}
          {showGrid && (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: `${100 * zoom}px ${100 * zoom}px`
                }}
              />
              {/* Center Guides */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-px h-full bg-blue-500 opacity-30"></div>
              </div>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="h-px w-full bg-blue-500 opacity-30"></div>
              </div>
            </>
          )}

          {/* Render all assets */}
          {allAssets.map(asset => {
            if (!asset.layer_visible) return null;

            const isSelected = selectedAsset?.id === asset.id;
            const finalOpacity = (asset.opacity || 1.0) * (asset.layer_opacity || 1.0);

            return (
              <div
                key={asset.id}
                className={`
                  absolute cursor-move
                  ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}
                `}
                style={{
                  left: asset.position_x * zoom,
                  top: asset.position_y * zoom,
                  width: asset.width ? asset.width * zoom : 'auto',
                  height: asset.height ? asset.height * zoom : 'auto',
                  opacity: finalOpacity,
                  transform: `
                    rotate(${asset.rotation || 0}deg)
                    scaleX(${asset.scale_x || 1.0})
                    scaleY(${asset.scale_y || 1.0})
                  `,
                  zIndex: asset.layer_number
                }}
                onMouseDown={(e) => handleAssetMouseDown(e, asset)}
              >
                {(asset.asset?.asset_type === 'image' || asset.asset?.media_type === 'image' || asset.asset?.type === 'image') ? (
                  <img
                    src={asset.asset?.s3_url_processed || asset.asset?.s3_url_raw || asset.asset?.url}
                    alt={asset.asset?.name}
                    className="max-w-none"
                    style={{
                      width: asset.width ? asset.width * zoom : 'auto',
                      height: asset.height ? asset.height * zoom : 'auto'
                    }}
                    draggable={false}
                  />
                ) : (
                  <div
                    className="bg-gray-700 flex items-center justify-center text-white text-4xl"
                    style={{
                      width: (asset.width || 200) * zoom,
                      height: (asset.height || 200) * zoom
                    }}
                  >
                    {(asset.asset?.asset_type === 'video' || asset.asset?.media_type === 'video' || asset.asset?.type === 'video') ? '🎥' : 
                     (asset.asset?.asset_type === 'audio' || asset.asset?.media_type === 'audio' || asset.asset?.type === 'audio') ? '🎵' : '📄'}
                  </div>
                )}

                {/* Transform Handles (only for selected asset) */}
                {isSelected && (
                  <>
                    {/* Corner Resize Handles */}
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white cursor-nw-resize" />
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white cursor-ne-resize" />
                    <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white cursor-sw-resize" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white cursor-se-resize" />
                  </>
                )}
              </div>
            );
          })}

          {/* Empty State - Show when no assets */}
          {(!allAssets || allAssets.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="text-center bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-12 border-2 border-dashed border-gray-600 shadow-2xl">
                <div className="text-8xl mb-6 animate-pulse">🎨</div>
                <div className="text-2xl font-bold mb-4 text-white">Empty Canvas</div>
                <div className="text-base mb-3 text-gray-300 max-w-md">
                  <span className="inline-block px-3 py-1 bg-blue-600 rounded-full text-sm mb-3">✨ Getting Started</span>
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <div>1️⃣ Browse assets in the right panel</div>
                  <div>2️⃣ Drag them to the layer timeline below</div>
                  <div>3️⃣ Adjust position and properties</div>
                </div>
                <div className="mt-6 text-xs text-gray-500">
                  💡 Tip: Click layers to select, drag to reposition
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transform Controls */}
      {selectedAsset && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <label className="text-gray-400 block mb-1">X</label>
              <input
                type="number"
                value={selectedAsset.position_x || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { position_x: parseInt(e.target.value) })}
                className="w-full bg-gray-700 text-white px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Y</label>
              <input
                type="number"
                value={selectedAsset.position_y || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { position_y: parseInt(e.target.value) })}
                className="w-full bg-gray-700 text-white px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">W</label>
              <input
                type="number"
                value={selectedAsset.width || ''}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { width: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Auto"
                className="w-full bg-gray-700 text-white px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">H</label>
              <input
                type="number"
                value={selectedAsset.height || ''}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { height: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Auto"
                className="w-full bg-gray-700 text-white px-2 py-1 rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewCanvas;

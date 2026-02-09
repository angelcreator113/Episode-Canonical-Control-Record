import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LayerStudioHybrid = ({ episodeId }) => {
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);

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

  useEffect(() => {
    loadLayers();
    loadEpisodeAssets();
  }, [episodeId]);

  const loadLayers = async () => {
    try {
      const response = await axios.get(`/api/v1/layers?episode_id=${episodeId}&include_assets=true`);
      const layersData = response.data.data || [];
      
      const uniqueLayers = layersData.reduce((acc, layer) => {
        if (!acc.find(l => l.layer_number === layer.layer_number)) {
          acc.push(layer);
        }
        return acc;
      }, []);
      
      setLayers(uniqueLayers);
      console.log('✅ Loaded layers with assets:', uniqueLayers);
    } catch (error) {
      console.error('❌ Failed to load layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeAssets = async () => {
    try {
      const response = await axios.get(`/api/v1/episodes/${episodeId}/assets`);
      setEpisodeAssets(response.data.data || []);
      console.log('✅ Episode assets loaded:', response.data.data);
    } catch (error) {
      console.error('❌ Failed to load assets:', error);
    }
  };

  const initializeLayers = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/layers/bulk-create', {
        episode_id: episodeId
      });
      setLayers(response.data.data || []);
    } catch (error) {
      console.error('Failed to initialize layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetDrop = async (layerId, asset, position = null) => {
    try {
      console.log('📥 Dropping asset:', asset.name, 'on layer:', layerId);
      
      // Calculate reasonable size based on asset dimensions
      const maxSize = 500; // Max dimension
      let width = asset.width || 400;
      let height = asset.height || 400;
      
      // Scale down if too large while maintaining aspect ratio
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: position?.x || 100,
        position_y: position?.y || 100,
        width: width,
        height: height,
        opacity: 1.0,
        scale_x: 1.0,
        scale_y: 1.0
      });
      console.log('✅ Asset added to layer');
      await loadLayers();
    } catch (error) {
      console.error('❌ Failed to add asset:', error);
    }
  };

  const handleLayerUpdate = async (layerId, updates) => {
    try {
      await axios.put(`/api/v1/layers/${layerId}`, updates);
      loadLayers();
    } catch (error) {
      console.error('Failed to update layer:', error);
    }
  };

  const handleAssetUpdate = async (assetId, updates) => {
    try {
      await axios.put(`/api/v1/layers/assets/${assetId}`, updates);
      loadLayers();
    } catch (error) {
      console.error('Failed to update asset:', error);
    }
  };

  const handleAssetRemove = async (assetId) => {
    try {
      await axios.delete(`/api/v1/layers/assets/${assetId}`);
      setSelectedAsset(null);
      loadLayers();
    } catch (error) {
      console.error('Failed to remove asset:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading Layer Studio...</p>
        </div>
      </div>
    );
  }

  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-12 text-center max-w-md border border-gray-700">
          <div className="text-7xl mb-6">🎬</div>
          <h2 className="text-2xl font-bold text-white mb-3">Initialize Layer Studio</h2>
          <p className="text-gray-400 mb-8">
            Set up the 5-layer composition system
          </p>
          <button
            onClick={initializeLayers}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 transition text-lg font-semibold shadow-lg"
          >
            🚀 Initialize 5 Layers
          </button>
        </div>
      </div>
    );
  }

  const sortedLayers = [...layers].sort((a, b) => b.layer_number - a.layer_number);
  
  const allAssets = sortedLayers
    .flatMap(layer => 
      (layer.assets || []).map(asset => ({
        ...asset,
        layer_number: layer.layer_number,
        layer_visible: layer.is_visible,
        layer_opacity: layer.opacity
      }))
    );

  console.log('🎨 Rendering canvas with assets:', allAssets);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white drop-shadow-md">🎬 Layer Studio Hybrid</h2>
          <div className="text-sm text-white font-medium drop-shadow">Professional Composition System</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black bg-opacity-30 rounded-lg px-4 py-2 shadow-md border border-white border-opacity-20">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-white hover:text-yellow-300 transition font-bold text-2xl leading-none px-2"
              title="Zoom Out"
            >−</button>
            <span className="text-white text-base font-bold font-mono w-14 text-center drop-shadow">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(2, canvasZoom + 0.25))}
              className="text-white hover:text-yellow-300 transition font-bold text-xl leading-none px-2"
              title="Zoom In"
            >+</button>
          </div>
          <button
            onClick={loadLayers}
            className="px-4 py-2 bg-black bg-opacity-30 text-white font-semibold rounded-lg hover:bg-opacity-50 transition shadow-md border border-white border-opacity-20"
            title="Refresh Layers"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Vertical Layers (20%) */}
        <div className="w-1/5 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <VerticalLayerList
            layers={sortedLayers}
            selectedLayer={selectedLayer}
            selectedAsset={selectedAsset}
            onLayerSelect={setSelectedLayer}
            onAssetSelect={setSelectedAsset}
            onAssetDrop={handleAssetDrop}
            onLayerUpdate={handleLayerUpdate}
            config={LAYER_CONFIG}
            colors={COLORS}
          />
        </div>

        {/* CENTER: Big Canvas (60%) */}
        <div className="w-3/5 bg-gray-900 flex flex-col">
          <BigCanvas
            allAssets={allAssets}
            zoom={canvasZoom}
            selectedAsset={selectedAsset}
            onAssetSelect={setSelectedAsset}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
            layers={sortedLayers}
          />
        </div>

        {/* RIGHT: Assets + Properties (20%) */}
        <div className="w-1/5 bg-gray-800 border-l border-gray-700 flex flex-col">
          <RightPanel
            episodeAssets={episodeAssets}
            selectedLayer={selectedLayer}
            selectedAsset={selectedAsset}
            onLayerUpdate={handleLayerUpdate}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
          />
        </div>
      </div>
    </div>
  );
};

// LEFT PANEL: Vertical Layer List
const VerticalLayerList = ({ layers, selectedLayer, selectedAsset, onLayerSelect, onAssetSelect, onAssetDrop, onLayerUpdate, config, colors }) => {
  const [dragOverLayer, setDragOverLayer] = useState(null);

  const handleDragOver = (e, layerId) => {
    e.preventDefault();
    setDragOverLayer(layerId);
  };

  const handleDrop = (e, layerId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverLayer(null);
    
    const assetData = e.dataTransfer.getData('asset');
    if (assetData) {
      const asset = JSON.parse(assetData);
      console.log('📥 Asset dropped on layer:', layerId, asset);
      onAssetDrop(layerId, asset);
    }
  };

  return (
    <div className="p-3">
      <h3 className="text-white font-semibold mb-3 text-sm">LAYERS</h3>
      <div className="space-y-2">
        {layers.map(layer => {
          const cfg = config[layer.layer_number];
          const clr = colors[cfg.color];
          const isSelected = selectedLayer?.id === layer.id;
          const isDragOver = dragOverLayer === layer.id;

          return (
            <div
              key={layer.id}
              className={`
                rounded-lg border-2 cursor-pointer transition-all
                ${isSelected ? 'ring-2 ring-blue-500' : ''}
                ${isDragOver ? 'border-blue-400 shadow-lg' : clr.border}
                ${layer.is_visible ? '' : 'opacity-50'}
              `}
              onClick={() => onLayerSelect(layer)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={() => setDragOverLayer(null)}
              onDrop={(e) => handleDrop(e, layer.id)}
            >
              <div className={`${clr.bg} px-2 py-2 rounded-t-lg`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cfg.icon}</span>
                    <div>
                      <div className="text-white text-xs font-bold">Layer {layer.layer_number}</div>
                      <div className={`${clr.text} text-xs`}>{cfg.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onLayerUpdate(layer.id, { is_visible: !layer.is_visible }); 
                    }}
                    className="text-white hover:text-blue-300 transition text-lg"
                    title={layer.is_visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.is_visible ? '👁️' : '🚫'}
                  </button>
                </div>
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
                    className="flex-1 h-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-white font-mono w-10 text-right">
                    {Math.round((layer.opacity || 1.0) * 100)}%
                  </span>
                </div>
              </div>
              <div className="bg-gray-900 p-2 rounded-b-lg">
                {layer.assets && layer.assets.length > 0 ? (
                  <div className="space-y-1">
                    {layer.assets.map(asset => (
                      <div
                        key={asset.id}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onAssetSelect(asset); 
                        }}
                        className={`
                          flex items-center gap-2 p-1 rounded cursor-pointer text-xs transition
                          ${selectedAsset?.id === asset.id 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }
                        `}
                      >
                        {asset.asset?.asset_type?.startsWith('image') || asset.asset?.media_type?.startsWith('image') ? (
                          <img 
                            src={asset.asset.s3_url_processed || asset.asset.s3_url_raw} 
                            alt={asset.asset.name}
                            className="w-6 h-6 object-cover rounded border border-gray-600" 
                          />
                        ) : (
                          <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-xs border border-gray-600">
                            {asset.asset?.asset_type?.startsWith('video') || asset.asset?.media_type?.startsWith('video') ? '🎥' : '🎵'}
                          </div>
                        )}
                        <span className="truncate flex-1">{asset.asset?.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-500 text-xs">
                    {isDragOver ? (
                      <span className="text-blue-400 font-semibold animate-pulse">📥 Drop here</span>
                    ) : (
                      <span>Empty layer</span>
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

// CENTER PANEL: Big Canvas
const BigCanvas = ({ allAssets, zoom, selectedAsset, onAssetSelect, onAssetUpdate, onAssetDrop, layers }) => {
  const canvasRef = React.useRef(null);
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
      
      const mainLayer = layers.find(l => l.layer_number === 2);
      if (mainLayer) {
        console.log('📥 Dropping on canvas at:', x, y);
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
    <div className="flex-1 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex justify-between items-center">
        <div className="text-sm text-gray-300">
          Canvas • {CANVAS_WIDTH} × {CANVAS_HEIGHT} • {allAssets.length} asset{allAssets.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`text-sm px-3 py-1 rounded transition ${
            showGrid 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {showGrid ? '🔲' : '□'} Grid
        </button>
      </div>

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
            height: CANVAS_HEIGHT * zoom
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
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${100 * zoom}px ${100 * zoom}px`
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
                  absolute cursor-move transition-shadow
                  ${isSelected ? 'ring-4 ring-blue-500 shadow-2xl' : 'hover:ring-2 hover:ring-blue-300'}
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
                  zIndex: asset.layer_number
                }}
                onMouseDown={(e) => handleAssetMouseDown(e, asset)}
              >
                {asset.asset?.asset_type?.startsWith('image') || asset.asset?.media_type?.startsWith('image') ? (
                  <img
                    src={asset.asset.s3_url_processed || asset.asset.s3_url_raw}
                    alt={asset.asset.name}
                    draggable={false}
                    className="select-none"
                    style={{
                      width: (asset.width || 400) * zoom,
                      height: (asset.height || 400) * zoom,
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div
                    className="bg-gray-700 flex items-center justify-center text-white text-4xl rounded-lg shadow-lg"
                    style={{
                      width: (asset.width || 200) * zoom,
                      height: (asset.height || 200) * zoom
                    }}
                  >
                    {asset.asset?.asset_type?.startsWith('video') || asset.asset?.media_type?.startsWith('video') ? '🎥' : '🎵'}
                  </div>
                )}

                {/* Transform Handles */}
                {isSelected && (
                  <>
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                    <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                  </>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {allAssets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-7xl mb-4">🎨</div>
                <div className="text-xl font-semibold mb-2">Empty Canvas</div>
                <div className="text-sm">Drag assets from the right panel to start</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedAsset && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 grid grid-cols-4 gap-2 text-xs">
          <div>
            <label className="text-gray-400">X</label>
            <input
              type="number"
              value={selectedAsset.position_x || 0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { position_x: parseInt(e.target.value) })}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded"
            />
          </div>
          <div>
            <label className="text-gray-400">Y</label>
            <input
              type="number"
              value={selectedAsset.position_y || 0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { position_y: parseInt(e.target.value) })}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded"
            />
          </div>
          <div>
            <label className="text-gray-400">W</label>
            <input
              type="number"
              value={selectedAsset.width || ''}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { width: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Auto"
              className="w-full bg-gray-700 text-white px-2 py-1 rounded"
            />
          </div>
          <div>
            <label className="text-gray-400">H</label>
            <input
              type="number"
              value={selectedAsset.height || ''}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { height: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Auto"
              className="w-full bg-gray-700 text-white px-2 py-1 rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// RIGHT PANEL: Mini Assets + Properties
const RightPanel = ({ episodeAssets, selectedLayer, selectedAsset, onLayerUpdate, onAssetUpdate, onAssetRemove }) => {
  const [filter, setFilter] = useState('all');

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = filter === 'all' 
    ? episodeAssets 
    : episodeAssets.filter(a => a.asset_type?.startsWith(filter) || a.media_type?.startsWith(filter));

  return (
    <div className="flex flex-col h-full">
      {/* Mini Asset Library */}
      <div className="flex-1 border-b border-gray-700 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-xs uppercase tracking-wide">
              Assets ({filteredAssets.length})
            </h3>
          </div>
          
          <div className="flex gap-1 mb-3">
            {[
              { id: 'all', label: 'All', icon: '📁' },
              { id: 'image', label: 'Images', icon: '🖼️' },
              { id: 'video', label: 'Videos', icon: '🎥' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setFilter(type.id)}
                className={`
                  flex-1 px-2 py-1 text-xs rounded transition font-medium
                  ${filter === type.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                <span className="mr-1">{type.icon}</span>
                {type.id === 'all' ? 'All' : ''}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="cursor-move group"
              >
                <div className="bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 hover:shadow-lg transition">
                  <div className="h-20 bg-gray-900 flex items-center justify-center relative overflow-hidden">
                    {asset.asset_type?.startsWith('image') || asset.media_type?.startsWith('image') ? (
                      <img 
                        src={asset.s3_url_processed || asset.s3_url_raw} 
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-3xl">
                        {asset.asset_type?.startsWith('video') || asset.media_type?.startsWith('video') ? '🎥' : '🎵'}
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-gray-700">
                    <div className="text-xs text-white truncate font-medium" title={asset.name}>
                      {asset.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {asset.asset_type || asset.media_type || 'unknown'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📁</div>
              <div className="text-sm">No {filter !== 'all' ? filter : ''} assets</div>
            </div>
          )}
        </div>
      </div>

      {/* Properties Panel */}
      <div className="h-1/2 overflow-y-auto p-3">
        {selectedAsset ? (
          <div>
            <h3 className="text-white font-bold text-xs uppercase tracking-wide mb-3">Properties</h3>
            
            <div className="bg-gray-700 p-3 rounded-lg mb-3">
              <div className="text-xs text-gray-400 mb-1">Asset Name</div>
              <div className="text-sm font-medium text-white break-words">
                {selectedAsset.asset?.name}
              </div>
            </div>

            <div className="space-y-3">
              {/* Opacity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-xs font-medium">Opacity</label>
                  <span className="text-white text-xs font-mono bg-gray-700 px-2 py-1 rounded">
                    {Math.round((selectedAsset.opacity || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedAsset.opacity || 1.0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Rotation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-xs font-medium">Rotation</label>
                  <span className="text-white text-xs font-mono bg-gray-700 px-2 py-1 rounded">
                    {selectedAsset.rotation || 0}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedAsset.rotation || 0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Scale */}
              <div>
                <label className="text-gray-300 text-xs font-medium block mb-2">Scale</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      X: {(parseFloat(selectedAsset.scale_x) || 1.0).toFixed(2)}
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={parseFloat(selectedAsset.scale_x) || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_x: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Y: {(parseFloat(selectedAsset.scale_y) || 1.0).toFixed(2)}
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={parseFloat(selectedAsset.scale_y) || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_y: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => {
                  if (window.confirm('Remove this asset from the layer?')) {
                    onAssetRemove(selectedAsset.id);
                  }
                }}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition font-semibold shadow-lg"
              >
                🗑️ Remove from Layer
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-12">
            <div className="text-5xl mb-3">👆</div>
            <div className="text-sm font-medium">Select an asset</div>
            <div className="text-xs mt-2 text-gray-600">
              Click an asset on the canvas<br />or in a layer to edit properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerStudioHybrid;

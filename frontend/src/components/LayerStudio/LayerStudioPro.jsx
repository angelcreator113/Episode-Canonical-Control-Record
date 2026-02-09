import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LayerStudioPro = ({ episodeId }) => {
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);

  // Accordion state for right panel sections
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    properties: true,
    effects: false,
    voice: false
  });

  const LAYER_CONFIG = {
    5: { name: 'Audio/Music', icon: '🎵', color: 'purple' },
    4: { name: 'Text/Captions', icon: '📝', color: 'blue' },
    3: { name: 'Overlays/Graphics', icon: '🎨', color: 'green' },
    2: { name: 'Main Content', icon: '🎬', color: 'yellow' },
    1: { name: 'Background/B-Roll', icon: '🖼️', color: 'gray' }
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
    } catch (error) {
      console.error('Failed to load layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeAssets = async () => {
    try {
      const response = await axios.get(`/api/v1/episodes/${episodeId}/assets`);
      setEpisodeAssets(response.data.data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
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
      // Calculate reasonable size based on asset dimensions
      const maxSize = 500;
      let width = asset.width || 400;
      let height = asset.height || 400;
      
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
      await loadLayers();
    } catch (error) {
      console.error('Failed to add asset:', error);
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading Layer Studio...</p>
        </div>
      </div>
    );
  }

  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
        <div className="bg-[#1a1a1a] rounded-lg shadow-2xl p-16 text-center max-w-md border border-gray-800">
          <div className="text-6xl mb-6 opacity-20">🎬</div>
          <h2 className="text-lg font-light text-white mb-3">Initialize Layer Studio</h2>
          <p className="text-gray-600 text-sm mb-10">
            Create the 5-layer composition system
          </p>
          <button
            onClick={initializeLayers}
            className="bg-white text-black px-8 py-3 rounded-lg hover:bg-gray-100 transition text-sm font-medium"
          >
            Initialize Layers
          </button>
        </div>
      </div>
    );
  }

  const sortedLayers = [...layers].sort((a, b) => b.layer_number - a.layer_number);
  
  const allAssets = sortedLayers.flatMap(layer => 
    (layer.assets || []).map(asset => ({
      ...asset,
      layer_number: layer.layer_number,
      layer_visible: layer.is_visible,
      layer_opacity: layer.opacity
    }))
  );

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f]">
      {/* MINIMAL HEADER - Nearly invisible */}
      <div className="bg-[#141414] px-6 py-3 flex items-center justify-between border-b border-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-light text-gray-600 tracking-wide uppercase">
            Layer Studio Pro
          </h2>
          <div className="text-xs text-gray-700">
            {allAssets.length} {allAssets.length === 1 ? 'asset' : 'assets'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Minimal Zoom */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] rounded px-3 py-1.5">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-gray-600 hover:text-gray-400 transition text-xs"
            >−</button>
            <span className="text-gray-500 text-xs font-mono w-12 text-center">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(2, canvasZoom + 0.25))}
              className="text-gray-600 hover:text-gray-400 transition text-xs"
            >+</button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT - Canvas is THE STAR */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Minimal Layers (15%) - Recedes */}
        <div className="w-[15%] bg-[#121212] border-r border-[#1a1a1a] overflow-y-auto">
          <MinimalLayerList
            layers={sortedLayers}
            selectedAsset={selectedAsset}
            onAssetSelect={setSelectedAsset}
            onAssetDrop={handleAssetDrop}
            onLayerUpdate={handleLayerUpdate}
            config={LAYER_CONFIG}
          />
        </div>

        {/* CENTER: THE STAR - Canvas with Vignette (70%) */}
        <div className="w-[70%] bg-[#0a0a0a] flex flex-col relative">
          {/* Vignette effect around canvas */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)'
            }}
          />
          <SpotlightCanvas
            allAssets={allAssets}
            zoom={canvasZoom}
            selectedAsset={selectedAsset}
            onAssetSelect={setSelectedAsset}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
            layers={sortedLayers}
          />
        </div>

        {/* RIGHT: Accordion Folders (15%) - CapCut style */}
        <div className="w-[15%] bg-[#121212] border-l border-[#1a1a1a] flex flex-col overflow-hidden">
          <AccordionPanel
            episodeAssets={episodeAssets}
            selectedAsset={selectedAsset}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
          />
        </div>
      </div>
    </div>
  );
};

// MINIMAL LEFT PANEL - Ultra low contrast, recedes
const MinimalLayerList = ({ layers, selectedAsset, onAssetSelect, onAssetDrop, onLayerUpdate, config }) => {
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
      onAssetDrop(layerId, JSON.parse(assetData));
    }
  };

  return (
    <div className="p-3">
      <div className="text-[10px] text-gray-700 uppercase tracking-wider mb-3 font-light px-1">Layers</div>
      <div className="space-y-1.5">
        {layers.map(layer => {
          const cfg = config[layer.layer_number];
          const isDragOver = dragOverLayer === layer.id;

          return (
            <div
              key={layer.id}
              className={`
                rounded transition-all
                ${isDragOver ? 'bg-[#1a1a1a] ring-1 ring-gray-800' : 'bg-[#161616] hover:bg-[#181818]'}
                ${layer.is_visible ? '' : 'opacity-30'}
              `}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={() => setDragOverLayer(null)}
              onDrop={(e) => handleDrop(e, layer.id)}
            >
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs opacity-20">{cfg.icon}</span>
                    <div>
                      <div className="text-[10px] text-gray-600 font-light">L{layer.layer_number}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onLayerUpdate(layer.id, { is_visible: !layer.is_visible })}
                    className="text-gray-700 hover:text-gray-500 transition"
                  >
                    <span className="text-[10px]">{layer.is_visible ? '👁' : '⚫'}</span>
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity || 1.0}
                  onChange={(e) => onLayerUpdate(layer.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full h-px opacity-20 hover:opacity-40 transition"
                  style={{ accentColor: '#333' }}
                />
              </div>

              <div className="px-2 pb-1.5">
                {layer.assets && layer.assets.length > 0 ? (
                  <div className="space-y-0.5">
                    {layer.assets.map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => onAssetSelect(asset)}
                        className={`
                          flex items-center gap-1.5 p-1 rounded cursor-pointer transition
                          ${selectedAsset?.id === asset.id
                            ? 'bg-[#1f1f1f]'
                            : 'hover:bg-[#1a1a1a]'
                          }
                        `}
                      >
                        {(asset.asset?.asset_type?.startsWith('image') || asset.asset?.media_type?.startsWith('image')) && (
                          <img 
                            src={asset.asset.s3_url_processed || asset.asset.s3_url_raw} 
                            className="w-4 h-4 object-cover rounded opacity-40" 
                          />
                        )}
                        <span className="text-[10px] text-gray-700 truncate flex-1 font-light">
                          {asset.asset?.name?.substring(0, 15)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-1 text-[10px] text-gray-800">
                    {isDragOver ? 'Drop' : '—'}
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

// SPOTLIGHT CANVAS - THE STAR with breathing room
const SpotlightCanvas = ({ allAssets, zoom, selectedAsset, onAssetSelect, onAssetUpdate, onAssetDrop, layers }) => {
  const canvasRef = React.useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
      onAssetUpdate(selectedAsset.id, { position_x: newX, position_y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex-1 flex flex-col relative z-10">
      {/* Minimal Canvas Info */}
      <div className="bg-[#0f0f0f] px-4 py-2 flex justify-between items-center border-b border-[#1a1a1a]">
        <div className="text-[10px] text-gray-700 font-light">
          {CANVAS_WIDTH} × {CANVAS_HEIGHT}
        </div>
      </div>

      {/* Canvas with LUXURY SPACING */}
      <div
        className="flex-1 flex items-center justify-center p-16"
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
          {/* Subtle Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: `${100 * zoom}px ${100 * zoom}px`
            }}
          />

          {/* Render Assets */}
          {allAssets.map(asset => {
            if (!asset.layer_visible) return null;

            const isSelected = selectedAsset?.id === asset.id;
            const finalOpacity = (parseFloat(asset.opacity) || 1.0) * (parseFloat(asset.layer_opacity) || 1.0);

            return (
              <div
                key={asset.id}
                className={`absolute cursor-move transition-all ${isSelected ? 'z-50' : ''}`}
                style={{
                  left: (asset.position_x || 0) * zoom,
                  top: (asset.position_y || 0) * zoom,
                  opacity: finalOpacity,
                  transform: `rotate(${asset.rotation || 0}deg) scaleX(${parseFloat(asset.scale_x) || 1.0}) scaleY(${parseFloat(asset.scale_y) || 1.0})`,
                  zIndex: asset.layer_number
                }}
                onMouseDown={(e) => handleAssetMouseDown(e, asset)}
              >
                {(asset.asset?.asset_type?.startsWith('image') || asset.asset?.media_type?.startsWith('image')) && (
                  <img
                    src={asset.asset.s3_url_processed || asset.asset.s3_url_raw}
                    alt={asset.asset.name}
                    draggable={false}
                    className={`select-none ${isSelected ? 'ring-2 ring-white ring-opacity-50' : ''}`}
                    style={{
                      width: (asset.width || 400) * zoom,
                      height: (asset.height || 400) * zoom,
                      objectFit: 'contain'
                    }}
                  />
                )}

                {/* Minimal Transform Handles */}
                {isSelected && (
                  <>
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full opacity-80" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full opacity-80" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rounded-full opacity-80" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full opacity-80" />
                  </>
                )}
              </div>
            );
          })}

          {/* Minimal Empty State */}
          {allAssets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-800">
                <div className="text-5xl mb-3 opacity-20">🎨</div>
                <div className="text-xs font-light">Drag assets to canvas</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Minimal Transform Controls (only when selected) */}
      {selectedAsset && (
        <div className="bg-[#0f0f0f] border-t border-[#1a1a1a] px-4 py-2 grid grid-cols-4 gap-2">
          {['position_x', 'position_y', 'width', 'height'].map((prop, i) => (
            <div key={prop}>
              <label className="text-[9px] text-gray-700 block mb-1 uppercase">
                {['X', 'Y', 'W', 'H'][i]}
              </label>
              <input
                type="number"
                value={selectedAsset[prop] || ''}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { 
                  [prop]: e.target.value ? parseInt(e.target.value) : null 
                })}
                placeholder={prop.includes('position') ? '0' : 'Auto'}
                className="w-full bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded border border-[#222] focus:border-gray-700 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ACCORDION PANEL - CapCut/Premiere Pro style
const AccordionPanel = ({ episodeAssets, selectedAsset, expandedSections, onToggleSection, onAssetUpdate, onAssetRemove }) => {
  const [assetFilter, setAssetFilter] = useState('all');

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = assetFilter === 'all' 
    ? episodeAssets 
    : episodeAssets.filter(a => a.asset_type?.startsWith(assetFilter) || a.media_type?.startsWith(assetFilter));

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ASSETS FOLDER */}
      <AccordionSection
        title="Assets"
        count={filteredAssets.length}
        expanded={expandedSections.assets}
        onToggle={() => onToggleSection('assets')}
      >
        <div className="p-2">
          {/* Filter Tabs */}
          <div className="flex gap-1 mb-2">
            {['all', 'image', 'video'].map(type => (
              <button
                key={type}
                onClick={() => setAssetFilter(type)}
                className={`
                  flex-1 px-2 py-1 text-[10px] rounded transition uppercase
                  ${assetFilter === type 
                    ? 'bg-[#222] text-white' 
                    : 'bg-[#1a1a1a] text-gray-600 hover:bg-[#1c1c1c]'
                  }
                `}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Asset Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="cursor-move group"
              >
                <div className="bg-[#1a1a1a] rounded overflow-hidden border border-[#222] hover:border-gray-700 transition">
                  <div className="h-14 bg-black flex items-center justify-center">
                    {asset.asset_type?.startsWith('image') || asset.media_type?.startsWith('image') ? (
                      <img 
                        src={asset.s3_url_processed || asset.s3_url_raw} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="text-xl opacity-30">🎥</span>
                    )}
                  </div>
                  <div className="p-1 bg-[#1a1a1a]">
                    <div className="text-[9px] text-gray-600 truncate" title={asset.name}>
                      {asset.name}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-6 text-[10px] text-gray-700">
              No {assetFilter !== 'all' ? assetFilter : ''} assets
            </div>
          )}
        </div>
      </AccordionSection>

      {/* PROPERTIES FOLDER */}
      <AccordionSection
        title="Properties"
        expanded={expandedSections.properties}
        onToggle={() => onToggleSection('properties')}
      >
        {selectedAsset ? (
          <div className="p-2 space-y-3">
            <div className="bg-[#1a1a1a] p-2 rounded">
              <div className="text-[9px] text-gray-700 mb-1 uppercase">Asset</div>
              <div className="text-[10px] text-gray-400 break-words">
                {selectedAsset.asset?.name}
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[9px] text-gray-600 uppercase">Opacity</label>
                <span className="text-[9px] text-gray-500 font-mono">
                  {Math.round((parseFloat(selectedAsset.opacity) || 1.0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={parseFloat(selectedAsset.opacity) || 1.0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { opacity: parseFloat(e.target.value) })}
                className="w-full h-1"
                style={{ accentColor: '#666' }}
              />
            </div>

            {/* Rotation */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[9px] text-gray-600 uppercase">Rotation</label>
                <span className="text-[9px] text-gray-500 font-mono">
                  {selectedAsset.rotation || 0}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={selectedAsset.rotation || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                className="w-full h-1"
                style={{ accentColor: '#666' }}
              />
            </div>

            {/* Scale */}
            <div>
              <label className="text-[9px] text-gray-600 uppercase block mb-1">Scale</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[8px] text-gray-700 mb-0.5">
                    X: {(parseFloat(selectedAsset.scale_x) || 1.0).toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedAsset.scale_x) || 1.0}
                    onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_x: parseFloat(e.target.value) })}
                    className="w-full h-1"
                    style={{ accentColor: '#666' }}
                  />
                </div>
                <div>
                  <div className="text-[8px] text-gray-700 mb-0.5">
                    Y: {(parseFloat(selectedAsset.scale_y) || 1.0).toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedAsset.scale_y) || 1.0}
                    onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_y: parseFloat(e.target.value) })}
                    className="w-full h-1"
                    style={{ accentColor: '#666' }}
                  />
                </div>
              </div>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => {
                if (window.confirm('Remove this asset?')) {
                  onAssetRemove(selectedAsset.id);
                }
              }}
              className="w-full bg-red-900 bg-opacity-20 hover:bg-opacity-30 text-red-400 px-3 py-2 rounded transition text-[10px] uppercase"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-700">
            <div className="text-3xl mb-2 opacity-20">👆</div>
            <div className="text-[10px]">Select an asset</div>
          </div>
        )}
      </AccordionSection>

      {/* EFFECTS FOLDER (Coming Soon) */}
      <AccordionSection
        title="Effects"
        expanded={expandedSections.effects}
        onToggle={() => onToggleSection('effects')}
        badge="Soon"
      >
        <div className="p-3 text-center text-gray-700 text-[10px]">
          Coming soon
        </div>
      </AccordionSection>

      {/* VOICE FOLDER (Coming Soon) */}
      <AccordionSection
        title="Voice"
        expanded={expandedSections.voice}
        onToggle={() => onToggleSection('voice')}
        badge="Soon"
      >
        <div className="p-3 text-center text-gray-700 text-[10px]">
          Coming soon
        </div>
      </AccordionSection>

      {/* LUXURY DEAD SPACE */}
      <div className="flex-1 min-h-[100px]" />
    </div>
  );
};

// ACCORDION SECTION COMPONENT - Collapsible folder
const AccordionSection = ({ title, count, expanded, onToggle, children, badge }) => {
  return (
    <div className="border-b border-[#1a1a1a]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#161616] transition text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[9px] text-gray-700">
              ({count})
            </span>
          )}
          {badge && (
            <span className="text-[8px] bg-[#222] text-gray-600 px-1.5 py-0.5 rounded uppercase">
              {badge}
            </span>
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-[#1a1a1a]">
          {children}
        </div>
      )}
    </div>
  );
};

export default LayerStudioPro;

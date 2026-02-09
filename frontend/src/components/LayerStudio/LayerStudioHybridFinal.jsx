import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useKeyboardShortcuts from './useKeyboardShortcuts';
import useSnapToGrid from './useSnapToGrid';
import useHistory from './useHistory';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import HistoryPanel from './HistoryPanel';
import AssetPreviewModal from './AssetPreviewModal';

const LayerStudioHybridFinal = ({ episodeId }) => {
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    assets: true,
    properties: true,
    effects: false,
    voice: false
  });
  const [assetsPanelHighlight, setAssetsPanelHighlight] = useState(false);
  const [collapsedLayers, setCollapsedLayers] = useState({});
  const [showFirstTimeOverlay, setShowFirstTimeOverlay] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all');

  const { snapPosition } = useSnapToGrid(50, snapEnabled);
  
  // History management
  const history = useHistory({ layers, episodeAssets });

  const LAYER_CONFIG = {
    5: { name: 'Audio/Music', icon: '🎵', color: 'purple' },
    4: { name: 'Text/Captions', icon: '📝', color: 'blue' },
    3: { name: 'Assets/Wardrobe', icon: '🎨', color: 'green' },
    2: { name: 'Raw Footage', icon: '🎬', color: 'yellow' },
    1: { name: 'Background', icon: '🖼️', color: 'gray' }
  };

  useEffect(() => {
    loadLayers();
    loadEpisodeAssets();
    
    // Check if first-time overlay should show
    const tourComplete = localStorage.getItem('layerStudioTourComplete');
    if (!tourComplete) {
      setTimeout(() => setShowFirstTimeOverlay(true), 1000);
    }
  }, [episodeId]);

  const handleQuickAdd = (type) => {
    const layerMap = {
      background: 1,
      footage: 2,
      asset: 3
    };
    
    const filterMap = {
      background: 'image',
      footage: 'video',
      asset: 'all'
    };
    
    // Set filter
    setAssetFilter(filterMap[type]);
    
    // Expand and highlight Assets section
    setExpandedSections(prev => ({ ...prev, assets: true }));
    setAssetsPanelHighlight(true);
    setTimeout(() => setAssetsPanelHighlight(false), 1500);
    
    // Select appropriate layer
    const targetLayer = layers.find(l => l.layer_number === layerMap[type]);
    if (targetLayer) {
      setSelectedLayer(targetLayer.id);
    }
  };

  const dismissOverlay = () => {
    setShowFirstTimeOverlay(false);
    localStorage.setItem('layerStudioTourComplete', 'true');
  };

  const toggleLayerCollapse = (layerId) => {
    setCollapsedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

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
      history.pushState({ layers: uniqueLayers, episodeAssets });
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
      const snappedPos = position ? snapPosition(position.x, position.y) : { x: 100, y: 100 };
      
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
        position_x: snappedPos.x,
        position_y: snappedPos.y,
        width: width,
        height: height,
        opacity: 1.0,
        scale_x: 1.0,
        scale_y: 1.0
      });
      
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
      // Apply snap if position is being updated
      if (updates.position_x !== undefined || updates.position_y !== undefined) {
        const asset = layers
          .flatMap(l => l.assets || [])
          .find(a => a.id === assetId);
        
        if (asset && snapEnabled) {
          const snapped = snapPosition(
            updates.position_x ?? asset.position_x,
            updates.position_y ?? asset.position_y
          );
          updates = { ...updates, position_x: snapped.x, position_y: snapped.y };
        }
      }

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

  const handleUndo = () => {
    const previousState = history.undo();
    if (previousState) {
      setLayers(previousState.layers);
      setEpisodeAssets(previousState.episodeAssets);
    }
  };

  const handleRedo = () => {
    const nextState = history.redo();
    if (nextState) {
      setLayers(nextState.layers);
      setEpisodeAssets(nextState.episodeAssets);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Keyboard shortcuts (must be after all handler functions are defined)
  useKeyboardShortcuts({
    layers,
    selectedLayer,
    selectedAsset,
    setSelectedLayer,
    setSelectedAsset,
    onLayerUpdate: handleLayerUpdate,
    onAssetUpdate: handleAssetUpdate,
    onAssetRemove: handleAssetRemove,
    canvasZoom,
    setCanvasZoom
  });

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
      {/* Enhanced Header with Quick Add Buttons */}
      <div className="bg-gradient-to-r from-[#1a1a1a] via-[#1c1c1c] to-[#1a1a1a] px-6 py-4 flex items-center justify-between border-b-2 border-[#2a2a2a] shadow-2xl relative overflow-hidden">
        {/* Subtle animated background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer pointer-events-none"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-br from-[#252525] to-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg">
            <div className="text-2xl filter drop-shadow-lg">🎬</div>
            <div>
              <h2 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-300 tracking-wide">
                Layer Studio
              </h2>
              <div className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Professional Mode</div>
            </div>
          </div>
          
          {/* Quick Add Buttons */}
          <div className="flex items-center gap-2.5 border-l-2 border-[#2a2a2a] pl-6">
            <div className="flex items-center gap-2 px-2 py-1 bg-[#1a1a1a] rounded-md border border-[#252525]">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Quick Add</span>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <button
              onClick={() => handleQuickAdd('background')}
              className="group relative flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#252525] via-[#222] to-[#1e1e1e] hover:from-[#2a2a2a] hover:via-[#282828] hover:to-[#252525] border border-[#2a2a2a] hover:border-blue-500/60 rounded-xl transition-all duration-300 text-xs text-gray-200 font-bold shadow-md hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105"
              title="Add Background - Filters to images"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🖼️</span>
              <span>Background</span>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </button>
            <button
              onClick={() => handleQuickAdd('footage')}
              className="group relative flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#252525] via-[#222] to-[#1e1e1e] hover:from-[#2a2a2a] hover:via-[#282828] hover:to-[#252525] border border-[#2a2a2a] hover:border-purple-500/60 rounded-xl transition-all duration-300 text-xs text-gray-200 font-bold shadow-md hover:shadow-xl hover:shadow-purple-500/20 hover:scale-105"
              title="Add Raw Footage - Filters to videos"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🎬</span>
              <span>Footage</span>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </button>
            <button
              onClick={() => handleQuickAdd('asset')}
              className="group relative flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#252525] via-[#222] to-[#1e1e1e] hover:from-[#2a2a2a] hover:via-[#282828] hover:to-[#252525] border border-[#2a2a2a] hover:border-green-500/60 rounded-xl transition-all duration-300 text-xs text-gray-200 font-bold shadow-md hover:shadow-xl hover:shadow-green-500/20 hover:scale-105"
              title="Add Asset/Wardrobe - Shows all assets"
            >
              <span className="text-base group-hover:scale-110 transition-transform">✨</span>
              <span>Assets</span>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/0 group-hover:from-green-500/10 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          {/* History (Undo/Redo) */}
          <div className="bg-gradient-to-br from-[#252525] to-[#1e1e1e] rounded-xl border border-[#2a2a2a] shadow-lg p-0.5">
            <HistoryPanel
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              historyLength={history.historyLength}
              currentIndex={history.currentIndex}
            />
          </div>

          {/* Snap to Grid Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-4 py-2 rounded-xl text-xs transition-all duration-200 border font-bold shadow-md hover:shadow-lg ${
              snapEnabled 
                ? 'bg-gradient-to-br from-[#2a2a2a] to-[#252525] text-white border-blue-500/40 hover:border-blue-500 shadow-blue-500/20' 
                : 'bg-gradient-to-br from-[#1e1e1e] to-[#1a1a1a] text-gray-400 border-[#2a2a2a] hover:bg-gradient-to-br hover:from-[#252525] hover:to-[#222] hover:text-gray-300'
            }`}
            title="Toggle snap to grid (50px)"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm">{snapEnabled ? '🔲' : '□'}</span>
              <span>Snap</span>
            </span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-gradient-to-br from-[#252525] to-[#1e1e1e] rounded-xl px-3 py-2 border border-[#2a2a2a] shadow-lg">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-all duration-200 text-sm w-7 h-7 rounded-lg flex items-center justify-center font-black hover:scale-110 hover:shadow-md"
            >−</button>
            <div className="px-3 py-1 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              <span className="text-white text-xs font-mono font-bold tracking-wider">
                {Math.round(canvasZoom * 100)}%
              </span>
            </div>
            <button
              onClick={() => setCanvasZoom(Math.min(2, canvasZoom + 0.25))}
              className="text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-all duration-200 text-sm w-7 h-7 rounded-lg flex items-center justify-center font-black hover:scale-110 hover:shadow-md"
            >+</button>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Minimal Layers (20%) */}
        <div className="w-[20%] bg-gradient-to-br from-[#1a1a1a] to-[#161616] border-r border-[#2a2a2a] overflow-y-auto shadow-inner">
          <MinimalLayerList
            layers={sortedLayers}
            selectedAsset={selectedAsset}
            onAssetSelect={setSelectedAsset}
            onAssetDrop={handleAssetDrop}
            onLayerUpdate={handleLayerUpdate}
            config={LAYER_CONFIG}
          />
        </div>

        {/* CENTER: Canvas with Vignette (60%) */}
        <div className="w-[60%] bg-[#0a0a0a] flex flex-col relative">
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
            snapEnabled={snapEnabled}
            handleQuickAdd={handleQuickAdd}
          />
        </div>

        {/* RIGHT: Accordion Folders (20%) */}
        <div className="w-[20%] bg-gradient-to-bl from-[#1a1a1a] to-[#161616] border-l border-[#2a2a2a] flex flex-col overflow-hidden shadow-inner">
          <AccordionPanel
            episodeAssets={episodeAssets}
            selectedAsset={selectedAsset}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
            onPreview={setPreviewAsset}
            highlight={assetsPanelHighlight}
            assetFilter={assetFilter}
            setAssetFilter={setAssetFilter}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts FAB */}
      <KeyboardShortcutsPanel />

      {/* Asset Preview Modal */}
      {previewAsset && (
        <AssetPreviewModal 
          asset={previewAsset} 
          onClose={() => setPreviewAsset(null)} 
        />
      )}
    </div>
  );
};

// Reuse MinimalLayerList from LayerStudioPro
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
      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3 font-semibold px-1">Layers</div>
      <div className="space-y-2 p-2">
        {layers.map(layer => {
          const cfg = config[layer.layer_number];
          const isDragOver = dragOverLayer === layer.id;

          return (
            <div
              key={layer.id}
              className={`
                rounded-lg transition-all border
                ${isDragOver ? 'bg-[#2a2a2a] ring-2 ring-blue-500 border-blue-500' : 'bg-[#1e1e1e] hover:bg-[#252525] border-[#2a2a2a]'}
                ${layer.is_visible ? '' : 'opacity-40'}
                shadow-sm
              `}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={() => setDragOverLayer(null)}
              onDrop={(e) => handleDrop(e, layer.id)}
            >
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl opacity-90 transition-transform hover:scale-125 duration-200">{cfg.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-200 font-semibold">{cfg.name}</div>
                        {layer.assets && layer.assets.length > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        )}
                      </div>
                      {layer.assets && layer.assets.length > 0 && (
                        <div className="text-[9px] text-gray-500 mt-0.5">
                          {layer.assets.length} item{layer.assets.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onLayerUpdate(layer.id, { is_visible: !layer.is_visible })}
                    className="text-gray-400 hover:text-gray-200 transition-all duration-200 p-1.5 hover:bg-[#2a2a2a] rounded-lg hover:scale-110"
                  >
                    <span className="text-base">{layer.is_visible ? '👁' : '⚫'}</span>
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

              <div className="px-3 pb-2">
                {layer.assets && layer.assets.length > 0 ? (
                  <div className="space-y-1">
                    {layer.assets.map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => onAssetSelect(asset)}
                        className={`
                          flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-150
                          ${selectedAsset?.id === asset.id
                            ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/20 border border-blue-700/50 shadow-sm'
                            : 'hover:bg-[#252525] border border-transparent'
                          }
                        `}
                      >
                        {(asset.asset?.asset_type?.startsWith('image') || asset.asset?.media_type?.startsWith('image')) && (
                          <img 
                            src={asset.asset.s3_url_processed || asset.asset.s3_url_raw} 
                            className="w-8 h-8 object-cover rounded border border-[#2a2a2a]" 
                          />
                        )}
                        <span className="text-[10px] text-gray-200 truncate flex-1 font-medium">
                          {asset.asset?.name?.substring(0, 20)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-[10px] text-gray-600">
                    {isDragOver ? '⬇ Drop Here' : ''}
                  </div>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Reuse SpotlightCanvas from LayerStudioPro
const SpotlightCanvas = ({ allAssets, zoom, selectedAsset, onAssetSelect, onAssetUpdate, onAssetDrop, layers, snapEnabled, handleQuickAdd }) => {
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
      <div className="bg-[#0f0f0f] px-4 py-2 flex justify-between items-center border-b border-[#1a1a1a]">
        <div className="text-[10px] text-gray-700 font-light">
          {CANVAS_WIDTH} × {CANVAS_HEIGHT}
        </div>
        {snapEnabled && (
          <div className="text-[10px] text-gray-700">Snap: 50px</div>
        )}
      </div>

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
          {/* Grid - only show when there are assets */}
          {allAssets.length > 0 && (
            <div
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(100,150,255,0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(100,150,255,0.08) 1px, transparent 1px)
                `,
                backgroundSize: `${100 * zoom}px ${100 * zoom}px`
              }}
            />
          )}

          {/* Empty State - Big Action Buttons */}
          {allAssets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-gradient-radial from-[#0a0a0a] to-black">
              <div className="text-center max-w-3xl px-8">
                <div className="mb-4">
                  <div className="text-6xl mb-3 opacity-40">🎨</div>
                  <h3 className="text-white text-4xl font-bold mb-2 bg-gradient-to-r from-gray-200 to-white bg-clip-text text-transparent">Start your scene</h3>
                  <p className="text-gray-500 text-sm">Choose how you want to begin</p>
                </div>
                
                <div className="grid grid-cols-3 gap-8 mb-8">
                  {/* Add Background Button */}
                  <button
                    onClick={() => handleQuickAdd('background')}
                    className="relative bg-gradient-to-br from-[#1e1e1e] via-[#1a1a1a] to-[#161616] hover:from-[#2a2a2a] hover:via-[#252525] hover:to-[#1e1e1e] border-2 border-[#2a2a2a] hover:border-blue-500 rounded-2xl p-10 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:shadow-blue-500/20 group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-transparent transition-all duration-300"></div>
                    <div className="relative">
                      <div className="text-6xl mb-5 group-hover:scale-125 transition-transform duration-300">🖼️</div>
                      <div className="text-white text-xl font-bold mb-2">Background</div>
                      <div className="text-gray-400 text-xs leading-relaxed">Set your scene<br/>foundation</div>
                    </div>
                  </button>
                  
                  {/* Add Raw Footage Button */}
                  <button
                    onClick={() => handleQuickAdd('footage')}
                    className="relative bg-gradient-to-br from-[#1e1e1e] via-[#1a1a1a] to-[#161616] hover:from-[#2a2a2a] hover:via-[#252525] hover:to-[#1e1e1e] border-2 border-[#2a2a2a] hover:border-purple-500 rounded-2xl p-10 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:shadow-purple-500/20 group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-transparent transition-all duration-300"></div>
                    <div className="relative">
                      <div className="text-6xl mb-5 group-hover:scale-125 transition-transform duration-300">🎬</div>
                      <div className="text-white text-xl font-bold mb-2">Raw Footage</div>
                      <div className="text-gray-400 text-xs leading-relaxed">Your main video<br/>content</div>
                    </div>
                  </button>
                  
                  {/* Add Asset/Wardrobe Button */}
                  <button
                    onClick={() => handleQuickAdd('asset')}
                    className="relative bg-gradient-to-br from-[#1e1e1e] via-[#1a1a1a] to-[#161616] hover:from-[#2a2a2a] hover:via-[#252525] hover:to-[#1e1e1e] border-2 border-[#2a2a2a] hover:border-green-500 rounded-2xl p-10 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:shadow-green-500/20 group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/0 group-hover:from-green-500/5 group-hover:to-transparent transition-all duration-300"></div>
                    <div className="relative">
                      <div className="text-6xl mb-5 group-hover:scale-125 transition-transform duration-300">✨</div>
                      <div className="text-white text-xl font-bold mb-2">Assets</div>
                      <div className="text-gray-400 text-xs leading-relaxed">Props, overlays<br/>& graphics</div>
                    </div>
                  </button>
                </div>
                
                <div className="text-gray-600 text-xs flex items-center justify-center gap-2">
                  <span className="text-gray-700">➡️</span>
                  <span>Or drag assets from the right panel directly to the canvas</span>
                </div>
              </div>
            </div>
          )}

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
        </div>
      </div>

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

// Reuse AccordionPanel from LayerStudioPro
const AccordionPanel = ({ episodeAssets, selectedAsset, expandedSections, onToggleSection, onAssetUpdate, onAssetRemove, onPreview, highlight, assetFilter, setAssetFilter }) => {
  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = assetFilter === 'all' 
    ? episodeAssets 
    : episodeAssets.filter(a => a.asset_type?.startsWith(assetFilter) || a.media_type?.startsWith(assetFilter));

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <style>{`
        @keyframes pulse-border {
          0%, 100% { 
            border-color: rgb(59, 130, 246); 
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); 
          }
          50% { 
            border-color: rgb(96, 165, 250); 
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); 
          }
        }
        .pulse-highlight {
          animation: pulse-border 0.5s ease-in-out 3;
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
          background-size: 1000px 100%;
          animation: shimmer 3s infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .float-animation {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
      <AccordionSection
        title={filteredAssets.length === 0 ? "Add to Scene" : "Assets"}
        count={filteredAssets.length}
        expanded={expandedSections.assets}
        onToggle={() => onToggleSection('assets')}
        highlight={highlight}
      >
      >
        <div className="p-3">
          <div className="flex gap-1.5 mb-3">
            {['all', 'image', 'video'].map(type => {
              const count = type === 'all' 
                ? episodeAssets.length 
                : episodeAssets.filter(a => a.asset_type?.startsWith(type) || a.media_type?.startsWith(type)).length;
              return (
                <button
                  key={type}
                  onClick={() => setAssetFilter(type)}
                  className={`
                    flex-1 px-2 py-1.5 text-[10px] rounded-lg transition uppercase font-bold border
                    ${assetFilter === type 
                      ? 'bg-gradient-to-b from-[#2a2a2a] to-[#252525] text-white border-[#3a3a3a] shadow-sm' 
                      : 'bg-[#1e1e1e] text-gray-400 hover:bg-[#252525] border-[#2a2a2a]'
                    }
                  `}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="cursor-move group"
              >
                <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-blue-500 transition-all duration-200 hover:shadow-lg hover:scale-105">
                  <div className="h-36 bg-black flex items-center justify-center relative overflow-hidden">
                    {asset.asset_type?.startsWith('image') || asset.media_type?.startsWith('image') ? (
                      <img 
                        src={asset.s3_url_processed || asset.s3_url_raw} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                      />
                    ) : (
                      <span className="text-2xl opacity-30 group-hover:opacity-50 transition">🎥</span>
                    )}
                  </div>
                  <div className="p-1.5 bg-gradient-to-b from-[#1e1e1e] to-[#1a1a1a]">
                    <div className="text-[9px] text-gray-300 truncate font-medium" title={asset.name}>
                      {asset.name}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-6 text-[10px] text-gray-500">
              No {assetFilter !== 'all' ? assetFilter : ''} assets
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Properties"
        expanded={expandedSections.properties}
        onToggle={() => onToggleSection('properties')}
      >
        {selectedAsset ? (
          <div className="p-3 space-y-4">
            <div className="bg-gradient-to-br from-[#252525] to-[#1e1e1e] p-3 rounded-lg border border-[#2a2a2a] shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🖼️</span>
                <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Asset Name</div>
              </div>
              <div className="text-[11px] text-gray-100 break-words font-medium">
                {selectedAsset.asset?.name}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🔆</span>
                  <label className="text-[10px] text-gray-300 uppercase font-bold tracking-wide">Opacity</label>
                </div>
                <span className="text-[11px] text-white font-mono bg-[#1e1e1e] px-2 py-0.5 rounded-md border border-[#2a2a2a]">
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
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ 
                  accentColor: '#3b82f6',
                  background: `linear-gradient(to right, #3b82f6 ${(parseFloat(selectedAsset.opacity) || 1.0) * 100}%, #2a2a2a ${(parseFloat(selectedAsset.opacity) || 1.0) * 100}%)`
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🔄</span>
                  <label className="text-[10px] text-gray-300 uppercase font-bold tracking-wide">Rotation</label>
                </div>
                <span className="text-[11px] text-white font-mono bg-[#1e1e1e] px-2 py-0.5 rounded-md border border-[#2a2a2a]">
                  {selectedAsset.rotation || 0}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={selectedAsset.rotation || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ 
                  accentColor: '#8b5cf6',
                  background: `linear-gradient(to right, #8b5cf6 ${((selectedAsset.rotation || 0) / 360) * 100}%, #2a2a2a ${((selectedAsset.rotation || 0) / 360) * 100}%)`
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs">🔍</span>
                <label className="text-[10px] text-gray-300 uppercase font-bold tracking-wide">Scale</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-gray-400 mb-1 flex items-center justify-between">
                    <span>Width</span>
                    <span className="text-white bg-[#1e1e1e] px-1.5 py-0.5 rounded font-mono">{(parseFloat(selectedAsset.scale_x) || 1.0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedAsset.scale_x) || 1.0}
                    onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_x: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#10b981' }}
                  />
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 mb-1 flex items-center justify-between">
                    <span>Height</span>
                    <span className="text-white bg-[#1e1e1e] px-1.5 py-0.5 rounded font-mono">{(parseFloat(selectedAsset.scale_y) || 1.0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedAsset.scale_y) || 1.0}
                    onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_y: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#10b981' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Remove this asset?')) {
                  onAssetRemove(selectedAsset.id);
                }
              }}
              className="w-full bg-gradient-to-r from-red-900/30 to-red-800/30 hover:from-red-900/50 hover:to-red-800/50 text-red-400 hover:text-red-300 px-4 py-2.5 rounded-lg transition-all duration-200 text-[11px] uppercase font-bold border border-red-900/50 hover:border-red-700 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg hover:shadow-red-900/30"
            >
              <span>🗑️</span>
              Remove
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center py-8 bg-gradient-to-br from-[#252525] via-[#1e1e1e] to-[#1a1a1a] border-2 border-[#2a2a2a] rounded-xl shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 shimmer"></div>
              <div className="relative">
                <div className="text-5xl mb-4 float-animation">👆</div>
                <div className="text-sm text-white font-bold mb-2 tracking-wide">Select an asset</div>
                <div className="text-[11px] text-gray-400 mb-4">
                  Click on canvas to edit properties
                </div>
                
                <div className="border-t border-[#2a2a2a] pt-4 mt-4">
                  <div className="text-[10px] text-gray-300 font-bold mb-3 flex items-center justify-center gap-2 bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent py-2">
                    <span>💡</span> Quick Tips
                  </div>
                  <div className="space-y-2.5 text-left px-4">
                    <div className="flex items-center gap-3 text-[10px] bg-[#1a1a1a] rounded-lg p-2 border border-[#2a2a2a]">
                      <span className="text-blue-400 font-bold">⌨️</span>
                      <span className="text-gray-200 flex-1">Arrow keys = Move</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] bg-[#1a1a1a] rounded-lg p-2 border border-[#2a2a2a]">
                      <span className="text-purple-400 font-bold">⚡</span>
                      <span className="text-gray-200 flex-1">Shift+Arrows = Move 10x</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] bg-[#1a1a1a] rounded-lg p-2 border border-[#2a2a2a]">
                      <span className="text-red-400 font-bold">🗑️</span>
                      <span className="text-gray-200 flex-1">Delete = Remove</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] bg-[#1a1a1a] rounded-lg p-2 border border-[#2a2a2a]">
                      <span className="text-green-400 font-bold">🔢</span>
                      <span className="text-gray-200 flex-1">1-5 = Select layer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AccordionSection>

      {/* Effects and Voice hidden until implemented */}

      <div className="flex-1 min-h-[100px]" />
    </div>
  );
};

const AccordionSection = ({ title, count, expanded, onToggle, children, badge, highlight }) => {
  return (
    <div className={`border-b border-[#2a2a2a] ${highlight ? 'pulse-highlight' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#1e1e1e] to-[#1a1a1a] hover:from-[#252525] hover:to-[#1e1e1e] transition-all duration-200 group text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs transition-transform duration-200 text-gray-400 ${
            expanded ? 'rotate-90' : ''
          }`}>
            ▶
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-200 group-hover:text-white transition">
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[9px] bg-gradient-to-r from-blue-900/40 to-blue-800/40 text-blue-300 px-2 py-0.5 rounded-full font-bold border border-blue-700/30">
              {count}
            </span>
          )}
          {badge && (
            <span className="text-[9px] bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold border border-yellow-700/30">
              {badge}
            </span>
          )}
        </div>
        <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-gray-600 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
      </button>
      
      {expanded && (
        <div className="border-t border-[#2a2a2a]">
          {children}
        </div>
      )}
    </div>
  );
};

export default LayerStudioHybridFinal;

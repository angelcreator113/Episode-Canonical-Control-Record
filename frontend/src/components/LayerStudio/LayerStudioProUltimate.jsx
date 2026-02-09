import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useKeyboardShortcuts from './useKeyboardShortcuts';
import useSnapToGrid from './useSnapToGrid';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import CanvasPresetSelector from './CanvasPresetSelector';
import Timeline from './Timeline';
import FirstTimeOverlay from './FirstTimeOverlay';
import BigCanvasEnhanced from './BigCanvasEnhanced';
import AssetSizeGuide from './AssetSizeGuide';
import SceneInfoPanel from './SceneInfoPanel';
import { CANVAS_PRESETS } from './CanvasPresets';
import { ASSET_CATEGORIES } from './assetCategories';

const LayerStudioProUltimate = ({ episodeId }) => {
  // ===== STATE =====
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canvasPreset, setCanvasPreset] = useState(CANVAS_PRESETS.youtube);
  const [showFirstTimeOverlay, setShowFirstTimeOverlay] = useState(false);
  const [assetPanelPulse, setAssetPanelPulse] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all');

  const { snapPosition } = useSnapToGrid(50, snapEnabled);

  const LAYER_CONFIG = {
    5: { name: 'Audio/Music', icon: '🎵', color: 'purple' },
    4: { name: 'Text/Captions', icon: '📝', color: 'blue' },
    3: { name: 'Assets/Wardrobe', icon: '🎨', color: 'green' },
    2: { name: 'Raw Footage', icon: '🎬', color: 'yellow' },
    1: { name: 'Background', icon: '🖼️', color: 'gray' }
  };

  const COLORS = {
    purple: { bg: 'bg-purple-900', border: 'border-purple-500', text: 'text-purple-300', hover: 'hover:bg-purple-800' },
    blue: { bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-300', hover: 'hover:bg-blue-800' },
    green: { bg: 'bg-green-900', border: 'border-green-500', text: 'text-green-300', hover: 'hover:bg-green-800' },
    yellow: { bg: 'bg-yellow-900', border: 'border-yellow-500', text: 'text-yellow-300', hover: 'hover:bg-yellow-800' },
    gray: { bg: 'bg-gray-700', border: 'border-gray-500', text: 'text-gray-300', hover: 'hover:bg-gray-600' }
  };

  // ===== LIFECYCLE =====
  useEffect(() => {
    loadLayers();
    loadEpisodeAssets();
    
    const hasSeenTour = localStorage.getItem('layerStudioTourComplete');
    if (!hasSeenTour) {
      setTimeout(() => setShowFirstTimeOverlay(true), 1000);
    }
  }, [episodeId]);

  // ===== DATA LOADING =====
  const loadLayers = async () => {
    try {
      const response = await axios.get(`/api/v1/layers?episode_id=${episodeId}`);
      const layersData = response.data.data || [];
      const uniqueLayers = layersData.reduce((acc, layer) => {
        if (!acc.find(l => l.layer_number === layer.layer_number)) {
          acc.push(layer);
        }
        return acc;
      }, []);
      setLayers(uniqueLayers);
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
      const response = await axios.post('/api/v1/layers/bulk-create', { episode_id: episodeId });
      setLayers(response.data.data || []);
    } catch (error) {
      console.error('Failed to initialize layers:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== QUICK ADD HANDLERS =====
  const handleQuickAdd = (targetLayer, filterType = 'all') => {
    const layer = layers.find(l => l.layer_number === targetLayer);
    if (layer) {
      setSelectedLayer(layer);
      setAssetFilter(filterType);
      
      // Pulse animation
      setAssetPanelPulse(true);
      setTimeout(() => setAssetPanelPulse(false), 1500);
    }
  };

  // ===== ASSET OPERATIONS =====
  const handleAssetDrop = async (layerId, asset, position = null) => {
    try {
      const snappedPos = position ? snapPosition(position.x, position.y) : snapPosition(100, 100);
      await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: snappedPos.x,
        position_y: snappedPos.y,
        width: 400,
        height: 400,
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
      if (updates.position_x !== undefined || updates.position_y !== undefined) {
        const asset = layers.flatMap(l => l.assets || []).find(a => a.id === assetId);
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

  const handleLayerReorder = async (layerId, newLayerNumber) => {
    try {
      await axios.put(`/api/v1/layers/${layerId}`, { layer_number: newLayerNumber });
      loadLayers();
    } catch (error) {
      console.error('Failed to reorder layer:', error);
    }
  };

  // ===== KEYBOARD SHORTCUTS =====
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

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ===== INITIALIZATION STATE =====
  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="bg-slate-800 rounded-lg p-8 text-center max-w-md border border-slate-700">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Initialize Composition</h2>
          <p className="text-gray-400 text-sm mb-6">
            Create a 5-layer timeline for your video
          </p>
          <button
            onClick={initializeLayers}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium transition w-full"
          >
            Create Layers
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
    <div className="h-screen flex flex-col bg-slate-900">
      {/* ===== HEADER ===== */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-2xl flex-shrink-0">🎬</span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-200 truncate">Composition Editor</h2>
            <p className="text-xs text-gray-400 truncate">{canvasPreset.name} • {canvasPreset.width}×{canvasPreset.height}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Canvas Preset Selector */}
          <CanvasPresetSelector currentPreset={canvasPreset} onPresetChange={setCanvasPreset} />

          {/* Snap Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2 py-2 text-xs rounded transition font-medium ${
              snapEnabled ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-400'
            }`}
            title="Snap to grid"
          >
            Snap
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2 py-2 text-xs rounded transition font-medium ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-400'
            }`}
            title="Toggle grid"
          >
            Grid
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-700 rounded px-2 py-2">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-gray-400 hover:text-white transition text-sm px-1"
            >−</button>
            <span className="text-gray-300 text-xs w-10 text-center font-mono">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
              className="text-gray-400 hover:text-white transition text-sm px-1"
            >+</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN 3-PANEL LAYOUT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Vertical Layers (20%) */}
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

          {/* CENTER: Big Canvas (60%) */}
          <BigCanvasEnhanced
            allAssets={allAssets}
            zoom={canvasZoom}
            selectedAsset={selectedAsset}
            showGrid={showGrid}
            snapEnabled={snapEnabled}
            canvasWidth={canvasPreset.width}
            canvasHeight={canvasPreset.height}
            presetName={canvasPreset.name}
            presetIcon={canvasPreset.icon}
            onAssetSelect={setSelectedAsset}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
            layers={sortedLayers}
          />

          {/* RIGHT: Assets + Properties (20%) */}
          <RightPanel
            episodeAssets={episodeAssets}
            selectedAsset={selectedAsset}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
            assetPanelPulse={assetPanelPulse}
            assetFilter={assetFilter}
            setAssetFilter={setAssetFilter}
            episodeId={episodeId}
            currentComposition={selectedAsset?.composition_id}
            canvasPreset={canvasPreset}
          />
        </div>

        {/* BOTTOM: Timeline */}
        <Timeline
          layers={sortedLayers}
          selectedLayer={selectedLayer}
          onLayerSelect={setSelectedLayer}
          onLayerReorder={handleLayerReorder}
          config={LAYER_CONFIG}
          colors={COLORS}
        />
      </div>

      {/* ===== OVERLAYS ===== */}
      {showFirstTimeOverlay && (
        <FirstTimeOverlay onClose={() => {
          setShowFirstTimeOverlay(false);
          localStorage.setItem('layerStudioTourComplete', 'true');
        }} />
      )}

      <KeyboardShortcutsPanel />
    </div>
  );
};

// ===== VERTICAL LAYER LIST COMPONENT =====
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
      onAssetDrop(layerId, asset);
    }
  };

  return (
    <div className="w-1/5 bg-slate-800 border-r border-slate-700 overflow-y-auto">
      <div className="p-2">
        <h3 className="text-gray-300 font-semibold text-xs mb-3 px-2 pt-1">TRACKS</h3>
        <div className="space-y-1">
          {layers.map(layer => {
            const cfg = config[layer.layer_number];
            const isSelected = selectedLayer?.id === layer.id;
            const isDragOver = dragOverLayer === layer.id;

            return (
              <div
                key={layer.id}
                className={`
                  rounded border cursor-pointer transition-all
                  ${isSelected ? 'border-blue-500 bg-slate-700' : 'border-slate-600 bg-slate-750'}
                  ${isDragOver ? 'border-blue-400 bg-blue-900 bg-opacity-20' : ''}
                  ${layer.is_visible ? '' : 'opacity-50'}
                `}
                onClick={() => onLayerSelect(layer)}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDragLeave={() => setDragOverLayer(null)}
                onDrop={(e) => handleDrop(e, layer.id)}
              >
                <div className="px-2 py-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-xs font-semibold truncate">L{layer.layer_number}</div>
                        <div className="text-gray-400 text-xs truncate">{cfg.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onLayerUpdate(layer.id, { is_visible: !layer.is_visible }); 
                      }}
                      className="text-gray-400 hover:text-white transition text-sm flex-shrink-0"
                      title={layer.is_visible ? 'Hide' : 'Show'}
                    >
                      {layer.is_visible ? '👁️' : '✕'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                      className="flex-1 h-1 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-500 font-mono w-8 text-right flex-shrink-0">
                      {Math.round((layer.opacity || 1.0) * 100)}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-900 px-2 py-1.5 border-t border-slate-700 min-h-[40px]">
                  {layer.assets && layer.assets.length > 0 ? (
                    <div className="space-y-0.5">
                      {layer.assets.map(asset => (
                        <div
                          key={asset.id}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onAssetSelect(asset); 
                          }}
                          className={`
                            flex items-center gap-1.5 p-1.5 rounded text-xs transition cursor-pointer
                            ${selectedAsset?.id === asset.id 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                            }
                          `}
                        >
                          {asset.asset?.type === 'image' ? (
                            <img 
                              src={asset.asset.url} 
                              alt={asset.asset.name}
                              className="w-6 h-6 object-cover rounded border border-slate-600 flex-shrink-0" 
                            />
                          ) : (
                            <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-xs flex-shrink-0 border border-slate-600">
                              {asset.asset?.type === 'video' ? '▶' : '♫'}
                            </div>
                          )}
                          <span className="truncate flex-1 font-medium text-xs">{asset.asset?.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-500 text-xs">
                      {isDragOver ? (
                        <span className="text-blue-400">Drop</span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== RIGHT PANEL COMPONENT =====
const RightPanel = ({ episodeAssets, selectedAsset, onAssetUpdate, onAssetRemove, assetPanelPulse, assetFilter, setAssetFilter, episodeId, currentComposition, canvasPreset }) => {
  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = assetFilter === 'all' 
    ? episodeAssets 
    : episodeAssets.filter(a => a.type === assetFilter);

  return (
    <div className="w-1/5 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
      {/* Utility Panels Section */}
      <div className="flex-shrink-0 border-b border-slate-700 overflow-y-auto max-h-64 space-y-1 p-1.5">
        <SceneInfoPanel episodeId={episodeId} currentComposition={currentComposition} />
        <AssetSizeGuide currentPreset={canvasPreset} />
      </div>

      {/* Asset Library */}
      <div className={`flex-1 border-b border-slate-700 overflow-y-auto`}>
        <div className="p-2">
          <h3 className="text-gray-300 font-semibold text-xs px-2 py-1 mb-2">MEDIA ({filteredAssets.length})</h3>
          
          <div className="flex gap-0.5 mb-2 px-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'image', label: 'Images' },
              { id: 'video', label: 'Video' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setAssetFilter(type.id)}
                className={`
                  flex-1 px-1.5 py-1 text-xs rounded transition
                  ${assetFilter === type.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                  }
                `}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1 px-1">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="cursor-move group"
              >
                <div className="bg-slate-700 rounded border border-slate-600 hover:border-blue-500 overflow-hidden transition">
                  <div className="h-16 bg-slate-900 flex items-center justify-center relative overflow-hidden">
                    {asset.type === 'image' ? (
                      <img 
                        src={asset.url} 
                        alt={asset.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition"
                      />
                    ) : (
                      <div className="text-2xl">{asset.type === 'video' ? '▶' : '♫'}</div>
                    )}
                  </div>
                  <div className="p-1.5 bg-slate-700">
                    <div className="text-xs text-gray-300 truncate font-medium" title={asset.name}>
                      {asset.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 uppercase font-mono">
                      {asset.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">📁</div>
              <div className="text-xs">No {assetFilter !== 'all' ? assetFilter : ''} files</div>
            </div>
          )}
        </div>
      </div>

      {/* Properties */}
      <div className="h-1/2 overflow-y-auto p-2 border-t border-slate-700">
        {selectedAsset ? (
          <div>
            <h3 className="text-gray-300 font-semibold text-xs mb-2 px-1">INSPECTOR</h3>
            
            <div className="bg-slate-700 p-1.5 rounded mb-2">
              <div className="text-xs text-gray-500 mb-1">Asset</div>
              <div className="text-xs font-medium text-gray-200 truncate">
                {selectedAsset.asset?.name}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Opacity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 font-semibold">Opacity</label>
                  <span className="text-gray-300 font-mono text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                    {Math.round((selectedAsset.opacity || 1.0) * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedAsset.opacity || 1.0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full h-1 rounded"
                />
              </div>

              {/* Rotation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 font-semibold">Rotation</label>
                  <span className="text-gray-300 font-mono text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                    {selectedAsset.rotation || 0}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedAsset.rotation || 0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                  className="w-full h-1 rounded"
                />
              </div>

              {/* Scale */}
              <div>
                <label className="text-gray-400 font-semibold block mb-1">Scale</label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">X: {(selectedAsset.scale_x || 1.0).toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={selectedAsset.scale_x || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_x: parseFloat(e.target.value) })}
                      className="w-full h-1 rounded"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Y: {(selectedAsset.scale_y || 1.0).toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={selectedAsset.scale_y || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_y: parseFloat(e.target.value) })}
                      className="w-full h-1 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => {
                  if (window.confirm('Remove asset?')) {
                    onAssetRemove(selectedAsset.id);
                  }
                }}
                className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1.5 rounded text-xs font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-xs mt-8">
            <div className="text-2xl mb-2">👈</div>
            <div>Select an asset</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== ANIMATION STYLES =====
const style = document.createElement('style');
style.textContent = `
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
  .animate-pulse-border {
    animation: pulse-border 1.5s ease-in-out 3;
  }
`;
document.head.appendChild(style);

export default LayerStudioProUltimate;

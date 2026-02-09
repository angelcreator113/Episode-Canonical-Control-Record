import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useKeyboardShortcuts from './useKeyboardShortcuts';
import useSnapToGrid from './useSnapToGrid';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import QuickStartGuide from './QuickStartGuide';
import CanvasPresetSelector from './CanvasPresetSelector';
import FirstTimeOverlay from './FirstTimeOverlay';
import BigCanvasEnhanced from './BigCanvasEnhanced';
import SceneSelector from './SceneSelector';
import ClipTimeline from './ClipTimeline';
import SceneInfoPanel from './SceneInfoPanel';
import AssetSizeGuide from './AssetSizeGuide';
import { CANVAS_PRESETS } from './canvasPresets';
import decisionLogger from '../../utils/decisionLogger';

const LayerStudioProUltimateV2 = ({ episodeId }) => {
  // ===== STATE =====
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canvasPreset, setCanvasPreset] = useState(CANVAS_PRESETS.youtube);
  const [showFirstTimeOverlay, setShowFirstTimeOverlay] = useState(false);
  const [assetPanelPulse, setAssetPanelPulse] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all');
  const [sceneInfoExpanded, setSceneInfoExpanded] = useState(false);
  const [canvasControlsExpanded, setCanvasControlsExpanded] = useState(false);
  const [canvasSpecsExpanded, setCanvasSpecsExpanded] = useState(false);

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
    // Set decision logger context
    decisionLogger.setContext(episodeId, currentScene?.id);
    
    loadLayers();
    loadEpisodeAssets();
    
    const hasSeenTour = localStorage.getItem('layerStudioTourComplete');
    if (!hasSeenTour) {
      setTimeout(() => setShowFirstTimeOverlay(true), 1000);
    }
  }, [episodeId, currentScene?.id]);

  // ===== DATA LOADING =====
  const loadLayers = async () => {
    try {
      const params = new URLSearchParams({ episode_id: episodeId });
      if (currentScene?.id) params.append('scene_id', currentScene.id);
      
      const response = await axios.get(`/api/v1/layers?${params}`);
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
      const response = await axios.post('/api/v1/layers/bulk-create', { 
        episode_id: episodeId,
        scene_id: currentScene?.id 
      });
      setLayers(response.data.data || []);
      
      // Log layer creation
      response.data.data?.forEach(layer => {
        decisionLogger.logLayerCreated(layer.id, layer.layer_number, LAYER_CONFIG[layer.layer_number].name);
      });
    } catch (error) {
      console.error('Failed to initialize layers:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== SCENE HANDLERS =====
  const handleSceneChange = (scene) => {
    setCurrentScene(scene);
    decisionLogger.setContext(episodeId, scene.id);
    loadLayers();
  };

  const handleSceneCreate = (scene) => {
    decisionLogger.logSceneCreated(scene.id, scene.name, scene.scene_number);
  };

  // ===== QUICK ADD HANDLERS =====
  const handleQuickAdd = (targetLayer, filterType = 'all') => {
    const layer = layers.find(l => l.layer_number === targetLayer);
    if (layer) {
      setSelectedLayer(layer);
      setAssetFilter(filterType);
      setAssetPanelPulse(true);
      setTimeout(() => setAssetPanelPulse(false), 1500);
    }
  };

  // ===== ASSET OPERATIONS =====
  const handleAssetDrop = async (layerId, asset, position = null) => {
    try {
      const snappedPos = position ? snapPosition(position.x, position.y) : snapPosition(100, 100);
      const layer = layers.find(l => l.id === layerId);
      
      const response = await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: snappedPos.x,
        position_y: snappedPos.y,
        width: 400,
        height: 400,
        opacity: 1.0,
        scale_x: 1.0,
        scale_y: 1.0,
        in_point_seconds: 0,
        out_point_seconds: currentScene?.duration_seconds || 10
      });

      // Log the decision
      decisionLogger.logAssetPositioned(
        asset.id,
        { x: snappedPos.x, y: snappedPos.y },
        { width: 400, height: 400 },
        layer?.layer_number
      );

      await loadLayers();
    } catch (error) {
      console.error('❌ Failed to add asset:', error);
    }
  };

  const handleAssetUpdate = async (assetId, updates) => {
    try {
      const asset = layers.flatMap(l => l.assets || []).find(a => a.id === assetId);
      
      // Snap position if updating coordinates
      if (updates.position_x !== undefined || updates.position_y !== undefined) {
        if (asset && snapEnabled) {
          const snapped = snapPosition(
            updates.position_x ?? asset.position_x,
            updates.position_y ?? asset.position_y
          );
          updates = { ...updates, position_x: snapped.x, position_y: snapped.y };
        }
      }

      await axios.put(`/api/v1/layers/assets/${assetId}`, updates);

      // Log property changes
      if (asset) {
        Object.entries(updates).forEach(([property, newValue]) => {
          const oldValue = asset[property];
          if (oldValue !== newValue) {
            decisionLogger.logAssetPropertyChanged(assetId, property, oldValue, newValue);
          }
        });

        // Special logging for timing changes
        if (updates.in_point_seconds !== undefined || updates.out_point_seconds !== undefined) {
          decisionLogger.logTimingSet(
            assetId,
            updates.in_point_seconds ?? asset.in_point_seconds,
            updates.out_point_seconds ?? asset.out_point_seconds,
            (updates.out_point_seconds ?? asset.out_point_seconds) - (updates.in_point_seconds ?? asset.in_point_seconds)
          );
        }
      }

      loadLayers();
    } catch (error) {
      console.error('Failed to update asset:', error);
    }
  };

  const handleAssetRemove = async (assetId) => {
    try {
      await axios.delete(`/api/v1/layers/assets/${assetId}`);
      
      // Log removal
      decisionLogger.log('ASSET_REMOVED', 'asset', assetId, {});
      
      setSelectedAsset(null);
      loadLayers();
    } catch (error) {
      console.error('Failed to remove asset:', error);
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
          <p className="text-white font-semibold">Loading Scene Composer...</p>
        </div>
      </div>
    );
  }

  // ===== INITIALIZATION STATE =====
  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="bg-slate-800 rounded-xl shadow-2xl p-12 text-center max-w-md border-2 border-blue-600">
          <div className="text-7xl mb-6 animate-bounce">🎬</div>
          <h2 className="text-3xl font-bold text-white mb-3">Scene Composer</h2>
          <p className="text-gray-300 mb-2">Professional 5-Layer Composition System</p>
          <p className="text-gray-400 text-sm mb-8">
            {currentScene ? `Scene: ${currentScene.name || 'Untitled'}` : 'No scene selected'}
          </p>
          <button
            onClick={initializeLayers}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition text-lg font-semibold shadow-lg transform hover:scale-105"
          >
            🚀 Initialize Layers
          </button>
          <div className="mt-6 text-sm text-gray-400">
            Creates: Background • Raw Footage • Assets/Wardrobe • Text • Audio
          </div>
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
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 border-opacity-40 flex-shrink-0">
        {/* Top Row: Title & Scene Selection */}
        <div className="px-8 py-4 border-b border-slate-700 border-opacity-20">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🎬</span>
              <div>
                <h1 className="text-white text-xl font-black tracking-tight">Scene Composer</h1>
                <p className="text-gray-500 text-xs tracking-wide mt-0.5">Professional Video Editing Suite</p>
              </div>
            </div>

            {/* Scene Selection Block */}
            <div className="flex-1 max-w-md">
              <label className="block text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">Select Scene</label>
              <SceneSelector
                episodeId={episodeId}
                currentSceneId={currentScene?.id}
                onSceneChange={handleSceneChange}
                onCreateScene={handleSceneCreate}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Canvas Preset & Controls */}
        <div className="px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-700 bg-opacity-40 px-3 py-2 rounded-lg">
              <span className="text-xs text-gray-400 font-semibold">Canvas:</span>
              <CanvasPresetSelector currentPreset={canvasPreset} onPresetChange={setCanvasPreset} />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-700 bg-opacity-40 px-3 py-2 rounded-lg text-sm">
              <span className="text-gray-400 font-semibold">{canvasPreset.width}</span>
              <span className="text-gray-600">×</span>
              <span className="text-gray-400 font-semibold">{canvasPreset.height}</span>
            </div>
          </div>

          <button
            onClick={loadLayers}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md"
            title="Refresh"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ===== MAIN 3-PANEL LAYOUT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden bg-slate-950 px-6 py-4 gap-6">
          {/* LEFT: Vertical Layers (Fixed Width) */}
          <div className="w-80 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden shadow-md">
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

          {/* CENTER: Big Canvas (Flex) */}
          <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700 shadow-lg">
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
          </div>

          {/* RIGHT: Assets + Properties (Fixed Width) */}
          <div className="w-80 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden shadow-md flex flex-col">
            <RightPanel
              episodeId={episodeId}
              currentScene={currentScene}
              episodeAssets={episodeAssets}
              selectedAsset={selectedAsset}
              canvasPreset={canvasPreset}
              onAssetUpdate={handleAssetUpdate}
              onAssetRemove={handleAssetRemove}
              assetPanelPulse={assetPanelPulse}
              assetFilter={assetFilter}
              setAssetFilter={setAssetFilter}
              snapEnabled={snapEnabled}
              setSnapEnabled={setSnapEnabled}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              canvasZoom={canvasZoom}
              setCanvasZoom={setCanvasZoom}
              sceneInfoExpanded={sceneInfoExpanded}
              setSceneInfoExpanded={setSceneInfoExpanded}
              canvasControlsExpanded={canvasControlsExpanded}
              setCanvasControlsExpanded={setCanvasControlsExpanded}
              canvasSpecsExpanded={canvasSpecsExpanded}
              setCanvasSpecsExpanded={setCanvasSpecsExpanded}
            />
          </div>
        </div>

        {/* BOTTOM: Clip Timeline */}
        <div className="border-t-2 border-slate-700 flex-shrink-0 mt-6 mx-6 mb-4 rounded-lg shadow-md bg-slate-800 overflow-y-auto" style={{ maxHeight: '180px' }}>
          <ClipTimeline
            layerAssets={allAssets}
            selectedAsset={selectedAsset}
            onAssetSelect={setSelectedAsset}
            onAssetUpdate={handleAssetUpdate}
            sceneDuration={currentScene?.duration_seconds || 60}
          />
        </div>
      </div>

      {/* ===== OVERLAYS ===== */}
      {showFirstTimeOverlay && (
        <FirstTimeOverlay onClose={() => {
          setShowFirstTimeOverlay(false);
          localStorage.setItem('layerStudioTourComplete', 'true');
        }} />
      )}

      <KeyboardShortcutsPanel />
      <QuickStartGuide />
    </div>
  );
};

// ===== VERTICAL LAYER LIST (UNCHANGED) =====
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
    <div className="h-full bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 pb-3 border-b border-slate-700 border-opacity-20">
          <span className="text-lg">📚</span> Layers
        </h3>
        <div className="space-y-2.5">
          {layers.map(layer => {
            const cfg = config[layer.layer_number];
            const clr = colors[cfg.color];
            const isSelected = selectedLayer?.id === layer.id;
            const isDragOver = dragOverLayer === layer.id;

            return (
              <div
                key={layer.id}
                className={`
                  rounded-lg border-l-4 cursor-pointer transition-all duration-200 overflow-hidden
                  ${isSelected ? 'ring-2 ring-blue-400 shadow-lg bg-slate-700 border-blue-400' : 'bg-slate-800 hover:shadow-md'}
                  ${isDragOver ? 'border-blue-400 shadow-lg scale-102 bg-slate-700 bg-opacity-80' : `border-slate-600 ${clr.border}`}
                  ${layer.is_visible ? '' : 'opacity-60'}
                `}
                onClick={() => onLayerSelect(layer)}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDragLeave={() => setDragOverLayer(null)}
                onDrop={(e) => handleDrop(e, layer.id)}
              >
                <div className={`px-4 py-3 group`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                      <div className="min-w-0">
                        <div className="text-white text-sm font-black leading-tight flex items-center gap-1.5">
                          Layer {layer.layer_number}
                          <span className="bg-black bg-opacity-40 px-2 rounded text-xs font-mono text-gray-400">
                            {(layer.assets || []).length}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs truncate font-medium mt-0.5">{cfg.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onLayerUpdate(layer.id, { is_visible: !layer.is_visible }); 
                        }}
                        className="text-gray-400 hover:text-blue-300 transition text-lg opacity-70 hover:opacity-100"
                        title={layer.is_visible ? 'Hide' : 'Show'}
                      >
                        {layer.is_visible ? '👁️' : '🚫'}
                      </button>
                    </div>
                  </div>
                  {/* Opacity slider - show on hover or when selected */}
                  <div className={`flex items-center gap-2 mt-1 transition-all overflow-hidden ${isSelected ? 'max-h-6 opacity-100' : 'max-h-0 opacity-0 group-hover:max-h-6 group-hover:opacity-100'}`}>
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
                      className="flex-1 h-1.5 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                      title="Opacity"
                    />
                    <span className="text-xs text-gray-400 font-mono w-10 text-right font-bold flex-shrink-0">
                      {Math.round((layer.opacity || 1.0) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-900 bg-opacity-40 p-2 rounded-b-lg min-h-[50px] hidden group-hover:block transition-all">
                  {layer.assets && layer.assets.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {layer.assets.map(asset => (
                        <div
                          key={asset.id}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onAssetSelect(asset); 
                          }}
                          className={`
                            flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition transform
                            ${selectedAsset?.id === asset.id 
                              ? 'bg-blue-600 text-white shadow-lg scale-105' 
                              : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:scale-102'
                            }
                          `}
                        >
                          {/* Thumbnail */}
                          <div className="flex-shrink-0">
                            {asset.asset?.url ? (
                              <img 
                                src={asset.asset.url} 
                                alt={asset.asset.name}
                                className="w-6 h-6 object-cover rounded border border-slate-600"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-xs border border-slate-600">
                                {asset.asset?.type === 'video' ? '🎥' : asset.asset?.type === 'image' ? '📷' : '🎵'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-xs">{asset.asset?.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-500 text-xs hidden group-hover:block transition-all">
                      {isDragOver ? (
                        <div className="animate-pulse">
                          <span className="text-blue-400 font-bold text-sm">📥 Drop here!</span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs opacity-60">Empty layer</span>
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

// ===== RIGHT PANEL WITH TIMING CONTROLS =====
const RightPanel = ({ episodeId, currentScene, episodeAssets, selectedAsset, canvasPreset, onAssetUpdate, onAssetRemove, assetPanelPulse, assetFilter, setAssetFilter, snapEnabled, setSnapEnabled, showGrid, setShowGrid, canvasZoom, setCanvasZoom, sceneInfoExpanded, setSceneInfoExpanded, canvasControlsExpanded, setCanvasControlsExpanded, canvasSpecsExpanded, setCanvasSpecsExpanded }) => {
  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = assetFilter === 'all' 
    ? episodeAssets 
    : episodeAssets.filter(a => a.type === assetFilter);

  return (
    <div className="h-full bg-slate-800 flex flex-col overflow-hidden">
      {/* Scene Info Panel - Collapsible */}
      <div className="flex-shrink-0 border-b border-slate-700 border-opacity-20 bg-slate-800 bg-opacity-50">
        <button
          onClick={() => setSceneInfoExpanded(!sceneInfoExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-700 hover:bg-opacity-20 transition"
        >
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">📋</span> Scene Metadata
            </h3>
            <p className="text-xs text-gray-500 mt-1">Name, notes, and recording settings</p>
          </div>
          <span className={`text-gray-500 transition transform ${sceneInfoExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {sceneInfoExpanded && (
          <div className="border-t border-slate-700 border-opacity-20 p-4 space-y-4 bg-slate-900 bg-opacity-30 max-h-60 overflow-y-auto">
            <SceneInfoPanel episodeId={episodeId} currentComposition={currentScene?.id} />
          </div>
        )}
      </div>

      {/* Canvas Size Reference */}
      <div className="flex-shrink-0 border-b border-slate-700 border-opacity-20 bg-slate-800 bg-opacity-30">
        <button
          onClick={() => setCanvasControlsExpanded(!canvasControlsExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-700 hover:bg-opacity-20 transition"
        >
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">📐</span> Canvas Specs
            </h3>
            <p className="text-xs text-gray-500 mt-1">Dimensions and safe zones for {canvasPreset.name}</p>
          </div>
          <span className={`text-gray-500 transition transform ${canvasControlsExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {canvasControlsExpanded && (
          <div className="border-t border-slate-700 border-opacity-20 p-4 bg-slate-900 bg-opacity-30">
            <AssetSizeGuide currentPreset={canvasPreset} />
          </div>
        )}
      </div>

      {/* Asset Library */}
      <div className={`flex-1 border-b border-slate-700 border-opacity-20 overflow-y-auto transition-all`}>
        <div className="p-4">
          <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-lg">📁</span> Assets <span className="ml-auto text-xs bg-slate-700 px-2.5 py-1 rounded-full font-mono text-gray-400">({filteredAssets.length})</span>
          </h3>
          
          <div className="flex gap-2 mb-4">
            {[
              { id: 'all', label: 'All', icon: '📁' },
              { id: 'image', label: 'Img', icon: '🖼️' },
              { id: 'video', label: 'Vid', icon: '🎥' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setAssetFilter(type.id)}
                className={`
                  flex-1 px-3 py-2.5 text-xs rounded-lg transition font-bold
                  ${assetFilter === type.id 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg ring-2 ring-blue-400 ring-opacity-50' 
                    : 'bg-slate-700 bg-opacity-40 text-gray-400 hover:bg-opacity-60'
                  }
                `}
              >
                <span className="mr-1.5">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="cursor-move group"
              >
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden border border-slate-600 hover:border-blue-400 hover:shadow-lg transition-all transform hover:scale-[1.02]">
                  <div className="h-32 bg-slate-900 flex items-center justify-center relative overflow-hidden">
                    {asset.url ? (
                      <>
                        <img 
                          src={asset.url} 
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 hidden peer-[*]:hidden bg-slate-800 flex items-center justify-center text-4xl group-hover:scale-125 transition">
                          {asset.type === 'video' ? '🎥' : '🎵'}
                        </div>
                      </>
                    ) : (
                      <div className="text-5xl group-hover:scale-125 transition">
                        {asset.type === 'video' ? '🎥' : asset.type === 'image' ? '🖼️' : '🎵'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-60 transition" />
                  </div>
                  <div className="p-3 bg-slate-700 bg-opacity-60">
                    <div className="text-sm text-white truncate font-semibold" title={asset.name}>
                      {asset.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5 uppercase font-mono tracking-wide">
                      {asset.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">📁</div>
              <div className="text-sm font-medium">No {assetFilter !== 'all' ? assetFilter : ''} assets</div>
              <div className="text-xs mt-2 text-gray-600">Upload assets in the Assets tab</div>
            </div>
          )}
        </div>
      </div>

      {/* Properties Panel with TIMING CONTROLS */}
      <div className="h-1/2 overflow-y-auto p-4 space-y-4">
        {/* Canvas Controls (collapsible) */}
        <div className="rounded-lg border border-slate-600 border-opacity-20 shadow-md overflow-hidden bg-slate-800 bg-opacity-30">
          <button
            onClick={() => setCanvasControlsExpanded(!canvasControlsExpanded)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-700 hover:bg-opacity-30 transition"
          >
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="text-base">🎨</span> Canvas Controls
            </h3>
            <span className={`text-gray-500 transition transform ${canvasControlsExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {canvasControlsExpanded && (
            <div className="border-t border-slate-600 border-opacity-20 p-4 space-y-3 bg-slate-700 bg-opacity-10">
              {/* Snap Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-xs font-bold tracking-wide">Snap to Grid</label>
                <button
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  className={`px-4 py-2 rounded text-xs font-bold transition ${
                    snapEnabled ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                  }`}
                >
                  {snapEnabled ? '✓ On' : '✗ Off'}
                </button>
              </div>
              
              {/* Grid Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-xs font-bold tracking-wide">Show Grid</label>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    showGrid ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                  }`}
                >
                  {showGrid ? '✓ On' : '✗ Off'}
                </button>
              </div>
              
              {/* Zoom Control */}
              <div>
                <label className="text-gray-300 text-xs font-bold block mb-2 tracking-wide">Zoom: {Math.round(canvasZoom * 100)}%</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-bold transition"
                  >−</button>
                  <div className="flex-1 bg-slate-900 rounded px-2 py-1.5 text-center">
                    <span className="text-white text-xs font-mono font-bold">{Math.round(canvasZoom * 100)}%</span>
                  </div>
                  <button
                    onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-bold transition"
                  >+</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedAsset ? (
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2 pb-3 border-b border-slate-600 border-opacity-30">
              <span className="text-lg">⚙️</span> Properties
            </h3>
            
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-lg mb-4 shadow-md border border-slate-600 border-opacity-40">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Asset Name</div>
              <div className="text-base font-bold text-white break-words">
                {selectedAsset.asset?.name}
              </div>
            </div>

            {/* TIMING SECTION (NEW!) */}
            <div className="bg-slate-900 rounded-lg p-3 mb-4 border-2 border-green-600 shadow-lg">
              <div className="text-xs font-bold text-green-400 mb-3 uppercase tracking-wider">⏱️ Timing</div>
              
              {/* In Point */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 text-xs font-bold">Start Time</label>
                  <span className="text-white text-xs font-mono bg-green-600 px-2 py-1 rounded">
                    {formatTime(selectedAsset.in_point_seconds || 0)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={selectedAsset.in_point_seconds || 0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { in_point_seconds: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded text-sm border border-slate-700"
                />
              </div>

              {/* Out Point */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 text-xs font-bold">End Time</label>
                  <span className="text-white text-xs font-mono bg-green-600 px-2 py-1 rounded">
                    {formatTime(selectedAsset.out_point_seconds || 0)}
                  </span>
                </div>
                <input
                  type="number"
                  min={selectedAsset.in_point_seconds || 0}
                  step="0.1"
                  value={selectedAsset.out_point_seconds || 10}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { out_point_seconds: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded text-sm border border-slate-700"
                />
              </div>

              {/* Duration (calculated) */}
              <div className="bg-slate-800 rounded p-2 border border-slate-700">
                <div className="text-xs text-gray-400">Duration</div>
                <div className="text-lg font-bold text-white font-mono">
                  {formatTime((selectedAsset.out_point_seconds || 10) - (selectedAsset.in_point_seconds || 0))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Opacity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-xs font-bold">Opacity</label>
                  <span className="text-white text-xs font-mono bg-blue-600 px-3 py-1 rounded-full shadow">
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
                  className="w-full h-2 rounded-lg"
                />
              </div>

              {/* Rotation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 text-xs font-bold">Rotation</label>
                  <span className="text-white text-xs font-mono bg-blue-600 px-3 py-1 rounded-full shadow">
                    {selectedAsset.rotation || 0}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedAsset.rotation || 0}
                  onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                  className="w-full h-2 rounded-lg"
                />
              </div>

              {/* Scale */}
              <div>
                <label className="text-gray-300 text-xs font-bold block mb-2">Scale</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-1 font-semibold">
                      X: {(selectedAsset.scale_x || 1.0).toFixed(2)}
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={selectedAsset.scale_x || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_x: parseFloat(e.target.value) })}
                      className="w-full h-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1 font-semibold">
                      Y: {(selectedAsset.scale_y || 1.0).toFixed(2)}
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={selectedAsset.scale_y || 1.0}
                      onChange={(e) => onAssetUpdate(selectedAsset.id, { scale_y: parseFloat(e.target.value) })}
                      className="w-full h-2 rounded-lg"
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
                className="w-full mt-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-3 rounded-lg transition font-bold shadow-xl transform hover:scale-105"
              >
                🗑️ Remove Asset
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6 flex flex-col items-center justify-center h-full">
            <div className="text-5xl mb-3">👆</div>
            <div className="text-sm font-bold mb-1">Select an asset</div>
            <div className="text-xs text-gray-600 mb-6">Click on canvas or in the left panel to edit</div>
            <div className="w-full space-y-3">
              <div className="bg-slate-700 bg-opacity-50 rounded p-3 text-xs text-gray-400 space-y-1">
                <div className="text-gray-300 font-semibold mb-2">💡 Keyboard Shortcuts:</div>
                <div>⌨️ Arrow keys: Move asset (1px)</div>
                <div>⌨️ Shift + Arrow: Move faster (10px)</div>
                <div>⌨️ Delete: Remove asset</div>
                <div>⌨️ Ctrl+D: Duplicate asset</div>
              </div>
              <div className="bg-blue-900 bg-opacity-30 rounded p-2 text-xs text-blue-300 border border-blue-600 border-opacity-30">
                👉 Tip: Drag assets from the 📁 Assets panel to add them to the canvas
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="flex-shrink-0 border-t border-slate-700 border-opacity-20 bg-slate-900 bg-opacity-50 px-4 py-2.5">
        <div className="text-xs text-gray-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {selectedAsset ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Editing: <span className="text-gray-200 font-mono">{selectedAsset.asset?.name || 'Asset'}</span></span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-slate-600"></span>
                <span>Ready</span>
              </>
            )}
          </div>
          <div className="text-gray-500">
            {episodeAssets.length} assets • {layers.length} layers
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== HELPER FUNCTIONS =====
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

export default LayerStudioProUltimateV2;

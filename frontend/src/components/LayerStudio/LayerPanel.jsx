import React, { useState } from 'react';
import LayerRow from './LayerRow';

const LAYER_CONFIG = {
  5: { name: 'Audio/Music', icon: '🎵', color: 'bg-gradient-to-br from-purple-900 to-purple-800', borderColor: 'border-purple-500', textColor: 'text-purple-200', glowColor: 'shadow-purple-500/50' },
  4: { name: 'Text/Captions', icon: '📝', color: 'bg-gradient-to-br from-blue-900 to-blue-800', borderColor: 'border-blue-500', textColor: 'text-blue-200', glowColor: 'shadow-blue-500/50' },
  3: { name: 'Overlays/Graphics', icon: '🎨', color: 'bg-gradient-to-br from-green-900 to-green-800', borderColor: 'border-green-500', textColor: 'text-green-200', glowColor: 'shadow-green-500/50' },
  2: { name: 'Main Content', icon: '🎬', color: 'bg-gradient-to-br from-orange-900 to-orange-800', borderColor: 'border-orange-500', textColor: 'text-orange-200', glowColor: 'shadow-orange-500/50' },
  1: { name: 'Background/B-Roll', icon: '🖼️', color: 'bg-gradient-to-br from-gray-700 to-gray-600', borderColor: 'border-gray-400', textColor: 'text-gray-200', glowColor: 'shadow-gray-500/50' }
};

const LayerPanel = ({
  layers,
  selectedLayer,
  selectedAsset,
  onLayerSelect,
  onAssetSelect,
  onAssetDrop,
  onLayerUpdate
}) => {
  const [compactMode, setCompactMode] = useState(false);
  
  // Deduplicate layers by layer_number
  const uniqueLayers = layers.reduce((acc, layer) => {
    if (!acc.find(l => l.layer_number === layer.layer_number)) {
      acc.push(layer);
    }
    return acc;
  }, []);
  
  // Sort layers by layer_number (descending - top to bottom in UI)
  const sortedLayers = [...uniqueLayers].sort((a, b) => b.layer_number - a.layer_number);

  return (
    <div className="h-full">
      <div className="border-b-2 border-gray-700/50 px-5 py-4 bg-gradient-to-r from-gray-800 to-gray-850">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎬</span>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Layers Timeline</h3>
          </div>
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="px-2.5 py-1 text-[10px] bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-md hover:from-gray-600 hover:to-gray-500 transition-all font-bold shadow-lg"
            title={compactMode ? "Expand layers" : "Compact layers"}
          >
            {compactMode ? '⏸' : '⏹'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 font-medium">
          {sortedLayers.length} active layers • <span className="text-blue-400">Top renders over bottom</span>
        </p>
      </div>

      <div className="p-4 space-y-3">{sortedLayers.map(layer => (
          <LayerRow
            key={layer.id}
            layer={layer}
            config={LAYER_CONFIG[layer.layer_number]}
            isSelected={selectedLayer?.id === layer.id}
            selectedAssetId={selectedAsset?.id}
            onLayerSelect={onLayerSelect}
            onAssetSelect={onAssetSelect}
            onAssetDrop={onAssetDrop}
            onLayerUpdate={onLayerUpdate}
            compactMode={compactMode}
          />
        ))}
      </div>
    </div>
  );
};

export default LayerPanel;

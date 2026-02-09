import React from 'react';

const PropertyPanel = ({
  selectedLayer,
  selectedAsset,
  onLayerUpdate,
  onAssetUpdate,
  onAssetRemove
}) => {
  if (!selectedLayer && !selectedAsset) {
    return (
      <div className="h-full bg-gray-800">
        <div className="border-b border-gray-700 px-4 py-3 bg-gray-800">
          <h3 className="text-sm font-bold text-white">⚙️ PROPERTIES</h3>
          <p className="text-[10px] text-gray-400 mt-1">Select a layer or asset</p>
        </div>
        
        <div className="p-4">
          <div className="text-center text-gray-500 mb-6">
            <div className="text-4xl mb-2">🎨</div>
            <p className="text-xs">No Selection</p>
          </div>
          
          {/* Quick Tips */}
          <div className="space-y-2">
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-2.5">
              <div className="flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-300 text-[10px] mb-0.5">Quick Tip</h4>
                  <p className="text-[9px] leading-relaxed text-blue-200">Click any layer to view and edit its properties like opacity, blend mode, and visibility.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded p-2.5">
              <div className="flex items-start gap-2">
                <span className="text-base">🎬</span>
                <div>
                  <h4 className="font-semibold text-green-300 text-[10px] mb-0.5">Layer 2 - Main</h4>
                  <p className="text-[9px] leading-relaxed text-green-200">Primary video footage goes here. Perfect for talking head shots or main scenes.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded p-2.5">
              <div className="flex items-start gap-2">
                <span className="text-base">🎨</span>
                <div>
                  <h4 className="font-semibold text-purple-300 text-[10px] mb-0.5">Layer 3 - Overlays</h4>
                  <p className="text-[9px] leading-relaxed text-purple-200">Add graphics, logos, and visual effects over your main content.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedAsset) {
    return <AssetProperties asset={selectedAsset} onUpdate={onAssetUpdate} onRemove={onAssetRemove} />;
  }

  return <LayerProperties layer={selectedLayer} onUpdate={onLayerUpdate} />;
};

const LayerProperties = ({ layer, onUpdate }) => {
  const handleChange = (field, value) => {
    onUpdate(layer.id, { [field]: value });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-800">
      <div className="border-b border-gray-700 px-4 py-3 bg-gray-800">
        <h3 className="text-sm font-bold text-white">⚙️ LAYER PROPERTIES</h3>
        <p className="text-[10px] text-gray-400 mt-1">Layer {layer.layer_number}</p>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">
            Layer Name
          </label>
          <input
            type="text"
            value={layer.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={`Layer ${layer.layer_number}`}
            className="w-full px-2 py-1.5 text-xs bg-gray-900 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Opacity */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">
            Opacity: {Math.round((layer.opacity || 1.0) * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.opacity || 1.0}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Blend Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blend Mode
          </label>
          <select
            value={layer.blend_mode || 'normal'}
            onChange={(e) => handleChange('blend_mode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
            <option value="color-dodge">Color Dodge</option>
            <option value="color-burn">Color Burn</option>
            <option value="hard-light">Hard Light</option>
            <option value="soft-light">Soft Light</option>
          </select>
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Visible</label>
          <button
            onClick={() => handleChange('is_visible', !layer.is_visible)}
            className={`
              px-4 py-2 rounded-lg transition
              ${layer.is_visible ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}
            `}
          >
            {layer.is_visible ? '👁️ Visible' : '🚫 Hidden'}
          </button>
        </div>

        {/* Locked */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Locked</label>
          <button
            onClick={() => handleChange('is_locked', !layer.is_locked)}
            className={`
              px-4 py-2 rounded-lg transition
              ${layer.is_locked ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-700'}
            `}
          >
            {layer.is_locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssetProperties = ({ asset, onUpdate, onRemove }) => {
  const handleChange = (field, value) => {
    onUpdate(asset.id, { [field]: value });
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Asset Properties</h3>
      
      <div className="space-y-4">
        {/* Asset Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Asset Name</div>
          <div className="font-medium">{asset.asset?.name}</div>
        </div>

        {/* Position */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              X Position (px)
            </label>
            <input
              type="number"
              value={asset.position_x || 0}
              onChange={(e) => handleChange('position_x', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Y Position (px)
            </label>
            <input
              type="number"
              value={asset.position_y || 0}
              onChange={(e) => handleChange('position_y', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (px)
            </label>
            <input
              type="number"
              value={asset.width || ''}
              onChange={(e) => handleChange('width', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Auto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (px)
            </label>
            <input
              type="number"
              value={asset.height || ''}
              onChange={(e) => handleChange('height', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Auto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rotation: {asset.rotation || 0}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={asset.rotation || 0}
            onChange={(e) => handleChange('rotation', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Scale */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scale X: {(asset.scale_x || 1.0).toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={asset.scale_x || 1.0}
              onChange={(e) => handleChange('scale_x', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scale Y: {(asset.scale_y || 1.0).toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={asset.scale_y || 1.0}
              onChange={(e) => handleChange('scale_y', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Opacity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opacity: {Math.round((asset.opacity || 1.0) * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={asset.opacity || 1.0}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Remove Button */}
        <button
          onClick={() => {
            if (window.confirm('Remove this asset from the layer?')) {
              onRemove(asset.id);
            }
          }}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          🗑️ Remove Asset
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;

import React from 'react';

// Role Selector Component
export const RoleSelector = ({ currentRole, onChange }) => {
  const roles = [
    { id: 'picture_editor', name: 'Picture Editor', icon: '🎬', layer: 2 },
    { id: 'colorist', name: 'Colorist', icon: '🎨', layer: 2 },
    { id: 'vfx_cleanup', name: 'VFX/Cleanup', icon: '✨', layer: 3 },
    { id: 'motion_graphics', name: 'Motion Graphics', icon: '📝', layer: 4 },
    { id: 'sound_designer', name: 'Sound Designer', icon: '🎵', layer: 5 },
  ];

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Role:</label>
      <select
        value={currentRole}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
      >
        <option value="">All Layers</option>
        {roles.map(role => (
          <option key={role.id} value={role.id}>
            {role.icon} {role.name}
          </option>
        ))}
      </select>
    </div>
  );
};

// Continuity Warning Component
export const ContinuityWarning = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl">⚠️</span>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Continuity Warnings
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning.message}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Color Preset Selector
export const ColorPresetSelector = ({ onApply }) => {
  const presets = {
    lala_default: { name: 'Lala Default', warmth: 15, saturation: 10 },
    justawoman_default: { name: 'JustAWoman Default', warmth: 5, saturation: 5 },
    dramatic: { name: 'Dramatic Moment', warmth: -10, contrast: 20 },
    happy: { name: 'Happy Scene', warmth: 20, brightness: 10 }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Color Preset
      </label>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => onApply(preset)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// QC Checklist Component
export const QCChecklist = ({ checks }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'fail': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-3">Quality Control Checklist</h3>
      <div className="space-y-2">
        {checks.map(check => (
          <div key={check.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getStatusIcon(check.status)}</span>
              <span className="text-sm">{check.name}</span>
            </div>
            {check.details && (
              <span className="text-xs text-gray-500">{check.details}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Asset Preview Component
export const AssetPreview = ({ asset }) => {
  if (!asset) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {asset.thumbnail_url ? (
            <img
              src={asset.thumbnail_url}
              alt={asset.name}
              className="w-20 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center text-3xl">
              📄
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{asset.name}</h4>
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            <div>Type: {asset.asset_type || asset.media_type || 'Unknown'}</div>
            {asset.duration && <div>Duration: {asset.duration}s</div>}
            {asset.dimensions && <div>Size: {asset.dimensions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default {
  RoleSelector,
  ContinuityWarning,
  ColorPresetSelector,
  QCChecklist,
  AssetPreview
};

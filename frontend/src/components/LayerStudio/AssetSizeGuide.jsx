import React, { useState } from 'react';

const AssetSizeGuide = ({ currentPreset }) => {
  const [isOpen, setIsOpen] = useState(false);

  const sizeGuides = {
    youtube: {
      background: { width: 1920, height: 1080, tips: 'Full HD landscape' },
      overlay: { width: 1920, height: 1080, tips: 'Full canvas size' },
      logo: { width: 300, height: 300, tips: 'Corner placement' }
    },
    youtube_shorts: {
      background: { width: 1080, height: 1920, tips: 'Vertical 9:16' },
      overlay: { width: 1080, height: 1920, tips: 'Full canvas size' },
      logo: { width: 200, height: 200, tips: 'Top or bottom' }
    },
    instagram_story: {
      background: { width: 1080, height: 1920, tips: 'Vertical 9:16' },
      overlay: { width: 1080, height: 1920, tips: 'Full canvas size' },
      text: { width: 1000, height: 300, tips: 'Safe area only' }
    },
    tiktok: {
      background: { width: 1080, height: 1920, tips: 'Vertical 9:16' },
      overlay: { width: 1080, height: 1920, tips: 'Full canvas size' },
      logo: { width: 200, height: 200, tips: 'Avoid bottom (UI)' }
    },
    instagram_feed: {
      background: { width: 1080, height: 1080, tips: 'Square 1:1' },
      overlay: { width: 1080, height: 1080, tips: 'Full canvas size' }
    }
  };

  const guide = sizeGuides[currentPreset.key] || sizeGuides.youtube;

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium transition"
      >
        <div className="flex items-center gap-2">
          <span>📐</span>
          <span className="text-gray-200">Asset Size Guide</span>
        </div>
        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-1 bg-slate-700 rounded p-2 space-y-2 border border-slate-600">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-600">
            <span className="text-lg">{currentPreset.icon}</span>
            <div className="text-xs">
              <div className="text-gray-200 font-semibold">{currentPreset.name}</div>
              <div className="text-gray-400 text-xs">
                {currentPreset.width} × {currentPreset.height}
              </div>
            </div>
          </div>

          {Object.entries(guide).map(([assetType, dimensions]) => (
            <div key={assetType} className="bg-slate-800 rounded p-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300 font-semibold uppercase">
                  {assetType}
                </span>
                <span className="text-gray-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded text-xs">
                  {dimensions.width}×{dimensions.height}
                </span>
              </div>
              <div className="text-gray-400 text-xs">{dimensions.tips}</div>
            </div>
          ))}

          <div className="bg-slate-800 border border-slate-600 rounded p-2 mt-2 text-xs">
            <div className="text-gray-300 font-semibold mb-0.5">💡 Background = Canvas size</div>
            <div className="text-gray-400 text-xs">
              Overlays can be smaller and positioned freely
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetSizeGuide;

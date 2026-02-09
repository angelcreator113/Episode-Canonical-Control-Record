import React, { useState } from 'react';
import { CANVAS_PRESETS } from './canvasPresets';

const CanvasPresetSelector = ({ currentPreset, onPresetChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded text-xs font-medium transition"
        title="Canvas presets"
      >
        <span>{currentPreset.icon}</span>
        <span className="max-w-[100px] truncate">{currentPreset.name}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 bg-slate-700 rounded border border-slate-600 shadow-lg z-50 w-48">
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(CANVAS_PRESETS).map(([key, preset]) => {
                const isActive = currentPreset.name === preset.name;
                
                return (
                  <button
                    key={key}
                    onClick={() => {
                      onPresetChange(preset);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition border-b border-slate-600 last:border-b-0
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }
                    `}
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{preset.name}</div>
                      <div className="text-xs opacity-75 truncate">{preset.width}×{preset.height}</div>
                    </div>
                    {isActive && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CanvasPresetSelector;

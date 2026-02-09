import React, { useState, useEffect } from 'react';

const ClipTimeline = ({ layerAssets, selectedAsset, onAssetSelect, onAssetUpdate, sceneDuration }) => {
  const [zoom, setZoom] = useState(1);
  const [playhead, setPlayhead] = useState(0);

  const maxDuration = Math.max(sceneDuration || 60, 
    ...layerAssets.map(a => a.out_point_seconds || 0)
  );

  const handleClipDrag = (asset, newInPoint) => {
    const duration = (asset.out_point_seconds || asset.in_point_seconds + 10) - asset.in_point_seconds;
    onAssetUpdate(asset.id, {
      in_point_seconds: Math.max(0, newInPoint),
      out_point_seconds: Math.max(0, newInPoint + duration)
    });
  };

  const handleClipResize = (asset, side, delta) => {
    if (side === 'left') {
      const newInPoint = Math.max(0, asset.in_point_seconds + delta);
      onAssetUpdate(asset.id, { in_point_seconds: newInPoint });
    } else {
      const newOutPoint = Math.max(asset.in_point_seconds + 1, (asset.out_point_seconds || 10) + delta);
      onAssetUpdate(asset.id, { out_point_seconds: newOutPoint });
    }
  };

  const timeToPixels = (seconds) => {
    return (seconds / maxDuration) * 800 * zoom;
  };

  const pixelsToTime = (pixels) => {
    return (pixels / (800 * zoom)) * maxDuration;
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-700 border-opacity-30 h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            Timeline
            <span className="text-xs text-gray-400 font-normal ml-2 px-2 py-1 bg-slate-800 rounded">
              {formatDuration(maxDuration)}
            </span>
          </h3>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded text-xs font-bold transition hover:shadow-md"
            >
              −
            </button>
            <span className="text-white text-xs font-mono w-10 text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded text-xs font-bold transition hover:shadow-md"
            >
              +
            </button>
          </div>
        </div>

        {/* Timeline Ruler */}
        <div className="relative">
          <div className="flex justify-between text-xs text-gray-400 font-mono mb-2 px-1">
            {Array.from({ length: Math.min(6, Math.ceil(maxDuration / 10)) }, (_, i) => {
              const time = (maxDuration / Math.min(5, Math.ceil(maxDuration / 10) - 1)) * i;
              return (
                <span key={i} className="text-xs font-semibold">{formatDuration(time)}</span>
              );
            })}
          </div>
          <div className="h-1.5 bg-slate-800 bg-opacity-50 rounded-full relative overflow-hidden border border-slate-700 border-opacity-30 shadow-inner">
            {/* Playhead */}
            <div
              className="absolute -top-1.5 bottom--1.5 w-1 bg-gradient-to-b from-red-400 to-red-600 z-10 shadow-lg"
              style={{ left: `${(playhead / maxDuration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Clips Container */}
      <div className="flex-1 overflow-y-auto">
        {layerAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-6xl mb-3 opacity-70">⏱️</div>
            <div className="text-sm font-bold text-white mb-2">Ready for timing</div>
            <div className="text-xs text-gray-500 max-w-xs mb-4">
              Drag assets from the canvas to the timeline, then adjust their in/out points
            </div>
            <div className="text-xs text-gray-600 flex gap-2 flex-wrap justify-center">
              <span className="bg-slate-800 px-2 py-1 rounded">📌 Drag to move</span>
              <span className="bg-slate-800 px-2 py-1 rounded">↔️ Edges to trim</span>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {layerAssets.map((asset, idx) => {
              const inPoint = asset.in_point_seconds || 0;
              const outPoint = asset.out_point_seconds || inPoint + 10;
              const duration = outPoint - inPoint;
              const isSelected = selectedAsset?.id === asset.id;

              return (
                <div
                  key={asset.id}
                  className="group relative"
                >
                  {/* Asset Info */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {asset.asset?.type === 'video' ? '🎥' : asset.asset?.type === 'image' ? '🖼️' : '🎵'}
                      </span>
                      <span className="text-xs font-semibold text-white truncate max-w-xs" title={asset.asset?.name}>
                        {asset.asset?.name || `Asset ${idx + 1}`}
                      </span>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300'}`}>
                      {formatDuration(inPoint)} → {formatDuration(outPoint)} ({formatDuration(duration)})
                    </span>
                  </div>
                  
                  {/* Clip Track */}
                  <div className="relative h-10 bg-slate-800 bg-opacity-50 rounded-lg overflow-hidden border border-slate-700 border-opacity-30 shadow-md hover:shadow-lg transition group-hover:bg-opacity-70">
                    {/* Background grid lines */}
                    <div className="absolute inset-0 opacity-10">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className="absolute h-full w-px bg-gray-500"
                          style={{ left: `${(i + 1) * 10}%` }}
                        />
                      ))}
                    </div>

                    {/* Clip Bar */}
                    <div
                      className={`
                        absolute h-full transition-all rounded-md cursor-move group/clip
                        ${isSelected 
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 ring-2 ring-blue-300 shadow-lg' 
                          : 'bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 hover:shadow-md'
                        }
                      `}
                      style={{
                        left: `${(inPoint / maxDuration) * 100}%`,
                        width: `${(duration / maxDuration) * 100}%`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssetSelect(asset);
                      }}
                    >
                      {/* Asset Preview */}
                      {asset.asset?.url && (
                        <img
                          src={asset.asset.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover/clip:opacity-30 transition"
                        />
                      )}
                      
                      {/* Clip Label */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-lg font-bold drop-shadow-lg">
                          {asset.asset?.type === 'video' ? '🎬' : '📷'}
                        </span>
                      </div>

                      {/* Resize Handles */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white bg-opacity-30 cursor-ew-resize hover:bg-opacity-70 hover:shadow-lg transition rounded-l-md group-hover/clip:bg-opacity-60" />
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white bg-opacity-30 cursor-ew-resize hover:bg-opacity-70 hover:shadow-lg transition rounded-r-md group-hover/clip:bg-opacity-60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Help Text */}
      {layerAssets.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-700 bg-slate-900 bg-opacity-50">
          <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
            <span>📌 Drag clip to move</span>
            <span>•</span>
            <span>↔️ Drag edges to trim</span>
            <span>•</span>
            <span>🖱️ Click to select</span>
          </div>
        </div>
      )}
    </div>
  );
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default ClipTimeline;

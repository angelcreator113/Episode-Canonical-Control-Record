import React, { useState } from 'react';

const Timeline = ({ layers, selectedLayer, onLayerSelect, onLayerReorder, config, colors }) => {
  const [draggedLayer, setDraggedLayer] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleDragStart = (e, layer) => {
    setDraggedLayer(layer);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, layer) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(layer.id);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e, targetLayer) => {
    e.preventDefault();
    
    if (draggedLayer && draggedLayer.id !== targetLayer.id) {
      // Swap layer numbers
      onLayerReorder(draggedLayer.id, targetLayer.layer_number);
    }
    
    setDraggedLayer(null);
    setDropTarget(null);
  };

  return (
    <div className="h-32 bg-gray-800 border-t-2 border-purple-600 shadow-2xl">
      <div className="p-3 h-full">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-white font-bold text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            Timeline
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-purple-600 to-transparent"></div>
          <span className="text-gray-400 text-xs">Drag layers to reorder • L1 = Bottom, L5 = Top</span>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2">
          {layers.map(layer => {
            const cfg = config[layer.layer_number];
            const clr = colors[cfg.color];
            const isSelected = selectedLayer?.id === layer.id;
            const isDragging = draggedLayer?.id === layer.id;
            const isDropTarget = dropTarget === layer.id;
            const assetCount = layer.assets?.length || 0;

            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, layer)}
                onDragOver={(e) => handleDragOver(e, layer)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, layer)}
                onClick={() => onLayerSelect(layer)}
                className={`
                  flex-shrink-0 w-36 rounded-lg border-2 cursor-move transition-all transform
                  ${isDragging ? 'opacity-30 scale-90' : ''}
                  ${isSelected ? 'ring-4 ring-blue-400 scale-105 shadow-2xl' : 'shadow-lg'}
                  ${isDropTarget && !isDragging ? 'ring-4 ring-green-400 scale-105' : ''}
                  ${clr.border} ${clr.bg} ${clr.hover}
                `}
              >
                <div className="p-3">
                  <div className="text-center">
                    <div className="text-3xl mb-1">{cfg.icon}</div>
                    <div className="text-white text-sm font-bold mb-1">
                      Layer {layer.layer_number}
                    </div>
                    <div className={`${clr.text} text-xs font-medium truncate mb-2`}>
                      {cfg.name}
                    </div>
                    
                    {/* Asset Count Badge */}
                    <div className={`
                      inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                      ${assetCount > 0 
                        ? 'bg-white bg-opacity-20 text-white' 
                        : 'bg-gray-800 text-gray-500'
                      }
                    `}>
                      <span>{assetCount}</span>
                      <span>{assetCount === 1 ? 'asset' : 'assets'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Timeline;

import React from 'react';

const HistoryPanel = ({ canUndo, canRedo, onUndo, onRedo, historyLength, currentIndex }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2 rounded transition ${
          canUndo 
            ? 'text-white hover:bg-gray-600' 
            : 'text-gray-500 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        ↶
      </button>
      
      <div className="text-xs text-gray-400 font-mono">
        {currentIndex + 1}/{historyLength}
      </div>
      
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-2 rounded transition ${
          canRedo 
            ? 'text-white hover:bg-gray-600' 
            : 'text-gray-500 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        ↷
      </button>
    </div>
  );
};

export default HistoryPanel;

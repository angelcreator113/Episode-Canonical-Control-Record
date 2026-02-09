import React from 'react';

const FirstTimeOverlay = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl max-w-2xl mx-4 border border-gray-700 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-8">
          <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
            <span className="text-4xl">🎬</span>
            <div>
              <div>Welcome to Layer Studio Pro</div>
              <div className="text-sm text-gray-400 font-normal mt-1">
                Professional video composition, made simple
              </div>
            </div>
          </h2>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-6 mb-8">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="bg-gray-700 text-gray-300 rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                1
              </div>
              <div>
                <div className="text-white font-medium text-base mb-1">Browse Assets</div>
                <div className="text-gray-400 text-sm leading-relaxed">
                  Find your media files in the <span className="text-gray-300">Assets panel</span> on the right. Filter by type: All, Images, or Videos.
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="bg-gray-700 text-gray-300 rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                2
              </div>
              <div>
                <div className="text-white font-medium text-base mb-1">Drag & Drop Assets</div>
                <div className="text-gray-400 text-sm leading-relaxed">
                  Drag assets to <span className="text-gray-300">layers</span> on the left, or directly to the <span className="text-gray-300">canvas</span> in the center. Quick Add buttons in the header work too.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="bg-gray-700 text-gray-300 rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                3
              </div>
              <div>
                <div className="text-white font-medium text-base mb-1">Adjust & Style</div>
                <div className="text-gray-400 text-sm leading-relaxed">
                  Click an asset to select it. Use the <span className="text-gray-300">Properties panel</span> to adjust opacity, rotation, scale, and position.
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-4">
              <div className="bg-gray-700 text-gray-300 rounded-full w-8 h-8 flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                4
              </div>
              <div>
                <div className="text-white font-medium text-base mb-1">Organize Layers</div>
                <div className="text-gray-400 text-sm leading-relaxed">
                  Reorder layers using the <span className="text-gray-300">Timeline</span> at the bottom. Drag to change stacking order.
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="text-gray-300 text-sm font-medium mb-3">Keyboard Shortcuts</div>
            <ul className="text-gray-400 text-xs space-y-2">
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-300 font-mono">1-5</kbd> <span className="ml-2">Select layers</span></li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-300 font-mono">Arrow keys</kbd> <span className="ml-2">Move selected assets</span></li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-300 font-mono">Shift + Arrow</kbd> <span className="ml-2">Move faster (10x)</span></li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              Get Started
            </button>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => {
                  document.querySelector('[title="Keyboard Shortcuts (Press ? to toggle)"]')?.click();
                }, 300);
              }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition font-medium"
            >
              View Shortcuts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstTimeOverlay;

import React, { useState } from 'react';

const KeyboardShortcutsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { category: 'Layer Selection', items: [
      { keys: ['1', '2', '3', '4', '5'], description: 'Select Layer 1-5' },
      { keys: ['V'], description: 'Toggle layer visibility' },
      { keys: ['L'], description: 'Toggle layer lock' },
    ]},
    { category: 'Asset Controls', items: [
      { keys: ['Delete'], description: 'Remove selected asset' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate asset' },
      { keys: ['←', '→', '↑', '↓'], description: 'Move asset (1px)' },
      { keys: ['Shift', '←/→/↑/↓'], description: 'Move asset (10px)' },
      { keys: ['Esc'], description: 'Deselect' },
    ]},
    { category: 'Canvas', items: [
      { keys: ['+'], description: 'Zoom in' },
      { keys: ['-'], description: 'Zoom out' },
      { keys: ['0'], description: 'Reset zoom to 100%' },
      { keys: ['Space', 'Drag'], description: 'Pan canvas' },
    ]},
    { category: 'History', items: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
    ]}
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition z-50"
        title="Keyboard Shortcuts"
      >
        ⌨️
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">⌨️ Keyboard Shortcuts</h3>
              <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 text-2xl">×</button>
            </div>

            <div className="p-6 space-y-6">
              {shortcuts.map(category => (
                <div key={category.category}>
                  <h4 className="text-purple-400 font-semibold mb-3 uppercase text-sm">{category.category}</h4>
                  <div className="space-y-2">
                    {category.items.map((shortcut, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                        <div className="flex gap-2">
                          {shortcut.keys.map((key, j) => (
                            <kbd key={j} className="px-3 py-1 bg-gray-900 text-white rounded border border-gray-600 text-sm font-mono">
                              {key}
                            </kbd>
                          ))}
                        </div>
                        <span className="text-gray-300 text-sm">{shortcut.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KeyboardShortcutsPanel;

import React from 'react';
import './KeyboardShortcutsModal.css';

/**
 * KeyboardShortcutsModal - Display all available keyboard shortcuts
 */
const KeyboardShortcutsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Playback',
      items: [
        { keys: ['Space'], description: 'Play / Pause' },
        { keys: ['←'], description: 'Previous frame' },
        { keys: ['→'], description: 'Next frame' },
        { keys: ['Home'], description: 'Jump to start' },
        { keys: ['End'], description: 'Jump to end' },
        { keys: ['J'], description: 'Rewind' },
        { keys: ['K'], description: 'Pause' },
        { keys: ['L'], description: 'Fast forward' },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { keys: ['+', '='], description: 'Zoom in' },
        { keys: ['-', '_'], description: 'Zoom out' },
        { keys: ['0'], description: 'Reset zoom' },
        { keys: ['Shift', '↑'], description: 'Scroll up' },
        { keys: ['Shift', '↓'], description: 'Scroll down' },
      ]
    },
    {
      category: 'Editing',
      items: [
        { keys: ['Ctrl', 'Z'], description: 'Undo' },
        { keys: ['Ctrl', 'Y'], description: 'Redo' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alt)' },
        { keys: ['Ctrl', 'C'], description: 'Copy selection' },
        { keys: ['Ctrl', 'V'], description: 'Paste' },
        { keys: ['Ctrl', 'X'], description: 'Cut selection' },
        { keys: ['Delete'], description: 'Delete selection' },
        { keys: ['Backspace'], description: 'Delete selection' },
      ]
    },
    {
      category: 'Selection',
      items: [
        { keys: ['Click'], description: 'Select item' },
        { keys: ['Shift', 'Click'], description: 'Add to selection' },
        { keys: ['Ctrl', 'A'], description: 'Select all' },
        { keys: ['Ctrl', 'D'], description: 'Deselect all' },
        { keys: ['Esc'], description: 'Clear selection' },
      ]
    },
    {
      category: 'Timeline',
      items: [
        { keys: ['Alt'], description: 'Disable snapping (hold)' },
        { keys: ['Ctrl', 'E'], description: 'Export timeline' },
        { keys: ['Ctrl', 'S'], description: 'Save timeline' },
        { keys: ['?'], description: 'Show shortcuts' },
        { keys: ['F'], description: 'Toggle fullscreen' },
      ]
    },
    {
      category: 'Panels',
      items: [
        { keys: ['1'], description: 'Timeline mode' },
        { keys: ['2'], description: 'Assets mode' },
        { keys: ['3'], description: 'Wardrobe mode' },
        { keys: ['4'], description: 'Voice mode' },
        { keys: ['5'], description: 'Effects mode' },
        { keys: ['Tab'], description: 'Toggle context panel' },
        { keys: ['`'], description: 'Toggle preview' },
      ]
    }
  ];

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div className="keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <button onClick={onClose} className="close-btn" title="Close (Esc)">
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          <div className="shortcuts-grid">
            {shortcuts.map((section) => (
              <div key={section.category} className="shortcuts-section">
                <h3 className="section-title">{section.category}</h3>
                <div className="shortcuts-list">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="shortcut-item">
                      <div className="shortcut-keys">
                        {item.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd className="key">{key}</kbd>
                            {keyIdx < item.keys.length - 1 && (
                              <span className="key-separator">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="shortcut-description">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <p>Press <kbd className="key">?</kbd> anytime to view shortcuts</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;

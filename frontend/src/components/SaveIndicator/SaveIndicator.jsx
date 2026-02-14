import React from 'react';
import './SaveIndicator.css';

/**
 * SaveIndicator — Shows save status + manual save button
 * Renders inline in a header bar
 */
function SaveIndicator({ saveStatus, lastSaved, errorMessage, onSave }) {
  const getStatusInfo = () => {
    switch (saveStatus) {
      case 'saved':
        return { icon: '✓', text: 'Saved', className: 'saved' };
      case 'saving':
        return { icon: '', text: 'Saving...', className: 'saving' };
      case 'unsaved':
        return { icon: '●', text: 'Unsaved changes', className: 'unsaved' };
      case 'error':
        return { icon: '⚠', text: 'Save failed', className: 'error' };
      default:
        return { icon: '', text: '', className: '' };
    }
  };

  const { icon, text, className } = getStatusInfo();

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diffMs = now - lastSaved;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`save-indicator ${className}`}>
      {/* Status badge */}
      <div className="save-status-badge">
        {saveStatus === 'saving' && <span className="save-spinner" />}
        {saveStatus !== 'saving' && <span className="save-icon">{icon}</span>}
        <span className="save-text">{text}</span>
        {lastSaved && saveStatus === 'saved' && (
          <span className="save-time">{formatLastSaved()}</span>
        )}
      </div>

      {/* Error tooltip */}
      {errorMessage && (
        <span className="save-error-tip" title={errorMessage}>
          {errorMessage.length > 30 ? errorMessage.slice(0, 30) + '...' : errorMessage}
        </span>
      )}

      {/* Save button */}
      <button
        className="save-btn-manual"
        onClick={onSave}
        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
        title="Save (Ctrl+S)"
      >
        💾 Save
      </button>
    </div>
  );
}

export default SaveIndicator;

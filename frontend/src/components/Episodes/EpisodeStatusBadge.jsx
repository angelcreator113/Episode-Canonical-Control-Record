// frontend/src/components/Episodes/EpisodeStatusBadge.jsx
import React, { useState, useRef, useEffect } from 'react';
import { getStatusConfig, getNextStatus, suggestStatusAdvance, EPISODE_STATUSES } from '../../utils/workflowRouter';
import './EpisodeStatusBadge.css';

/**
 * EpisodeStatusBadge - Clickable status with dropdown
 * 
 * Features:
 * - Shows current status with color coding
 * - Click to open dropdown
 * - AI suggestions for next status
 * - Shows next steps on hover
 */
function EpisodeStatusBadge({ episode, onStatusChange, showDropdown = true, size = 'medium' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const dropdownRef = useRef(null);
  
  const currentStatus = episode?.status || EPISODE_STATUSES.DRAFT;
  const config = getStatusConfig(currentStatus);
  const suggestion = suggestStatusAdvance(episode);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Show AI suggestion after component mounts
  useEffect(() => {
    if (suggestion && suggestion.shouldSuggest) {
      const timer = setTimeout(() => setShowSuggestion(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [suggestion]);
  
  const handleStatusClick = (newStatus) => {
    if (onStatusChange && newStatus !== currentStatus) {
      onStatusChange(newStatus);
      setIsOpen(false);
      setShowSuggestion(false);
    }
  };
  
  const handleAcceptSuggestion = () => {
    if (suggestion && onStatusChange) {
      onStatusChange(suggestion.nextStatus);
      setShowSuggestion(false);
    }
  };
  
  const allStatuses = Object.keys(EPISODE_STATUSES).map(key => EPISODE_STATUSES[key]);
  
  return (
    <div className={`episode-status-badge-container size-${size}`} ref={dropdownRef}>
      {/* Current Status Badge */}
      <button
        className={`episode-status-badge status-${currentStatus}`}
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          cursor: showDropdown ? 'pointer' : 'default'
        }}
        title={showDropdown ? 'Click to change status' : config.label}
      >
        <span className="status-icon">{config.icon}</span>
        <span className="status-label">{config.label}</span>
        {showDropdown && (
          <span className="dropdown-arrow">▼</span>
        )}
      </button>
      
      {/* AI Suggestion Toast */}
      {suggestion && showSuggestion && (
        <div className="status-suggestion-toast">
          <div className="suggestion-content">
            <span className="suggestion-icon">💡</span>
            <div className="suggestion-text">
              <strong>{suggestion.message}</strong>
              <p className="suggestion-reason">{suggestion.reason}</p>
            </div>
          </div>
          <div className="suggestion-actions">
            <button 
              className="btn-suggestion-accept"
              onClick={handleAcceptSuggestion}
            >
              Yes, move it!
            </button>
            <button 
              className="btn-suggestion-dismiss"
              onClick={() => setShowSuggestion(false)}
            >
              Not yet
            </button>
          </div>
        </div>
      )}
      
      {/* Dropdown Menu */}
      {isOpen && showDropdown && (
        <div className="status-dropdown">
          <div className="dropdown-header">
            <span>Change Status</span>
          </div>
          
          {allStatuses.map(status => {
            const statusConfig = getStatusConfig(status);
            const isCurrent = status === currentStatus;
            const isNext = status === getNextStatus(currentStatus);
            
            return (
              <button
                key={status}
                className={`status-option ${isCurrent ? 'current' : ''} ${isNext ? 'next' : ''}`}
                onClick={() => handleStatusClick(status)}
                disabled={isCurrent}
              >
                <div className="option-left">
                  <span className="option-icon">{statusConfig.icon}</span>
                  <div className="option-info">
                    <span className="option-label">{statusConfig.label}</span>
                    {isNext && (
                      <span className="option-badge">Suggested next</span>
                    )}
                  </div>
                </div>
                {isCurrent && (
                  <span className="current-indicator">✓</span>
                )}
              </button>
            );
          })}
          
          <div className="dropdown-footer">
            <small>AI will suggest when ready to advance</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default EpisodeStatusBadge;

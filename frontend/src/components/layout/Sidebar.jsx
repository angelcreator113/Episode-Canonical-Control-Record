// frontend/src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import showService from '../../services/showService';
import './Sidebar.css';

/**
 * Sidebar - Simple MVP Navigation
 * On mobile: slides in as a drawer from the left with backdrop overlay
 * On desktop: always visible in the flex layout
 */

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [shows, setShows] = useState([]);
  const [showsExpanded, setShowsExpanded] = useState(true);
  
  useEffect(() => {
    loadShows();
  }, []);
  
  const loadShows = async () => {
    try {
      const showsData = await showService.getAllShows();
      
      // Map shows to include episode count if available
      const formattedShows = showsData.map(show => ({
        id: show.id,
        name: show.name || show.title || 'Untitled Show',
        episodeCount: show.episodeCount || show.episode_count || show.episodes?.length || 0
      }));
      
      setShows(formattedShows);
    } catch (error) {
      console.error('Error loading shows:', error);
      // Set empty array on error to prevent showing mock data
      setShows([]);
    }
  };
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };
  
  // On mobile, close sidebar after navigating
  const handleNavigate = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const NavItem = ({ icon, label, path, onClick }) => (
    <button
      className={`nav-item ${isActive(path) ? 'active' : ''}`}
      onClick={onClick || (() => handleNavigate(path))}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
  
  return (
    <>
    {/* Mobile backdrop overlay */}
    {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo + Mobile Close */}
      <div className="sidebar-logo" onClick={() => handleNavigate('/')}>
        <span className="logo-icon">🎬</span>
        <div className="logo-text">
          <div className="logo-title">Creative Engine</div>
          <div className="logo-subtitle">by LaLa</div>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close sidebar">
            ✕
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Home */}
        <NavItem icon="🏠" label="Home" path="/" />
        
        {/* Shows */}
        <div className="nav-group">
          <button
            className={`nav-item ${isActive('/shows') ? 'active' : ''}`}
            onClick={() => {
              if (showsExpanded) {
                // Already expanded - navigate to shows and close sidebar
                navigate('/shows');
                if (onClose) onClose();
              } else {
                // Expand the sub-items and navigate
                setShowsExpanded(true);
                navigate('/shows');
                if (onClose) onClose();
              }
            }}
          >
            <span className="nav-icon">🎬</span>
            <span className="nav-label">Shows</span>
            <span className={`expand-icon ${showsExpanded ? 'expanded' : ''}`}>
              ▼
            </span>
          </button>
          
          {showsExpanded && shows.length > 0 && (
            <div className="nav-subgroup">
              {shows.map(show => (
                <button
                  key={show.id}
                  className={`nav-subitem ${isActive(`/shows/${show.id}`) ? 'active' : ''}`}
                  onClick={() => handleNavigate(`/shows/${show.id}`)}
                >
                  <span className="subitem-indicator">└─</span>
                  <span className="subitem-label">{show.name}</span>
                  <span className="subitem-count">{show.episodeCount}</span>
                </button>
              ))}
            </div>
          )}
          
          {showsExpanded && shows.length === 0 && (
            <div className="nav-empty-state">
              <span className="empty-text">No shows yet</span>
            </div>
          )}
        </div>
        
        {/* Settings */}
        <NavItem icon="⚙️" label="Settings" path="/settings" />
      </nav>
      
      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">L</div>
          <div className="user-details">
            <div className="user-name">LaLa</div>
            <div className="user-status">Creator</div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

export default Sidebar;

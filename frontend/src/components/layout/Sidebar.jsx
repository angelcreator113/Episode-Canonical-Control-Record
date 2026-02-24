// frontend/src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import showService from '../../services/showService';
import { episodeService } from '../../services/episodeService';
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
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [currentShowId, setCurrentShowId] = useState(null);
  
  useEffect(() => {
    loadShows();
  }, []);
  
  // Auto-expand Universe/StoryTeller group when on its sub-routes
  useEffect(() => {
    if (location.pathname.startsWith('/universe') || location.pathname.startsWith('/storyteller') || location.pathname.startsWith('/character-registry') || location.pathname.startsWith('/continuity') || location.pathname.startsWith('/relationships') || location.pathname.startsWith('/therapy')) {
      setStoryExpanded(true);
    }
  }, [location.pathname]);

  // Detect if we're on an episode page and get its parent show
  useEffect(() => {
    const checkEpisodeRoute = async () => {
      const match = location.pathname.match(/\/episodes\/([^/]+)/);
      if (match && match[1] !== 'create') {
        const episodeId = match[1];
        try {
          const episode = await episodeService.getEpisode(episodeId);
          if (episode?.show_id || episode?.showId) {
            setCurrentShowId(episode.show_id || episode.showId);
            setShowsExpanded(true); // Auto-expand shows when viewing an episode
          }
        } catch (err) {
          console.error('Failed to get episode for sidebar:', err);
        }
      } else {
        // Check if we're on a show page
        const showMatch = location.pathname.match(/\/shows\/([^/]+)/);
        if (showMatch) {
          setCurrentShowId(showMatch[1]);
        } else {
          setCurrentShowId(null);
        }
      }
    };
    checkEpisodeRoute();
  }, [location.pathname]);
  
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
        
        {/* Session Briefing */}
        <NavItem icon="◈" label="Session" path="/start" />
        
        {/* Universe group (includes StoryTeller tools) */}
        <div className="nav-group">
          <button
            className={`nav-item ${isActive('/universe') || isActive('/storyteller') || isActive('/character-registry') || isActive('/continuity') || isActive('/relationships') || isActive('/therapy') ? 'active' : ''}`}
            onClick={() => {
              setStoryExpanded(!storyExpanded);
              if (!storyExpanded) {
                navigate('/universe');
                if (onClose) onClose();
              }
            }}
          >
            <span className="nav-icon">◈</span>
            <span className="nav-label">Universe</span>
            <span className={`expand-icon ${storyExpanded ? 'expanded' : ''}`}>
              ▼
            </span>
          </button>
          
          {storyExpanded && (
            <div className="nav-subgroup">
              <button
                className={`nav-subitem ${isActive('/universe') ? 'active' : ''}`}
                onClick={() => handleNavigate('/universe')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Overview</span>
              </button>
              <button
                className={`nav-subitem ${isActive('/storyteller') ? 'active' : ''}`}
                onClick={() => handleNavigate('/storyteller')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Book Editor</span>
              </button>
              <button
                className={`nav-subitem ${isActive('/character-registry') ? 'active' : ''}`}
                onClick={() => handleNavigate('/character-registry')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Characters</span>
              </button>
              <button
                className={`nav-subitem ${isActive('/continuity') ? 'active' : ''}`}
                onClick={() => handleNavigate('/continuity')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Continuity</span>
              </button>
              <button
                className={`nav-subitem ${isActive('/relationships') ? 'active' : ''}`}
                onClick={() => handleNavigate('/relationships')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Relationships</span>
              </button>
              <button
                className={`nav-subitem ${isActive('/therapy') ? 'active' : ''}`}
                onClick={() => handleNavigate('/therapy/default')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Therapy</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Shows */}
        <div className="nav-group">
          <button
            className={`nav-item ${isActive('/shows') ? 'active' : ''}`}
            onClick={() => {
              setShowsExpanded(!showsExpanded);
              if (!showsExpanded) {
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
          
          {showsExpanded && (
            <div className="nav-subgroup">
              <button
                className={`nav-subitem ${location.pathname === '/shows' ? 'active' : ''}`}
                onClick={() => handleNavigate('/shows')}
              >
                <span className="subitem-indicator">└─</span>
                <span className="subitem-label">Shows</span>
              </button>
              {shows.map(show => (
                <button
                  key={show.id}
                  className={`nav-subitem ${isActive(`/shows/${show.id}`) || currentShowId === show.id ? 'active' : ''}`}
                  onClick={() => handleNavigate(`/shows/${show.id}`)}
                >
                  <span className="subitem-indicator">└─</span>
                  <span className="subitem-label">{show.name}</span>
                  <span className="subitem-count">{show.episodeCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Settings — show-level config (Config + Advanced) */}
        <NavItem
          icon="⚙️"
          label="Settings"
          path={currentShowId
            ? `/shows/${currentShowId}/settings`
            : shows.length > 0
              ? `/shows/${shows[0].id}/settings`
              : '/universe'}
        />
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

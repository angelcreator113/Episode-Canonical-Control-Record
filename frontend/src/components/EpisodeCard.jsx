/**
 * EpisodeCard Component - ENHANCED VISUAL HIERARCHY
 * Improved scanning, stronger hierarchy, clearer actions
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { formatters } from '../utils/formatters';
import '../styles/EpisodeCard.css';

/**
 * StatusBadge - Top-right status indicator
 */
const StatusBadge = ({ status }) => {
  const getStatusDisplay = (status) => {
    const displays = {
      draft: { emoji: '✏️', label: 'Draft' },
      scripted: { emoji: '📜', label: 'Scripted' },
      in_build: { emoji: '🎬', label: 'In Build' },
      in_review: { emoji: '👀', label: 'In Review' },
      review: { emoji: '👀', label: 'In Review' },
      scheduled: { emoji: '📅', label: 'Scheduled' },
      published: { emoji: '✅', label: 'Published' },
      archived: { emoji: '📦', label: 'Archived' },
    };
    return displays[status] || { emoji: '⚪', label: formatters.formatStatus(status) };
  };

  const { emoji, label } = getStatusDisplay(status);

  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-emoji">{emoji}</span>
      <span className="status-text">{label}</span>
    </span>
  );
};

/**
 * MetaRow - Single inline row for episode metadata
 */
const MetaRow = ({ episodeNumber, airDate, show }) => {
  const parts = [];
  
  if (episodeNumber) {
    parts.push({ type: 'text', content: `Episode ${episodeNumber}` });
  }
  
  if (airDate) {
    parts.push({ type: 'text', content: formatters.formatDate(airDate) });
  }
  
  if (show?.name) {
    parts.push({ type: 'link', content: show.name, id: show.id });
  }

  return (
    <div className="meta-row">
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="meta-separator">•</span>}
          {part.type === 'link' ? (
            <Link 
              to={`/shows/${part.id}`} 
              className="meta-text meta-link"
              onClick={(e) => e.stopPropagation()}
            >
              {part.content}
            </Link>
          ) : (
            <span className="meta-text">{part.content}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * CardHeader - Episode title (hero element)
 */
const CardHeader = ({ title }) => (
  <div className="card-content-area">
    <h3 className="card-title">{title || 'Untitled Episode'}</h3>
  </div>
);

/**
 * CardBody - Metadata, description, and tags
 */
const CardBody = ({ episode }) => {
  return (
    <div className="card-meta-area">
      {/* Meta Row */}
      <MetaRow 
        episodeNumber={episode.episode_number}
        airDate={episode.air_date}
        show={episode.show}
      />
      
      {/* Description - 2 line clamp */}
      {episode.description && (
        <p className="card-description">
          {episode.description}
        </p>
      )}
      
      {/* Categories/Tags */}
      {episode.categories && episode.categories.length > 0 && (
        <div className="card-tags">
          {episode.categories.slice(0, 3).map((category, index) => (
            <span key={index} className="tag-chip">
              {category}
            </span>
          ))}
          {episode.categories.length > 3 && (
            <span className="tag-chip tag-more">
              +{episode.categories.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * CardFooter - Normalized actions (Primary, Secondary, Tertiary)
 */
const CardFooter = ({ episodeId, onView, onEdit, onDelete }) => (
  <div className="card-footer-actions">
    {/* Primary Action */}
    {onView && (
      <button 
        className="btn-action btn-primary-action" 
        onClick={() => onView(episodeId)}
        aria-label="Open episode"
      >
        Open Episode
      </button>
    )}
    
    {/* Secondary Action */}
    {onEdit && (
      <button 
        className="btn-action btn-secondary-action" 
        onClick={() => onEdit(episodeId)}
        aria-label="Edit episode"
      >
        Edit
      </button>
    )}
    
    {/* Tertiary/Danger Action - Icon only */}
    {onDelete && (
      <button 
        className="btn-action btn-danger-action" 
        onClick={() => onDelete(episodeId)}
        aria-label="Delete episode"
        title="Delete"
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    )}
  </div>
);

/**
 * EpisodeCard - Main card component
 */
const EpisodeCard = ({ episode, onEdit, onDelete, onView, isSelected, onSelect, viewMode = 'grid' }) => {
  return (
    <div className={`episode-card-modern ${isSelected ? 'is-selected' : ''} view-${viewMode}`}>
      {/* Status Badge - Top Right */}
      <StatusBadge status={episode.status} />
      
      {/* Checkbox for bulk selection */}
      {onSelect && (
        <div className="episode-card-checkbox">
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={() => onSelect(episode.id)}
            aria-label={`Select ${episode.title}`}
          />
        </div>
      )}
      
      {/* Card Content - Wrapped for list view */}
      {viewMode === 'list' ? (
        <div className="episode-card-header">
          <h3 className="episode-title">{episode.title}</h3>
          <MetaRow 
            episodeNumber={episode.episode_number}
            airDate={episode.air_date}
            show={episode.show}
          />
        </div>
      ) : (
        <>
          <CardHeader title={episode.title} />
          <CardBody episode={episode} />
        </>
      )}
      
      <CardFooter 
        episodeId={episode.id}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
};

export default EpisodeCard;

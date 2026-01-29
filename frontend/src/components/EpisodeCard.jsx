/**
 * EpisodeCard Component - ENHANCED VISUAL HIERARCHY
 * Improved scanning, stronger hierarchy, clearer actions
 */

import React from 'react';
import { formatters } from '../utils/formatters';
import '../styles/EpisodeCard.css';

/**
 * StatusBadge - Top-right status indicator
 */
const StatusBadge = ({ status }) => {
  const getStatusDisplay = (status) => {
    const displays = {
      draft: { emoji: '🟡', label: 'Draft' },
      published: { emoji: '🟢', label: 'Published' },
      scheduled: { emoji: '🔵', label: 'Scheduled' },
      archived: { emoji: '⚪', label: 'Archived' },
      in_progress: { emoji: '🟠', label: 'In Progress' },
    };
    return displays[status] || { emoji: '⚪', label: formatters.formatStatus(status) };
  };

  const { emoji, label } = getStatusDisplay(status);

  return (
    <span className={`status-badge-new status-${status}`}>
      <span className="status-emoji">{emoji}</span>
      <span className="status-label">{label}</span>
    </span>
  );
};

/**
 * MetaRow - Single inline row for episode metadata
 */
const MetaRow = ({ episodeNumber, airDate, show }) => {
  const parts = [];
  
  if (episodeNumber) {
    parts.push(`Episode ${episodeNumber}`);
  }
  
  if (airDate) {
    parts.push(formatters.formatDate(airDate));
  }
  
  if (show?.name) {
    parts.push(show.name);
  }

  return (
    <div className="meta-row">
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="meta-separator">•</span>}
          <span className="meta-text">{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * CardHeader - Episode title (hero element)
 */
const CardHeader = ({ title }) => (
  <div className="episode-card-header-new">
    <h3 className="episode-title-hero">{title || 'Untitled Episode'}</h3>
  </div>
);

/**
 * CardBody - Metadata, description, and tags
 */
const CardBody = ({ episode }) => {
  return (
    <div className="episode-card-body-new">
      {/* Meta Row */}
      <MetaRow 
        episodeNumber={episode.episode_number}
        airDate={episode.air_date}
        show={episode.show}
      />
      
      {/* Description - 2 line clamp */}
      {episode.description && (
        <p className="episode-description-clamp">
          {episode.description}
        </p>
      )}
      
      {/* Categories/Tags */}
      {episode.categories && episode.categories.length > 0 && (
        <div className="episode-tags-row">
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
  <div className="episode-card-footer-new">
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
    <div className={`episode-card-enhanced ${isSelected ? 'is-selected' : ''} view-${viewMode}`}>
      {/* Status Badge - Top Right */}
      <StatusBadge status={episode.status} />
      
      {/* Checkbox for bulk selection */}
      {onSelect && (
        <div className="episode-card-checkbox-new">
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
        <div className="episode-card-header-new">
          <h3 className="episode-title-hero">{episode.title}</h3>
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

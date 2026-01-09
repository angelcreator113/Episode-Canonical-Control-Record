/**
 * EpisodeCard Component
 * Card display for episodes with header, body, and action buttons
 */

import React from 'react';
import { formatters } from '../utils/formatters';
import '../styles/EpisodeCard.css';

/**
 * CardHeader - Displays title and status badge
 */
const CardHeader = ({ title, status }) => (
  <div className="episode-card-header">
    <div className="episode-card-header-top">
      <h3>{title || 'Untitled'}</h3>
      <span className={`status-badge status-${status}`}>
        {formatters.formatStatus(status)}
      </span>
    </div>
  </div>
);

/**
 * CardBody - Displays episode details and categories
 */
const CardBody = ({ episode }) => {

  return (
  <div className="episode-card-body">
    {episode.episode_number && (
      <p className="episode-number">
        <strong>Episode:</strong> {episode.episode_number}
      </p>
    )}
    {episode.air_date && (
      <p className="air-date">
        <strong>Air Date:</strong> {formatters.formatDate(episode.air_date)}
      </p>
    )}
    {episode.description && (
      <p className="description">{formatters.truncate(episode.description, 100)}</p>
    )}
    {episode.categories && episode.categories.length > 0 && (
      <div className="episode-categories">
        {episode.categories.map((category, index) => (
          <span key={index} className="category-badge">
            {category}
          </span>
        ))}
      </div>
    )}
  </div>
);
}

/**
 * CardFooter - Displays action buttons
 */
const CardFooter = ({ episodeId, onView, onEdit, onDelete, handleEditClick }) => (
  <div className="episode-card-footer">
    {onView && (
      <button 
        className="btn btn-secondary" 
        onClick={() => onView(episodeId)}
        aria-label="View episode details"
      >
        View Details
      </button>
    )}
    {onEdit && (
      <button 
        className="btn btn-primary" 
        onClick={handleEditClick}
        aria-label="Edit episode"
      >
        Edit
      </button>
    )}
    {onDelete && (
      <button 
        className="btn btn-danger" 
        onClick={() => onDelete(episodeId)}
        aria-label="Delete episode"
      >
        Delete
      </button>
    )}
  </div>
);

/**
 * EpisodeCard - Main card component
 */
const EpisodeCard = ({ episode, onEdit, onDelete, onView, isSelected, onSelect }) => {
  const handleEditClick = () => {
    if (!episode.id) {
      return;
    }
    onEdit(episode.id);
  };

  return (
    <div className={`episode-card ${isSelected ? 'selected' : ''}`}>
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
      
      <CardHeader title={episode.title} status={episode.status} />
      <CardBody episode={episode} />
      <CardFooter 
        episodeId={episode.id}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        handleEditClick={handleEditClick}
      />
    </div>
  );
};

export default EpisodeCard;

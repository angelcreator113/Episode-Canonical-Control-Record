import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/ShowCard.css';

const ShowCard = ({ show, onDelete, onEdit }) => {
  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${show.name}"?`)) {
      try {
        await onDelete(show.id);
      } catch (error) {
        alert('Failed to delete show: ' + error.message);
      }
    }
  };

  return (
    <div className="show-card">
      <div className="show-card-header">
        <h3 className="show-card-title">{show.name}</h3>
        <span className={`show-status ${show.status || 'active'}`}>
          {show.status || 'active'}
        </span>
      </div>

      <div className="show-card-body">
        {show.description && (
          <p className="show-description">{show.description}</p>
        )}
        
        <div className="show-meta">
          {show.network && (
            <div className="meta-item">
              <span className="meta-label">Network:</span>
              <span className="meta-value">{show.network}</span>
            </div>
          )}
          {show.genre && (
            <div className="meta-item">
              <span className="meta-label">Genre:</span>
              <span className="meta-value">{show.genre}</span>
            </div>
          )}
          {show.episode_count !== undefined && (
            <div className="meta-item">
              <span className="meta-label">Episodes:</span>
              <span className="meta-value">{show.episode_count}</span>
            </div>
          )}
          {show.season_count !== undefined && (
            <div className="meta-item">
              <span className="meta-label">Seasons:</span>
              <span className="meta-value">{show.season_count}</span>
            </div>
          )}
        </div>

        {show.creator_name && (
          <p className="show-creator">Created by: {show.creator_name}</p>
        )}
      </div>

      <div className="show-card-actions">
        <Link 
          to={`/shows/${show.id}/edit`}
          className="btn btn-secondary"
          onClick={(e) => onEdit && onEdit(show)}
        >
          Edit
        </Link>
        <button 
          className="btn btn-danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ShowCard;

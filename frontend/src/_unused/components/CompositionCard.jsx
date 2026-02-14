import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CompositionCard.css';

/**
 * CompositionCard Component
 * Displays a single composition with preview, metadata, and actions
 */
export default function CompositionCard({ composition, onDelete, onGenerate }) {
  const navigate = useNavigate();
  
  const episodeName = composition.episode?.episodeTitle || composition.episode?.title || 'Unknown Episode';
  const showName = composition.episode?.show?.name || 'Unknown Show';
  const status = composition.status || 'DRAFT';
  const createdDate = composition.created_at || composition.createdAt;
  const version = composition.current_version || 1;
  const hasDraft = composition.has_unsaved_changes || false;
  const templateName = composition.template?.name || 'Default Template';
  
  // Check if template upgrade available (would be passed from parent)
  const templateUpgradeAvailable = composition.template_upgrade_available || false;
  
  const formatsArray = Array.isArray(composition.selected_formats) 
    ? composition.selected_formats 
    : [];
    
  const outputCount = composition.outputs?.filter(o => o.status === 'READY').length || 0;
  const failedCount = composition.outputs?.filter(o => o.status === 'FAILED').length || 0;

  const handleCardClick = () => {
    navigate(`/compositions/${composition.id}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(composition);
  };

  const handleGenerate = (e) => {
    e.stopPropagation();
    if (onGenerate) onGenerate(composition);
  };

  return (
    <div className="composition-card" onClick={handleCardClick}>
      {/* Preview Image */}
      <div className="composition-card__preview">
        {composition.preview_url ? (
          <img src={composition.preview_url} alt={episodeName} />
        ) : (
          <div className="composition-card__placeholder">
            <div className="composition-card__placeholder-content">
              <div className="composition-card__placeholder-icon">📺</div>
              <div className="composition-card__placeholder-text">{episodeName}</div>
              <div className="composition-card__placeholder-subtext">
                {formatsArray.length} {formatsArray.length === 1 ? 'format' : 'formats'}
              </div>
            </div>
          </div>
        )}
        
        {/* Badges Overlay */}
        <div className="composition-card__badges">
          {composition.is_primary && (
            <span className="composition-card__badge composition-card__badge--primary">
              ⭐ Primary
            </span>
          )}
          {hasDraft && (
            <span className="composition-card__badge composition-card__badge--draft">
              Draft
            </span>
          )}
          {templateUpgradeAvailable && (
            <span className="composition-card__badge composition-card__badge--upgrade">
              Upgrade Available
            </span>
          )}
          <span className={`composition-card__badge composition-card__badge--version`}>
            v{version}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="composition-card__content">
        <h3 className="composition-card__title">
          {composition.name || episodeName}
        </h3>
        
        <div className="composition-card__metadata">
          <div className="composition-card__metadata-item">
            <span className="composition-card__metadata-label">Show:</span>
            <span className="composition-card__metadata-value">{showName}</span>
          </div>
          
          <div className="composition-card__metadata-item">
            <span className="composition-card__metadata-label">Template:</span>
            <span className="composition-card__metadata-value">{templateName}</span>
          </div>
          
          <div className="composition-card__metadata-item">
            <span className="composition-card__metadata-label">Status:</span>
            <span className={`composition-card__status composition-card__status--${status.toLowerCase()}`}>
              {status}
            </span>
          </div>
          
          <div className="composition-card__metadata-item">
            <span className="composition-card__metadata-label">Outputs:</span>
            <span className="composition-card__metadata-value">
              {outputCount > 0 && <span className="composition-card__output-success">{outputCount} ready</span>}
              {failedCount > 0 && <span className="composition-card__output-failed">{failedCount} failed</span>}
              {outputCount === 0 && failedCount === 0 && <span>None</span>}
            </span>
          </div>
          
          {createdDate && (
            <div className="composition-card__metadata-item">
              <span className="composition-card__metadata-label">Created:</span>
              <span className="composition-card__metadata-value">
                {new Date(createdDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="composition-card__actions">
          <button 
            className="composition-card__action-btn composition-card__action-btn--primary"
            onClick={handleCardClick}
          >
            Open
          </button>
          <button 
            className="composition-card__action-btn composition-card__action-btn--secondary"
            onClick={handleGenerate}
          >
            🎬 Generate
          </button>
          <button 
            className="composition-card__action-btn composition-card__action-btn--danger"
            onClick={handleDelete}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

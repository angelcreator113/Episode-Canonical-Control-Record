import React from 'react';
import './Lightbox.css';

export const Lightbox = ({ image, onClose }) => {
  if (!image) return null;

  const handleBackdropClick = (e) => {
    // Close if clicking directly on the backdrop
    if (e.target.className === 'lightbox-backdrop') {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="lightbox-backdrop active" onClick={handleBackdropClick}>
      <div className="lightbox-container">
        <button className="lightbox-close" onClick={onClose}>
          ✕
        </button>
        
        <div className="lightbox-content">
          <img
            src={image.s3_url}
            alt={image.episode_id}
            className="lightbox-image"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-family="Arial"%3EImage not available%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>

        <div className="lightbox-info">
          <h3>Thumbnail Details</h3>
          <div className="info-grid">
            <div className="info-row">
              <span className="label">Type:</span>
              <span className="value">{image.thumbnail_type || 'standard'}</span>
            </div>
            <div className="info-row">
              <span className="label">Episode ID:</span>
              <span className="value">{String(image.episode_id || image.episodeId || 'N/A').slice(0, 8)}</span>
            </div>
            {image.created_at && (
              <div className="info-row">
                <span className="label">Created:</span>
                <span className="value">
                  {new Date(image.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;

import React, { useState } from 'react';
import { useThumbnails } from '../../hooks/useThumbnails';
import Lightbox from './Lightbox';
import './ThumbnailGallery.css';

export const ThumbnailGallery = ({ episodeId }) => {
  const { thumbnails, loading, error, pagination, refresh } = useThumbnails(episodeId);
  const [selectedImage, setSelectedImage] = useState(null);

  if (loading && thumbnails.length === 0) {
    return (
      <div className="thumbnail-gallery">
        <div className="loading">Loading thumbnails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="thumbnail-gallery">
        <div className="error-message">
          Error loading thumbnails: {error}
          <button onClick={refresh} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (thumbnails.length === 0) {
    return (
      <div className="thumbnail-gallery">
        <div className="no-content">
          <span className="icon">📸</span>
          <p>No thumbnails available for this episode</p>
          <button onClick={refresh} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thumbnail-gallery">
      <div className="gallery-header">
        <h3>Thumbnails ({thumbnails.length})</h3>
        <button onClick={refresh} className="refresh-btn" title="Refresh gallery">
          🔄
        </button>
      </div>

      <div className="gallery-grid">
        {thumbnails.map((thumbnail) => (
          <div
            key={thumbnail.id}
            className="thumbnail-item"
            onClick={() => setSelectedImage(thumbnail)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setSelectedImage(thumbnail);
              }
            }}
          >
            <div className="thumbnail-wrapper">
              <img
                src={thumbnail.s3_url}
                alt={`Thumbnail for ${thumbnail.episode_id}`}
                className="thumbnail-image"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120"%3E%3Crect fill="%23e0e0e0" width="200" height="120"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-family="Arial" font-size="12"%3EImage not available%3C/text%3E%3C/svg%3E';
                }}
              />
              <div className="thumbnail-overlay">
                <span className="view-icon">👁️ View</span>
              </div>
            </div>
            {thumbnail.thumbnail_type && (
              <div className="thumbnail-label">{thumbnail.thumbnail_type}</div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox - Rendered outside grid for proper overlay */}
      {selectedImage && (
        <Lightbox
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default ThumbnailGallery;

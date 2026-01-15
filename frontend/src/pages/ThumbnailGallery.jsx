import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './ThumbnailGallery.css';

/**
 * ThumbnailGallery Component
 * View and manage thumbnails for an episode
 */

function ThumbnailGallery() {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadEpisode();
    loadThumbnails();
  }, [episodeId]);

  const loadEpisode = async () => {
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}`);
      const data = await response.json();
      setEpisode(data.data || data);
    } catch (error) {
      // Episode load failed, continue anyway
    }
  };

  const loadThumbnails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/thumbnails/episode/${episodeId}/all`);
      if (!response.ok) {
        throw new Error(`Failed to load thumbnails: ${response.status}`);
      }
      const data = await response.json();
      setThumbnails(data.thumbnails || []);
    } catch (error) {
      setStatus('❌ Failed to load thumbnails: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const publishThumbnail = async (thumbnailId) => {
    try {
      const response = await fetch(`/api/v1/thumbnails/${thumbnailId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setStatus('✅ Thumbnail published');
        loadThumbnails();
      } else {
        const error = await response.json();
        setStatus('❌ ' + error.message);
      }
    } catch (error) {
      setStatus('❌ Failed to publish: ' + error.message);
    }
  };

  const unpublishThumbnail = async (thumbnailId) => {
    if (!window.confirm('Unpublish this thumbnail?')) return;
    
    try {
      const response = await fetch(`/api/v1/thumbnails/${thumbnailId}/unpublish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setStatus('✅ Thumbnail unpublished');
        loadThumbnails();
      } else {
        const error = await response.json();
        setStatus('❌ ' + error.message);
      }
    } catch (error) {
      setStatus('❌ Failed to unpublish: ' + error.message);
    }
  };

  const setPrimary = async (thumbnailId) => {
    try {
      const response = await fetch(`/api/v1/thumbnails/${thumbnailId}/set-primary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setStatus('✅ Set as primary thumbnail');
        loadThumbnails();
      } else {
        const error = await response.json();
        setStatus('❌ ' + error.message);
      }
    } catch (error) {
      setStatus('❌ Failed to set primary: ' + error.message);
    }
  };

  const deleteThumbnail = async (thumbnailId) => {
    if (!window.confirm('Delete this thumbnail? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/v1/thumbnails/${thumbnailId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setStatus('✅ Thumbnail deleted');
        loadThumbnails();
      } else {
        const error = await response.json();
        setStatus('❌ ' + error.message);
      }
    } catch (error) {
      setStatus('❌ Failed to delete: ' + error.message);
    }
  };

  const getStatusBadge = (thumbnail) => {
    if (thumbnail.isPrimary) {
      return <span className="badge badge-primary">PRIMARY</span>;
    }
    if (thumbnail.publishStatus === 'PUBLISHED') {
      return <span className="badge badge-success">PUBLISHED</span>;
    }
    if (thumbnail.publishStatus === 'UNPUBLISHED') {
      return <span className="badge badge-warning">UNPUBLISHED</span>;
    }
    return <span className="badge badge-draft">DRAFT</span>;
  };

  const getImageUrl = (thumbnail) => {
    // ✅ FIX: Use API endpoint to get proper S3 URL
    if (thumbnail.s3Key && thumbnail.s3Bucket) {
      const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
      return `https://${thumbnail.s3Bucket}.s3.${region}.amazonaws.com/${thumbnail.s3Key}`;
    }
    return null;
  };

  if (loading) {
    return <div className="loading">⏳ Loading thumbnails...</div>;
  }

  return (
    <div className="thumbnail-gallery">
      <div className="gallery-header">
        <h1>🖼️ Thumbnail Gallery</h1>
        <p className="episode-info">
          {episode?.title || `Episode ${episodeId}`}
          {thumbnails.length > 0 && ` • ${thumbnails.length} thumbnail(s)`}
        </p>
      </div>

      {status && (
        <div className={`status-message ${status.includes('✅') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}

      {thumbnails.length === 0 && (
        <div className="empty-state">
          <p>No thumbnails generated yet.</p>
          <button onClick={() => window.location.href = '/composer'} className="btn-create">
            Create Composition
          </button>
        </div>
      )}

      {thumbnails.length > 0 && (
        <div className="thumbnails-grid">
          {thumbnails.map(thumb => {
            const imgUrl = getImageUrl(thumb);
            return (
              <div key={thumb.id} className="thumbnail-card">
                <div className="thumbnail-preview">
                  {imgUrl ? (
                    <img src={imgUrl} alt={thumb.format} />
                  ) : (
                    <div className="no-image">No Image</div>
                  )}
                  {getStatusBadge(thumb)}
                </div>

                <div className="thumbnail-info">
                  <h3>{thumb.format}</h3>
                  {thumb.widthPixels && thumb.heightPixels && (
                    <p className="dimensions">{thumb.widthPixels} × {thumb.heightPixels}px</p>
                  )}
                  {thumb.publishedAt && (
                    <p className="publish-date">
                      📅 {new Date(thumb.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="thumbnail-actions">
                  {thumb.publishStatus === 'DRAFT' && (
                    <button 
                      onClick={() => publishThumbnail(thumb.id)}
                      className="btn-publish"
                      title="Publish this thumbnail"
                    >
                      ✅ Publish
                    </button>
                  )}

                  {thumb.publishStatus === 'PUBLISHED' && !thumb.isPrimary && (
                    <button 
                      onClick={() => unpublishThumbnail(thumb.id)}
                      className="btn-unpublish"
                      title="Unpublish this thumbnail"
                    >
                      ❌ Unpublish
                    </button>
                  )}

                  {thumb.format === 'YOUTUBE' && !thumb.isPrimary && (
                    <button 
                      onClick={() => setPrimary(thumb.id)}
                      className="btn-primary-set"
                      title="Set as primary thumbnail"
                    >
                      ⭐ Primary
                    </button>
                  )}

                  {!thumb.isPrimary && (
                    <button 
                      onClick={() => deleteThumbnail(thumb.id)}
                      className="btn-delete"
                      title="Delete this thumbnail"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="gallery-footer">
        <button onClick={() => window.location.href = '/composer'} className="btn-back">
          ← Back to Composer
        </button>
      </div>
    </div>
  );
}

export default ThumbnailGallery;

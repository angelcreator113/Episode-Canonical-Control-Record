import React, { useState, useEffect } from 'react';
import { HiX, HiDownload, HiTrash, HiHeart } from 'react-icons/hi';
import { API_URL } from '../config/api';
import './AssetDetailsModal.css';

const AssetDetailsModal = ({ asset: initialAsset, onClose, onUpdate }) => {
  const [asset, setAsset] = useState(initialAsset);
  const [isFavorite, setIsFavorite] = useState(initialAsset?.metadata?.isFavorite || false); // SEPARATE STATE
  const [loading, setLoading] = useState(false);

  // Update isFavorite when asset changes
  useEffect(() => {
    setIsFavorite(asset?.metadata?.isFavorite || false);
  }, [asset]);

  const handleToggleFavorite = async () => {
    try {
      const newFavoriteState = !isFavorite;
      console.log('Toggling favorite to:', newFavoriteState);
      
      // ✅ UPDATE LOCAL STATE IMMEDIATELY (OPTIMISTIC UPDATE)
      setIsFavorite(newFavoriteState);

      const response = await fetch(`${API_URL}/assets/${asset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          metadata: {
            ...asset.metadata,
            isFavorite: newFavoriteState
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }

      const data = await response.json();
      console.log('Response:', data);

      // Update full asset object
      const updatedAsset = {
        ...asset,
        metadata: {
          ...asset.metadata,
          isFavorite: newFavoriteState
        }
      };
      
      setAsset(updatedAsset);
      console.log('Updated asset:', updatedAsset);

      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }

    } catch (error) {
      console.error('Error toggling favorite:', error);
      // ✅ REVERT ON ERROR
      setIsFavorite(!isFavorite);
      alert('Failed to update favorite status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this asset permanently?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/assets/${asset.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete asset');
      }

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="asset-details-modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content asset-details-content">
        {/* Header */}
        <div className="modal-header">
          <h2>Asset Details</h2>
          <button className="modal-close" onClick={onClose}>
            <HiX size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body asset-details-body">
          {/* Preview Image */}
          <div className="asset-preview">
            <img src={asset.thumbnail_url || asset.url} alt={asset.name} />
            <div className="asset-type-badge">
              {asset.type?.replace('_', ' ')}
            </div>
          </div>

          {/* Details */}
          <div className="asset-details-info">
            <div className="detail-section">
              <label>Name</label>
              <p>{asset.name}</p>
            </div>

            <div className="detail-section">
              <label>Description</label>
              <p>{asset.metadata?.description || 'No description'}</p>
            </div>

            <div className="detail-section">
              <label>Episode</label>
              <p>{asset.metadata?.episodeTitle || 'Welcome to the Show'}</p>
            </div>

            <div className="detail-section">
              <label>Tags</label>
              <p>{asset.metadata?.tags?.join(', ') || 'No tags'}</p>
            </div>

            <div className="detail-section">
              <label>File Info</label>
              <div className="file-info">
                <span>Uploaded: {new Date(asset.created_at).toLocaleDateString()}</span>
                <span>Size: {asset.size || 'N/A'}</span>
                {asset.dimensions && <span>Dimensions: {asset.dimensions}</span>}
              </div>
            </div>

            {asset.metadata?.usedInEpisodes?.length > 0 && (
              <div className="detail-section">
                <label>Used In Episodes</label>
                <div className="used-episodes">
                  {asset.metadata.usedInEpisodes.map(ep => (
                    <span key={ep.id} className="episode-badge">
                      {ep.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="asset-details-actions">
          {/* Favorite Button - USE isFavorite STATE */}
          <button 
            onClick={handleToggleFavorite}
            className={`action-btn favorite ${isFavorite ? 'active' : ''}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            disabled={loading}
          >
            {isFavorite ? (
              <>
                {/* FILLED HEART */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span>Favorited</span>
              </>
            ) : (
              <>
                {/* OUTLINE HEART */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span>Favorite</span>
              </>
            )}
          </button>

          {/* Download Button */}
          <button 
            onClick={() => window.open(asset.url, '_blank')}
            className="action-btn download"
            title="Download asset"
            disabled={loading}
          >
            <HiDownload size={20} />
            <span>Download</span>
          </button>

          {/* Delete Button */}
          <button 
            onClick={handleDelete}
            className="action-btn delete"
            title="Delete asset"
            disabled={loading}
          >
            <HiTrash size={20} />
            <span>Delete</span>
          </button>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailsModal;

/**
 * AssetPreviewModal Component
 * Full-screen asset preview with navigation and actions
 */

import React, { useState, useEffect } from 'react';
import LabelSelector from './LabelSelector';
import assetService from '../services/assetService';
import './AssetPreviewModal.css';

const AssetPreviewModal = ({ asset, allAssets = [], onClose, onRefresh, onNavigate }) => {
  const [currentAsset, setCurrentAsset] = useState(asset);
  const [showLabels, setShowLabels] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    setCurrentAsset(asset);
  }, [asset]);

  const currentIndex = allAssets.findIndex(a => a.id === currentAsset.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allAssets.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      const prev = allAssets[currentIndex - 1];
      setCurrentAsset(prev);
      onNavigate && onNavigate(prev);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const next = allAssets[currentIndex + 1];
      setCurrentAsset(next);
      onNavigate && onNavigate(next);
    }
  };

  const handleDownload = async (version = 'raw') => {
    setDownloading(true);
    try {
      const url = version === 'processed' ? currentAsset.s3_url_processed : currentAsset.s3_url_raw;
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentAsset.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      alert('Download failed: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${currentAsset.name}"? This cannot be undone.`)) return;
    
    setProcessing(true);
    try {
      await assetService.deleteAsset(currentAsset.id);
      alert('✅ Asset deleted successfully!');
      if (onRefresh) {
        await onRefresh();
      }
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!confirm('Process background removal? This will use API credits.')) return;

    setProcessing(true);
    try {
      await assetService.processBackground(currentAsset.id);
      alert('✅ Background removal started!');
      onRefresh && onRefresh();
      // Reload current asset
      const response = await assetService.searchAssets({ query: '', assetType: currentAsset.asset_type });
      const updated = response.data.data.find(a => a.id === currentAsset.id);
      if (updated) setCurrentAsset(updated);
    } catch (error) {
      alert('Background removal failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const isVideo = currentAsset.media_type === 'video';
  const hasProcessedVersion = !!currentAsset.s3_url_processed;
  const displayUrl = showProcessed && hasProcessedVersion ? currentAsset.s3_url_processed : currentAsset.s3_url_raw;

  // Check for mock URLs
  const isMockUrl = displayUrl?.includes('mock-s3.dev');
  const getPlaceholderUrl = () => {
    const typeLabel = currentAsset.asset_type?.replace(/_/g, ' ') || 'Asset';
    const mediaIcon = isVideo ? '🎥' : '🖼️';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#6366f1"/><text x="50%" y="40%" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text><text x="50%" y="62%" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.5)" text-anchor="middle" dominant-baseline="middle">(Preview unavailable - mock URL)</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const placeholderUrl = getPlaceholderUrl();

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="asset-preview-modal-overlay" onClick={onClose}>
      <div className="asset-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">
          ✕
        </button>

        {/* Navigation Arrows */}
        {hasPrevious && (
          <button className="modal-nav-btn modal-nav-prev" onClick={handlePrevious} title="Previous (←)">
            ‹
          </button>
        )}
        {hasNext && (
          <button className="modal-nav-btn modal-nav-next" onClick={handleNext} title="Next (→)">
            ›
          </button>
        )}

        {/* Main Content */}
        <div className="modal-content-wrapper">
          {/* Media Display */}
          <div className="modal-media">
            {isVideo ? (
              <video
                src={isMockUrl ? placeholderUrl : displayUrl}
                controls
                className="modal-video"
              />
            ) : (
              <img
                src={isMockUrl ? placeholderUrl : displayUrl}
                alt={currentAsset.name}
                className="modal-image"
                onError={(e) => { e.target.src = placeholderUrl; }}
              />
            )}

            {/* Version Toggle */}
            {!isVideo && hasProcessedVersion && (
              <button
                onClick={() => setShowProcessed(!showProcessed)}
                className="modal-version-toggle"
              >
                {showProcessed ? '🖼️ Show Original' : '✨ Show Processed'}
              </button>
            )}

            {/* Counter */}
            <div className="modal-counter">
              {currentIndex + 1} / {allAssets.length}
            </div>
          </div>

          {/* Sidebar */}
          <div className="modal-sidebar">
            <div className="modal-sidebar-content">
              {/* Title */}
              <h2 className="modal-title">{currentAsset.name}</h2>

              {/* Metadata */}
              <div className="modal-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">Type:</span>
                  <span className="metadata-value">{currentAsset.asset_type}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Media:</span>
                  <span className="metadata-value">{isVideo ? '🎥 Video' : '🖼️ Image'}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Size:</span>
                  <span className="metadata-value">{formatFileSize(currentAsset.file_size_bytes)}</span>
                </div>
                {currentAsset.width && currentAsset.height && (
                  <div className="metadata-item">
                    <span className="metadata-label">Dimensions:</span>
                    <span className="metadata-value">{currentAsset.width} × {currentAsset.height}</span>
                  </div>
                )}
                {isVideo && currentAsset.duration_seconds && (
                  <div className="metadata-item">
                    <span className="metadata-label">Duration:</span>
                    <span className="metadata-value">{formatDuration(currentAsset.duration_seconds)}</span>
                  </div>
                )}
                {currentAsset.description && (
                  <div className="metadata-item">
                    <span className="metadata-label">Description:</span>
                    <p className="metadata-value">{currentAsset.description}</p>
                  </div>
                )}
              </div>

              {/* Labels */}
              <div className="modal-labels-section">
                <button
                  className="modal-labels-toggle"
                  onClick={() => setShowLabels(!showLabels)}
                >
                  🏷️ Labels ({currentAsset.labels?.length || 0})
                </button>
                {showLabels && (
                  <LabelSelector
                    assetId={currentAsset.id}
                    currentLabels={currentAsset.labels || []}
                    onUpdate={() => {
                      onRefresh && onRefresh();
                      // Reload current asset
                      assetService.searchAssets({ query: '', assetType: currentAsset.asset_type })
                        .then(response => {
                          const updated = response.data.data.find(a => a.id === currentAsset.id);
                          if (updated) setCurrentAsset(updated);
                        });
                    }}
                  />
                )}
              </div>

              {/* Status */}
              {hasProcessedVersion && (
                <div className="modal-status">
                  <span className="status-badge-modal success">✓ Background Removed</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button
                onClick={() => handleDownload('raw')}
                disabled={downloading || isMockUrl}
                className="modal-btn modal-btn-primary"
                title={isMockUrl ? 'Not available (mock URL)' : 'Download original'}
              >
                ⬇️ Download{hasProcessedVersion ? ' Original' : ''}
              </button>

              {hasProcessedVersion && (
                <button
                  onClick={() => handleDownload('processed')}
                  disabled={downloading}
                  className="modal-btn modal-btn-primary"
                >
                  ⬇️ Download Processed
                </button>
              )}

              {!hasProcessedVersion && !isVideo && (
                <button
                  onClick={handleRemoveBackground}
                  disabled={processing}
                  className="modal-btn modal-btn-secondary"
                >
                  🎨 Remove Background
                </button>
              )}

              <button
                onClick={handleDelete}
                disabled={processing}
                className="modal-btn modal-btn-danger"
              >
                🗑️ Delete Asset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetPreviewModal;

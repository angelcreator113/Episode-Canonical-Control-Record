/**
 * AssetCard Component
 * Enhanced card with labels, editing, BG removal, and selection
 */

import React, { useState } from 'react';
import LabelSelector from './LabelSelector';
import assetService from '../services/assetService';
import './AssetCard.css';

const AssetCard = ({
  asset,
  onRefresh,
  onSelect,
  isSelected = false,
  showSelection = false,
  showActions = true,
  onPreview,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description || '');
  const [processing, setProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(true);
  const [showUsage, setShowUsage] = useState(false);
  const [usage, setUsage] = useState([]);

  const hasProcessedVersion = !!asset.s3_url_processed;
  const isVideo = asset.media_type === 'video';
  const displayUrl = showProcessed && hasProcessedVersion ? asset.s3_url_processed : asset.s3_url_raw;
  const [imgError, setImgError] = useState(false);
  
  // Handle mock S3 URLs and errors in development
  const getImageSrc = () => {
    // Check for mock URLs or missing URLs first
    const url = displayUrl;
    if (!url || url.includes('mock-s3.dev') || url.includes('undefined') || imgError) {
      // Return a data URI with centered text instead of external placeholder
      const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
      const mediaIcon = asset.media_type === 'video' ? '🎥' : '🖼️';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    return url;
  };

  const handleSaveEdit = async () => {
    setProcessing(true);
    try {
      await assetService.updateAsset(asset.id, {
        name: editName,
        description,
      });
      setIsEditing(false);
      onRefresh && onRefresh();
    } catch (error) {
      alert('Failed to update asset');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!confirm('Process background removal? This will use API credits.')) return;

    setProcessing(true);
    try {
      await assetService.processBackground(asset.id);
      onRefresh && onRefresh();
    } catch (error) {
      alert('Background removal failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;

    setProcessing(true);
    try {
      console.log('Deleting asset:', asset.id);
      const response = await assetService.deleteAsset(asset.id);
      console.log('Delete response:', response);
      alert('✅ Asset deleted successfully!');
      // Force refresh by calling onRefresh
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete asset: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const loadUsage = async () => {
    try {
      const response = await assetService.getAssetUsage(asset.id);
      setUsage(response.data.data || []);
      setShowUsage(true);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`asset-card ${isSelected ? 'selected' : ''}`}>
      {/* Selection Checkbox */}
      {showSelection && (
        <div className="asset-selection">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect && onSelect(asset.id, e.target.checked)}
          />
        </div>
      )}

      {/* Media Preview */}
      <div className="asset-preview" onClick={() => onPreview && onPreview(asset)} style={{ cursor: onPreview ? 'pointer' : 'default' }}>
        {isVideo ? (
          <video
            src={displayUrl}
            controls
            className="asset-video"
            title={asset.name}
          />
        ) : (
          <img
            src={getImageSrc()}
            alt={asset.name}
            className="asset-image"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}

        {/* BG Version Toggle */}
        {!isVideo && hasProcessedVersion && (
          <button
            onClick={() => setShowProcessed(!showProcessed)}
            className="asset-preview-toggle"
            title={showProcessed ? 'Show Original' : 'Show Processed'}
          >
            {showProcessed ? '🖼️' : '✨'}
          </button>
        )}

        {/* Media Type Badge */}
        <span className="asset-media-badge">
          {isVideo ? '🎥' : '🖼️'} {asset.media_type}
        </span>
      </div>

      {/* Asset Info */}
      <div className="asset-info">
        {/* Name (Editable) */}
        {isEditing ? (
          <div className="asset-name-edit">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') { setIsEditing(false); setEditName(asset.name); }
              }}
              autoFocus
              className="asset-name-input"
            />
            <small className="edit-hint">Press Enter to save, Esc to cancel</small>
          </div>
        ) : (
          <h3
            className="asset-name"
            onClick={() => showActions && setIsEditing(true)}
            title="Click to edit"
          >
            {asset.name}
          </h3>
        )}

        {/* Description */}
        {isEditing && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description..."
            className="asset-description-input"
            rows="2"
          />
        )}

        {/* Type Badge */}
        <span className="asset-type-badge">{asset.asset_type.replace(/_/g, ' ')}</span>

        {/* Meta Info */}
        <div className="asset-meta">
          <span title="File size">{formatFileSize(asset.file_size_bytes)}</span>
          {asset.width && <span>{asset.width}×{asset.height}</span>}
          {isVideo && asset.duration_seconds && (
            <span title="Duration">⏱️ {formatDuration(asset.duration_seconds)}</span>
          )}
        </div>

        {/* Labels */}
        {showActions && (
          <LabelSelector
            assetId={asset.id}
            currentLabels={asset.labels || []}
            onUpdate={onRefresh}
          />
        )}

        {/* Usage Info */}
        {!showUsage && usage.length === 0 && (
          <button onClick={loadUsage} className="asset-usage-btn">
            📊 View Usage
          </button>
        )}
        {showUsage && (
          <div className="asset-usage-info">
            <strong>Used in:</strong> {usage.length} {usage.length === 1 ? 'place' : 'places'}
          </div>
        )}

        {/* Status Indicators */}
        <div className="asset-status">
          {hasProcessedVersion && <span className="status-badge success">✓ BG Removed</span>}
          {asset.approval_status === 'PENDING' && <span className="status-badge warning">⏳ Pending</span>}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="asset-actions">
          {!hasProcessedVersion && !isVideo && (
            <button
              onClick={handleRemoveBackground}
              disabled={processing}
              className="btn-action btn-primary"
              title="Remove background"
            >
              {processing ? '⏳' : '🎨'} Remove BG
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={processing}
            className="btn-action btn-danger"
            title="Delete asset"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="asset-processing-overlay">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
};

export default AssetCard;

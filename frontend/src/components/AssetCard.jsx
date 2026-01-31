/**
 * AssetCard Component
 * Enhanced card with labels, editing, BG removal, and selection
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import LabelSelector from './LabelSelector';
import assetService from '../services/assetService';
import './AssetCard.css';

// Helper function to convert technical asset type to human-readable label
const getAssetTypeLabel = (assetType) => {
  const typeLabels = {
    'PROMO_LALA': 'Lala Character',
    'PROMO_JUSTAWOMANINHERPRIME': 'Show Character',
    'PROMO_GUEST': 'Guest Character',
    'BRAND_LOGO': 'Logo',
    'BACKGROUND_IMAGE': 'Background',
    'BACKGROUND_VIDEO': 'Background Video',
    'EPISODE_FRAME': 'Episode Frame',
    'EPISODE_VIDEO': 'Episode Video',
    'PROMO_VIDEO': 'Promo Video',
    'BRAND_BANNER': 'Banner',
    'BRAND_SOCIAL': 'Social Media',
    'LALA_VIDEO': 'Lala Video',
    'LALA_HEADSHOT': 'Lala Headshot',
    'LALA_FULLBODY': 'Lala Full Body',
    'GUEST_VIDEO': 'Guest Video',
    'GUEST_HEADSHOT': 'Guest Headshot',
    'CLOTHING_DRESS': 'Dress',
    'CLOTHING_TOP': 'Top',
    'CLOTHING_BOTTOM': 'Bottom',
    'CLOTHING_SHOES': 'Shoes',
    'CLOTHING_ACCESSORIES': 'Accessories',
    'CLOTHING_JEWELRY': 'Jewelry',
    'CLOTHING_PERFUME': 'Perfume',
  };
  return typeLabels[assetType] || assetType?.replace(/_/g, ' ') || 'Asset';
};

// Helper function to convert technical "allowed_uses" to readable labels
const getUsageLabel = (use) => {
  const usageLabels = {
    'THUMBNAIL': 'Thumbnail',
    'SCENE': 'Scene Background',
    'UI': 'User Interface',
    'SOCIAL': 'Social Media',
    'PROMO': 'Promotional',
    'TITLE': 'Title Card',
  };
  return usageLabels[use] || use;
};

// Add this helper function in AssetCard.jsx
const getEpisodeInfo = (asset) => {
  const metadata = asset.metadata || {};
  if (metadata.episodeNumber && metadata.episodeTitle) {
    return {
      number: metadata.episodeNumber,
      title: metadata.episodeTitle,
      scene: metadata.scene || ''
    };
  }
  return null;
};

const AssetCard = ({
  asset,
  onRefresh,
  onSelect,
  isSelected = false,
  showSelection = false,
  showActions = true,
  onPreview,
  viewMode = 'compact', // 'compact', 'detailed', 'list'
}) => {
  const [processing, setProcessing] = useState(false);
  const [showProcessed, setShowProcessed] = useState(true);
  const [showUsage, setShowUsage] = useState(false);
  const [usage, setUsage] = useState([]);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu]);

  const hasProcessedVersion = !!asset.s3_url_processed;
  const isVideo = asset.media_type === 'video';
  
  // Use full resolution for better quality display
  const getDisplayUrl = () => {
    // For images: use processed if available, otherwise raw
    // This gives us full resolution instead of low-res thumbnails
    if (isVideo) {
      return showProcessed && hasProcessedVersion ? asset.s3_url_processed : asset.s3_url_raw;
    }
    return asset.s3_url_processed || asset.s3_url_raw;
  };
  
  const displayUrl = getDisplayUrl();

  // In the render section, add this badge after the asset type badge:
  const episodeInfo = getEpisodeInfo(asset);

  // Handle mock S3 URLs and errors in development
  const getImageSrc = () => {
    // Check for mock URLs or missing URLs first
    const url = displayUrl;
    if (!url || url.includes('mock-s3.dev') || url.includes('undefined') || imgError) {
      // Return a data URI with centered text instead of external placeholder
      const typeLabel = getAssetTypeLabel(asset.asset_type);
      const mediaIcon = asset.media_type === 'video' ? '🎥' : '🖼️';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    return url;
  };



  const loadUsage = async () => {
    console.log('🔍 loadUsage called for asset:', asset.id);
    try {
      const response = await assetService.getAssetUsage(asset.id);
      console.log('✅ Usage response:', response);
      console.log('📊 Response data:', response.data);
      // The response is { status, data, count }
      const usageData = response.data?.data || response.data || [];
      console.log('📋 Parsed usage data:', usageData);
      setUsage(usageData);
      setShowUsageModal(true);
      console.log('✓ showUsageModal set to true');
    } catch (error) {
      console.error('❌ Failed to load usage:', error);
      console.error('Error details:', error.response?.data);
      // Show empty usage on error
      setUsage([]);
      setShowUsageModal(true);
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
      <div
        className="asset-preview"
        onClick={() => onPreview && onPreview(asset)}
        style={{ cursor: onPreview ? 'pointer' : 'default' }}
      >
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
        {/* Name */}
        <h3 className="asset-name" title={asset.name}>
          {asset.name}
        </h3>

        {/* Primary Identity: Role Badge */}
        <span className="asset-type-badge">{getAssetTypeLabel(asset.asset_type)}</span>

        {/* Secondary: Folder/Group */}
        {asset.asset_group && (
          <span className={`org-badge org-badge-${asset.asset_group.toLowerCase()}`}>
            {asset.asset_group}
          </span>
        )}

        {/* Tertiary Metadata - Hidden by default, shown on hover */}
        <div className="asset-secondary-metadata">
          {asset.purpose && (
            <span className="org-badge org-badge-purpose">
              {asset.purpose}
            </span>
          )}
          {asset.is_global && (
            <span className="org-badge org-badge-global" title="Available globally">
              🌐 Global
            </span>
          )}
        </div>

        {/* Allowed Uses - Hidden by default */}
        {asset.allowed_uses && asset.allowed_uses.length > 0 && (
          <div className="asset-uses">
            <small className="uses-label">Can be used for:</small>
            <div className="uses-tags">
              {asset.allowed_uses.slice(0, 3).map(use => (
                <span key={use} className="use-tag">{getUsageLabel(use)}</span>
              ))}
              {asset.allowed_uses.length > 3 && (
                <span className="use-tag-more">+{asset.allowed_uses.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Add this JSX in the card header area: */}
        {episodeInfo && (
          <div className="episode-badge" title={`Episode ${episodeInfo.number}: ${episodeInfo.title}`}>
            <span className="badge-icon">📺</span>
            <span className="badge-text">Ep {episodeInfo.number}</span>
          </div>
        )}

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



        {/* Status Indicators */}
        <div className="asset-status">
          {hasProcessedVersion && <span className="status-badge success">✓ BG Removed</span>}
          {asset.approval_status === 'PENDING' && <span className="status-badge warning">⏳ Pending</span>}
        </div>
      </div>

      {/* Context Menu Actions */}
      {showActions && (
        <div className="asset-actions-menu-container" ref={menuRef}>
          <button
            className="asset-actions-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setShowActionsMenu(!showActionsMenu);
            }}
            title="More actions"
          >
            ⋮
          </button>
          {showActionsMenu && (
            <div className="asset-actions-menu">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowActionsMenu(false);
                  setShowDetailModal(true);
                }}
                className="menu-item"
              >
                📖 View Details
              </button>
              <button
                onClick={(e) => {
                  console.log('🖱️ View Usage button clicked');
                  e.stopPropagation();
                  e.preventDefault();
                  setShowActionsMenu(false);
                  loadUsage();
                }}
                className="menu-item"
              >
                📊 View Usage
              </button>
            </div>
          )}
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="asset-processing-overlay">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}

      {/* Detail Modal - Book View (rendered via Portal) */}
      {showDetailModal && createPortal(
        <div 
          className="asset-detail-modal-backdrop" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailModal(false);
            }
          }}
        >
          <div className="asset-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📖 Asset Details</h2>
              <button 
                className="modal-close" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowDetailModal(false);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Preview Image */}
              <div className="detail-preview">
                {isVideo ? (
                  <video src={displayUrl} controls style={{ width: '100%', maxHeight: '400px', borderRadius: '8px' }} />
                ) : (
                  <img src={getImageSrc()} alt={asset.name} style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }} />
                )}
              </div>

              {/* Details Grid */}
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{asset.name}</span>
                </div>
                
                {asset.description && (
                  <div className="detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">{asset.description}</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">{getAssetTypeLabel(asset.asset_type)}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Role:</span>
                  <span className="detail-value">{asset.asset_role || 'Not set'}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Media Type:</span>
                  <span className="detail-value">{asset.media_type}</span>
                </div>

                {asset.width && asset.height && (
                  <div className="detail-row">
                    <span className="detail-label">Dimensions:</span>
                    <span className="detail-value">{asset.width} × {asset.height} px</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{formatFileSize(asset.file_size_bytes)}</span>
                </div>

                {isVideo && asset.duration_seconds && (
                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{formatDuration(asset.duration_seconds)}</span>
                  </div>
                )}

                {asset.asset_group && (
                  <div className="detail-row">
                    <span className="detail-label">Group:</span>
                    <span className="detail-value">{asset.asset_group}</span>
                  </div>
                )}

                {asset.purpose && (
                  <div className="detail-row">
                    <span className="detail-label">Purpose:</span>
                    <span className="detail-value">{asset.purpose}</span>
                  </div>
                )}

                {asset.is_global && (
                  <div className="detail-row">
                    <span className="detail-label">Global:</span>
                    <span className="detail-value">🌐 Yes - Available everywhere</span>
                  </div>
                )}

                {asset.allowed_uses && asset.allowed_uses.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Allowed Uses:</span>
                    <span className="detail-value">
                      {asset.allowed_uses.map(use => getUsageLabel(use)).join(', ')}
                    </span>
                  </div>
                )}

                {asset.tags && asset.tags.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Tags:</span>
                    <span className="detail-value">{asset.tags.join(', ')}</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">Approval Status:</span>
                  <span className="detail-value">{asset.approval_status || 'Pending'}</span>
                </div>

                {hasProcessedVersion && (
                  <div className="detail-row">
                    <span className="detail-label">Processing:</span>
                    <span className="detail-value">✓ Background removed</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">Created:</span>
                  <span className="detail-value">{new Date(asset.created_at).toLocaleString()}</span>
                </div>

                {asset.s3_url_raw && (
                  <div className="detail-row">
                    <span className="detail-label">Original URL:</span>
                    <span className="detail-value detail-url">
                      <a href={asset.s3_url_raw} target="_blank" rel="noopener noreferrer">View Original</a>
                    </span>
                  </div>
                )}

                {asset.s3_url_processed && (
                  <div className="detail-row">
                    <span className="detail-label">Processed URL:</span>
                    <span className="detail-value detail-url">
                      <a href={asset.s3_url_processed} target="_blank" rel="noopener noreferrer">View Processed</a>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Usage Modal */}
      {showUsageModal && createPortal(
        <div 
          className="asset-detail-modal-backdrop" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUsageModal(false);
            }
          }}
        >
          <div className="asset-detail-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Asset Usage</h2>
              <button 
                className="modal-close" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowUsageModal(false);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-row">
                <div className="detail-label">Asset Name</div>
                <div className="detail-value"><strong>{asset.name}</strong></div>
              </div>

              <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div className="detail-label">Used In</div>
                <div className="detail-value">
                  {usage.length > 0 ? (
                    <div className="usage-list" style={{ margin: 0 }}>
                      {usage.map((ep, idx) => (
                        <div key={idx} className="usage-item" style={{ marginBottom: '8px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                          <div style={{ fontWeight: 600, color: '#2563eb', marginBottom: '4px' }}>
                            Episode {ep.episode_number}
                          </div>
                          <div style={{ color: '#374151' }}>
                            {ep.episode_title || 'Untitled'}
                          </div>
                          {ep.usage_type && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                              Type: {ep.usage_type}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                      <div>Not currently used in any episodes</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AssetCard;

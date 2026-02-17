// frontend/src/components/Episodes/EpisodeAssetsTab.jsx - ENHANCED
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetService } from '../../services/assetService';
import AssetUploader from '../Assets/AssetUploader';
import AssetLinkModal from '../Assets/AssetLinkModal';
import './EpisodeAssetsTab.css';

/**
 * EpisodeAssetsTab - Two-section asset management
 * 
 * Section 1: From Show Library (linked, reusable)
 * Section 2: Episode Only (unique to episode)
 * 
 * Features: Link, Unlink, Upload, Promote, Bulk operations
 */

// Map asset type/role to UI category
const mapAssetTypeToCategory = (assetType) => {
  if (!assetType) return 'other';
  const type = assetType.toUpperCase();
  if (type.includes('LOGO') || type.includes('BRAND')) return 'logos';
  if (type.includes('BACKGROUND') || type.includes('BG')) return 'backgrounds';
  if (type.includes('INTRO')) return 'intros';
  if (type.includes('OUTRO')) return 'outros';
  if (type.includes('MUSIC') || type.includes('AUDIO')) return 'music';
  if (type.includes('WARDROBE') || type.includes('OUTFIT')) return 'wardrobe';
  if (type.includes('THUMBNAIL')) return 'thumbnail';
  return 'other';
};

// Generate placeholder thumbnail for assets without one
const generatePlaceholderThumbnail = (category) => {
  const icons = {
    logos: '🎬',
    backgrounds: '🖼️',
    intros: '🎵',
    outros: '🎬',
    music: '🎵',
    wardrobe: '👗',
    thumbnail: '🖼️',
    other: '📎'
  };
  const icon = icons[category] || '📎';
  return `data:image/svg+xml;base64,${btoa(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#64748b"/><text x="50%" y="50%" font-size="80" text-anchor="middle" dy=".3em">${icon}</text></svg>`)}`;
};

function EpisodeAssetsTab({ episode, show }) {
  const navigate = useNavigate();
  const [linkedAssets, setLinkedAssets] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [showUploader, setShowUploader] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Safety check
  if (!episode || !show) {
    return <div className="episode-assets-loading">Loading episode and show data...</div>;
  }
  
  useEffect(() => {
    if (episode?.id) {
      fetchEpisodeAssets();
    }
  }, [episode?.id]);
  
  const fetchEpisodeAssets = async () => {
    setLoading(true);
    try {
      // Fetch assets linked to this episode via the junction table
      const response = await assetService.getEpisodeAssets(episode.id);
      
      const assetsArray = response.data?.assets || response.data || [];
      
      // Separate linked (show) assets from episode-only assets
      const linked = [];
      const epOnly = [];
      
      assetsArray.forEach(asset => {
        const category = mapAssetTypeToCategory(asset.asset_type || asset.asset_role);
        const mappedAsset = {
          id: asset.id,
          name: asset.name || asset.file_name || 'Untitled Asset',
          type: asset.media_type || (asset.content_type?.startsWith('video') ? 'video' : 'image'),
          category: category,
          url: asset.s3_url_raw || asset.url,
          thumbnail_url: asset.metadata?.thumbnail_url || asset.s3_url_raw || generatePlaceholderThumbnail(category),
          source: asset.asset_scope || 'EPISODE'
        };
        
        if (asset.asset_scope === 'SHOW' || asset.show_id) {
          linked.push(mappedAsset);
        } else {
          epOnly.push(mappedAsset);
        }
      });
      
      setLinkedAssets(linked);
      setEpisodeAssets(epOnly);
      console.log(`✅ EpisodeAssetsTab: Loaded ${linked.length} linked, ${epOnly.length} episode-only assets`);
    } catch (error) {
      console.error('Error fetching episode assets:', error);
      setLinkedAssets([]);
      setEpisodeAssets([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Map category to asset type (must match backend VALID_ASSET_TYPES)
  const categoryToAssetType = (category) => {
    const mapping = {
      thumbnail: 'THUMBNAIL',
      guest_photo: 'GUEST_PHOTO',
      custom_graphic: 'CUSTOM_GRAPHIC',
      b_roll: 'B_ROLL',
      other: 'EPISODE_FRAME'
    };
    return mapping[category] || 'EPISODE_FRAME';
  };
  
  // Handle file upload
  const handleUpload = async (files, category, destination) => {
    try {
      console.log('Uploading episode assets:', files, 'Category:', category, 'Destination:', destination);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', categoryToAssetType(category));
        formData.append('metadata', JSON.stringify({
          episodeId: episode.id,
          episode_id: episode.id,
          asset_scope: 'EPISODE',
          purpose: category,
          uploadedFrom: 'EpisodeAssetsTab'
        }));
        
        await assetService.uploadAsset(formData);
        console.log(`✅ Uploaded: ${file.name}`);
      }
      
      // Refresh assets
      await fetchEpisodeAssets();
      
      setShowUploader(false);
      alert(`Successfully uploaded ${files.length} asset(s) to episode!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload assets: ' + error.message);
    }
  };
  
  const handleLinkAssets = async (assetIds) => {
    if (!assetIds || assetIds.length === 0) return;
    
    try {
      await assetService.linkAssetsToEpisode(episode.id, assetIds);
      console.log(`✅ Linked ${assetIds.length} assets to episode`);
      await fetchEpisodeAssets();
      setShowLinkModal(false);
    } catch (error) {
      console.error('Error linking assets:', error);
      alert('Failed to link assets. Please try again.');
    }
  };
  
  const handlePromoteToShow = async (asset) => {
    if (!confirm(`Promote "${asset.name}" to Show Library?`)) return;
    
    const replaceWithLink = confirm(
      'Replace episode copy with link to show asset?\n\nYes = Linked (saves space)\nNo = Keep both'
    );
    
    if (replaceWithLink) {
      setEpisodeAssets(episodeAssets.filter(a => a.id !== asset.id));
      setLinkedAssets([...linkedAssets, { ...asset, source: 'show' }]);
    }
    
    alert('Asset promoted to Show Library!');
  };
  
  if (loading) return <div className="episode-assets-loading">Loading...</div>;
  
  return (
    <div className="episode-assets-tab">
      {/* FROM SHOW LIBRARY */}
      <section className="linked-assets-section">
        <div className="section-header">
          <div className="header-left">
            <h3><span className="section-icon">🔗</span> From Show Library</h3>
            <p className="section-subtitle">Reusable assets from {show.name}</p>
          </div>
          <button className="btn-link-asset" onClick={() => setShowLinkModal(true)}>
            + Link Show Asset
          </button>
        </div>
        
        {linkedAssets.length === 0 ? (
          <div className="empty-section">
            <div className="empty-icon">🔗</div>
            <p>No show assets linked</p>
            <button className="btn-primary" onClick={() => setShowLinkModal(true)}>
              + Link Show Asset
            </button>
          </div>
        ) : (
          <div className="assets-grid">
            {linkedAssets.map(asset => (
              <div key={asset.id} className="asset-card linked-asset">
                <div className="asset-badge linked-badge">🔗 Linked</div>
                <div className="asset-thumbnail">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.name} />
                  ) : (
                    <img src={asset.thumbnail_url} alt={asset.name} />
                  )}
                </div>
                <div className="asset-info">
                  <div className="asset-category-badge" style={{ background: '#10b981' }}>
                    🔗 {asset.category || 'Asset'}
                  </div>
                  <h4 className="asset-name">{asset.name}</h4>
                  <div className="asset-meta">
                    <span>{asset.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* EPISODE ONLY */}
      <section className="episode-assets-section">
        <div className="section-header">
          <div className="header-left">
            <h3><span className="section-icon">📎</span> Episode Only</h3>
            <p className="section-subtitle">Unique to this episode</p>
          </div>
          <button className="btn-upload" onClick={() => setShowUploader(true)}>
            + Upload New
          </button>
        </div>
        
        {episodeAssets.length === 0 ? (
          <div className="empty-section">
            <div className="empty-icon">📎</div>
            <p>No episode assets</p>
            <button className="btn-primary" onClick={() => setShowUploader(true)}>
              + Upload Asset
            </button>
          </div>
        ) : (
          <div className="assets-grid">
            {episodeAssets.map(asset => (
              <div key={asset.id} className="asset-card episode-asset">
                <div className="asset-badge episode-badge">📎 Episode</div>
                <div className="asset-thumbnail">
                  <img src={asset.url || asset.thumbnail_url} alt={asset.name} />
                </div>
                <div className="asset-info">
                  <div className="asset-category-badge" style={{ background: '#8b5cf6' }}>
                    📎 {asset.category || 'Asset'}
                  </div>
                  <h4 className="asset-name">{asset.name}</h4>
                  <div className="asset-meta">
                    <span>{asset.type}</span>
                    <button
                      className="btn-promote-inline"
                      onClick={(e) => { e.stopPropagation(); handlePromoteToShow(asset); }}
                    >
                      ⬆️ Promote
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {showUploader && (
        <AssetUploader
          context="episode"
          onUpload={handleUpload}
          onClose={() => setShowUploader(false)}
        />
      )}
      
      {showLinkModal && (
        <AssetLinkModal
          show={show}
          episode={episode}
          onLink={handleLinkAssets}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

export default EpisodeAssetsTab;

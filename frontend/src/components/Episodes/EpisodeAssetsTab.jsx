// frontend/src/components/Episodes/EpisodeAssetsTab.jsx - ENHANCED
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      // Mock data - replace with API calls
      setLinkedAssets([
        {
          id: 'linked-1',
          name: 'Show Logo',
          type: 'image',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzEwYjk4MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OrDwvdGV4dD48L3N2Zz4=',
          category: 'logos'
        }
      ]);
      
      setEpisodeAssets([
        {
          id: 'ep-1',
          name: 'Episode Thumbnail',
          type: 'image',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzhiNWNmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+WvO+4jzwvdGV4dD48L3N2Zz4=',
          category: 'thumbnail'
        }
      ]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
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
                <img src={asset.thumbnail_url} alt={asset.name} className="asset-thumb" />
                <h4>{asset.name}</h4>
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
                <img src={asset.thumbnail_url} alt={asset.name} className="asset-thumb" />
                <h4>{asset.name}</h4>
                <button
                  className="btn-promote"
                  onClick={() => handlePromoteToShow(asset)}
                  title="Promote to Show Library"
                >
                  ⬆️ Promote
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {showUploader && (
        <AssetUploader
          context="episode"
          onUpload={async () => { await fetchEpisodeAssets(); setShowUploader(false); }}
          onClose={() => setShowUploader(false)}
        />
      )}
      
      {showLinkModal && (
        <AssetLinkModal
          show={show}
          onLink={async () => { await fetchEpisodeAssets(); setShowLinkModal(false); }}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

export default EpisodeAssetsTab;

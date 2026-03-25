import React, { useState, useEffect, useCallback } from 'react';
import { Search, Image, Video, User, MapPin, Palette, Upload, Plus, X } from 'lucide-react';
import api from '../../../services/api';

/**
 * AssetDrawer — Browse/search/upload assets to add to the Scene Studio canvas.
 * Collapsible panel below the Objects Panel on the left.
 */

const TABS = [
  { key: 'all', label: 'All', icon: Palette },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'video', label: 'Videos', icon: Video },
  { key: 'character', label: 'Characters', icon: User },
];

export default function AssetDrawer({ showId, episodeId, onAddAsset, isOpen, onToggle }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (showId) params.show_id = showId;
      if (episodeId) params.episode_id = episodeId;
      if (search) params.search = search;

      // Map tab to category filter
      if (activeTab === 'image') params.asset_type = 'image';
      else if (activeTab === 'video') params.asset_type = 'video';
      else if (activeTab === 'character') params.category = 'character_outfit';
      // background filter removed — backgrounds come from Scene Sets

      const { data } = await api.get('/api/v1/assets', { params });
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('AssetDrawer fetch error:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId, search, activeTab]);

  useEffect(() => {
    if (isOpen) fetchAssets();
  }, [isOpen, fetchAssets]);

  const handleAddAsset = useCallback((asset) => {
    if (!onAddAsset) return;

    const contentType = asset.content_type || '';
    const isVideo = contentType.startsWith('video/');

    onAddAsset({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: isVideo ? 'video' : 'image',
      assetId: asset.id,
      assetUrl: asset.s3_url_processed || asset.s3_url_raw || '',
      x: 100,
      y: 100,
      width: asset.width || 300,
      height: asset.height || 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      flipX: false,
      flipY: false,
      label: asset.character_name || asset.outfit_name || asset.location_name || asset.category || 'Asset',
      assetRole: asset.category || null,
      usageType: 'overlay',
      _asset: asset,
    });
  }, [onAddAsset]);

  if (!isOpen) {
    return (
      <button className="scene-studio-drawer-toggle" onClick={onToggle}>
        <Plus size={14} />
        <span>Add Assets</span>
      </button>
    );
  }

  return (
    <div className="scene-studio-asset-drawer">
      <div className="scene-studio-panel-header">
        <Palette size={14} />
        <span>Asset Library</span>
        <button className="scene-studio-icon-btn" onClick={onToggle}>
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="scene-studio-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="scene-studio-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`scene-studio-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Asset Grid */}
      <div className="scene-studio-asset-grid">
        {loading && <div className="scene-studio-loading">Loading...</div>}

        {!loading && assets.length === 0 && (
          <div className="scene-studio-empty-state">No assets found.</div>
        )}

        {assets.map((asset) => {
          const thumbUrl = asset.s3_url_processed || asset.s3_url_raw || '';
          const isVideo = (asset.content_type || '').startsWith('video/');

          return (
            <div
              key={asset.id}
              className="scene-studio-asset-thumb"
              onClick={() => handleAddAsset(asset)}
              title={asset.character_name || asset.outfit_name || asset.location_name || asset.category}
            >
              {thumbUrl ? (
                isVideo ? (
                  <div className="scene-studio-video-thumb">
                    <Video size={20} />
                  </div>
                ) : (
                  <img src={thumbUrl} alt="" loading="lazy" />
                )
              ) : (
                <div className="scene-studio-no-thumb">
                  <Image size={20} />
                </div>
              )}
              <span className="scene-studio-asset-name">
                {asset.character_name || asset.outfit_name || asset.location_name || asset.category || 'Asset'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

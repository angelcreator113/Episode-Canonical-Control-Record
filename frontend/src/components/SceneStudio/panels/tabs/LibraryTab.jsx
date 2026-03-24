import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Image, Video, User, MapPin, Palette } from 'lucide-react';
import api from '../../../../services/api';

/**
 * LibraryTab — Browse/search assets from the asset library.
 * Extracted and enhanced from the old AssetDrawer.
 */

const FILTERS = [
  { key: 'all', label: 'All', icon: Palette },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'video', label: 'Videos', icon: Video },
  { key: 'character', label: 'Characters', icon: User },
  { key: 'background', label: 'Backgrounds', icon: MapPin },
];

export default function LibraryTab({ showId, episodeId, onAddAsset }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchAssets = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (showId) params.show_id = showId;
      if (episodeId) params.episode_id = episodeId;
      if (searchTerm) params.search = searchTerm;

      if (activeFilter === 'image') params.asset_type = 'image';
      else if (activeFilter === 'video') params.asset_type = 'video';
      else if (activeFilter === 'character') params.category = 'character_outfit';
      else if (activeFilter === 'background') params.category = 'background';

      const { data } = await api.get('/api/v1/assets', { params });
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('LibraryTab fetch error:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId, activeFilter]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAssets(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, activeFilter, fetchAssets]);

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

  return (
    <div className="scene-studio-library-tab">
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

      {/* Filter pills */}
      <div className="scene-studio-tabs">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              className={`scene-studio-tab ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              <Icon size={12} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Asset grid */}
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

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Image } from 'lucide-react';
import api from '../../../../services/api';

/**
 * DecorTab — Browse decorative/overlay assets from the library.
 * Filtered to decor and overlay categories.
 */

export default function DecorTab({ showId, episodeId, onAddAsset }) {
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
      // Fetch decor/overlay/prop categories
      params.category = 'prop';

      const { data } = await api.get('/api/v1/assets', { params });
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('DecorTab fetch error:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId, search]);

  useEffect(() => {
    const timer = setTimeout(fetchAssets, 300);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  const handleAdd = useCallback((asset) => {
    if (!onAddAsset) return;
    onAddAsset({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      assetId: asset.id,
      assetUrl: asset.s3_url_processed || asset.s3_url_raw || '',
      x: 100,
      y: 100,
      width: asset.width || 200,
      height: asset.height || 200,
      rotation: 0,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      label: asset.character_name || asset.location_name || asset.category || 'Decor',
      assetRole: 'decor',
      usageType: 'overlay',
      _asset: asset,
    });
  }, [onAddAsset]);

  return (
    <div className="scene-studio-decor-tab">
      <div className="scene-studio-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search decor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="scene-studio-asset-grid">
        {loading && <div className="scene-studio-loading">Loading...</div>}

        {!loading && assets.length === 0 && (
          <div className="scene-studio-empty-state">No decor assets found.</div>
        )}

        {assets.map((asset) => {
          const thumbUrl = asset.s3_url_processed || asset.s3_url_raw || '';
          return (
            <div
              key={asset.id}
              className="scene-studio-asset-thumb"
              onClick={() => handleAdd(asset)}
              title={asset.character_name || asset.location_name || asset.category}
            >
              {thumbUrl ? (
                <img src={thumbUrl} alt="" loading="lazy" />
              ) : (
                <div className="scene-studio-no-thumb">
                  <Image size={20} />
                </div>
              )}
              <span className="scene-studio-asset-name">
                {asset.character_name || asset.location_name || asset.category || 'Decor'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

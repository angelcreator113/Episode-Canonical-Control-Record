import React, { useState, useEffect, useCallback } from 'react';
import { Search, Image } from 'lucide-react';
import api from '../../../../services/api';

/**
 * DecorTab — Curated room-ready decor and overlay assets.
 * Categories: Mirrors, Frames, Lamps, Rugs, Flowers, Vanity, Overlays.
 * Feels editorialized, not just another filter on the full library.
 */

const DECOR_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'mirror', label: 'Mirrors' },
  { key: 'frame', label: 'Frames' },
  { key: 'lamp', label: 'Lamps' },
  { key: 'rug', label: 'Rugs' },
  { key: 'flower', label: 'Flowers' },
  { key: 'vanity', label: 'Vanity' },
  { key: 'overlay', label: 'Overlays' },
];

/**
 * Compute smart insertion size for an asset based on type and source dimensions.
 * Preserves aspect ratio. Fits within a percentage of canvas width based on role.
 */
function computeInsertSize(asset, canvasWidth, canvasHeight) {
  const srcW = asset.width || 400;
  const srcH = asset.height || 400;
  const aspect = srcW / srcH;

  // Target: 22-28% of canvas width for decor objects
  const targetW = (canvasWidth || 1920) * 0.25;
  let w = targetW;
  let h = w / aspect;

  // Clamp height to 35% of canvas
  const maxH = (canvasHeight || 1080) * 0.35;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }

  return { width: Math.round(w), height: Math.round(h) };
}

export default function DecorTab({ showId, episodeId, canvasWidth, canvasHeight, onAddAsset }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0, category: 'prop' };
      if (showId) params.show_id = showId;
      if (episodeId) params.episode_id = episodeId;

      // Combine category keyword into search for sub-filtering
      const searchParts = [];
      if (search) searchParts.push(search);
      if (category !== 'all') searchParts.push(category);
      if (searchParts.length > 0) params.search = searchParts.join(' ');

      const { data } = await api.get('/api/v1/assets', { params });
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('DecorTab fetch error:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId, search, category]);

  useEffect(() => {
    const timer = setTimeout(fetchAssets, 300);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  const handleAdd = useCallback((asset) => {
    if (!onAddAsset) return;
    const { width, height } = computeInsertSize(asset, canvasWidth, canvasHeight);

    onAddAsset({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      assetId: asset.id,
      assetUrl: asset.s3_url_processed || asset.s3_url_raw || '',
      x: (canvasWidth || 1920) / 2 - width / 2,
      y: (canvasHeight || 1080) / 2 - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      label: asset.character_name || asset.location_name || asset.category || 'Decor',
      assetRole: 'decor',
      usageType: 'overlay',
      _asset: asset,
    });
  }, [onAddAsset, canvasWidth, canvasHeight]);

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

      {/* Category pills */}
      <div className="scene-studio-decor-categories">
        {DECOR_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`scene-studio-decor-pill ${category === cat.key ? 'active' : ''}`}
            onClick={() => setCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="scene-studio-asset-grid">
        {loading && <div className="scene-studio-loading">Loading...</div>}

        {!loading && assets.length === 0 && (
          <div className="scene-studio-empty-state">
            {category === 'all'
              ? 'No decor assets found.'
              : `No ${DECOR_CATEGORIES.find((c) => c.key === category)?.label || 'items'} found.`}
          </div>
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

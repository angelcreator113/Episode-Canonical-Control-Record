import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * ShowAssetsTab — Structured Asset Dashboard
 *
 * Groups assets by what they actually are:
 * - Scene Sets (venue images, angles)
 * - UI Overlays (show-level icons + frames)
 * - Wardrobe Library
 * - Invitations (generated from events)
 * - Uploaded Assets (logos, music, other)
 */

const SECTION_CONFIG = {
  scene_sets: { icon: '📍', label: 'Scene Sets', desc: 'Venue images and camera angles', color: '#6366f1', link: 'scene-library' },
  overlays: { icon: '✨', label: 'UI Overlays', desc: 'Show-level frames and icons', color: '#B8962E', link: 'scene-library?tab=overlays' },
  wardrobe: { icon: '👗', label: 'Wardrobe', desc: 'Clothing, shoes, accessories, perfume', color: '#ec4899', link: 'world?tab=wardrobe' },
  invitations: { icon: '💌', label: 'Invitations', desc: 'Event invitation letters', color: '#f59e0b', link: 'world?tab=events' },
  uploads: { icon: '📁', label: 'Uploaded Assets', desc: 'Logos, music, intros, outros', color: '#64748b', link: null },
};

function ShowAssetsTab({ show }) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => {
    loadAssetCounts();
  }, [show.id]);

  const loadAssetCounts = async () => {
    setLoading(true);
    try {
      // Load counts from multiple sources
      const [sceneRes, overlayRes, wardrobeRes, assetRes] = await Promise.allSettled([
        api.get(`/api/v1/scene-sets?show_id=${show.id}&limit=100`),
        api.get(`/api/v1/ui-overlays/${show.id}`),
        api.get(`/api/v1/wardrobe?show_id=${show.id}&limit=200`),
        api.get(`/api/v1/assets?show_id=${show.id}&asset_scope=SHOW&limit=200`),
      ]);

      const sceneSets = sceneRes.status === 'fulfilled' ? (sceneRes.value.data?.data || sceneRes.value.data || []) : [];
      const overlays = overlayRes.status === 'fulfilled' ? (overlayRes.value.data?.data || []) : [];
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [];
      const assets = assetRes.status === 'fulfilled' ? (assetRes.value.data?.data || []) : [];

      const overlayGenerated = overlays.filter(o => o.generated || o.url || o.asset_id).length;
      const invitations = assets.filter(a => (a.asset_role || '').includes('INVITATION'));
      const uploads = assets.filter(a => !(a.asset_role || '').includes('INVITATION') && !(a.asset_role || '').includes('OVERLAY'));

      setCounts({
        scene_sets: sceneSets.length,
        overlays: overlayGenerated,
        overlays_total: overlays.length,
        wardrobe: wardrobe.length,
        invitations: invitations.length,
        uploads: uploads.length,
      });

      // Get first thumbnail from each category
      setThumbnails({
        scene_sets: sceneSets.slice(0, 4).map(s => s.base_still_url || s.thumbnail_url).filter(Boolean),
        overlays: overlays.filter(o => o.url).slice(0, 4).map(o => o.url),
        wardrobe: wardrobe.slice(0, 4).map(w => w.s3_url_processed || w.s3_url || w.thumbnail_url).filter(Boolean),
        invitations: invitations.slice(0, 4).map(a => a.s3_url_processed || a.s3_url_raw).filter(Boolean),
        uploads: uploads.slice(0, 4).map(a => a.s3_url_raw).filter(Boolean),
      });
    } catch (err) {
      console.error('[ShowAssets] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const goTo = (section) => {
    const config = SECTION_CONFIG[section];
    if (config?.link) {
      navigate(`/shows/${show.id}/${config.link}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
        Loading asset inventory...
      </div>
    );
  }

  const totalAssets = Object.values(counts).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0) - (counts.overlays_total || 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Asset Inventory</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {totalAssets} production assets across {Object.keys(SECTION_CONFIG).length} categories
          </p>
        </div>
      </div>

      {/* Asset Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(SECTION_CONFIG).map(([key, config]) => {
          const count = counts[key] || 0;
          const thumbs = thumbnails[key] || [];
          const isOverlays = key === 'overlays';

          return (
            <div key={key}
              onClick={() => goTo(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                cursor: config.link ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (config.link) { e.currentTarget.style.borderColor = config.color; e.currentTarget.style.boxShadow = `0 2px 8px ${config.color}15`; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${config.color}12`, fontSize: 20, flexShrink: 0,
              }}>
                {config.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{config.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                    background: count > 0 ? `${config.color}15` : '#f1f5f9',
                    color: count > 0 ? config.color : '#94a3b8',
                  }}>
                    {isOverlays ? `${count}/${counts.overlays_total || 0} generated` : count}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{config.desc}</div>
              </div>

              {/* Thumbnail strip */}
              {thumbs.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {thumbs.slice(0, 3).map((url, i) => (
                    <img key={i} src={url} alt=""
                      style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      onError={e => e.target.style.display = 'none'}
                    />
                  ))}
                  {count > 3 && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, background: '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#94a3b8',
                    }}>
                      +{count - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Arrow */}
              {config.link && (
                <span style={{ fontSize: 14, color: '#cbd5e1', flexShrink: 0 }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShowAssetsTab;

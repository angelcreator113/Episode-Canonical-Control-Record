import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * ShowAssetsTab — Production Asset Dashboard
 *
 * Enhanced view with larger thumbnails, progress bars, and quick actions.
 */

const SECTION_CONFIG = {
  scene_sets: { icon: '📍', label: 'Scene Sets', desc: 'Venue exteriors, interiors, and camera angles', color: '#6366f1', link: 'scene-library', actionLabel: 'Scene Library' },
  overlays: { icon: '📱', label: "Lala's Phone", desc: 'Phone screen designs and app icons — generated from DALL-E and Flux', color: '#B8962E', link: 'scene-library?tab=overlays', actionLabel: 'Manage Overlays' },
  wardrobe: { icon: '👗', label: 'Wardrobe', desc: 'Clothing, shoes, accessories, jewelry, perfume', color: '#ec4899', link: 'world?tab=wardrobe', actionLabel: 'Wardrobe Library' },
  invitations: { icon: '💌', label: 'Invitations', desc: 'Event invitation letters — per episode', color: '#f59e0b', link: 'world?tab=events', actionLabel: 'Events' },
  uploads: { icon: '📁', label: 'Uploads', desc: 'Logos, music, intros, outros, custom assets', color: '#64748b', link: null, actionLabel: null },
};

function ShowAssetsTab({ show }) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState({});
  const [names, setNames] = useState({});

  useEffect(() => { loadAssetCounts(); }, [show.id]);

  const loadAssetCounts = async () => {
    setLoading(true);
    try {
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

      setThumbnails({
        scene_sets: sceneSets.slice(0, 6).map(s => s.base_still_url || s.thumbnail_url).filter(Boolean),
        overlays: overlays.filter(o => o.url).slice(0, 8).map(o => o.url),
        wardrobe: wardrobe.slice(0, 6).map(w => w.s3_url_processed || w.s3_url || w.thumbnail_url).filter(Boolean),
        invitations: invitations.slice(0, 4).map(a => a.s3_url_processed || a.s3_url_raw).filter(Boolean),
        uploads: uploads.slice(0, 4).map(a => a.s3_url_raw).filter(Boolean),
      });

      setNames({
        scene_sets: sceneSets.slice(0, 6).map(s => s.name),
        wardrobe: wardrobe.slice(0, 6).map(w => w.name),
      });
    } catch (err) {
      console.error('[ShowAssets] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const goTo = (section) => {
    const config = SECTION_CONFIG[section];
    if (config?.link) navigate(`/shows/${show.id}/${config.link}`);
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading production assets...</div>;

  const totalAssets = (counts.scene_sets || 0) + (counts.overlays || 0) + (counts.wardrobe || 0) + (counts.invitations || 0) + (counts.uploads || 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Production Assets</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {totalAssets} assets across {Object.keys(SECTION_CONFIG).length} categories
          </p>
        </div>
      </div>

      {/* Asset Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(SECTION_CONFIG).map(([key, config]) => {
          const count = counts[key] || 0;
          const thumbs = thumbnails[key] || [];
          const isOverlays = key === 'overlays';
          const total = isOverlays ? (counts.overlays_total || 0) : null;
          const pct = total ? Math.round((count / total) * 100) : null;

          return (
            <div key={key} style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
              overflow: 'hidden', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (config.link) { e.currentTarget.style.borderColor = config.color + '60'; e.currentTarget.style.boxShadow = `0 2px 12px ${config.color}10`; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${config.color}10`, fontSize: 18, flexShrink: 0,
                }}>
                  {config.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{config.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                      background: count > 0 ? `${config.color}12` : '#f1f5f9',
                      color: count > 0 ? config.color : '#94a3b8',
                    }}>
                      {isOverlays ? `${count}/${total} generated` : count}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{config.desc}</div>
                </div>
                {config.link && (
                  <button onClick={() => goTo(key)} style={{
                    padding: '6px 14px', borderRadius: 6, border: `1px solid ${config.color}30`,
                    background: `${config.color}08`, color: config.color,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {config.actionLabel} →
                  </button>
                )}
              </div>

              {/* Progress bar for overlays */}
              {pct !== null && (
                <div style={{ height: 3, background: '#f1f5f9', margin: '0 18px 8px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: config.color, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}

              {/* Thumbnail grid */}
              {thumbs.length > 0 && (
                <div style={{ padding: '0 18px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
                  {thumbs.map((url, i) => (
                    <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={url} alt={names[key]?.[i] || ''}
                        style={{
                          width: key === 'overlays' ? 40 : 72,
                          height: key === 'overlays' ? 40 : 48,
                          borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0',
                          cursor: config.link ? 'pointer' : 'default',
                        }}
                        onClick={() => goTo(key)}
                        onError={e => e.target.style.display = 'none'}
                      />
                      {names[key]?.[i] && key !== 'overlays' && (
                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {names[key][i]}
                        </div>
                      )}
                    </div>
                  ))}
                  {count > thumbs.length && (
                    <div onClick={() => goTo(key)} style={{
                      width: key === 'overlays' ? 40 : 72,
                      height: key === 'overlays' ? 40 : 48,
                      borderRadius: 6, background: '#f8fafc', border: '1px dashed #cbd5e1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', flexShrink: 0,
                    }}>
                      +{count - thumbs.length}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {count === 0 && config.link && (
                <div style={{ padding: '0 18px 14px' }}>
                  <button onClick={() => goTo(key)} style={{
                    width: '100%', padding: '10px', borderRadius: 6, border: '1px dashed #cbd5e1',
                    background: '#fafafa', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                  }}>
                    + Add {config.label.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShowAssetsTab;

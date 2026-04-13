// frontend/src/components/Show/ShowWardrobeTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * ShowWardrobeTab — Wardrobe Dashboard
 *
 * Summary view with stats, tier breakdown, top brands,
 * and link to full wardrobe management in Producer Mode.
 */

const TIER_CONFIG = [
  { key: 'elite', icon: '👑', color: '#ec4899', label: 'Elite' },
  { key: 'luxury', icon: '💎', color: '#eab308', label: 'Luxury' },
  { key: 'mid', icon: '👠', color: '#6366f1', label: 'Mid' },
  { key: 'basic', icon: '👟', color: '#94a3b8', label: 'Basic' },
];

const CAT_ICONS = {
  dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessory: '🎀',
  jewelry: '💍', bag: '👜', outerwear: '🧥', perfume: '🌸',
};

function ShowWardrobeTab({ show }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/v1/wardrobe?show_id=${show.id}&limit=500`)
      .then(r => setItems(r.data?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [show.id]);

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading wardrobe...</div>;

  // Stats
  const totalValue = items.reduce((s, w) => s + (parseFloat(w.price) || 0), 0);
  const tierDist = { elite: 0, luxury: 0, mid: 0, basic: 0 };
  const catDist = {};
  const brandCounts = {};
  items.forEach(w => {
    if (w.tier) tierDist[w.tier] = (tierDist[w.tier] || 0) + 1;
    const cat = w.clothing_category || 'other';
    catDist[cat] = (catDist[cat] || 0) + 1;
    if (w.brand) brandCounts[w.brand] = (brandCounts[w.brand] || 0) + 1;
  });
  const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const categories = Object.entries(catDist).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Wardrobe Library</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {items.length} items · ${totalValue.toLocaleString()} total value
          </p>
        </div>
        <button onClick={() => navigate(`/shows/${show.id}/world?tab=wardrobe`)} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          👗 Open Full Wardrobe →
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Total Items</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{items.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Total Value</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#B8962E' }}>${totalValue.toLocaleString()}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Categories</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1' }}>{categories.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Brands</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ec4899' }}>{Object.keys(brandCounts).length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Avg Price</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>${items.length > 0 ? Math.round(totalValue / items.length).toLocaleString() : 0}</div>
        </div>
      </div>

      {/* Two columns: Tiers + Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Tier Breakdown */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>By Tier</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {TIER_CONFIG.map(t => (
              <div key={t.key} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: '#f8f8f8' }}>
                <div style={{ fontSize: 16 }}>{t.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{tierDist[t.key] || 0}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>By Category</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map(([cat, count]) => (
              <div key={cat} style={{
                padding: '4px 10px', borderRadius: 6, background: '#f1f5f9',
                fontSize: 11, fontWeight: 600, color: '#64748b',
              }}>
                {CAT_ICONS[cat] || '🏷️'} {cat} ({count})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Brands + Recent Items */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Top Brands */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>Top Brands</div>
          {topBrands.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {topBrands.map(([brand, count]) => (
                <div key={brand} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{brand}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{count} item{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No brands identified yet</div>
          )}
        </div>

        {/* Recent Items */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>Recent Items</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {items.slice(0, 6).map(w => (
              <div key={w.id} style={{ flexShrink: 0 }}>
                {(w.s3_url_processed || w.s3_url || w.thumbnail_url) ? (
                  <img src={w.s3_url_processed || w.s3_url || w.thumbnail_url} alt={w.name}
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                    onError={e => e.target.style.display = 'none'} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 20 }}>
                    {CAT_ICONS[w.clothing_category] || '👗'}
                  </div>
                )}
                <div style={{ fontSize: 8, color: '#64748b', marginTop: 2, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShowWardrobeTab;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * EpisodeWardrobeTab — Outfit context for this episode
 *
 * Shows: assigned outfit pieces, event dress code match,
 * total cost, brand summary, tier alignment, and link
 * to outfit picker in Producer Mode.
 */

const CAT_ICONS = {
  dress: '👗', top: '👚', bottom: '👖', shoes: '👟', accessory: '🎀',
  jewelry: '💍', bag: '👜', outerwear: '🧥', perfume: '🌸',
};

const TIER_COLORS = { basic: '#94a3b8', mid: '#6366f1', luxury: '#eab308', elite: '#ec4899' };

function EpisodeWardrobeTab({ episodeId, episode }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const showId = episode?.show_id || episode?.showId;

  useEffect(() => {
    if (episodeId) loadData();
  }, [episodeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load episode wardrobe
      const [wardrobeRes, eventsRes] = await Promise.allSettled([
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`).catch(() => ({ data: {} })),
        showId ? api.get(`/api/v1/world/${showId}/events`).catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
      ]);

      // Get items from event outfit_pieces (more accurate than episode_wardrobe)
      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events || []) : [];
      const linkedEvent = events.find(e => e.used_in_episode_id === episodeId);
      setEvent(linkedEvent || null);

      let outfitPieces = linkedEvent?.outfit_pieces;
      if (typeof outfitPieces === 'string') try { outfitPieces = JSON.parse(outfitPieces); } catch { outfitPieces = []; }

      if (outfitPieces?.length > 0) {
        setItems(outfitPieces);
      } else {
        // Fallback: load from show wardrobe
        const allWardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [];
        setItems(allWardrobe.slice(0, 10));
      }
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading wardrobe...</div>;

  // Stats
  const totalCost = items.reduce((s, w) => s + (parseFloat(w.price) || 0), 0);
  const brands = [...new Set(items.map(w => w.brand).filter(Boolean))];
  const tiers = items.map(w => w.tier).filter(Boolean);
  const ownedCount = items.filter(w => w.is_owned).length;
  const dressCode = event?.dress_code;
  const prestige = event?.prestige || 5;
  const hasOutfit = items.some(w => w.id);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Episode Outfit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {items.length} piece{items.length !== 1 ? 's' : ''} · ${totalCost.toLocaleString()} total
            {dressCode && ` · Dress code: ${dressCode}`}
          </p>
        </div>
        {showId && (
          <button onClick={() => navigate(`/shows/${showId}/world?tab=events`)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            👗 Pick Outfit →
          </button>
        )}
      </div>

      {/* Event Context Bar */}
      {event && (
        <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Event</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{event.name}</div>
          </div>
          {dressCode && (
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Dress Code</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#B8962E' }}>{dressCode}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Prestige</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#B8962E' }}>{prestige}/10</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Owned</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: ownedCount === items.length ? '#16a34a' : '#f59e0b' }}>{ownedCount}/{items.length}</div>
          </div>
          {brands.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Brands</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{brands.join(', ')}</div>
            </div>
          )}
        </div>
      )}

      {/* No outfit state */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a2e' }}>No outfit selected</h3>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            Pick wardrobe items for this episode from the event panel in Producer Mode.
          </p>
          {showId && (
            <button onClick={() => navigate(`/shows/${showId}/world?tab=events`)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              🎭 Go to Producer Mode
            </button>
          )}
        </div>
      )}

      {/* Outfit Grid */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {items.map((w, i) => {
            const imgUrl = w.image_url || w.s3_url_processed || w.s3_url || w.thumbnail_url;
            const cat = w.category || w.clothing_category || 'item';
            const tierColor = TIER_COLORS[w.tier] || '#94a3b8';
            return (
              <div key={w.id || i} style={{
                background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden',
              }}>
                {/* Image */}
                <div style={{ width: '100%', aspectRatio: '1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={w.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  ) : (
                    <span style={{ fontSize: 40, color: '#cbd5e1' }}>{CAT_ICONS[cat] || '👗'}</span>
                  )}
                  {w.tier && (
                    <span style={{ position: 'absolute', top: 6, right: 6, padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: tierColor }}>
                      {w.tier}
                    </span>
                  )}
                  {w.is_owned && (
                    <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: '#f0fdf4', color: '#16a34a' }}>
                      Owned
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name || cat}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, padding: '1px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>
                      {CAT_ICONS[cat] || '🏷️'} {cat}
                    </span>
                    {w.brand && <span style={{ fontSize: 9, padding: '1px 6px', background: '#faf5ea', borderRadius: 4, color: '#B8962E' }}>{w.brand}</span>}
                  </div>
                  {w.price > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>${parseFloat(w.price).toLocaleString()}</div>
                  )}
                  {w.description && (
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {w.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EpisodeWardrobeTab;

/**
 * EpisodeWardrobeGameplay — Episode Mode Wardrobe
 *
 * The gameplay loop: Browse → React → Select
 *
 * Props:
 *   episodeId - Episode UUID
 *   showId - Show UUID
 *   event - Event object (from world_events) with dress_code, prestige, etc.
 *   characterState - Lala's current stats { coins, reputation, ... }
 *   onSelect - Callback when outfit is selected
 *
 * Workflow:
 *   1. Shows event context banner (dress code, prestige, brand)
 *   2. Calls /api/v1/wardrobe/browse-pool to get curated 6-10 items
 *   3. Displays items in a "closet browse" with Lala reactions
 *   4. Player clicks item → expanded view with match score + reaction
 *   5. Player confirms selection → POST /api/v1/wardrobe/select
 *   6. Optional: Purchase coin-locked items mid-browse
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const TIER_STYLES = {
  basic: { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b', label: 'Basic', emoji: '🧵' },
  mid: { bg: '#eef2ff', border: '#c7d2fe', color: '#6366f1', label: 'Mid', emoji: '💜' },
  luxury: { bg: '#fef3c7', border: '#fde68a', color: '#92400e', label: 'Luxury', emoji: '💎' },
  elite: { bg: '#fef3c7', border: '#f59e0b', color: '#78350f', label: 'Elite', emoji: '👑' },
};

const ROLE_STYLES = {
  safe: { bg: '#f0fdf4', border: '#bbf7d0', label: '✅ Safe Pick', color: '#16a34a' },
  stretch: { bg: '#eef2ff', border: '#c7d2fe', label: '⬆️ Stretch', color: '#6366f1' },
  risky: { bg: '#fef2f2', border: '#fecaca', label: '⚡ Risky', color: '#dc2626' },
  locked_tease: { bg: '#f8fafc', border: '#e2e8f0', label: '🔒 Locked', color: '#94a3b8' },
};

const CAT_ICONS = { dress: '👗', top: '👚', bottom: '👖', shoes: '👠', accessories: '👜', jewelry: '💍', perfume: '🌸' };

export default function EpisodeWardrobeGameplay({ episodeId, showId, event = {}, characterState = {}, onSelect }) {
  const [pool, setPool] = useState([]);
  const [poolBreakdown, setPoolBreakdown] = useState({});
  const [scoringSummary, setScoringSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [inspectingItem, setInspectingItem] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [phase, setPhase] = useState('browse'); // browse | inspect | selected

  // ─── Load browse pool ───
  const loadPool = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/wardrobe/browse-pool', {
        show_id: showId,
        event_name: event.name || '',
        dress_code: event.dress_code || '',
        dress_code_keywords: event.dress_code_keywords || [],
        event_type: event.event_type || '',
        prestige: event.prestige || 5,
        strictness: event.strictness || 5,
        host_brand: event.host_brand || '',
        is_paid: event.is_paid || false,
        character_state: characterState,
      });
      setPool(res.data.pool || []);
      setPoolBreakdown(res.data.pool_breakdown || {});
      setScoringSummary(res.data.scoring_summary || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  }, [showId, event, characterState]);

  useEffect(() => { loadPool(); }, [loadPool]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }
  }, [success]);

  // ─── Select outfit ───
  const confirmSelection = async (item) => {
    setConfirming(true);
    try {
      const res = await api.post('/api/v1/wardrobe/select', {
        episode_id: episodeId,
        wardrobe_id: item.id,
        show_id: showId,
      });
      if (res.data.success) {
        setSelectedItem(item);
        setPhase('selected');
        setSuccess(`Selected: ${item.name}`);
        if (onSelect) onSelect(item);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Selection failed');
    } finally {
      setConfirming(false);
    }
  };

  // ─── Purchase item ───
  const purchaseItem = async (item) => {
    setPurchasing(item.id);
    try {
      const res = await api.post('/api/v1/wardrobe/purchase', {
        wardrobe_id: item.id,
        show_id: showId,
      });
      if (res.data.success) {
        setSuccess(`Purchased "${item.name}" for ${res.data.cost} coins!`);
        loadPool();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  // ─── Render ───
  if (loading) {
    return (
      <div style={W.container}>
        <div style={W.loadingBox}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Opening the closet...</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Loading browse pool for this event</div>
        </div>
      </div>
    );
  }

  return (
    <div style={W.container}>
      {/* Status messages */}
      {error && <div style={W.errorBanner}>{error} <button onClick={() => setError(null)} style={W.xBtn}>✕</button></div>}
      {success && <div style={W.successBanner}>{success}</div>}

      {/* ═══ EVENT CONTEXT BANNER ═══ */}
      <div style={W.eventBanner}>
        <div style={W.eventBannerLeft}>
          <div style={W.eventLabel}>STYLING FOR</div>
          <div style={W.eventName}>{event.name || 'Untitled Event'}</div>
          <div style={W.eventTags}>
            {event.dress_code && <span style={W.eventTag}>👗 {event.dress_code}</span>}
            <span style={W.eventTag}>⭐ Prestige {event.prestige || '?'}</span>
            <span style={W.eventTag}>📏 Strictness {event.strictness || '?'}</span>
            {event.host_brand && <span style={W.eventTag}>🏛️ {event.host_brand}</span>}
            {event.is_paid && <span style={{ ...W.eventTag, background: '#fef3c7', color: '#92400e' }}>💰 Paid Event</span>}
          </div>
        </div>
        <div style={W.eventBannerRight}>
          <div style={{ fontSize: 11, color: '#880e4f', marginBottom: 4, fontWeight: 600 }}>LALA'S COINS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: (characterState.coins || 0) < 100 ? '#dc2626' : '#4a1942' }}>
            🪙 {characterState.coins || 0}
          </div>
        </div>
      </div>

      {/* ═══ POOL BREAKDOWN ═══ */}
      <div style={W.breakdownRow}>
        <span style={W.breakdownItem}>
          {pool.length} items in closet
        </span>
        <span style={W.breakdownDot}>·</span>
        <span style={{ ...W.breakdownItem, color: '#16a34a' }}>{poolBreakdown.safe || 0} safe</span>
        <span style={W.breakdownDot}>·</span>
        <span style={{ ...W.breakdownItem, color: '#6366f1' }}>{poolBreakdown.stretch || 0} stretch</span>
        <span style={W.breakdownDot}>·</span>
        <span style={{ ...W.breakdownItem, color: '#dc2626' }}>{poolBreakdown.risky || 0} risky</span>
        <span style={W.breakdownDot}>·</span>
        <span style={{ ...W.breakdownItem, color: '#94a3b8' }}>{poolBreakdown.locked_tease || 0} locked</span>
      </div>

      {/* ═══ PHASE: SELECTED ═══ */}
      {phase === 'selected' && selectedItem && (
        <div style={W.selectedBanner}>
          <div style={{ fontSize: 32 }}>✨</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>Outfit Selected</div>
            <div style={{ fontSize: 14, color: '#6366f1', fontWeight: 600 }}>{selectedItem.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
              "{selectedItem.lala_reaction_own || selectedItem.lala_reaction || 'She made her choice.'}"
            </div>
          </div>
          <button onClick={() => { setPhase('browse'); setSelectedItem(null); }} style={W.changeBtn}>
            ↩ Change
          </button>
        </div>
      )}

      {/* ═══ PHASE: INSPECT ═══ */}
      {phase === 'inspect' && inspectingItem && (
        <div style={W.inspectOverlay}>
          <div style={W.inspectCard}>
            <button onClick={() => { setPhase('browse'); setInspectingItem(null); }} style={W.inspectClose}>✕</button>

            <div style={W.inspectHeader}>
              <span style={{ fontSize: 32 }}>{CAT_ICONS[inspectingItem.clothing_category] || '👕'}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{inspectingItem.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {inspectingItem.clothing_category} · {inspectingItem.color || '—'} · {inspectingItem.era_alignment || '—'}
                </div>
              </div>
              <div style={W.inspectTier(inspectingItem.tier)}>
                {TIER_STYLES[inspectingItem.tier]?.emoji} {TIER_STYLES[inspectingItem.tier]?.label}
              </div>
            </div>

            {/* Match score bar */}
            <div style={W.inspectScoreSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Match Score</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: inspectingItem.match_score >= 40 ? '#16a34a' : inspectingItem.match_score >= 20 ? '#eab308' : '#dc2626' }}>
                  {inspectingItem.match_score}/60
                </span>
              </div>
              <div style={W.scoreBar}>
                <div style={{ ...W.scoreFill, width: `${Math.min(100, (inspectingItem.match_score / 60) * 100)}%`, background: inspectingItem.match_score >= 40 ? '#16a34a' : inspectingItem.match_score >= 20 ? '#eab308' : '#dc2626' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {(inspectingItem.match_reasons || []).map((r, i) => (
                  <span key={i} style={W.reasonBadge}>{r}</span>
                ))}
              </div>
            </div>

            {/* Lala reaction */}
            <div style={W.reactionBox}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: 1, marginBottom: 6 }}>LALA'S REACTION</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: '#475569', lineHeight: 1.5 }}>
                "{inspectingItem.lala_reaction}"
              </div>
            </div>

            {/* Actions */}
            <div style={W.inspectActions}>
              {inspectingItem.can_select && (
                <button onClick={() => confirmSelection(inspectingItem)} disabled={confirming}
                  style={W.selectBtn}>
                  {confirming ? '⏳...' : '✨ Select This Outfit'}
                </button>
              )}
              {inspectingItem.can_purchase && (
                <button onClick={() => purchaseItem(inspectingItem)} disabled={purchasing === inspectingItem.id}
                  style={W.purchaseBtn}>
                  {purchasing === inspectingItem.id ? '⏳...' : `🪙 Buy for ${inspectingItem.coin_cost} coins`}
                </button>
              )}
              {!inspectingItem.can_select && !inspectingItem.can_purchase && (
                <div style={W.lockedMessage}>
                  🔒 {inspectingItem.lock_type === 'reputation' ? `Needs Rep ${inspectingItem.reputation_required}` :
                    inspectingItem.lock_type === 'brand_exclusive' ? 'Brand Exclusive' :
                    inspectingItem.lock_type === 'season_drop' ? `Drops Episode ${inspectingItem.season_unlock_episode}` :
                    inspectingItem.lock_type === 'coin' ? `Need ${inspectingItem.coin_cost} coins` : 'Locked'}
                </div>
              )}
              <button onClick={() => { setPhase('browse'); setInspectingItem(null); }} style={W.backBtn}>
                ← Back to Closet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PHASE: BROWSE ═══ */}
      {(phase === 'browse' || phase === 'selected') && (
        <div style={W.closetGrid}>
          {pool.map((item, idx) => {
            const ts = TIER_STYLES[item.tier] || TIER_STYLES.basic;
            const rs = ROLE_STYLES[item.pool_role] || ROLE_STYLES.safe;
            const isSelected = selectedItem?.id === item.id;
            const isLocked = !item.is_owned;

            return (
              <div key={item.id}
                onClick={() => { if (phase !== 'selected') { setInspectingItem(item); setPhase('inspect'); } }}
                style={{
                  ...W.closetCard,
                  border: isSelected ? '2px solid #6366f1' : `1px solid ${rs.border}`,
                  background: isSelected ? '#eef2ff' : isLocked ? '#f8fafc' : '#fff',
                  opacity: isLocked && item.is_visible === false ? 0.4 : 1,
                  cursor: phase === 'selected' ? 'default' : 'pointer',
                  animation: `fadeIn 0.3s ease ${idx * 0.08}s both`,
                }}>

                {/* Role badge */}
                <div style={{ ...W.roleBadge, background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                  {rs.label}
                </div>

                {/* Tier badge */}
                <div style={{ ...W.tierBadge, background: ts.bg, border: `1px solid ${ts.border}`, color: ts.color }}>
                  {ts.emoji} {ts.label}
                </div>

                {/* Item info */}
                <div style={W.itemIcon}>{CAT_ICONS[item.clothing_category] || '👕'}</div>
                <div style={W.itemName}>{item.name}</div>
                <div style={W.itemMeta}>{item.clothing_category} · {item.color || '—'}</div>

                {/* Tags */}
                <div style={W.tagRow}>
                  {(item.aesthetic_tags || []).slice(0, 3).map((t, ti) => (
                    <span key={ti} style={W.tag}>{t}</span>
                  ))}
                </div>

                {/* Score mini */}
                <div style={W.miniScoreRow}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Match</span>
                  <div style={W.miniBar}>
                    <div style={{ height: '100%', width: `${Math.min(100, (item.match_score / 60) * 100)}%`, borderRadius: 2, background: item.match_score >= 40 ? '#16a34a' : item.match_score >= 20 ? '#eab308' : '#dc2626' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{item.match_score}</span>
                </div>

                {/* Lala mini reaction */}
                <div style={W.miniReaction}>
                  {isLocked ? `🔒 ${item.lock_type === 'coin' ? `${item.coin_cost} coins` : item.lock_type}` :
                    `"${(item.lala_reaction || '').substring(0, 40)}${(item.lala_reaction || '').length > 40 ? '...' : ''}"`}
                </div>

                {isSelected && <div style={W.selectedOverlay}>✨ SELECTED</div>}
              </div>
            );
          })}
        </div>
      )}

      {pool.length === 0 && !loading && (
        <div style={W.emptyState}>
          <div style={{ fontSize: 40 }}>👗</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Closet is empty</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Seed wardrobe items in Producer Mode first.</div>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}


// ─── STYLES ───
const W = {
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },

  loadingBox: { textAlign: 'center', padding: 60 },

  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },

  // Event banner
  eventBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
    borderRadius: 14, marginBottom: 12, color: '#4a1942',
  },
  eventBannerLeft: {},
  eventBannerRight: { textAlign: 'right' },
  eventLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#c2185b', marginBottom: 4 },
  eventName: { fontSize: 18, fontWeight: 800, marginBottom: 6, color: '#4a1942' },
  eventTags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  eventTag: { padding: '3px 10px', background: 'rgba(194,24,91,0.1)', borderRadius: 6, fontSize: 11, color: '#880e4f' },

  // Breakdown
  breakdownRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: '#64748b' },
  breakdownItem: { fontWeight: 600 },
  breakdownDot: { color: '#e2e8f0' },

  // Selected banner
  selectedBanner: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
    background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 14, marginBottom: 14,
  },
  changeBtn: {
    marginLeft: 'auto', padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#64748b',
  },

  // Closet grid
  closetGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  closetCard: {
    borderRadius: 14, padding: 16, position: 'relative', transition: 'all 0.2s',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  roleBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, alignSelf: 'flex-start' },
  tierBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, alignSelf: 'flex-end', position: 'absolute', top: 10, right: 10, textTransform: 'uppercase' },
  itemIcon: { fontSize: 28, marginTop: 4 },
  itemName: { fontSize: 14, fontWeight: 700, color: '#1a1a2e' },
  itemMeta: { fontSize: 11, color: '#94a3b8' },
  tagRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  tag: { padding: '1px 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 10, color: '#64748b' },
  miniScoreRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  miniBar: { flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2 },
  miniReaction: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2, lineHeight: 1.3 },
  selectedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(99, 102, 241, 0.1)', borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800, color: '#6366f1',
  },

  // Inspect overlay
  inspectOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  inspectCard: {
    background: '#fff', borderRadius: 20, padding: 28, maxWidth: 500, width: '100%',
    position: 'relative', maxHeight: '85vh', overflowY: 'auto',
  },
  inspectClose: {
    position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none',
    width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#64748b',
  },
  inspectHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  inspectTier: (tier) => ({
    marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    background: (TIER_STYLES[tier] || TIER_STYLES.basic).bg,
    border: `1px solid ${(TIER_STYLES[tier] || TIER_STYLES.basic).border}`,
    color: (TIER_STYLES[tier] || TIER_STYLES.basic).color,
  }),

  // Score section
  inspectScoreSection: { padding: 16, background: '#f8fafc', borderRadius: 12, marginBottom: 14 },
  scoreBar: { height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4, transition: 'width 0.6s ease' },
  reasonBadge: { padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 10, color: '#4338ca', fontWeight: 600 },

  // Reaction
  reactionBox: { padding: 16, background: '#fef3c7', borderRadius: 12, marginBottom: 14 },

  // Actions
  inspectActions: { display: 'flex', flexDirection: 'column', gap: 8 },
  selectBtn: {
    padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
    borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  purchaseBtn: {
    padding: '10px 20px', background: '#fef3c7', border: '1px solid #fde68a',
    borderRadius: 10, color: '#92400e', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  lockedMessage: {
    padding: '12px 20px', background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 10, color: '#94a3b8', fontSize: 13, fontWeight: 600, textAlign: 'center',
  },
  backBtn: {
    padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer',
  },

  emptyState: { textAlign: 'center', padding: 60 },
};

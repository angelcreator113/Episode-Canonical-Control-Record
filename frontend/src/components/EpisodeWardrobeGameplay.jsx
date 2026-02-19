/**
 * EpisodeWardrobeGameplay v2 — Full Outfit Slot System
 * 
 * Layout: Slots (left) | Browse Pool (right)
 * 
 * Slots:
 *   👗 Body (dress) OR (👚 Top + 👖 Bottom) — smart detection
 *   👠 Shoes (required)
 *   👜 Accessories (optional)
 *   💍 Jewelry (optional)
 *   🌸 Perfume (optional)
 * 
 * Scoring: Synergy system
 *   - Base match score per item (from browse-pool endpoint)
 *   - Aesthetic tag overlap bonus (items share tags = synergy)
 *   - Tier harmony bonus (same tier = cohesive, mixed = penalty)
 *   - Event alignment bonus (all items match event type)
 *   - Lala confidence meter based on total outfit synergy
 * 
 * Props:
 *   episodeId, showId, event, characterState, onOutfitComplete
 * 
 * Location: frontend/src/components/EpisodeWardrobeGameplay.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

// ─── CONSTANTS ───

const SLOT_DEFS = [
  { key: 'body', icon: '👗', label: 'Body', categories: ['dress'], required: true, desc: 'Dress or Top+Bottom' },
  { key: 'top', icon: '👚', label: 'Top', categories: ['top'], required: false, desc: 'With bottom' },
  { key: 'bottom', icon: '👖', label: 'Bottom', categories: ['bottom'], required: false, desc: 'With top' },
  { key: 'shoes', icon: '👠', label: 'Shoes', categories: ['shoes'], required: true, desc: 'Required' },
  { key: 'accessories', icon: '👜', label: 'Accessories', categories: ['accessories'], required: false, desc: 'Optional' },
  { key: 'jewelry', icon: '💍', label: 'Jewelry', categories: ['jewelry'], required: false, desc: 'Optional' },
  { key: 'perfume', icon: '🌸', label: 'Perfume', categories: ['perfume'], required: false, desc: 'Optional' },
];

const TIER_VALS = { basic: 1, mid: 2, luxury: 3, elite: 4 };
const TIER_STYLES = {
  basic: { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b', emoji: '🧵' },
  mid: { bg: '#eef2ff', border: '#c7d2fe', color: '#6366f1', emoji: '💜' },
  luxury: { bg: '#fef3c7', border: '#fde68a', color: '#92400e', emoji: '💎' },
  elite: { bg: '#fef3c7', border: '#f59e0b', color: '#78350f', emoji: '👑' },
};
const ROLE_STYLES = {
  safe: { bg: '#f0fdf4', border: '#bbf7d0', label: '✅ Safe', color: '#16a34a' },
  stretch: { bg: '#eef2ff', border: '#c7d2fe', label: '⬆️ Stretch', color: '#6366f1' },
  risky: { bg: '#fef2f2', border: '#fecaca', label: '⚡ Risky', color: '#dc2626' },
  locked_tease: { bg: '#f8fafc', border: '#e2e8f0', label: '🔒 Locked', color: '#94a3b8' },
};
const CAT_ICONS = { dress: '👗', top: '👚', bottom: '👖', shoes: '👠', accessories: '👜', jewelry: '💍', perfume: '🌸' };

const CONFIDENCE_LEVELS = [
  { min: 0, label: 'Nervous', emoji: '😰', color: '#dc2626', lala: "I don't know about this..." },
  { min: 30, label: 'Unsure', emoji: '😕', color: '#eab308', lala: "It's... something." },
  { min: 50, label: 'Okay', emoji: '🙂', color: '#22c55e', lala: "This could work." },
  { min: 70, label: 'Confident', emoji: '😊', color: '#6366f1', lala: "I feel good about this." },
  { min: 85, label: 'Slaying', emoji: '👑', color: '#8b5cf6', lala: "They're not ready for me." },
];

function getConfidence(score) {
  for (let i = CONFIDENCE_LEVELS.length - 1; i >= 0; i--) {
    if (score >= CONFIDENCE_LEVELS[i].min) return CONFIDENCE_LEVELS[i];
  }
  return CONFIDENCE_LEVELS[0];
}

// ─── SYNERGY CALCULATOR ───

function calculateSynergy(filledSlots, eventContext) {
  const items = Object.values(filledSlots).filter(Boolean);
  if (items.length === 0) return { total: 0, breakdown: {}, confidence: getConfidence(0) };

  // 1. Base match scores (avg)
  const baseAvg = items.reduce((s, i) => s + (i.match_score || 0), 0) / items.length;
  const baseScore = Math.min(35, baseAvg * 0.6);

  // 2. Aesthetic synergy — shared tags between items
  let aestheticBonus = 0;
  if (items.length >= 2) {
    const tagSets = items.map(i => new Set((i.aesthetic_tags || []).map(t => t.toLowerCase())));
    let sharedCount = 0;
    let pairs = 0;
    for (let a = 0; a < tagSets.length; a++) {
      for (let b = a + 1; b < tagSets.length; b++) {
        pairs++;
        for (const tag of tagSets[a]) {
          if (tagSets[b].has(tag)) sharedCount++;
        }
      }
    }
    aestheticBonus = Math.min(25, (sharedCount / Math.max(1, pairs)) * 15);
  }

  // 3. Tier harmony — items in same tier get bonus, mixed tiers get penalty
  const tiers = items.map(i => TIER_VALS[i.tier] || 1);
  const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length;
  const tierVariance = tiers.reduce((s, t) => s + Math.abs(t - avgTier), 0) / tiers.length;
  const tierBonus = Math.max(0, 15 - tierVariance * 8);

  // 4. Event alignment — do items' event_types include this event?
  const eventType = (eventContext.event_type || '').toLowerCase();
  let eventHits = 0;
  items.forEach(i => {
    const et = (i.event_types || []).map(e => e.toLowerCase());
    if (et.some(e => e.includes(eventType) || eventType.includes(e))) eventHits++;
  });
  const eventBonus = items.length > 0 ? Math.min(15, (eventHits / items.length) * 15) : 0;

  // 5. Slot coverage bonus — more slots filled = more polished
  const slotBonus = Math.min(10, items.length * 1.5);

  const total = Math.round(Math.min(100, baseScore + aestheticBonus + tierBonus + eventBonus + slotBonus));

  return {
    total,
    breakdown: {
      base: Math.round(baseScore),
      aesthetic: Math.round(aestheticBonus),
      tier_harmony: Math.round(tierBonus),
      event_alignment: Math.round(eventBonus),
      coverage: Math.round(slotBonus),
    },
    confidence: getConfidence(total),
  };
}

// ─── MAIN COMPONENT ───

export default function EpisodeWardrobeGameplay({ episodeId, showId, event = {}, characterState = {}, onOutfitComplete }) {
  const [pool, setPool] = useState([]);
  const [poolBreakdown, setPoolBreakdown] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Slot state
  const [filledSlots, setFilledSlots] = useState({});
  const [activeSlot, setActiveSlot] = useState('body');
  const [inspecting, setInspecting] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [outfitLocked, setOutfitLocked] = useState(false);

  // Smart detection: dress vs top+bottom
  const bodyMode = useMemo(() => {
    if (filledSlots.body) return 'dress';
    if (filledSlots.top || filledSlots.bottom) return 'separates';
    return 'none';
  }, [filledSlots.body, filledSlots.top, filledSlots.bottom]);

  const visibleSlots = useMemo(() => {
    return SLOT_DEFS.filter(s => {
      if (bodyMode === 'dress' && (s.key === 'top' || s.key === 'bottom')) return false;
      if (bodyMode === 'separates' && s.key === 'body') return false;
      return true;
    });
  }, [bodyMode]);

  const synergy = useMemo(() => calculateSynergy(filledSlots, event), [filledSlots, event]);

  const filteredPool = useMemo(() => {
    const slot = SLOT_DEFS.find(s => s.key === activeSlot);
    if (!slot) return pool;
    return pool.filter(item => {
      const cat = (item.clothing_category || '').toLowerCase();
      return slot.categories.includes(cat);
    }).sort((a, b) => b.match_score - a.match_score);
  }, [pool, activeSlot]);

  // ─── Load pool ───
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
        character_state: characterState,
      });
      setPool(res.data.pool || []);
      setPoolBreakdown(res.data.pool_breakdown || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load wardrobe');
    } finally { setLoading(false); }
  }, [showId, event, characterState]);

  useEffect(() => { loadPool(); }, [loadPool]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

  // ─── Assign item to slot ───
  const assignToSlot = (item) => {
    const cat = (item.clothing_category || '').toLowerCase();
    let slotKey = activeSlot;
    if (cat === 'dress') slotKey = 'body';
    else if (cat === 'top') slotKey = 'top';
    else if (cat === 'bottom') slotKey = 'bottom';
    else if (cat === 'shoes') slotKey = 'shoes';
    else if (cat === 'accessories') slotKey = 'accessories';
    else if (cat === 'jewelry') slotKey = 'jewelry';
    else if (cat === 'perfume') slotKey = 'perfume';

    if (slotKey === 'body') {
      setFilledSlots(prev => ({ ...prev, body: item, top: undefined, bottom: undefined }));
    } else if (slotKey === 'top' || slotKey === 'bottom') {
      setFilledSlots(prev => ({ ...prev, [slotKey]: item, body: undefined }));
    } else {
      setFilledSlots(prev => ({ ...prev, [slotKey]: item }));
    }
    setInspecting(null);
  };

  const removeFromSlot = (slotKey) => {
    setFilledSlots(prev => ({ ...prev, [slotKey]: undefined }));
  };

  const purchaseItem = async (item) => {
    setPurchasing(item.id);
    try {
      const res = await api.post('/api/v1/wardrobe/purchase', { wardrobe_id: item.id, show_id: showId });
      if (res.data.success) { setSuccess(`Purchased "${item.name}" for ${res.data.cost} coins!`); loadPool(); }
    } catch (err) { setError(err.response?.data?.error || 'Purchase failed'); }
    finally { setPurchasing(null); }
  };

  const lockOutfit = async () => {
    setConfirming(true);
    try {
      const items = Object.entries(filledSlots).filter(([, v]) => v).map(([slot, item]) => ({ slot, item }));
      for (const { item } of items) {
        await api.post('/api/v1/wardrobe/select', { episode_id: episodeId, wardrobe_id: item.id, show_id: showId });
      }
      setOutfitLocked(true);
      setSuccess('Outfit locked! 🔒✨');
      if (onOutfitComplete) onOutfitComplete({ slots: filledSlots, synergy });
    } catch (err) { setError(err.response?.data?.error || 'Failed to lock outfit'); }
    finally { setConfirming(false); }
  };

  const canLock = useMemo(() => {
    const hasBody = filledSlots.body || (filledSlots.top && filledSlots.bottom);
    const hasShoes = !!filledSlots.shoes;
    return hasBody && hasShoes;
  }, [filledSlots]);

  // ─── RENDER ───
  if (loading) {
    return (
      <div style={W.container}>
        <div style={W.loadingBox}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Opening the closet...</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading wardrobe for this event</div>
        </div>
      </div>
    );
  }

  return (
    <div style={W.container}>
      {error && <div style={W.errorBanner}>{error}<button onClick={() => setError(null)} style={W.xBtn}>✕</button></div>}
      {success && <div style={W.successBanner}>{success}</div>}

      {/* ═══ EVENT BANNER ═══ */}
      <div style={W.eventBanner}>
        <div>
          <div style={W.eventLabel}>STYLING FOR</div>
          <div style={W.eventName}>{event.name || 'Untitled Event'}</div>
          <div style={W.eventTags}>
            {event.dress_code && <span style={W.eventTag}>👗 {event.dress_code}</span>}
            <span style={W.eventTag}>⭐ {event.prestige || '?'}</span>
            <span style={W.eventTag}>📏 {event.strictness || '?'}</span>
            {event.host_brand && <span style={W.eventTag}>🏛️ {event.host_brand}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#880e4f', letterSpacing: 1, fontWeight: 600 }}>COINS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: (characterState.coins || 0) < 100 ? '#dc2626' : '#4a1942' }}>🪙 {characterState.coins || 0}</div>
        </div>
      </div>

      {/* ═══ LOCKED STATE ═══ */}
      {outfitLocked && (
        <div style={W.lockedBanner}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Outfit Locked</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Synergy: {synergy.total}/100 — {synergy.confidence.emoji} {synergy.confidence.label}</div>
          </div>
          <button onClick={() => setOutfitLocked(false)} style={W.unlockBtn}>↩ Unlock</button>
        </div>
      )}

      {/* ═══ MAIN LAYOUT ═══ */}
      {!outfitLocked && (
        <div style={W.mainLayout}>

          {/* ──── LEFT: SLOTS ──── */}
          <div style={W.slotsPanel}>
            {/* Confidence */}
            <div style={W.confidenceCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Outfit Synergy</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: synergy.confidence.color }}>
                  {synergy.confidence.emoji} {synergy.total}
                </span>
              </div>
              <div style={W.synergyBar}>
                <div style={{ height: '100%', width: `${synergy.total}%`, borderRadius: 4, background: `linear-gradient(90deg, ${synergy.confidence.color}80, ${synergy.confidence.color})`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: synergy.confidence.color, marginTop: 5 }}>
                "{synergy.confidence.lala}"
              </div>
              {synergy.total > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                  {Object.entries(synergy.breakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} style={W.synBadge}>+{v} {k.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Slots */}
            {visibleSlots.map(slot => {
              const item = filledSlots[slot.key];
              const isActive = activeSlot === slot.key;
              return (
                <div key={slot.key}
                  onClick={() => !item && setActiveSlot(slot.key)}
                  style={{
                    ...W.slotCard,
                    border: isActive ? '2px solid #6366f1' : item ? '2px solid #bbf7d0' : '1px solid #e2e8f0',
                    background: item ? '#f0fdf4' : isActive ? '#eef2ff' : '#fff',
                    cursor: item ? 'default' : 'pointer',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{slot.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>
                        {slot.label}
                        {slot.required && !item && <span style={{ color: '#dc2626', fontSize: 9 }}> *</span>}
                      </div>
                      {item ? (
                        <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{item.name}</div>
                      ) : (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{slot.desc}</div>
                      )}
                    </div>
                    {item && (
                      <button onClick={(e) => { e.stopPropagation(); removeFromSlot(slot.key); setActiveSlot(slot.key); }}
                        style={W.removeBtn}>✕</button>
                    )}
                  </div>
                  {item && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={W.miniTier(item.tier)}>{TIER_STYLES[item.tier]?.emoji} {item.tier}</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>Match: {item.match_score}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <button onClick={lockOutfit} disabled={!canLock || confirming}
              style={{ ...W.lockBtn, opacity: canLock ? 1 : 0.4 }}>
              {confirming ? '⏳ Locking...' : canLock ? '🔒 Lock Outfit' : '⚠️ Fill required slots'}
            </button>
            {!canLock && (
              <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                Need: {!filledSlots.body && !(filledSlots.top && filledSlots.bottom) ? 'body ' : ''}
                {!filledSlots.shoes ? 'shoes' : ''}
              </div>
            )}
          </div>

          {/* ──── RIGHT: BROWSE ──── */}
          <div style={W.browsePanel}>
            <div style={W.browseHeader}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  {CAT_ICONS[SLOT_DEFS.find(s => s.key === activeSlot)?.categories?.[0]] || '👕'} Browse: {SLOT_DEFS.find(s => s.key === activeSlot)?.label || activeSlot}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{filteredPool.length} items · Click to equip</div>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {visibleSlots.filter(s => !filledSlots[s.key]).map(s => (
                  <button key={s.key} onClick={() => setActiveSlot(s.key)}
                    style={{ ...W.slotSwitch, background: activeSlot === s.key ? '#6366f1' : '#f1f5f9', color: activeSlot === s.key ? '#fff' : '#64748b' }}>
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>

            <div style={W.browseGrid}>
              {filteredPool.map((item, idx) => {
                const ts = TIER_STYLES[item.tier] || TIER_STYLES.basic;
                const rs = ROLE_STYLES[item.pool_role] || ROLE_STYLES.safe;
                const isLocked = !item.is_owned;
                const isUsed = Object.values(filledSlots).some(fi => fi?.id === item.id);
                return (
                  <div key={item.id}
                    onClick={() => {
                      if (isUsed) return;
                      if (item.can_select) assignToSlot(item);
                      else setInspecting(item);
                    }}
                    style={{
                      ...W.browseCard,
                      opacity: isUsed ? 0.3 : isLocked && !item.is_visible ? 0.4 : 1,
                      cursor: isUsed ? 'not-allowed' : 'pointer',
                      border: `1px solid ${rs.border}`,
                      animation: `fadeSlide 0.25s ease ${idx * 0.05}s both`,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ ...W.rolePill, background: rs.bg, color: rs.color }}>{rs.label}</span>
                      <span style={{ ...W.tierPill, background: ts.bg, color: ts.color }}>{ts.emoji} {ts.label}</span>
                    </div>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{CAT_ICONS[item.clothing_category] || '👕'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 1 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{item.color || '—'} · {item.era_alignment || '—'}</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                      {(item.aesthetic_tags || []).slice(0, 3).map((t, i) => (
                        <span key={i} style={W.tagPill}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ flex: 1, height: 3, background: '#f1f5f9', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.match_score / 60) * 100)}%`, borderRadius: 2, background: item.match_score >= 40 ? '#16a34a' : item.match_score >= 20 ? '#eab308' : '#dc2626' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{item.match_score}</span>
                    </div>
                    <div style={{ fontSize: 9, marginTop: 3, color: isLocked ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {isUsed ? '✓ In outfit' : isLocked ? (item.lock_type === 'coin' ? `🪙 ${item.coin_cost}` : `🔒 ${item.lock_type}`) : '✅ Tap to equip'}
                    </div>
                  </div>
                );
              })}
              {filteredPool.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                  <div style={{ fontSize: 24 }}>{SLOT_DEFS.find(s => s.key === activeSlot)?.icon || '👕'}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>No {activeSlot} items available</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ INSPECT MODAL ═══ */}
      {inspecting && (
        <div style={W.overlay} onClick={() => setInspecting(null)}>
          <div style={W.modal} onClick={e => e.stopPropagation()}>
            <button onClick={() => setInspecting(null)} style={W.modalClose}>✕</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span style={{ fontSize: 32 }}>{CAT_ICONS[inspecting.clothing_category] || '👕'}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{inspecting.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{inspecting.clothing_category} · {inspecting.color || '—'} · {inspecting.tier}</div>
              </div>
            </div>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Match Score</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: inspecting.match_score >= 40 ? '#16a34a' : '#eab308' }}>{inspecting.match_score}/60</span>
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (inspecting.match_score / 60) * 100)}%`, borderRadius: 3, background: inspecting.match_score >= 40 ? '#16a34a' : '#eab308' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {(inspecting.match_reasons || []).map((r, i) => <span key={i} style={W.reasonPill}>{r}</span>)}
              </div>
            </div>
            <div style={{ padding: 12, background: '#fef3c7', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: 1, marginBottom: 3 }}>LALA SAYS</div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#475569' }}>"{inspecting.lala_reaction}"</div>
            </div>
            {inspecting.can_select && (
              <button onClick={() => assignToSlot(inspecting)} style={W.modalSelectBtn}>✨ Equip</button>
            )}
            {inspecting.can_purchase && (
              <button onClick={() => purchaseItem(inspecting)} disabled={purchasing === inspecting.id}
                style={W.modalBuyBtn}>
                {purchasing === inspecting.id ? '⏳...' : `🪙 Buy for ${inspecting.coin_cost}`}
              </button>
            )}
            {!inspecting.can_select && !inspecting.can_purchase && (
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                🔒 {inspecting.lock_type === 'reputation' ? `Rep ${inspecting.reputation_required}+` :
                  inspecting.lock_type === 'brand_exclusive' ? 'Brand Exclusive' :
                  inspecting.lock_type === 'season_drop' ? `Drops Ep ${inspecting.season_unlock_episode}` :
                  inspecting.lock_type === 'coin' ? `Need ${inspecting.coin_cost} coins` : 'Locked'}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ─── STYLES ───
const W = {
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  loadingBox: { textAlign: 'center', padding: 60 },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 10 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 10, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' },
  eventBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)', borderRadius: 14, marginBottom: 12, color: '#4a1942' },
  eventLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#c2185b', marginBottom: 2 },
  eventName: { fontSize: 16, fontWeight: 800, marginBottom: 4, color: '#4a1942' },
  eventTags: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  eventTag: { padding: '2px 8px', background: 'rgba(194,24,91,0.1)', borderRadius: 5, fontSize: 10, color: '#880e4f' },
  lockedBanner: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 12, marginBottom: 12 },
  unlockBtn: { marginLeft: 'auto', padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#64748b' },
  mainLayout: { display: 'flex', gap: 16, minHeight: 480 },
  slotsPanel: { flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: 6 },
  confidenceCard: { padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 2 },
  synergyBar: { height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  synBadge: { padding: '1px 5px', background: '#eef2ff', borderRadius: 3, fontSize: 8, color: '#4338ca', fontWeight: 600 },
  slotCard: { padding: '8px 12px', borderRadius: 10, transition: 'all 0.15s' },
  removeBtn: { width: 22, height: 22, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  miniTier: (tier) => ({ padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 600, background: (TIER_STYLES[tier] || TIER_STYLES.basic).bg, color: (TIER_STYLES[tier] || TIER_STYLES.basic).color }),
  lockBtn: { padding: '11px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  browsePanel: { flex: 1, minWidth: 0 },
  browseHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  slotSwitch: { width: 30, height: 30, borderRadius: 7, border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  browseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 },
  browseCard: { padding: 12, borderRadius: 12, background: '#fff', transition: 'all 0.15s' },
  rolePill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700 },
  tierPill: { padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  tagPill: { padding: '1px 4px', background: '#f1f5f9', borderRadius: 3, fontSize: 8, color: '#64748b' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 18, padding: 22, maxWidth: 420, width: '100%', position: 'relative', maxHeight: '80vh', overflowY: 'auto' },
  modalClose: { position: 'absolute', top: 12, right: 12, background: '#f1f5f9', border: 'none', width: 28, height: 28, borderRadius: '50%', fontSize: 13, cursor: 'pointer', color: '#64748b' },
  reasonPill: { padding: '2px 6px', background: '#eef2ff', borderRadius: 4, fontSize: 9, color: '#4338ca', fontWeight: 600 },
  modalSelectBtn: { width: '100%', padding: '11px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  modalBuyBtn: { width: '100%', padding: '9px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
};

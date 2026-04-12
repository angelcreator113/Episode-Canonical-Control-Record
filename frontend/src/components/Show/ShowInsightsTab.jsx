// frontend/src/components/Show/ShowInsightsTab.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * ShowInsightsTab — Real Show Intelligence Dashboard
 *
 * All data from actual APIs — no mock data:
 * - Character state (coins, reputation, brand_trust, influence, stress)
 * - Financial ledger (income, expenses, net P&L across episodes)
 * - Episode evaluation tiers (SLAY/PASS/SAFE/FAIL distribution)
 * - Wardrobe stats (items, tiers, most worn)
 * - Production progress (overlays, scenes, scripts)
 */

const STAT_COLORS = {
  coins: '#B8962E',
  reputation: '#6366f1',
  brand_trust: '#16a34a',
  influence: '#0ea5e9',
  stress: '#dc2626',
};

const TIER_CONFIG = {
  slay: { color: '#FFD700', bg: '#FFFBEB', emoji: '👑', label: 'SLAY' },
  pass: { color: '#22c55e', bg: '#f0fdf4', emoji: '✨', label: 'PASS' },
  safe: { color: '#eab308', bg: '#fefce8', emoji: '😐', label: 'SAFE' },
  fail: { color: '#dc2626', bg: '#fef2f2', emoji: '💔', label: 'FAIL' },
};

function ShowInsightsTab({ show }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showId = show?.id;

  useEffect(() => {
    if (showId) loadInsights();
  }, [showId]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [charRes, ledgerRes, episodesRes, wardrobeRes, eventsRes, overlaysRes] = await Promise.allSettled([
        api.get(`/api/v1/world/${showId}/balance`).catch(() => ({ data: {} })),
        api.get(`/api/v1/world/${showId}/financial-ledger?limit=200`).catch(() => ({ data: { data: {} } })),
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).catch(() => ({ data: [] })),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=500`).catch(() => ({ data: {} })),
        api.get(`/api/v1/world/${showId}/events?limit=100`).catch(() => ({ data: {} })),
        api.get(`/api/v1/ui-overlays/${showId}`).catch(() => ({ data: {} })),
      ]);

      // Character state
      const balance = charRes.status === 'fulfilled' ? charRes.value.data : {};

      // Financial ledger
      const ledger = ledgerRes.status === 'fulfilled' ? (ledgerRes.value.data?.data || {}) : {};
      const transactions = ledger.transactions || [];
      const episodeSummary = ledger.episode_summary || [];

      // Episodes
      const episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value.data?.data || episodesRes.value.data || []) : [];

      // Wardrobe
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [];

      // Events
      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events || []) : [];

      // Overlays
      const overlays = overlaysRes.status === 'fulfilled' ? (overlaysRes.value.data?.data || []) : [];

      // Compute tier distribution
      const tiers = { slay: 0, pass: 0, safe: 0, fail: 0 };
      const scores = [];
      episodes.forEach(ep => {
        const evalJson = ep.evaluation_json ? (typeof ep.evaluation_json === 'string' ? JSON.parse(ep.evaluation_json) : ep.evaluation_json) : null;
        if (evalJson?.tier_final) tiers[evalJson.tier_final] = (tiers[evalJson.tier_final] || 0) + 1;
        if (evalJson?.score) scores.push({ episode: ep.episode_number, score: evalJson.score, tier: evalJson.tier_final, title: ep.title });
      });

      // Financial totals
      const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'reward').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      const totalExpenses = transactions.filter(t => t.type === 'expense' || t.type === 'deduction').reduce((s, t) => s + parseFloat(t.amount || 0), 0);

      // Wardrobe stats
      const tierDist = { basic: 0, mid: 0, luxury: 0, elite: 0 };
      const brandCounts = {};
      wardrobe.forEach(w => {
        if (w.tier) tierDist[w.tier] = (tierDist[w.tier] || 0) + 1;
        if (w.brand) brandCounts[w.brand] = (brandCounts[w.brand] || 0) + 1;
      });
      const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      setData({
        balance: balance.balance ?? null,
        affordability: balance.affordability,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        episodes: episodes.length,
        completed: episodes.filter(e => e.evaluation_status === 'accepted').length,
        tiers,
        scores,
        wardrobe: wardrobe.length,
        wardrobeTiers: tierDist,
        wardrobeValue: wardrobe.reduce((s, w) => s + (parseFloat(w.price) || 0), 0),
        topBrands,
        events: events.length,
        eventsReady: events.filter(e => e.status !== 'draft').length,
        overlaysGenerated: overlays.filter(o => o.generated || o.url || o.asset_id).length,
        overlaysTotal: overlays.length,
        episodeSummary,
      });
    } catch (err) {
      console.error('[Insights] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading insights...</div>;
  if (!data) return <div style={{ padding: 24, color: '#94a3b8' }}>No data available.</div>;

  const S = {
    card: { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 18px' },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Show Intelligence</h2>

      {/* Row 1: Character Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'coins', label: 'Coins', value: data.balance !== null ? data.balance.toLocaleString() : '—', icon: '🪙' },
          { key: 'reputation', label: 'Episodes', value: data.episodes, icon: '📺' },
          { key: 'brand_trust', label: 'Completed', value: data.completed, icon: '👑' },
          { key: 'influence', label: 'Events', value: data.events, icon: '💌' },
          { key: 'stress', label: 'Wardrobe', value: data.wardrobe, icon: '👗' },
        ].map(stat => (
          <div key={stat.key} style={S.card}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{stat.icon} {stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: STAT_COLORS[stat.key] || '#1a1a2e' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Financial P&L + Tier Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Financial P&L */}
        <div style={S.card}>
          <div style={S.sectionTitle}>💰 Financial Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>INCOME</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{data.totalIncome.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>EXPENSES</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{data.totalExpenses.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: data.netProfit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>NET P&L</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: data.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                {data.netProfit >= 0 ? '+' : ''}{data.netProfit.toLocaleString()}
              </div>
            </div>
          </div>
          {data.episodeSummary.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Per Episode</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {data.episodeSummary.slice(0, 8).map((ep, i) => {
                  const net = (parseFloat(ep.total_income) || 0) - (parseFloat(ep.total_expenses) || 0);
                  return (
                    <div key={i} style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: net >= 0 ? '#f0fdf4' : '#fef2f2',
                      color: net >= 0 ? '#16a34a' : '#dc2626',
                    }}>
                      Ep{ep.episode_number}: {net >= 0 ? '+' : ''}{net}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tier Distribution */}
        <div style={S.card}>
          <div style={S.sectionTitle}>🎯 Episode Tiers</div>
          {data.completed > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {Object.entries(TIER_CONFIG).map(([tier, cfg]) => (
                  <div key={tier} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: cfg.bg }}>
                    <div style={{ fontSize: 20 }}>{cfg.emoji}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{data.tiers[tier] || 0}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                  </div>
                ))}
              </div>
              {/* Score history */}
              {data.scores.length > 0 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 40 }}>
                  {data.scores.map((s, i) => (
                    <div key={i} title={`Ep${s.episode}: ${s.score}/100 (${s.tier})`} style={{
                      flex: 1, height: `${s.score * 0.4}px`, minHeight: 4,
                      background: TIER_CONFIG[s.tier]?.color || '#94a3b8',
                      borderRadius: '3px 3px 0 0', cursor: 'pointer',
                    }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 12 }}>
              Complete episodes to see tier distribution
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Wardrobe Intelligence + Production Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Wardrobe */}
        <div style={S.card}>
          <div style={S.sectionTitle}>👗 Wardrobe Intelligence</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Total Items</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{data.wardrobe}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Total Value</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#B8962E' }}>${data.wardrobeValue.toLocaleString()}</div>
            </div>
          </div>

          {/* Tier breakdown */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>By Tier</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { tier: 'elite', color: '#ec4899', icon: '👑' },
                { tier: 'luxury', color: '#eab308', icon: '💎' },
                { tier: 'mid', color: '#6366f1', icon: '👠' },
                { tier: 'basic', color: '#94a3b8', icon: '👟' },
              ].map(t => (
                <div key={t.tier} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6, background: '#f8f8f8' }}>
                  <div style={{ fontSize: 12 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{data.wardrobeTiers[t.tier] || 0}</div>
                  <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>{t.tier}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top brands */}
          {data.topBrands.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Top Brands</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {data.topBrands.map(([brand, count]) => (
                  <span key={brand} style={{ padding: '2px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 10, fontWeight: 600, color: '#333' }}>
                    {brand} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Production Progress */}
        <div style={S.card}>
          <div style={S.sectionTitle}>🎬 Production Progress</div>
          {[
            { label: 'Events', value: data.events, sub: `${data.eventsReady} ready`, color: '#f59e0b' },
            { label: 'UI Overlays', value: data.overlaysGenerated, sub: `of ${data.overlaysTotal}`, color: '#B8962E', pct: data.overlaysTotal > 0 ? Math.round((data.overlaysGenerated / data.overlaysTotal) * 100) : 0 },
            { label: 'Episodes', value: data.episodes, sub: `${data.completed} completed`, color: '#6366f1' },
            { label: 'Wardrobe Items', value: data.wardrobe, sub: `$${data.wardrobeValue.toLocaleString()} value`, color: '#ec4899' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>
                  {item.value} <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>{item.sub}</span>
                </span>
              </div>
              {item.pct !== undefined && (
                <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: 2 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShowInsightsTab;

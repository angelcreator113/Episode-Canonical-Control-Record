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
  coins: 'var(--lala-gold-text)',
  reputation: 'var(--primary-text)',
  brand_trust: 'var(--success-text)',
  influence: 'var(--info-text)',
  stress: 'var(--danger-text)',
};

const TIER_CONFIG = {
  slay: { color: 'var(--lala-gold-text)', fill: 'var(--lala-gold)', bg: 'var(--lala-gold-soft)', emoji: '👑', label: 'SLAY' },
  pass: { color: 'var(--success-text)', fill: 'var(--success)', bg: 'var(--success-bg)', emoji: '✨', label: 'PASS' },
  safe: { color: 'var(--warning-text)', fill: 'var(--warning)', bg: 'var(--warning-bg)', emoji: '😐', label: 'SAFE' },
  fail: { color: 'var(--danger-text)', fill: 'var(--danger)', bg: 'var(--danger-bg)', emoji: '💔', label: 'FAIL' },
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

      // Financial totals: the server's sums over the rows that count toward
      // Lala's balance (no voided rows, no deleted episode's), not a sum of
      // the listed page (Task #2273).
      const totalIncome = Number(ledger.totals?.income) || 0;
      const totalExpenses = Number(ledger.totals?.expenses) || 0;

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

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading insights...</div>;
  if (!data) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>No data available.</div>;

  const S = {
    card: { background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '14px 18px' },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Show Intelligence</h2>

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
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>{stat.icon} {stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: STAT_COLORS[stat.key] || 'var(--text-primary)' }}>{stat.value}</div>
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
              <div style={{ fontSize: 10, color: 'var(--success-text)', fontWeight: 600 }}>INCOME</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success-text)' }}>{data.totalIncome.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--danger-text)', fontWeight: 600 }}>EXPENSES</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger-text)' }}>{data.totalExpenses.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: data.netProfit >= 0 ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>NET P&L</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: data.netProfit >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {data.netProfit >= 0 ? '+' : ''}{data.netProfit.toLocaleString()}
              </div>
            </div>
          </div>
          {data.episodeSummary.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Per Episode</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {data.episodeSummary.slice(0, 8).map((ep, i) => {
                  const net = (parseFloat(ep.total_income) || 0) - (parseFloat(ep.total_expenses) || 0);
                  return (
                    <div key={i} style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: net >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
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
                      background: TIER_CONFIG[s.tier]?.fill || 'var(--text-secondary)',
                      borderRadius: '3px 3px 0 0', cursor: 'pointer',
                    }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
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
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Total Items</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{data.wardrobe}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Total Value</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lala-gold-text)' }}>${data.wardrobeValue.toLocaleString()}</div>
            </div>
          </div>

          {/* Tier breakdown */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>By Tier</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { tier: 'elite', color: 'var(--accent-dark)', icon: '👑' },
                { tier: 'luxury', color: 'var(--lala-gold-text)', icon: '💎' },
                { tier: 'mid', color: 'var(--primary-text)', icon: '👠' },
                { tier: 'basic', color: 'var(--text-secondary)', icon: '👟' },
              ].map(t => (
                <div key={t.tier} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6, background: 'var(--surface-bg)' }}>
                  <div style={{ fontSize: 12 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{data.wardrobeTiers[t.tier] || 0}</div>
                  <div style={{ fontSize: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t.tier}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top brands */}
          {data.topBrands.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Top Brands</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {data.topBrands.map(([brand, count]) => (
                  <span key={brand} style={{ padding: '2px 8px', background: 'var(--lala-parchment-2)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
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
            { label: 'Events', value: data.events, sub: `${data.eventsReady} ready`, color: 'var(--warning-text)' },
            { label: "Lala's Phone", value: data.overlaysGenerated, sub: `of ${data.overlaysTotal}`, color: 'var(--lala-gold-text)', pct: data.overlaysTotal > 0 ? Math.round((data.overlaysGenerated / data.overlaysTotal) * 100) : 0 },
            { label: 'Episodes', value: data.episodes, sub: `${data.completed} completed`, color: 'var(--primary-text)' },
            { label: 'Wardrobe Items', value: data.wardrobe, sub: `$${data.wardrobeValue.toLocaleString()} value`, color: 'var(--accent-dark)' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>
                  {item.value} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>{item.sub}</span>
                </span>
              </div>
              {item.pct !== undefined && (
                <div style={{ height: 4, background: 'var(--lala-parchment-2)', borderRadius: 2, overflow: 'hidden' }}>
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

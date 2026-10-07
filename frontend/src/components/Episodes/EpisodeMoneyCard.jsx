/**
 * The episode Overview's Money card (Episode Money Phase B, MB5; Evoni's
 * rulings, 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(gg)).
 *
 *   MB5. "The episode Overview gets a Money card (M1): actual net so far,
 *   projected net, and how many lines are still planned or pending."
 *   Q10. "the Overview's ledger list is replaced by the Money card with a
 *   "See all in Money →" link; the Money tab is the one full view."
 *
 * It reads the same endpoint as the Money tab
 * (GET /world/:showId/episodes/:episodeId/money), so the two agree. A
 * conditional bonus is never counted; it is shown as "+ up to X if SLAY"
 * (Q3). Read-only.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import api from '../../services/api';

const coins = (n) => Math.abs(Math.round(Number(n) || 0)).toLocaleString();
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coins(n)}`;
const tone = (n) => (n > 0 ? 'var(--success-text)' : n < 0 ? 'var(--danger-text)' : 'var(--text-primary)');

const S = {
  card: { background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8, padding: '12px 14px', marginTop: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  label: { fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--lala-gold-text)' },
  link: { fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--lala-gold-text)', textDecoration: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 },
  statLabel: { fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-secondary)' },
  statValue: { fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 700, marginTop: 2 },
  note: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 },
  chip: { display: 'inline-block', padding: '1px 8px', marginRight: 4, borderRadius: 999, border: '1px solid var(--lala-gold)', color: 'var(--lala-gold-text)', fontFamily: "'DM Mono', monospace", fontSize: 10 },
};

export default function EpisodeMoneyCard({ showId, episodeId }) {
  const [money, setMoney] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!showId || !episodeId) return undefined;
    let cancelled = false;
    setMoney(null);
    setFailed(false);
    api.get(`/api/v1/world/${showId}/episodes/${episodeId}/money`)
      .then((r) => { if (!cancelled) setMoney(r.data?.data || null); })
      .catch((err) => {
        console.error('[EpisodeMoneyCard] load failed:', err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [showId, episodeId]);

  if (!showId || !episodeId) return null;

  const p = money?.projection;
  const open = p?.open_count ?? 0;

  return (
    <div style={S.card} data-testid="episode-money-card">
      <div style={S.head}>
        <span style={{ ...S.label, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Coins size={13} aria-hidden="true" /> Money</span>
        <Link to={`/episodes/${episodeId}?tab=money`} style={S.link} data-testid="episode-money-card-link">See all in Money →</Link>
      </div>
      {failed && <div style={S.note}>Couldn't load this episode's money.</div>}
      {!failed && !p && <div style={S.note}>Loading money…</div>}
      {p && (
        <>
          <div style={S.grid}>
            <div data-testid="episode-money-card-actual">
              <div style={S.statLabel}>Actual net so far</div>
              <div style={{ ...S.statValue, color: tone(p.posted_net) }}>{signed(p.posted_net)}</div>
            </div>
            <div data-testid="episode-money-card-projected">
              <div style={S.statLabel}>Projected net</div>
              <div style={{ ...S.statValue, color: tone(p.projected_net) }}>{signed(p.projected_net)}</div>
            </div>
          </div>
          {p.conditional?.length > 0 && (
            <div style={{ marginTop: 6 }} data-testid="episode-money-card-conditional">
              {p.conditional.map((c) => (
                <span key={c.tier} style={S.chip}>+ up to {coins(c.amount)} if {String(c.tier).toUpperCase()}</span>
              ))}
            </div>
          )}
          <div style={S.note} data-testid="episode-money-card-open">
            {open === 0
              ? 'No lines are still planned or pending.'
              : `${open} line${open === 1 ? ' is' : 's are'} still planned or pending.`}
          </div>
        </>
      )}
    </div>
  );
}

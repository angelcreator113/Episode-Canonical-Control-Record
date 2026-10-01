/**
 * Production → Money: Episode Money, Phase A (docs/EVENT_EPISODE_FLOW.md
 * §8(aa) M1–M5; Task #2278). The ledger view is read-only.
 *
 * Everything comes from the ledger (M4) through
 * GET /world/:showId/episodes/:episodeId/money:
 * - Lala's current balance (getCurrentBalance);
 * - this episode's posted rows, voided and deleted-episode rows excluded (M6);
 * - the episode's net, the sum of those rows;
 * - "Expected" lines from the source event's accepted terms. They are never
 *   posted and never added to the balance (M2).
 *
 * - Event spending (the event cost split ruling, 2026-09-30): the lines Lala
 *   buys during the event, edited here until Complete (EpisodeSpendingSection).
 *
 * Phase B (§8(gg) MB1–MB3 and Evoni's answers, 2026-10-01): one list of
 * the episode's money lines, each with its trigger, who pays or covers it,
 * its amount and its state (Planned, Pending, Posted); posted rows no line
 * matches are "Posted, not planned". Beside the actual balance: the
 * projected net (posted + pending + planned) and Lala's projected balance
 * after this episode. A conditional bonus is never counted; it shows as
 * "+ up to X if SLAY" beside the net. The header chip stays the actual
 * balance. No recap (Phase C).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Receipt, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import EpisodeSpendingSection from './EpisodeSpendingSection';
import './EpisodeMoneyTab.css';

export const getEpisodeMoneyApi = (showId, episodeId) =>
  api.get(`/api/v1/world/${showId}/episodes/${episodeId}/money`).then((r) => r.data?.data);


const coins = (n) => Number(n || 0).toLocaleString();
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coins(Math.abs(n))}`;
const label = (category) => String(category || '').replace(/_/g, ' ');
const day = (date) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const tone = (n) => (n > 0 ? 'em-pos' : n < 0 ? 'em-neg' : '');

const STATE_LABELS = {
  planned: 'Planned',
  pending: 'Pending',
  posted: 'Posted',
  not_earned: 'Not earned',
  covered: 'Covered',
};

// Who pays or covers the line (MB2).
function payerText(line) {
  const who = line.payer?.who;
  const name = line.payer?.name || (who === 'brand' ? 'the brand' : who === 'host' ? 'the host' : null);
  if (line.covered) return `Covered by ${name || 'the host'}${line.covered_amount ? ` (${coins(line.covered_amount)})` : ''}`;
  if (who === 'lala') return 'Lala pays';
  return name ? `Paid by ${name}` : 'Paid by the host';
}

export default function EpisodeMoneyTab({ episode, showId }) {
  const [money, setMoney] = useState(null);
  const [error, setError] = useState(null);

  // After a spending write: reload quietly, keeping the view on screen.
  const reload = useCallback(async () => {
    try {
      setMoney(await getEpisodeMoneyApi(showId, episode.id));
    } catch (err) {
      console.error('[EpisodeMoneyTab] reload failed:', err);
    }
  }, [showId, episode?.id]);

  useEffect(() => {
    if (!showId || !episode?.id) return undefined;
    let cancelled = false;
    setMoney(null);
    setError(null);
    getEpisodeMoneyApi(showId, episode.id)
      .then((data) => { if (!cancelled) setMoney(data); })
      .catch((err) => {
        console.error('[EpisodeMoneyTab] load failed:', err);
        if (!cancelled) setError("Couldn't load this episode's money. Try again in a moment.");
      });
    return () => { cancelled = true; };
  }, [showId, episode?.id]);

  if (!showId) return <div className="em-empty">This episode has no show, so it has no money to show.</div>;
  if (error) return <div className="em-empty em-error">{error}</div>;
  if (!money) return <div className="em-empty">Loading money…</div>;

  const projection = money.projection || null;
  const lines = money.lines || [];
  const unplanned = money.unplanned || [];

  const warnings = money.warnings || [];

  return (
    <div className="em-tab">
      {warnings.length > 0 && (
        <div className="em-warnings" role="alert" data-testid="em-warnings">
          <div className="em-warnings-head"><AlertTriangle size={14} aria-hidden /> Money warning</div>
          <ul>
            {warnings.map((w) => <li key={w.code} data-testid={`em-warning-${w.code}`}>{w.message}</li>)}
          </ul>
          <p className="em-warnings-note">A warning only: nothing is blocked here. Complete still refuses a completion that takes Lala below zero.</p>
        </div>
      )}
      <div className="em-summary">
        <div className="em-card" data-testid="em-balance">
          <div className="em-card-label"><Coins size={14} aria-hidden /> Lala's balance</div>
          <div className="em-card-value">{coins(money.balance)} 🪙</div>
          <div className="em-card-note">Across the whole show, from the ledger.</div>
        </div>
        {projection && (
          <div className="em-card" data-testid="em-projected-balance">
            <div className="em-card-label"><TrendingUp size={14} aria-hidden /> After this episode</div>
            <div className={`em-card-value ${projection.projected_balance < 0 ? 'em-neg' : ''}`}>{coins(projection.projected_balance)} 🪙</div>
            <div className="em-card-note">Projected: her balance plus this episode's pending and planned lines.</div>
          </div>
        )}
        <div className="em-card" data-testid="em-net">
          <div className="em-card-label"><Receipt size={14} aria-hidden /> This episode's net</div>
          {projection ? (
            <>
              <div className={`em-card-value ${tone(projection.projected_net)}`}>{signed(projection.projected_net)}</div>
              <div className="em-card-note">Projected. Posted so far: {signed(projection.posted_net)}.</div>
              {projection.conditional.length > 0 && (
                <div className="em-conditional" data-testid="em-conditional">
                  {projection.conditional.map((c) => (
                    <span key={c.tier} className="em-chip em-chip-conditional">+ up to {coins(c.amount)} if {c.tier.toUpperCase()}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`em-card-value ${tone(money.net)}`}>{signed(money.net)}</div>
              <div className="em-card-note">The sum of the posted rows.</div>
            </>
          )}
        </div>
      </div>

      <section className="em-section">
        <h3 className="em-heading">Money lines</h3>
        <p className="em-explain">
          Each line from the accepted terms{money.event ? ` of ${money.event.name}` : ''} and the event spending.
          Planned and pending lines are not in the ledger or the balance.
        </p>
        {lines.length === 0 && unplanned.length === 0 ? (
          <div className="em-empty">
            {money.event ? 'The accepted terms carry no money, and nothing has posted.' : 'This episode has no source event, and nothing has posted.'}
          </div>
        ) : (
          <ul className="em-rows" data-testid="em-lines">
            {lines.map((l) => (
              <li key={l.key} className={`em-line em-line-${l.state}`} data-testid={`em-line-${l.key}`}>
                <span className="em-line-label">{l.label}</span>
                <span className={`em-line-amount ${l.covered || l.state === 'not_earned' ? '' : tone(l.signed)}`}>
                  {l.covered ? '0' : signed(l.signed)}
                </span>
                <span className="em-line-meta">
                  <span className={`em-chip em-chip-${l.state}`}>{STATE_LABELS[l.state] || l.state}</span>
                  {l.trigger && <span>{l.trigger}</span>}
                  <span>{payerText(l)}</span>
                </span>
              </li>
            ))}
            {unplanned.map((r) => (
              <li key={r.id} className="em-line em-line-posted" data-testid={`em-unplanned-${r.id}`}>
                <span className="em-line-label">{r.description || label(r.category)}</span>
                <span className={`em-line-amount ${tone(r.signed)}`}>{signed(r.signed)}</span>
                <span className="em-line-meta">
                  <span className="em-chip em-chip-posted">Posted, not planned</span>
                  <span>{label(r.category)}</span>
                  <span>{day(r.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {money.spending && (
        <EpisodeSpendingSection showId={showId} episodeId={episode.id} spending={money.spending} onChanged={reload} />
      )}
    </div>
  );
}

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
 * No planned or pending states (Phase B) and no recap (Phase C).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Receipt, CalendarClock } from 'lucide-react';
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

  return (
    <div className="em-tab">
      <div className="em-summary">
        <div className="em-card" data-testid="em-balance">
          <div className="em-card-label"><Coins size={14} aria-hidden /> Lala's balance</div>
          <div className="em-card-value">{coins(money.balance)} 🪙</div>
          <div className="em-card-note">Across the whole show, from the ledger.</div>
        </div>
        <div className="em-card" data-testid="em-net">
          <div className="em-card-label"><Receipt size={14} aria-hidden /> This episode's net</div>
          <div className={`em-card-value ${money.net > 0 ? 'em-pos' : money.net < 0 ? 'em-neg' : ''}`}>{signed(money.net)}</div>
          <div className="em-card-note">The sum of the rows posted below.</div>
        </div>
      </div>

      <section className="em-section">
        <h3 className="em-heading">Posted</h3>
        {money.rows.length === 0 ? (
          <div className="em-empty">Nothing has posted for this episode yet.</div>
        ) : (
          <ul className="em-rows">
            {money.rows.map((r) => (
              <li key={r.id} className="em-row">
                <span className="em-row-date">{day(r.date)}</span>
                <span className="em-row-category">{label(r.category)}</span>
                <span className="em-row-desc">{r.description || '—'}</span>
                <span className={`em-row-amount ${r.signed > 0 ? 'em-pos' : 'em-neg'}`}>{signed(r.signed)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="em-section">
        <h3 className="em-heading"><CalendarClock size={14} aria-hidden /> Expected</h3>
        <p className="em-explain">
          From the source event's accepted terms{money.event ? ` (${money.event.name})` : ''}. Expected lines are
          not posted and are not in the balance or the net.
        </p>
        {money.expected.length === 0 ? (
          <div className="em-empty">
            {money.event ? 'The accepted terms carry no payment or entry cost.' : 'This episode has no source event, so nothing is expected.'}
          </div>
        ) : (
          <ul className="em-rows">
            {money.expected.map((x) => (
              <li key={`${x.kind}-${x.label}`} className="em-row em-row-expected">
                <span className="em-row-date">Expected</span>
                <span className="em-row-category">{x.label}</span>
                <span className="em-row-desc">From the terms</span>
                <span className="em-row-amount">{signed(x.kind === 'income' ? x.amount : -x.amount)}</span>
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

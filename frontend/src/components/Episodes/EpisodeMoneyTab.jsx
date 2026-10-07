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
 *
 * After Complete (MB6, Q7): a Reconciliation section compares each line as
 * planned at Start Episode (episodes.money_plan) with what posted.
 *
 * The redesign (Evoni's Episode mock, 2026-10-06): three tiles (Earns,
 * Spends, Net estimate) over "Every line in the estimate", each line with
 * where it comes from, when it is charged or paid, what it adds and its
 * state; then where the deal terms stand, with Open terms in the event.
 * The rows add up to the projected net (lib/episodeMoney.js).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { estimateRows, moneyTiles, termsNote } from '../../lib/episodeMoney';
import EpisodeSpendingSection from './EpisodeSpendingSection';
import './EpisodeMoneyTab.css';

export const getEpisodeMoneyApi = (showId, episodeId) =>
  api.get(`/api/v1/world/${showId}/episodes/${episodeId}/money`).then((r) => r.data?.data);


const coins = (n) => Number(n || 0).toLocaleString();
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coins(Math.abs(n))}`;
const day = (date) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const tone = (n) => (n > 0 ? 'em-pos' : n < 0 ? 'em-neg' : '');

// MB6 (§8(gg), Q7): after Complete, the plan saved at Start Episode beside
// what posted, per line, with the differences highlighted.
const RECON_LABELS = {
  as_planned: 'As planned',
  changed: 'Changed',
  not_earned: 'Not earned',
  earned: 'Earned',
  outstanding: 'Outstanding',
  added: 'Added',
  removed: 'Removed',
  covered: 'Covered',
  unplanned: 'Posted, not planned',
};
const QUIET = new Set(['as_planned', 'earned', 'covered']);

function Reconciliation({ recon }) {
  const amount = (n) => (n == null ? '—' : signed(n));
  return (
    <section className="em-section" data-testid="em-reconciliation">
      <h3 className="em-heading">Reconciliation</h3>
      <p className="em-explain">
        {recon.basis === 'start_episode'
          ? `Each line as planned at Start Episode${recon.planned_at ? ` (${day(recon.planned_at)})` : ''}, beside what posted.`
          : 'No plan was saved at Start Episode for this episode, so each line is compared with the plan as it stands now.'}
        {recon.highlighted > 0 ? ` ${recon.highlighted} difference${recon.highlighted === 1 ? '' : 's'} highlighted.` : ' Everything went as planned.'}
      </p>
      <ul className="em-rows">
        {recon.rows.map((r) => {
          const loud = !QUIET.has(r.status) || r.draft_change;
          return (
            <li key={r.key} className={`em-recon ${loud ? 'em-recon-diff' : ''}`} data-testid={`em-recon-${r.key}`}>
              <span className="em-line-label">{r.label}</span>
              <span className={`em-chip em-recon-chip-${r.status}`}>
                {r.status === 'outstanding' && r.pending ? 'Outstanding · pending' : (RECON_LABELS[r.status] || r.status)}
              </span>
              <span className="em-recon-figures">
                <span>Planned {r.planned_conditional != null ? `${signed(r.planned_conditional)} if earned` : amount(r.planned)}</span>
                <span>Posted {amount(r.posted)}</span>
                {r.difference != null && r.difference !== 0 && (
                  <span className={tone(r.difference)}>Difference {signed(r.difference)}</span>
                )}
              </span>
              {r.draft_change && (
                <span className="em-recon-note">
                  Changed from its draft: {r.draft_change.from.quantity} × {coins(r.draft_change.from.unit_price)} → {r.draft_change.to.quantity} × {coins(r.draft_change.to.unit_price)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="em-recon-totals" data-testid="em-recon-totals">
        Planned net {signed(recon.totals.planned_net)} · posted net {signed(recon.totals.posted_net)} ·{' '}
        <span className={tone(recon.totals.difference)}>difference {signed(recon.totals.difference)}</span>
      </div>
    </section>
  );
}

export default function EpisodeMoneyTab({ episode, showId }) {
  const [money, setMoney] = useState(null);
  const [error, setError] = useState(null);
  // A failed refresh after a change: the view stays, and says it may be out
  // of date (Evoni, 2026-10-07; it used to fail silently).
  const [staleError, setStaleError] = useState(null);

  // After a spending write: reload quietly, keeping the view on screen.
  const reload = useCallback(async () => {
    try {
      setMoney(await getEpisodeMoneyApi(showId, episode.id));
      setStaleError(null);
    } catch (err) {
      console.error('[EpisodeMoneyTab] reload failed:', err);
      setStaleError("Your change was saved, but the numbers couldn't refresh. They may be out of date.");
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

  const rows = estimateRows(money);
  const tiles = moneyTiles(money);
  const terms = termsNote(money);

  const warnings = money.warnings || [];

  return (
    <div className="em-tab">
      {staleError && (
        <div className="em-stale" role="alert" data-testid="em-stale">
          <span>{staleError}</span>
          <button type="button" className="em-link" onClick={reload}>Refresh</button>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="em-warnings" role="alert" data-testid="em-warnings">
          <div className="em-warnings-head"><AlertTriangle size={14} aria-hidden /> Money warning</div>
          <ul>
            {warnings.map((w) => <li key={w.code} data-testid={`em-warning-${w.code}`}>{w.message}</li>)}
          </ul>
          <p className="em-warnings-note">A warning only: nothing is blocked here. Complete still refuses a completion that takes Lala below zero.</p>
        </div>
      )}
      <div className="em-tiles">
        <div className="em-tile em-tile-earns" data-testid="em-earns">
          <div className="em-tile-label">Earns</div>
          <div className="em-tile-value">{signed(tiles.earns.total)}</div>
          <div className="em-tile-note">{tiles.earns.note}</div>
        </div>
        <div className="em-tile em-tile-spends" data-testid="em-spends">
          <div className="em-tile-label">Spends</div>
          <div className="em-tile-value">{signed(tiles.spends.total)}</div>
          <div className="em-tile-note">{tiles.spends.note}</div>
        </div>
        <div className="em-tile em-tile-net" data-testid="em-net">
          <div className="em-tile-label">Net estimate</div>
          <div className={`em-tile-value ${tone(tiles.net.total)}`}>{signed(tiles.net.total)}</div>
          <div className="em-tile-note">Adds up exactly the lines below</div>
          {tiles.net.conditional.length > 0 && (
            <div className="em-conditional" data-testid="em-conditional">
              {tiles.net.conditional.map((c) => (
                <span key={c.tier} className="em-chip em-chip-conditional">+ up to {coins(c.amount)} if {c.tier.toUpperCase()}</span>
              ))}
            </div>
          )}
          {tiles.net.balance && (
            <div className="em-tile-balance" data-testid="em-projected-balance">
              Lala has {coins(tiles.net.balance.now)} · <span className={tiles.net.balance.after < 0 ? 'em-neg' : ''}>{coins(tiles.net.balance.after)} after this episode</span>
            </div>
          )}
        </div>
      </div>

      <section className="em-section em-estimate">
        <div className="em-estimate-head">
          <h3 className="em-heading em-estimate-title">Every line in the estimate</h3>
          <span className="em-explain">Each line says where it comes from and when it is charged or paid</span>
        </div>
        {rows.length === 0 ? (
          <div className="em-empty">
            {money.event ? 'The accepted terms carry no money, and nothing has posted.' : 'This episode has no source event, and nothing has posted.'}
          </div>
        ) : (
          <ul className="em-est-rows" data-testid="em-lines">
            {rows.map((r) => (
              <li
                key={r.key}
                className={`em-est-row is-${r.chipKind}`}
                data-testid={r.unplannedId ? `em-unplanned-${r.unplannedId}` : `em-line-${r.key}`}
              >
                <span className="em-est-what" title={r.pieces ? r.pieces.join(', ') : undefined}>
                  <span className="em-est-label">{r.label}</span>
                  <span className="em-est-source">{r.source}</span>
                </span>
                <span className="em-est-when">{r.when}</span>
                <span className={`em-est-amount ${tone(r.counts)}`}>{r.amountText}</span>
                <span className={`em-chip em-chip-${r.chipKind}`}>{r.chip}</span>
              </li>
            ))}
          </ul>
        )}
        {terms && (
          <div className="em-terms" data-testid="em-terms">
            <span>{terms}</span>
            <Link className="em-terms-link" to={`/shows/${showId}/events/${money.event.id}#epp-sec-deal`}>Open terms in the event</Link>
          </div>
        )}
      </section>

      {money.reconciliation && <Reconciliation recon={money.reconciliation} />}

      {money.spending && (
        <EpisodeSpendingSection showId={showId} episodeId={episode.id} spending={money.spending} onChanged={reload} />
      )}
    </div>
  );
}

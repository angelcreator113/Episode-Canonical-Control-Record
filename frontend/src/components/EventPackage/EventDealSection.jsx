/**
 * EventDealSection — section 5, Deal & Money: the three money tiles, the
 * reopen panel (Task #2378) right above the Terms it reopens, the Terms
 * (Task #1814), and the money preview (MB4). The Terms start from the
 * combined GET's deliverables and costs when the page has them (Task #54).
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Lock, Coins } from 'lucide-react';
import TermsReopenPanel from './TermsReopenPanel';
import EventTermsSection from './EventTermsSection';
import { dealTiles } from '../../lib/eventPackageHero';
import { dealLabelFor } from '../../utils/eventTerms';
import { coins, signedCoins } from '../../lib/eventPackageFields';

export default function EventDealSection({
  showId, eventId, event, used, termsReopen, lockEpisode, stakes, moneyPreview, seeds, reloadTick,
  termsOffer, setTermsOffer, setInvitationRegenSignal, setPriceInputs, putEvent, setToast, load, hints = null,
}) {
  const dealTilesNow = dealTiles(moneyPreview);
  return (
    <section id="epp-sec-deal" className="epp-section epp-deal" data-testid="deal-section">
    <div className="epp-section-header">
      <div className="epp-section-heading">
        <h2 className="epp-section-title"><span className="epp-section-num">5.</span> Deal &amp; Money</h2>
        <p className="epp-section-sub">{dealLabelFor(event) ? `${dealLabelFor(event)}: what` : 'What'} Lala earns, pays and agrees to.</p>
      </div>
      {used && !termsReopen && <span className="epp-chip" data-testid="deal-locked"><Lock size={11} aria-hidden="true" /> Locked at Start Episode</span>}
    </div>
    {/* The host's usual deal type and the money warning (EventFieldHints). */}
    {hints}
    {dealTilesNow && (
      <ul className="epp-deal-tiles" data-testid="deal-tiles">
        {dealTilesNow.map((t) => (
          <li key={t.key} className={`epp-deal-tile tile-${t.key}`} data-testid={`deal-${t.key}`}>
            <span>{t.label}</span>
            <strong>{t.value}</strong>
            <small>{t.sub}</small>
          </li>
        ))}
      </ul>
    )}
    {/* Reopen terms (Task #2378) sits directly above the Terms it
        reopens, where the lock label is (Evoni, 2026-09-30: the line
        under the page banner was not found). */}
    <TermsReopenPanel key={`terms-reopen-${reloadTick}`}
      showId={showId}
      eventId={eventId}
      locked={used}
      reopen={termsReopen || null}
      episode={lockEpisode}
      offer={termsOffer}
      onOffer={setTermsOffer}
      onChanged={load}
      onRegenerateInvitation={() => setInvitationRegenSignal((n) => n + 1)}
      onToast={setToast}
    />

    <EventTermsSection key={`terms-${reloadTick}`}
      showId={showId}
      eventId={eventId}
      event={event}
      locked={used && !termsReopen}
      putEvent={putEvent}
      onSaved={load}
      onToast={setToast}
      onPriceInputsChange={setPriceInputs}
            initialDeliverables={seeds?.deliverables}
            initialCosts={seeds?.costs}
    />
    <div className="epp-deal-money">
        <div className="epp-stake">
          <div className="epp-stake-head"><Coins size={14} aria-hidden="true" /> Money</div>
          {stakes.money.summary
            ? <p className="epp-stake-text">{stakes.money.summary}</p>
            : <div className="epp-basic-unset">Not set</div>}
          {!used && moneyPreview && (() => {
            const counted = (moneyPreview.lines || []).filter((l) => !l.covered && !l.conditional);
            const bonus = moneyPreview.projection?.conditional || [];
            return (
              <div className="epp-money-preview" data-testid="money-preview">
                <p className="epp-stake-text" data-testid="money-preview-balance">Lala has {coins(moneyPreview.balance)} coins.</p>
                {counted.length ? (
                  <ul className="epp-money-lines">
                    {counted.map((l) => (
                      <li key={l.key} data-testid={`money-preview-line-${l.key}`}>
                        <span>{l.label}</span>
                        <span className={l.signed < 0 ? 'is-neg' : 'is-pos'}>{signedCoins(l.signed)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="epp-stake-text">No planned income or costs.</p>
                )}
                {moneyPreview.projection && (
                  <p className="epp-stake-text" data-testid="money-preview-after">
                    After this episode: <strong>{coins(moneyPreview.projection.projected_balance)} coins</strong> projected.
                  </p>
                )}
                {bonus.map((b) => (
                  <p key={`${b.tier}-${b.label}`} className="epp-stake-note">Plus up to {coins(b.amount)} if she earns it ({b.label}).</p>
                ))}
              </div>
            );
          })()}
        </div>
    </div>
    </section>
  );
}

/**
 * EventLookSection — section 4, Lala's Look (Task #2376): the dress code
 * and styling brief, her outfit as pictures (with each piece's charge once
 * the episode has it), Choose / Change outfit or Open Wardrobe, and the
 * recommended looks while none is chosen.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Link } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import PieceImage from '../Wardrobe/PieceImage';
import EventLookRecommendations from './EventLookRecommendations';
import { pieceChargeText } from '../../lib/lookCharge';

export default function EventLookSection({
  showId, eventId, event, used, outfitPieces, episodeLook, lookSummary, lookBrief, lookEpisodeId, reloadTick, fold,
  setOutfitPickerOpen, setToast, load,
}) {
  return (
    <section id="epp-sec-look" className={fold.cls('look', `epp-look-section${outfitPieces.length ? '' : ' no-outfit'}`)} data-testid="style-section">
      <div className="epp-section-header">
        <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">4.</span> Lala&apos;s Look</h2><p className="epp-section-sub">What she wears, from her closet.</p></div>
        {fold.button('look', "Lala's Look")}
        <span className={`epp-chip${outfitPieces.length && episodeLook?.state !== 'chosen' ? '' : ' warn'}`} data-testid="style-outfit-summary">
          {lookSummary}
        </span>
      </div>
      {fold.line('look')}
      <div id="epp-body-look" className="epp-section-body" hidden={!fold.isOpen('look')}>
      <div className="epp-split">
        {/* What the event asks of her: the dress code and the creation
            draft's styling brief (automation.styling_brief). */}
        <dl className="epp-split-main epp-look-brief" data-testid="look-brief">
          {lookBrief.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not set'}</dd></div>)}
        </dl>
        <div className={`epp-split-side epp-outfit-card${outfitPieces.length ? '' : ' empty'}`} data-testid="outfit-card">
          {outfitPieces.length > 0 ? (
            <>
              <span className="epp-col-title">Her outfit</span>
              <ul className="epp-outfit-pieces">
                {/* Each piece as its picture (Evoni, 2026-10-07: "show the
                    images instead of just the name"); a shirt stands in
                    when there is none or it fails to load. */}
                {outfitPieces.map((piece, i) => (
                  <li key={piece.id || i} className="epp-outfit-piece" data-testid={`look-piece-${piece.id || i}`}>
                    {/* On its Producer Mode backdrop (Task #3151). */}
                    <span className="epp-outfit-piece-img">
                      <PieceImage item={piece} src={piece.image_url || null} radius={0} alt={piece.name || 'Outfit piece'}
                        fallback={<Shirt size={22} aria-hidden="true" />} imgTestId={`look-piece-img-${piece.id || i}`} />
                    </span>
                    <span className="epp-outfit-piece-name">{piece.name || 'Unnamed piece'}</span>
                    {episodeLook && (
                      <span className="epp-outfit-piece-cost" data-testid={`look-piece-cost-${piece.id || i}`}>
                        {pieceChargeText(piece)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {episodeLook && (
                <span className="epp-look-from" data-testid="look-from">
                  {episodeLook.state === 'locked' && "Locked in the episode's Wardrobe; charged at Finalize."}
                  {episodeLook.state === 'chosen' && "Chosen in the episode's Wardrobe, not locked yet."}
                  {episodeLook.state === 'event' && 'Picked here before Start Episode; the episode can change it in its Wardrobe.'}
                </span>
              )}
            </>
          ) : (
            <>
              <Shirt size={22} aria-hidden="true" />
              <strong>No outfit yet</strong>
              <span>{episodeLook ? "Choose it in the episode's Wardrobe; the coin cost is charged at Finalize." : 'Pick from the closet; the coin cost is charged at Finalize.'}</span>
            </>
          )}
          {used && lookEpisodeId && (
            <Link className="epp-btn" to={`/episodes/${lookEpisodeId}?tab=wardrobe`} data-testid="look-open-wardrobe">
              <Shirt size={14} /> Open Wardrobe
            </Link>
          )}
          {!used && (
            <button className={`epp-btn ${outfitPieces.length ? '' : 'epp-btn-primary'}`} onClick={() => setOutfitPickerOpen(true)} data-testid="style-choose-outfit">
              <Shirt size={14} /> {outfitPieces.length ? 'Change outfit' : 'Choose outfit'}
            </button>
          )}
        </div>
      </div>
      {/* Recommended looks (episode creation step 3): whole outfits from
          the closet while none is chosen. */}
      {!used && outfitPieces.length === 0 && (
        <EventLookRecommendations key={`look-recs-${reloadTick}`}
          showId={showId} eventId={eventId}
          onSaved={load} onToast={setToast} onBrowse={() => setOutfitPickerOpen(true)}
          hasOutfit={!!event.outfit_set_id || outfitPieces.length > 0}
        />
      )}
              </div>
    </section>
  );
}

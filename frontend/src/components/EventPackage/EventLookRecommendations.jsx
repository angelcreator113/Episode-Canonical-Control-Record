/**
 * Recommended looks in the Event Package's Style section (Evoni,
 * 2026-10-03, episode creation step 3): instead of searching the closet,
 * two or three whole outfits that fit this event, each with its match and
 * what Lala would have to buy, and Use this look.
 *
 * The closet comes from GET …/events/:eventId/wardrobe-options (each piece
 * scored against the event by scorePieceForEvent); the looks are built by
 * recommendLooks, with no AI. Use this look saves through the same
 * PUT …/events/:eventId/outfit the closet picker uses, which re-scores the
 * whole outfit. Shown only while no outfit is chosen.
 *
 * Props: showId, eventId, onSaved(), onToast(message), onBrowse() to open
 * the full closet picker.
 */
import { useEffect, useState } from 'react';
import { Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { recommendLooks, isOwned } from '../../utils/recommendLooks';

export default function EventLookRecommendations({ showId, eventId, onSaved, onToast, onBrowse }) {
  const [looks, setLooks] = useState(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/events/${eventId}/wardrobe-options`)
      .then((res) => { if (!cancelled) setLooks(recommendLooks(res.data?.items || [])); })
      .catch((err) => {
        console.error('[EventLooks] closet load failed:', err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [showId, eventId]);

  const chooseLook = async (look) => {
    if (saving) return;
    setSaving(look.key);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}/outfit`, { wardrobe_ids: look.pieces.map((p) => p.id) });
      onToast?.(`${look.label} chosen`);
      onSaved?.();
    } catch (err) {
      console.error('[EventLooks] save failed:', err);
      onToast?.(err.response?.data?.error || err.message || 'Failed to save the look');
    } finally {
      setSaving(null);
    }
  };

  if (failed) return <p className="epp-looks-note" data-testid="looks-failed">Recommended looks could not be loaded. Choose an outfit from the closet instead.</p>;
  if (looks === null) return <p className="epp-looks-note" data-testid="looks-loading">Finding looks in Lala&apos;s closet…</p>;
  if (looks.length === 0) {
    return (
      <p className="epp-looks-note" data-testid="looks-empty">
        Lala&apos;s closet has no dress or top-and-bottom to build a look from yet.
      </p>
    );
  }

  return (
    <div className="epp-looks" data-testid="looks">
      <div className="epp-looks-head"><Sparkles size={13} aria-hidden="true" /> Recommended from Lala&apos;s closet</div>
      <ul className="epp-looks-list">
        {looks.map((look) => (
          <li key={look.key} className="epp-look" data-testid={`look-${look.label.replace(' ', '-').toLowerCase()}`}>
            <div className="epp-look-head">
              <span className="epp-look-label">{look.label}</span>
              <span className="epp-look-match" data-testid="look-match">{look.match}% event match</span>
            </div>
            <ul className="epp-look-pieces">
              {look.pieces.map((p) => (
                <li key={p.id} className={isOwned(p) ? '' : 'is-buy'}>
                  {p.name || 'Unnamed piece'}
                  {!isOwned(p) && <span className="epp-look-buy"> · to buy</span>}
                </li>
              ))}
            </ul>
            <p className="epp-look-note" data-testid="look-cost">
              {look.owned
                ? 'Lala owns every piece.'
                : <><ShoppingBag size={12} aria-hidden="true" /> {look.toBuy.length} piece{look.toBuy.length === 1 ? '' : 's'} to buy{look.toBuyCost ? ` · ${look.toBuyCost.toLocaleString()} coins` : ''}</>}
              {look.missing.includes('shoes') && <span className="epp-look-missing"> No shoes in the closet.</span>}
            </p>
            <button
              type="button" className="epp-btn epp-btn-small epp-look-use" data-testid="look-use"
              onClick={() => chooseLook(look)} disabled={!!saving}
            >
              {saving === look.key ? 'Saving…' : 'Use this look'}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="epp-inline-link" onClick={onBrowse} data-testid="looks-browse">
        <Shirt size={12} aria-hidden="true" /> Build another from the closet
      </button>
    </div>
  );
}

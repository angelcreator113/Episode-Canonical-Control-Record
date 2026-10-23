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
 * the full closet picker, hasOutfit (optional, default false): the event
 * already has an outfit.
 *
 * Use this look is saved at once, with "‘Look A’ chosen · Undo" for a few
 * seconds (useUndo; Evoni, 2026-10-23, undo instead of confirm): the outfit
 * it replaces is read first (GET …/outfit) and Undo saves those pieces back
 * through the same PUT (re-read from the closet, as any save is; none when
 * there was none), then refreshes the page. The page shows these
 * recommendations only while no outfit is chosen, so the refresh after the
 * save takes this component away: the Undo floats at the foot of the
 * screen (a floating offer, FloatingUndoHost) instead of sitting here. If
 * the outfit it replaces cannot be read, Undo could not restore it, so
 * with hasOutfit it asks first, as before.
 */
import { useEffect, useState } from 'react';
import { Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { recommendLooks, isOwned } from '../../utils/recommendLooks';
import { showFloatingUndos } from './UndoNotice';
import { useUndo } from './useUndo';

const REFRESH_FAILED = "Saved — couldn't refresh the page. Reload to see the outfit.";

export default function EventLookRecommendations({ showId, eventId, onSaved, onToast, onBrowse, hasOutfit = false }) {
  const [looks, setLooks] = useState(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(null);
  const outfitUrl = `/api/v1/world/${showId}/events/${eventId}/outfit`;
  const undo = useUndo(`look:${eventId}`);

  // The page's refresh after a save; its failure is not the save's.
  const refreshPage = async (savedFn, toastFn) => {
    try {
      await savedFn?.();
    } catch (err) {
      console.error('[EventLooks] refresh after save failed:', err);
      toastFn?.(REFRESH_FAILED);
    }
  };

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
    // The outfit this replaces, for Undo.
    let previous = null;
    try {
      const res = await api.get(outfitUrl);
      previous = (Array.isArray(res.data?.pieces) ? res.data.pieces : []).map((p) => p?.id).filter(Boolean);
    } catch (err) {
      console.error('[EventLooks] current outfit read failed:', err);
      if (!hasOutfit) previous = [];
    }
    if (previous === null && !window.confirm(`Replace the event's chosen outfit with ${look.label}?`)) {
      setSaving(null);
      return;
    }
    try {
      await api.put(outfitUrl, { wardrobe_ids: look.pieces.map((p) => p.id) });
    } catch (err) {
      console.error('[EventLooks] save failed:', err);
      onToast?.(err.response?.data?.error || err.message || 'Failed to save the look');
      setSaving(null);
      return;
    }
    if (previous === null) {
      onToast?.(`${look.label} chosen`);
    } else {
      showFloatingUndos();
      undo.offer({
        floating: true,
        message: `'${look.label}' chosen`,
        undo: async () => {
          await api.put(outfitUrl, { wardrobe_ids: previous });
          await refreshPage(onSaved, onToast);
        },
      });
    }
    await refreshPage(onSaved, onToast);
    setSaving(null);
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

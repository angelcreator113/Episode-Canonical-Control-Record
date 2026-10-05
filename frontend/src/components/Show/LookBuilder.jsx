/**
 * Producer Mode → Assets → Wardrobe: building a look for the episode in
 * production, beside the closet (Evoni's redesign, 2026-10-05). The draft
 * starts from the episode's saved outfit; pieces come in and out from the
 * closet's cards; Save look to episode sends the whole look to
 * POST /wardrobe/lock-outfit-atomic, the episode styling game's own save,
 * which checks every piece and the cost on the server and buys and links
 * the look in one transaction, or none. The episode's Wardrobe tab stays the
 * full styling game (the pool, the score, suggestions).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { resolveWardrobeImageUrl } from '../../utils/wardrobeImage';
import { outfitPieces } from '../../lib/closetGrouping';
import { restoreLook, lookIds, toggleInLook, toggleSetInLook, setReach, lookRows, lookCosts, canSaveLook, sameLook } from '../../lib/lookBuilder';

/**
 * The look draft for one episode: its saved outfit, its anchor event and the
 * event's money forecast; toggle(item) adds or removes a piece; save() sends
 * the look. characterState is Lala's { coins, reputation }. items is the
 * closet: toggle(item) brings a piece's matching-set partners in and out
 * with it; remove(item) takes out that one piece.
 */
export function useLookDraft({ episode, showId, characterState, items = [], onSaved }) {
  const episodeId = episode?.id || null;
  const [saved, setSaved] = useState({});
  const [filled, setFilled] = useState({});
  const [event, setEvent] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(Boolean(episodeId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) { setSaved({}); setFilled({}); setEvent(null); setForecast(null); setLoading(false); return; }
    setLoading(true);
    try {
      const [outfitRes, anchor] = await Promise.all([
        api.get(`/api/v1/wardrobe/outfit/${episodeId}`).catch((err) => { console.error('[LookBuilder] outfit load failed:', err); return { data: { items: [] } }; }),
        getEpisodeAnchorEvent(episodeId).catch((err) => { console.error('[LookBuilder] event load failed:', err); return null; }),
      ]);
      const look = restoreLook(outfitRes.data?.items || []);
      setSaved(look);
      setFilled(look);
      setEvent(anchor);
      if (anchor?.id) {
        try {
          const r = await api.get(`/api/v1/world/${showId}/events/${anchor.id}/financial-forecast`);
          setForecast(r.data?.success === false ? null : r.data);
        } catch (err) {
          console.error('[LookBuilder] forecast load failed:', err);
          setForecast(null);
        }
      } else {
        setForecast(null);
      }
    } finally {
      setLoading(false);
    }
  }, [episodeId, showId]);

  // A new episode starts with no message; a reload after a save keeps the save's.
  useEffect(() => { setMessage(null); load(); }, [load]);

  const toggle = useCallback((item) => {
    setMessage(null);
    setFilled((f) => {
      if (lookIds(f).has(item.id)) return toggleSetInLook(f, item, items, characterState);
      return setReach(item, items, characterState, f).ok ? toggleSetInLook(f, item, items, characterState) : f;
    });
  }, [characterState, items]);
  const remove = useCallback((item) => {
    setMessage(null);
    setFilled((f) => (lookIds(f).has(item.id) ? toggleInLook(f, item, characterState) : f));
  }, [characterState]);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/api/v1/wardrobe/lock-outfit-atomic', {
        episode_id: episodeId,
        show_id: showId,
        wardrobe_ids: outfitPieces(filled).map(({ item }) => item.id),
      });
      const spent = Number(res.data?.coins_spent) || 0;
      setMessage({ ok: true, text: spent > 0 ? `Look saved; Lala spent ${spent.toLocaleString()} coins.` : 'Look saved to the episode.' });
      await load();
      onSaved?.();
    } catch (err) {
      console.error('[LookBuilder] save failed:', err);
      setMessage({ ok: false, text: err.response?.data?.error || 'The look could not be saved.' });
    } finally {
      setSaving(false);
    }
  }, [episodeId, showId, filled, load, onSaved]);

  const ids = useMemo(() => lookIds(filled), [filled]);
  return {
    episode, event, forecast, filled, ids, loading, saving, message,
    dirty: !sameLook(filled, saved), toggle, remove, save, reset: () => setFilled(saved),
    reach: (item) => setReach(item, items, characterState, filled),
  };
}

const coins = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—');

export function LookBuilderPanel({ look, coinsNow }) {
  const { episode, event, forecast, filled, loading, saving, message, dirty } = look;
  const costs = lookCosts(filled, coinsNow, forecast?.income?.total);
  const verdict = canSaveLook(filled, costs);
  const rows = lookRows(filled);
  const name = episode.episode_number ? `Episode ${episode.episode_number}` : 'This episode';
  return (
    <section className="wa-look" data-testid="look-builder" aria-label="Building a look">
      <span className="wa-look-eyebrow">Building a look for</span>
      <h3 className="wa-look-title">{name} · {event?.name || 'No event yet'}</h3>
      <p className="wa-look-sub">{event?.dress_code ? `Dress code: ${event.dress_code}` : 'No dress code set'}</p>

      {loading ? <p className="wa-look-empty">Loading the look…</p> : (
        <ul className="wa-look-rows">
          {rows.map((row, i) => (
            <li key={row.item?.id || `${row.slot}-${i}`} className={`wa-look-row${row.item ? '' : ' empty'}`} data-testid={`look-row-${row.slot}`}>
              {(() => {
                // The closet's own picture of the piece (wardrobeImage), the swatch when it has none.
                const url = row.item ? resolveWardrobeImageUrl(row.item) : null;
                return <span className="wa-look-swatch" aria-hidden="true" style={url ? { backgroundImage: `url(${url})` } : undefined} />;
              })()}
              <span className="wa-look-row-text">
                <span className="wa-look-row-slot">{row.label}</span>
                <strong>{row.item ? row.item.name : 'Pick a piece'}</strong>
              </span>
              {row.item && (
                <span className="wa-look-row-end">
                  <span>{row.item.is_owned === true || row.item.in_saved_look ? 'Owned' : `${coins(row.item.coin_cost)} coins`}</span>
                  <button type="button" className="wa-look-remove" aria-label={`Take ${row.item.name} out of the look`} onClick={() => look.remove(row.item)}>×</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="wa-look-money" data-testid="look-money">
        <div><dt>Look costs</dt><dd>−{coins(costs.cost)} coins</dd></div>
        <div><dt>Lala has now</dt><dd>{coins(costs.have)} coins</dd></div>
        <div><dt>After purchase</dt><dd className={costs.after < 0 ? 'short' : undefined}>{coins(costs.after)} coins</dd></div>
        <div><dt>Deal pays at Complete</dt><dd className="plus">+{coins(costs.pays)} coins</dd></div>
        <div className="wa-look-payday"><dt>After payday</dt><dd>{coins(costs.payday)} coins</dd></div>
      </dl>

      <button type="button" className="wa-look-save" disabled={!verdict.ok || saving || !dirty} onClick={look.save} data-testid="look-save">
        {saving ? 'Saving…' : 'Save look to episode'}
      </button>
      <p className={`wa-look-note${message ? (message.ok ? ' ok' : ' bad') : ''}`} role="status">
        {message ? message.text : !verdict.ok ? verdict.why : dirty ? 'Unsaved changes.' : 'This is the saved look.'}
      </p>
      <Link className="wa-look-link" to={`/episodes/${episode.id}?tab=wardrobe`}>Style it in the episode</Link>
    </section>
  );
}

/** The latest looks worn, from GET /wardrobe/outfit-history/:showId. */
export function RecentlyWorn({ showId }) {
  const [looks, setLooks] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/wardrobe/outfit-history/${showId}`)
      .then((r) => { if (!cancelled) setLooks((r.data?.history || []).filter((h) => h.items?.length).slice(-3).reverse()); })
      .catch((err) => { console.error('[LookBuilder] outfit history load failed:', err); if (!cancelled) setLooks([]); });
    return () => { cancelled = true; };
  }, [showId]);
  if (!looks?.length) return null;
  return (
    <section className="wa-worn" data-testid="recently-worn">
      <span className="wa-look-eyebrow wa-worn-eyebrow">Recently worn</span>
      <ul>
        {looks.map((h) => (
          <li key={h.episode_id}>
            <strong>{h.items.slice(0, 2).map((i) => i.name).join(' + ')}{h.items.length > 2 ? ` +${h.items.length - 2}` : ''}</strong>
            <span> · Episode {h.episode_number ?? '?'}</span>
          </li>
        ))}
      </ul>
      <Link className="wa-look-link" to="/wardrobe/calendar">Outfit history</Link>
    </section>
  );
}

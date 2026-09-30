/**
 * EventOutfitPicker — choose Lala's look for an event (Task #2376).
 *
 * The closet picker that lived inline in WorldAdmin's OUTFIT PICKER MODAL,
 * lifted out so the Event Package's Style area can open it too. Since the
 * Events tab became a queue of event packages (#1649) the picker was only
 * reachable from the event card's ⋯ menu or the old Edit details modal;
 * the Package showed "Not chosen" with no way to choose.
 *
 * Endpoints (src/routes/worldEvents.js, unchanged):
 *   GET /world/:showId/events/:eventId/wardrobe-options — closet with match info
 *   GET /world/:showId/events/:eventId/outfit           — saved pieces + score
 *   PUT /world/:showId/events/:eventId/outfit           — save wardrobe_ids, re-score
 * The pieces are stored on world_events.outfit_pieces (+ outfit_score).
 *
 * Props: showId, event ({ id, name, prestige }), onClose(), onSaved(result)
 * after a save ({ pieces, score }), onToast(message).
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { SLOT_KEYS, SLOT_DEFS, getSlotForCategory } from '../lib/wardrobeSlots';

const smBtn = { padding: '5px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#475569', fontWeight: 500, transition: 'all 0.12s' };
const selStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', background: '#fff', transition: 'border-color 0.15s' };

export default function EventOutfitPicker({ showId, event, onClose, onSaved, onToast }) {
  const [outfitOptions, setOutfitOptions] = useState([]);
  const [outfitSelected, setOutfitSelected] = useState(new Set());
  const [outfitSaving, setOutfitSaving] = useState(false);
  const [outfitScore, setOutfitScore] = useState(null);
  const [outfitSlotFilter, setOutfitSlotFilter] = useState('all');
  const [outfitTierFilter, setOutfitTierFilter] = useState('all');
  const [outfitHideWorn, setOutfitHideWorn] = useState(false);
  const [outfitShowAllRepeats, setOutfitShowAllRepeats] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = (message) => { if (onToast) onToast(message); };
  const eventId = event?.id;

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/v1/world/${showId}/events/${eventId}/wardrobe-options`);
        if (cancelled) return;
        setOutfitOptions(res.data.items || []);
        const existing = await api.get(`/api/v1/world/${showId}/events/${eventId}/outfit`);
        if (cancelled) return;
        if (existing.data.pieces?.length > 0) {
          setOutfitSelected(new Set(existing.data.pieces.map(p => p.id)));
          setOutfitScore(existing.data.score);
        }
      } catch (err) {
        console.error('[EventOutfitPicker] load failed:', err);
        if (!cancelled) setOutfitOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showId, eventId]);

  if (!event) return null;

  const save = async () => {
    setOutfitSaving(true);
    try {
      const res = await api.put(`/api/v1/world/${showId}/events/${eventId}/outfit`, {
        wardrobe_ids: Array.from(outfitSelected),
      });
      setOutfitScore(res.data.score);
      toast(`Outfit saved — match ${res.data.score?.match_score}/100 (${res.data.score?.narrative_mood})`);
      if (onSaved) onSaved(res.data);
    } catch (err) {
      console.error('[EventOutfitPicker] save failed:', err);
      toast('Save failed: ' + (err.response?.data?.error || err.message));
    }
    setOutfitSaving(false);
  };

  return createPortal(
    <div data-testid="outfit-picker" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      <div role="dialog" aria-label="Pick Outfit" style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 16, boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👗 Pick Outfit</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', overflowWrap: 'anywhere' }}>{event.name}{event.prestige != null ? ` · Prestige ${event.prestige}/10` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {loading && (
          <div data-testid="outfit-picker-loading" style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Loading the closet…</div>
        )}

        {/* Score banner */}
        {outfitScore && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: outfitScore.narrative_mood === 'confidence' ? '#f0fdf4' : outfitScore.narrative_mood === 'anxiety' ? '#fef2f2' : '#FAF7F0', border: '1px solid #e8e0d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>Match: {outfitScore.match_score}/100</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: outfitScore.narrative_mood === 'confidence' ? '#16a34a' : outfitScore.narrative_mood === 'anxiety' ? '#dc2626' : '#B8962E' }}>
                {outfitScore.narrative_mood}
              </span>
            </div>
            {/* Signal breakdown — each delta inline so creators can
                see exactly which dimension lifted vs dropped the score.
                Without this, three text lines from the scorer all read
                the same weight even when one is +6 and another -6 (a
                12-pt swing in secondary that's invisible without the
                numeric tag). */}
            {outfitScore.signals?.map((s, i) => {
              const d = typeof s.delta === 'number' ? s.delta : null;
              const positive = d != null && d > 0;
              const negative = d != null && d < 0;
              return (
                <div key={i} style={{ fontSize: 11, color: '#666', marginTop: 3, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {d != null && (
                    <span style={{
                      display: 'inline-block', minWidth: 26, textAlign: 'right',
                      fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 10,
                      color: positive ? '#16a34a' : negative ? '#dc2626' : '#94a3b8',
                    }}>
                      {positive ? '+' : ''}{d}
                    </span>
                  )}
                  <span>{s.text}</span>
                </div>
              );
            })}
            {outfitScore.repeats?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {(outfitShowAllRepeats ? outfitScore.repeats : outfitScore.repeats.slice(0, 2)).map((r, i) => (
                  <div key={`r${i}`} style={{ fontSize: 11, color: '#8b5cf6', marginTop: 3 }}>{r.narrative?.text}</div>
                ))}
                {outfitScore.repeats.length > 2 && (
                  <button
                    onClick={() => setOutfitShowAllRepeats(v => !v)}
                    style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: '#8b5cf6', fontFamily: "'DM Mono', monospace" }}
                  >
                    {outfitShowAllRepeats ? 'Show fewer repeats' : `Show ${outfitScore.repeats.length - 2} more repeats`}
                  </button>
                )}
              </div>
            )}

            {/* ── Per-slot breakdown ────────────────────────────────
                One row per UI slot (outfit/shoes/jewelry/accessories/
                fragrance). Each row shows a progress bar + reason so the
                player can see exactly which slot is hurting the overall
                score. Status color: empty=gray, low=red, ok=amber,
                good=green. Required slots with empty status get the red
                "missing" treatment. */}
            {Array.isArray(outfitScore.slots) && outfitScore.slots.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {outfitScore.slots.map(slot => {
                  const emptyRequired = slot.status === 'empty' && slot.required;
                  const color = emptyRequired ? '#dc2626'
                    : slot.status === 'good' ? '#16a34a'
                    : slot.status === 'ok' ? '#B8962E'
                    : slot.status === 'low' ? '#dc2626'
                    : '#94a3b8';
                  const barWidth = slot.status === 'empty' ? 0 : slot.match;
                  return (
                    <div key={slot.slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 110, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#444', fontWeight: 600, flexShrink: 0 }}>
                        <span>{slot.icon}</span>
                        <span>{slot.label}</span>
                      </div>
                      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${barWidth}%`, height: '100%', background: color, transition: 'width 0.25s' }} />
                      </div>
                      <div style={{ width: 36, fontSize: 11, fontWeight: 700, color, textAlign: 'right', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                        {slot.status === 'empty' ? (slot.required ? '!' : '—') : slot.match}
                      </div>
                    </div>
                  );
                })}
                {/* Reason line per-row would crowd the grid; show only
                    the first non-empty reason whose slot is dragging the
                    score so players get one concrete thing to fix. */}
                {(() => {
                  const weakest = outfitScore.slots
                    .filter(s => s.reason && (s.status === 'low' || (s.status === 'empty' && s.required)))
                    .sort((a, b) => a.match - b.match)[0];
                  if (!weakest) return null;
                  return (
                    <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 4, fontStyle: 'italic' }}>
                      💡 {weakest.reason}
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Surface items whose category isn't one of the 5 slots so
                the author can fix the category on the row. */}
            {Array.isArray(outfitScore.unassigned) && outfitScore.unassigned.length > 0 && (
              <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, fontSize: 11, color: '#c2410c' }}>
                ⚠️ Couldn't slot {outfitScore.unassigned.length} piece{outfitScore.unassigned.length > 1 ? 's' : ''} — check {outfitScore.unassigned.map(u => u.name).slice(0, 3).join(', ')}{outfitScore.unassigned.length > 3 ? '…' : ''}
              </div>
            )}
          </div>
        )}

        {/* Selected pieces */}
        {outfitSelected.size > 0 && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FAF7F0', borderRadius: 8, border: '1px solid #e8e0d0' }}>
            <div style={{ fontSize: 10, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>SELECTED ({outfitSelected.size} pieces)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from(outfitSelected).map(id => {
                const item = outfitOptions.find(i => i.id === id);
                if (!item) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e8e0d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                       onClick={() => { const s = new Set(outfitSelected); s.delete(id); setOutfitSelected(s); setOutfitScore(null); }}>
                    {item.image_url && <img src={item.image_url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                    <span style={{ fontSize: 11 }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: '#ccc' }}>✕</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Closet filters + grid */}
        {(() => {
          const filteredOutfitOptions = outfitOptions.filter((item) => {
            const slot = getSlotForCategory(item.clothing_category) || 'other';
            if (outfitSlotFilter !== 'all' && slot !== outfitSlotFilter) return false;
            if (outfitTierFilter !== 'all' && (item.tier || 'basic') !== outfitTierFilter) return false;
            if (outfitHideWorn && ((parseInt(item.times_worn, 10) || 0) > 0 || !!item.last_worn_date)) return false;
            return true;
          });

          return (
            <>
              <div style={{ marginBottom: 10, padding: '8px 10px', border: '1px solid #e8e0d0', borderRadius: 8, background: '#faf7f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>FILTERS</div>
                  {/* Auto-tag — heuristic backfill of event_types tags
                      across the entire wardrobe. Reads name + aesthetic
                      + brand + occasion to derive sensible tags so the
                      occasion_precision signal stops flipping negative
                      on untagged inventory. Wrapped in window.confirm
                      since it's a bulk write — preview opens in toast. */}
                  <button
                    type="button"
                    title="Heuristic event_types tag suggester for the whole wardrobe — fixes the 'tagged pieces don't align' signal that was dropping outfit scores"
                    onClick={async () => {
                      try {
                        // Dry-run first to show the diff before writing.
                        const dry = await api.post(`/api/v1/wardrobe/${showId}/auto-tag-event-types`, { dry_run: true });
                        const changed = dry.data?.changed_count || 0;
                        const total = dry.data?.total || 0;
                        if (changed === 0) {
                          toast(`✓ All ${total} wardrobe items already tagged — nothing to add.`);
                          return;
                        }
                        if (!window.confirm(`Auto-tag ${changed} of ${total} wardrobe items with derived event_types?\n\nExamples: ${dry.data.items.slice(0, 3).map(i => `${i.name} → +${i.added.join(', +')}`).join('; ')}${dry.data.items.length > 3 ? '...' : ''}`)) return;
                        const apply = await api.post(`/api/v1/wardrobe/${showId}/auto-tag-event-types`, { dry_run: false });
                        toast(`✦ Auto-tagged ${apply.data.changed_count} wardrobe items. Reopen the picker to see updated scores.`);
                      } catch (err) {
                        console.error('[EventOutfitPicker] auto-tag failed:', err);
                        toast('Auto-tag failed: ' + (err?.response?.data?.error || err.message));
                      }
                    }}
                    style={{ padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: '1px solid #e8d8b8', background: '#fff', color: '#B8962E', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
                  >
                    ✦ Auto-tag wardrobe
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button onClick={() => setOutfitSlotFilter('all')} style={{ ...smBtn, background: outfitSlotFilter === 'all' ? '#B8962E' : '#fff', color: outfitSlotFilter === 'all' ? '#fff' : '#555', borderColor: '#e8d9b8' }}>All Slots</button>
                  {SLOT_KEYS.map(slot => (
                    <button key={slot} onClick={() => setOutfitSlotFilter(slot)} style={{ ...smBtn, background: outfitSlotFilter === slot ? '#B8962E' : '#fff', color: outfitSlotFilter === slot ? '#fff' : '#555', borderColor: '#e8d9b8' }}>
                      {SLOT_DEFS[slot]?.icon} {SLOT_DEFS[slot]?.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <select value={outfitTierFilter} onChange={e => setOutfitTierFilter(e.target.value)} style={{ ...selStyle, width: 140, minHeight: 30, fontSize: 11 }}>
                    <option value="all">All tiers</option>
                    <option value="basic">Basic</option>
                    <option value="mid">Mid</option>
                    <option value="luxury">Luxury</option>
                    <option value="elite">Elite</option>
                  </select>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                    <input type="checkbox" checked={outfitHideWorn} onChange={e => setOutfitHideWorn(e.target.checked)} />
                    Hide already worn
                  </label>
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>
                    Showing {filteredOutfitOptions.length}/{outfitOptions.length}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
                {filteredOutfitOptions.length} pieces in closet — tap to select
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, paddingBottom: outfitSelected.size > 0 ? 84 : 0 }}>
                {filteredOutfitOptions.map(item => {
                  const selected = outfitSelected.has(item.id);
                  return (
                    <div key={item.id} onClick={() => {
                      const s = new Set(outfitSelected);
                      if (selected) s.delete(item.id); else s.add(item.id);
                      setOutfitSelected(s);
                      setOutfitScore(null);
                    }} style={{
                      border: selected ? '2px solid #B8962E' : '1px solid #e8e0d0', borderRadius: 10,
                      overflow: 'hidden', cursor: 'pointer', background: selected ? '#faf5ea' : '#fff',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ aspectRatio: '1', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 32, color: '#ddd' }}>👗</span>
                        )}
                      </div>
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{item.clothing_category} · {item.tier || 'basic'}</div>
                        {item.brand && <div style={{ fontSize: 9, color: '#aaa' }}>{item.brand}</div>}
                        {item.price > 0 && <div style={{ fontSize: 10, color: '#B8962E', fontWeight: 600 }}>${item.price}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!loading && outfitOptions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👗</div>
                  <p style={{ fontSize: 13 }}>No wardrobe pieces yet. Upload items in the Wardrobe tab first.</p>
                </div>
              )}

              {outfitOptions.length > 0 && filteredOutfitOptions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#999', border: '1px dashed #e8e0d0', borderRadius: 10, marginTop: 8 }}>
                  No pieces match these filters. Try clearing a filter.
                </div>
              )}
            </>
          );
        })()}


        {/* Sticky action footer */}
        {outfitSelected.size > 0 && (
          <div style={{ position: 'sticky', bottom: 0, marginTop: 12, background: '#fff', paddingTop: 10, borderTop: '1px solid #f1e8d6', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>
                {outfitSelected.size} selected
                {outfitScore?.match_score != null && (
                  <span style={{ marginLeft: 8, color: '#B8962E', fontWeight: 700 }}>
                    Match {outfitScore.match_score}/100
                  </span>
                )}
              </div>
              <button onClick={() => { setOutfitSelected(new Set()); setOutfitScore(null); }} style={{ ...smBtn, padding: '3px 8px' }}>
                Clear
              </button>
            </div>
            <button data-testid="outfit-picker-save" disabled={outfitSaving} onClick={save} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 8, background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: outfitSaving ? 0.5 : 1 }}>
              {outfitSaving ? 'Saving...' : outfitScore ? 'Update Outfit' : `Save Outfit (${outfitSelected.size} pieces)`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * The stats panel editor (Task #3164): on the panel art (one of the show's
 * overlays), a box for each of Lala's numbers. Drag a box to move it, its
 * corner dot to size it. Each row picks the stat, the icon drawn beside the
 * number (another overlay she uploaded, such as a coin) and the number's
 * colour. Save keeps the boxes on the art (PUT /ui-overlays/:showId/
 * stats-panel/:assetId); "Stop using as stats panel" makes it an ordinary
 * overlay again. The audience sees it; Lala's Phone never shows it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import StatsPanelPreview from './StatsPanelPreview';
import { PANEL_STATS, newSpot, moveSpot, resizeSpot, statsPanelApi, iconUrlsOf } from '../../lib/statsPanel';
import './StatsPanel.css';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';
const NO_OVERLAYS = [];

export default function StatsPanelEditor({ showId, overlay, overlays = NO_OVERLAYS, onClose, onSaved }) {
  const [spots, setSpots] = useState(() => (Array.isArray(overlay?.stats_panel?.spots) ? overlay.stats_panel.spots : []));
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const drag = useRef(null);
  const icons = overlays.filter((o) => o.url && o.id !== overlay?.id);
  const iconUrls = iconUrlsOf(icons);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const update = (id, changes) => setSpots((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  // Drag a box (or its corner) in percent of the art.
  const onSpotPointerDown = useCallback((e, spot, mode) => {
    const art = e.currentTarget.closest('.spx-art');
    if (!art) return;
    e.preventDefault();
    setSelectedId(spot.id);
    const rect = art.getBoundingClientRect();
    drag.current = { id: spot.id, mode, x: e.clientX, y: e.clientY, start: spot, rect };
    const move = (ev) => {
      const d = drag.current;
      if (!d || !d.rect.width || !d.rect.height) return;
      const dx = ((ev.clientX - d.x) / d.rect.width) * 100;
      const dy = ((ev.clientY - d.y) / d.rect.height) * 100;
      const next = d.mode === 'resize' ? resizeSpot(d.start, dx, dy) : moveSpot(d.start, dx, dy);
      setSpots((list) => list.map((s) => (s.id === d.id ? next : s)));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const save = async (next) => {
    setSaving(true);
    setError(null);
    try {
      const data = await statsPanelApi.save(showId, overlay.asset_id, next);
      onSaved?.(overlay, data?.spots ?? null);
      onClose?.();
    } catch (err) {
      console.error('[StatsPanelEditor] save failed:', err);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="spx-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="spx-dialog" role="dialog" aria-modal="true" aria-labelledby="spx-title" data-testid="stats-panel-editor">
        <div className="spx-dialog-head">
          <h3 id="spx-title">Stats panel: {overlay?.name}</h3>
          <button type="button" className="spx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="spx-dialog-body">
          <p className="spx-hint">
            The audience sees this panel over the episode, not Lala. Each box shows one of her stats as
            &ldquo;before &rarr; after&rdquo; for the episode. Drag a box to move it and its corner dot to size it.
            Icons are your other overlays: upload one (512 &times; 512, transparent) in Overlays, then pick it here.
          </p>
          <StatsPanelPreview url={overlay?.url} spots={spots} iconUrls={iconUrls} selectedId={selectedId} onSpotPointerDown={onSpotPointerDown} label={`${overlay?.name || 'Stats panel'} with its number boxes`} />

          <ul className="spx-rows" data-testid="stats-panel-rows">
            {spots.map((s, n) => (
              <li key={s.id} className={`spx-row${s.id === selectedId ? ' is-selected' : ''}`} data-testid="stats-panel-row" onFocusCapture={() => setSelectedId(s.id)}>
                <select aria-label={`Stat ${n + 1}`} value={s.stat} onChange={(e) => update(s.id, { stat: e.target.value })}>
                  {PANEL_STATS.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
                <select aria-label={`Icon ${n + 1}`} value={s.icon || ''} onChange={(e) => update(s.id, { icon: e.target.value || null })}>
                  <option value="">No icon</option>
                  {icons.map((o) => <option key={o.id} value={o.id}>{o.name || o.id}</option>)}
                </select>
                <input type="color" aria-label={`Colour ${n + 1}`} value={s.color || '#ffffff'} onChange={(e) => update(s.id, { color: e.target.value })} />
                <button type="button" className="spx-icon-btn" aria-label={`Remove box ${n + 1}`} onClick={() => setSpots((list) => list.filter((x) => x.id !== s.id))}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="spx-error" role="alert">{error}</p>}

          <div className="spx-actions">
            <button type="button" className="spx-btn" onClick={() => setSpots((list) => [...list, newSpot(list.length)])} disabled={spots.length >= 8} data-testid="stats-panel-add">
              <Plus size={14} aria-hidden="true" /> Add a number
            </button>
            {overlay?.stats_panel && (
              <button type="button" className="spx-btn is-quiet" onClick={() => save(null)} disabled={saving} data-testid="stats-panel-stop">
                Stop using as stats panel
              </button>
            )}
            <div className="spx-actions-end">
              <button type="button" className="spx-btn" onClick={onClose}>Cancel</button>
              <button type="button" className="spx-btn is-primary" onClick={() => save(spots)} disabled={saving} data-testid="stats-panel-save">
                {saving && <Loader2 size={14} className="sol-spin" aria-hidden="true" />} Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

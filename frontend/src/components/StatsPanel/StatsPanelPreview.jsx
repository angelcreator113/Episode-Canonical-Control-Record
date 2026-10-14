/**
 * The stats panel drawn in the page (Task #3164): the art at the master's
 * 1920 × 220 shape, and each box with its icon and its text. The server's
 * PNG (services/statsPanelService.renderPng) is the finished piece; this is
 * its preview, and the editor's canvas.
 *
 *   url         the art
 *   spots       the boxes; `text` is shown in each (the editor shows the stat's name)
 *   iconUrls    { [overlay key]: image url }
 *   selectedId  the box being edited, outlined
 *   onSpotPointerDown(e, spot, 'move' | 'resize')  editing only
 */
import { PANEL_STATS } from '../../lib/statsPanel';
import './StatsPanel.css';

const NO_SPOTS = [];
const NO_ICONS = {};
const labelOf = (stat) => PANEL_STATS.find((s) => s.key === stat)?.label || stat;

export default function StatsPanelPreview({ url, spots = NO_SPOTS, iconUrls = NO_ICONS, selectedId = null, onSpotPointerDown = null, label = 'Stats panel' }) {
  const editing = Boolean(onSpotPointerDown);
  return (
    <div className={`spx-art${editing ? ' is-editing' : ''}`} role="img" aria-label={label} data-testid="stats-panel-preview">
      {url ? <img className="spx-art-img" src={url} alt="" draggable={false} /> : <span className="spx-art-empty">No art yet</span>}
      {spots.map((spot) => {
        const icon = spot.icon ? iconUrls[spot.icon] : null;
        return (
          <div
            key={spot.id}
            className={`spx-spot${spot.id === selectedId ? ' is-selected' : ''}`}
            data-testid={`stats-panel-spot-${spot.id}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`, '--spx-h': spot.h, color: spot.color || undefined }}
            onPointerDown={editing ? (e) => onSpotPointerDown(e, spot, 'move') : undefined}
          >
            {icon && <img className="spx-icon" src={icon} alt="" draggable={false} />}
            <span className="spx-text">{spot.text ?? labelOf(spot.stat)}</span>
            {editing && (
              <span
                className="spx-handle"
                aria-hidden="true"
                onPointerDown={(e) => { e.stopPropagation(); onSpotPointerDown(e, spot, 'resize'); }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

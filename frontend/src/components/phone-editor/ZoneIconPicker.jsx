/**
 * ZoneIconPicker / ZoneIconSummary — a tap zone's icon in the zones workspace
 * (Task #2014, doctrine rules 17 and 18).
 *
 * ZoneIconPicker is the TAP editor's icon grid, shared by ScreenLinkEditor's
 * own rows and the workspace's Tap Zones panel: an Upload tile first (a
 * per-zone custom image), then the library icons. Picking a library icon
 * stores its key at once (pickZoneLibraryIcon) and makes it the zone's icon;
 * picking it again removes it.
 *
 * ZoneIconSummary is the one line every zone row shows, selected or not:
 * "Icon: <name>" with a thumbnail, "Custom image", or "No icon".
 */
import { Upload, Loader, Check } from 'lucide-react';
import { describeZoneIcon, resolveZoneIconKey } from '../../lib/overlayUtils';
import './ZoneIconPicker.css';

export function ZoneIconSummary({ zone, icons = [], className = '' }) {
  const d = describeZoneIcon(zone, icons);
  const text = d.kind === 'library'
    ? `Icon: ${(d.icon?.name || d.key || '').replace(/\s*Icon$/i, '')}`
    : d.kind === 'custom' ? 'Custom image' : 'No icon';
  return (
    <span className={`zone-icon-summary zone-icon-summary--${d.kind} ${className}`.trim()} data-icon-kind={d.kind}>
      {d.url
        ? <img src={d.url} alt="" className="zone-icon-summary__thumb" draggable={false} />
        : <span className="zone-icon-summary__thumb zone-icon-summary__thumb--empty" aria-hidden="true" />}
      <span className="zone-icon-summary__text">{text}</span>
    </span>
  );
}

export default function ZoneIconPicker({ zone, icons = [], onPick, onUpload, uploading = false }) {
  // Several overlays can share an image; show each image once.
  const unique = icons.filter((ico, idx, arr) => ico.url && arr.findIndex(i => i.url === ico.url) === idx);
  const currentKey = resolveZoneIconKey(zone, icons);
  return (
    <div className="zone-icon-picker">
      <div className="zone-icon-picker__header">
        <span>{currentKey ? 'CHANGE ICON' : 'CHOOSE AN ICON'}</span>
        <span className="zone-icon-picker__count">{unique.length} in library</span>
      </div>
      <div className="zone-icon-picker__grid">
        {onUpload && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpload(); }}
            disabled={uploading}
            title="Upload a custom icon"
            className="zone-icon-picker__tile zone-icon-picker__tile--upload"
          >
            {uploading ? <Loader size={16} className="spin" /> : <Upload size={16} />}
            <span>{uploading ? 'UPLOADING' : 'UPLOAD'}</span>
          </button>
        )}
        {unique.map(ico => {
          const isSelected = currentKey === ico.id;
          return (
            <button
              key={ico.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPick(ico); }}
              title={ico.name}
              aria-pressed={isSelected}
              className={`zone-icon-picker__tile ${isSelected ? 'zone-icon-picker__tile--selected' : ''}`}
            >
              <img src={ico.url} alt={ico.name} draggable={false} />
              {isSelected && (
                <span className="zone-icon-picker__check" aria-hidden="true"><Check size={10} color="#fff" strokeWidth={3} /></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

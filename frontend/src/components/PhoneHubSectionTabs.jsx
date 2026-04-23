/**
 * PhoneHubSectionTabs — shared tab bar for the Phone Hub surface.
 *
 * Extracted so the tabs stay visible even when the active tab renders
 * its own workspace (e.g. Zones, Content) instead of PhoneHub. If this
 * lived only inside PhoneHub, unmounting PhoneHub would hide the tabs
 * and the whole layout would feel like it jumps when switching to
 * Zones.
 */
import './PhoneHubSectionTabs.css';

export default function PhoneHubSectionTabs({
  activeTab,
  onChangeTab,
  screenCount = 0,
  iconCount = 0,
  placementCount = 0,
  hiddenCount = 0,
  showHidden = false,
  onToggleShowHidden,
  gridFilter = 'all',
  showZones = true,
  showContent = true,
  showMissions = true,
}) {
  return (
    <div className="phone-hub-section-tabs">
      <div className="phone-hub-section-tab-group">
        <button
          type="button"
          onClick={() => onChangeTab('screens')}
          className={`phone-hub-section-tab ${activeTab === 'screens' ? 'active' : ''}`}
        >
          Screens <span className="phone-hub-section-tab-count">· {screenCount}</span>
        </button>
        {(gridFilter === 'all' || gridFilter === 'icon') && iconCount > 0 && (
          <button
            type="button"
            onClick={() => onChangeTab('icons')}
            className={`phone-hub-section-tab ${activeTab === 'icons' ? 'active' : ''}`}
          >
            Icons <span className="phone-hub-section-tab-count">· {iconCount}</span>
          </button>
        )}
        {iconCount > 0 && (
          <button
            type="button"
            onClick={() => onChangeTab('placements')}
            className={`phone-hub-section-tab ${activeTab === 'placements' ? 'active' : ''}`}
          >
            Placements <span className="phone-hub-section-tab-count">· {placementCount}</span>
          </button>
        )}
        {showZones && (
          <button
            type="button"
            onClick={() => onChangeTab('zones')}
            className={`phone-hub-section-tab ${activeTab === 'zones' ? 'active' : ''}`}
          >
            Zones
          </button>
        )}
        {showContent && (
          <button
            type="button"
            onClick={() => onChangeTab('content')}
            className={`phone-hub-section-tab ${activeTab === 'content' ? 'active' : ''}`}
          >
            Content
          </button>
        )}
        {showMissions && (
          <button
            type="button"
            onClick={() => onChangeTab('missions')}
            className={`phone-hub-section-tab ${activeTab === 'missions' ? 'active' : ''}`}
          >
            Missions
          </button>
        )}
      </div>
      {hiddenCount > 0 && onToggleShowHidden && (
        <button onClick={onToggleShowHidden} className={`phone-hub-show-hidden-btn ${showHidden ? 'active' : ''}`}>
          {showHidden ? 'Hide removed' : `Show removed (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

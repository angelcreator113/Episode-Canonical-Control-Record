/**
 * PhoneHubSectionTabs — shared tab bar for the Phone Hub surface.
 *
 * Extracted so the tabs stay visible even when the active tab renders
 * its own workspace (e.g. Zones, Content) instead of PhoneHub. If this
 * lived only inside PhoneHub, unmounting PhoneHub would hide the tabs
 * and the whole layout would feel like it jumps when switching to
 * Zones.
 *
 * The row is organised in stages (doctrine rule 18, Task #2010): Build ·
 * Connect · Content · Preview · Advanced ▾. Stages only regroup the
 * existing activeTab keys, which are unchanged:
 *   Build    → 'screens', with a Screens | Icons toggle ('icons') under it
 *   Connect  → 'zones'
 *   Content  → 'content'
 *   Preview  → 'preview' (shown only when the parent can render it)
 *   Advanced → a menu holding Missions ('missions')
 */
import { useEffect, useRef, useState } from 'react';
import { Hammer, Link2, LayoutTemplate, Play, ChevronDown } from 'lucide-react';
import './PhoneHubSectionTabs.css';

// Keys that belong to the Build stage ('placements' is PhoneHub's
// read-only overview of icons, so it sits with them).
const BUILD_KEYS = ['screens', 'icons', 'placements'];

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
  showPreview = false,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef(null);

  useEffect(() => {
    if (!advancedOpen) return undefined;
    const onPointer = (e) => { if (advancedRef.current && !advancedRef.current.contains(e.target)) setAdvancedOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setAdvancedOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [advancedOpen]);

  const stages = [
    { key: 'build', label: 'Build', Icon: Hammer, tab: 'screens', active: BUILD_KEYS.includes(activeTab), show: true },
    { key: 'connect', label: 'Connect', Icon: Link2, tab: 'zones', active: activeTab === 'zones', show: showZones },
    { key: 'content', label: 'Content', Icon: LayoutTemplate, tab: 'content', active: activeTab === 'content', show: showContent },
    { key: 'preview', label: 'Preview', Icon: Play, tab: 'preview', active: activeTab === 'preview', show: showPreview },
  ].filter(s => s.show);
  const buildActive = BUILD_KEYS.includes(activeTab);
  const showIconsToggle = (gridFilter === 'all' || gridFilter === 'icon') && iconCount > 0;

  return (
    <div className="phone-hub-section-tabs-wrap">
      <div className="phone-hub-section-tabs">
        <div className="phone-hub-stage-row">
          <div className="phone-hub-section-tab-group">
            {stages.map(({ key, label, Icon, tab, active }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  // Build keeps whichever of Screens / Icons is open.
                  if (key === 'build' && active) return;
                  onChangeTab(tab);
                }}
                className={`phone-hub-section-tab ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={13} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          {showMissions && (
            <div className="phone-hub-advanced" ref={advancedRef}>
              <button
                type="button"
                onClick={() => setAdvancedOpen(o => !o)}
                className={`phone-hub-section-tab ${activeTab === 'missions' ? 'active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={advancedOpen}
              >
                Advanced <ChevronDown size={13} aria-hidden="true" />
              </button>
              {advancedOpen && (
                <div className="phone-hub-advanced-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setAdvancedOpen(false); onChangeTab('missions'); }}
                    className={`phone-hub-advanced-item ${activeTab === 'missions' ? 'active' : ''}`}
                  >
                    Missions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {hiddenCount > 0 && onToggleShowHidden && (
          <button onClick={onToggleShowHidden} className={`phone-hub-show-hidden-btn ${showHidden ? 'active' : ''}`}>
            {showHidden ? 'Hide removed' : `Show removed (${hiddenCount})`}
          </button>
        )}
      </div>
      {buildActive && (
        <div className="phone-hub-build-toggle" role="group" aria-label="Build">
          <button
            type="button"
            onClick={() => onChangeTab('screens')}
            className={`phone-hub-build-toggle-btn ${activeTab === 'screens' ? 'active' : ''}`}
            aria-pressed={activeTab === 'screens'}
          >
            Screens <span className="phone-hub-section-tab-count">· {screenCount}</span>
          </button>
          {showIconsToggle && (
            <button
              type="button"
              onClick={() => onChangeTab('icons')}
              className={`phone-hub-build-toggle-btn ${activeTab === 'icons' ? 'active' : ''}`}
              aria-pressed={activeTab === 'icons'}
            >
              Icons <span className="phone-hub-section-tab-count">· {iconCount}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

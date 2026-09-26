/**
 * PhoneHub — Visual phone device frame with screen slots
 *
 * Shows a phone device with the currently selected screen overlay.
 * Clicking screen slots on the side switches the active screen.
 * Supports screen_links: clickable tap zones with icon overlays that navigate between screens.
 *
 * Props:
 *   screens       — array of overlay objects (the phone screens)
 *   activeScreen  — currently displayed screen overlay
 *   onSelectScreen(overlay) — callback when a screen slot is clicked
 *   onNavigate(screenKey)   — callback when a tap zone is clicked (navigates to target screen)
 *   navigationHistory       — array of previous screen keys for back navigation
 *   onBack()                — callback for back button (pops navigation history)
 *   deviceFrame   — optional custom device frame image URL
 */
import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { MoreVertical, Trash2, EyeOff, Edit3, Settings } from 'lucide-react';
import PhoneDevice from './phone/PhoneDevice';
import { isMapScreen } from './phone/PhoneMapView';
import { PHONE_SKINS, getScreenImageStyle } from './phone/phoneStyle';
import PhoneHubSectionTabs from './PhoneHubSectionTabs';
import { isIcon, isScreen, getScreenLinks, getIconUrls, resolveZoneIconKey } from '../lib/overlayUtils';

// Screen types are now fully dynamic — defined per-show in the database.
// The `screens` prop already contains all type data from the API.

export { PHONE_SKINS, getScreenImageStyle };

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '11px 14px',
  border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 500, color: '#2C2C2C',
  textAlign: 'left', minHeight: 44,
  borderBottom: '1px solid #f5f3ee',
};

const ScreenCard = memo(function ScreenCard({ type, screen, activeScreen, onSelectScreen, onEditScreen, onDelete, onHide, isHidden, globalFit, isIcon, linkCount = 0, hasTargetedPlacement = false }) {
  const isActive = activeScreen?.id === screen?.id && screen;
  const hasImage = screen?.generated && screen?.url;
  const accentColor = isIcon ? '#a889c8' : '#B8962E';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [menuOpen]);

  return (
    <div
      onClick={() => {
        if (menuOpen) return;
        if (isHidden && onHide) { onHide(type.key); return; }
        const target = screen
          ? screen
          : { ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true };
        // Single click on a card with a real generated image → preview the
        // screen on the phone. Cards without an image (placeholders that
        // haven't been generated/uploaded yet) jump straight into the
        // edit modal so creators can fill them in. Use the menu (⋮ → Edit)
        // to open the editor for already-generated screens.
        if (hasImage) {
          onSelectScreen(target);
        } else {
          (onEditScreen || onSelectScreen)(target);
        }
      }}
      className="screen-card"
      style={{
        background: isHidden ? '#f5f3f0' : isActive ? '#2C2C2C' : hasImage ? '#fff' : '#faf8f5',
        border: `1px solid ${isHidden ? '#e8e0d0' : isActive ? accentColor : hasImage ? '#e8e0d0' : '#f0ece4'}`,
        borderRadius: isIcon ? 8 : 10, padding: isIcon ? 6 : 8,
        cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'visible',
        minHeight: isIcon ? 40 : 'auto', opacity: isHidden ? 0.45 : 1,
      }}
    >
      {!isHidden && (onDelete || onHide) && (
        <div ref={menuRef} style={{ position: 'absolute', top: 4, right: 4, zIndex: 5 }}>
          <button className="screen-card-menu" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} aria-label="Screen options" style={{
            width: 28, height: 28, borderRadius: 6,
            background: hasImage ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
            border: 'none', color: hasImage ? '#fff' : '#999',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: hasImage ? 'blur(4px)' : 'none',
          }}><MoreVertical size={14} /></button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: isIcon ? 'auto' : 0, left: isIcon ? 0 : 'auto', marginTop: 4, background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 20, minWidth: 140, overflow: 'hidden' }}>
              <button onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                const target = screen
                  ? screen
                  : { ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true };
                (onEditScreen || onSelectScreen)(target);
              }} style={menuItemStyle}><Edit3 size={14} /> Edit</button>
              {onHide && !hasImage && (<button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); if (window.confirm(`Remove "${type.label}" from the grid? You can restore it later from "Show removed" at the top.`)) onHide(type.key); }} style={menuItemStyle}><EyeOff size={14} /> Hide</button>)}
              {onDelete && (screen?.generated || screen?.asset_id || screen?.url) && (<button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(screen); }} style={{ ...menuItemStyle, color: '#dc2626', borderBottom: 'none' }}><Trash2 size={14} /> Delete</button>)}
            </div>
          )}
        </div>
      )}
      {isHidden && (<div style={{ position: 'absolute', top: 4, right: 4, zIndex: 3, fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace", background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd' }}>restore</div>)}
      {hasImage && (
        <div className="screen-card-thumb" style={{ width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 6, background: '#f0f0f0' }}>
          <img src={screen.url} alt={type.label} style={isIcon ? { width: '100%', height: '100%', objectFit: 'contain' } : getScreenImageStyle(screen, globalFit)} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: isIcon ? 12 : 14, flexShrink: 0 }}>{type.icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: isIcon ? 9 : 11, fontWeight: 600, color: isActive ? '#fff' : '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{type.label}</div>
          {!isIcon && (<div className="screen-card-desc" style={{ fontSize: 8, color: isActive ? 'rgba(255,255,255,0.6)' : '#999', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{type.desc}</div>)}
        </div>
      </div>
      {/* Link status badge — shows at a glance whether this card participates
          in the phone flow. Skipped for placeholders (no real screen/icon). */}
      {screen && !isHidden && (() => {
        const linked = linkCount > 0;
        const isIconCard = !!isIcon;
        // For icons: "linked" means it's placed on ≥1 screen AND at least one of
        // those placements has a target. Placed-but-no-target = unlinked.
        const reallyLinked = isIconCard ? (linked && hasTargetedPlacement) : linked;
        const label = isIconCard
          ? (reallyLinked
              ? `✓ ${linkCount} screen${linkCount === 1 ? '' : 's'}`
              : linked
                ? '⚠ No target'
                : '○ Unplaced')
          : (linked
              ? `← ${linkCount} zone${linkCount === 1 ? '' : 's'}`
              : '⚠ Unreached');
        const color = reallyLinked
          ? (isActive ? 'rgba(255,255,255,0.85)' : '#5a8f3b')
          : !linked && !isIconCard
            ? (isActive ? 'rgba(255,200,150,0.95)' : '#B84D2E')
            : isIconCard && !linked
              ? (isActive ? 'rgba(255,255,255,0.55)' : '#A09889')
              : (isActive ? 'rgba(255,200,150,0.95)' : '#B84D2E');
        return (
          <div
            title={reallyLinked
              ? (isIconCard ? 'Placed on screens with targets set' : 'Zones link here')
              : isIconCard
                ? (linked ? 'Placed but has no navigation target' : 'Not placed on any screen yet')
                : 'No zones link to this screen'}
            style={{
              marginTop: 4,
              fontSize: 9,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
              letterSpacing: 0.3,
              color,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        );
      })()}
      {!menuOpen && (<div style={{ position: 'absolute', top: isIcon ? 5 : 8, left: isIcon ? 5 : 8, width: 7, height: 7, borderRadius: '50%', background: hasImage ? '#16a34a' : screen ? '#eab308' : '#e0e0e0' }} />)}
    </div>
  );
});

export default function PhoneHub({
  screens = [],
  activeScreen,
  onSelectScreen,
  onEditScreen,
  onDelete,
  onHideScreen,
  hiddenScreens = [],
  showHidden = false,
  onToggleShowHidden,
  onNavigate,
  navigationHistory = [],
  onBack,
  skin = 'midnight',
  onChangeSkin,
  customFrameUrl,
  globalFit,
  gridFilter = 'all',
  onEditZones,
  // New: top-level tab state lifted into the parent so Zones and
  // Missions can live on the same bar. Falls back to internal state when
  // the parent doesn't pass it, so old call sites keep working.
  activeTab: activeTabProp,
  onChangeTab,
  // When true, skip rendering the internal section tab bar. The parent
  // is rendering its own <PhoneHubSectionTabs /> above this component so
  // the tabs stay visible even when PhoneHub itself unmounts for tabs
  // that have their own workspace (Zones, Content).
  suppressSectionTabs = false,
  // Optional node drawn in the device's place (Task #2010): the Preview
  // stage puts the embedded, non-saving Preview phone here, beside the
  // same screen list. Without it, PhoneDevice and the skin picker as before.
  devicePane = null,
}) {
  // Placements memo lives below the screenTypes/iconTypes declarations so it
  // doesn't TDZ-crash (useMemo body runs synchronously on first render).

  const [frameError, setFrameError] = useState(false);
  // Skin picker collapsed by default — it's a rare customization, not a primary
  // control. Opens via a small ⚙ trigger just below the phone.
  const [skinPickerOpen, setSkinPickerOpen] = useState(false);
  // Grid section — show Screens or Icons at a time, not both stacked. Defaults
  // to Screens since that's the primary content.
  // Controlled-or-uncontrolled tab state. When the parent passes activeTab
  // + onChangeTab we delegate; otherwise we keep the old internal behaviour
  // so existing consumers don't break.
  const [internalTab, setInternalTab] = useState('screens');
  const gridSection = activeTabProp !== undefined ? activeTabProp : internalTab;
  const setGridSection = onChangeTab || setInternalTab;

  // Only use custom frame if we have a URL AND it hasn't errored
  const useCustomFrame = customFrameUrl && !frameError;

  // Selecting an icon keeps the screen the device was showing (doctrine rule
  // 17, Task #2008): the device shows only screens, so while an icon is
  // selected it keeps the last screen shown, looked up by id so it is never
  // stale, or the home screen if there was none.
  // isIcon covers both icon categories; `type` is the older marker the page also checks.
  const iconSelected = !!activeScreen && (isIcon(activeScreen) || activeScreen.type === 'icon');
  const [lastScreenId, setLastScreenId] = useState(null);
  if (activeScreen && !iconSelected && activeScreen.id !== lastScreenId) {
    setLastScreenId(activeScreen.id);
  }

  // Find the home screen — prefer is_home flag, then first generated screen
  const firstScreen = useMemo(() => {
    const generated = screens.filter(s => s.generated && s.url && isScreen(s));
    return generated.find(s => s.is_home) || generated[0] || null;
  }, [screens]);

  const deviceScreen = iconSelected
    ? (screens.find(s => s.id === lastScreenId && isScreen(s)) || firstScreen)
    : activeScreen;

  // Find persistent icons from the first/home screen that should show on ALL screens
  const persistentLinks = useMemo(() => {
    if (!firstScreen) return [];
    const links = getScreenLinks(firstScreen);
    return links.filter(l => l.persistent && l.icon_url);
  }, [firstScreen]);

  // Split screens by category — all from the DB, no hardcoded keys
  const screenTypes = screens.filter(s => isScreen(s));
  const iconTypes = screens.filter(isIcon);

  // Placements view — groups zones across all screens by the icon they display.
  // Gives creators a read-only overview: "this icon appears on N screens" plus
  // a list of those screens, so they can see the full picture without clicking
  // through each screen one by one. Declared AFTER screenTypes/iconTypes so
  // the useMemo body doesn't reference them before initialization.
  const placements = useMemo(() => {
    // Buckets are keyed by icon key for library icons (doctrine rule 17: a
    // placement stands for its icon, whatever image it last stored) and by
    // address for zones that resolve to no icon.
    const byIcon = new Map();
    // Seed with library icons so icons with zero placements still show (with a count of 0).
    iconTypes.forEach(icon => {
      if (!icon.url) return;
      byIcon.set(`icon:${icon.id}`, { icon, placements: [] });
    });
    // Walk every screen's zones and append them to the matching icon's bucket.
    screenTypes.forEach(screen => {
      const links = getScreenLinks(screen);
      links.forEach(link => {
        const key = resolveZoneIconKey(link, iconTypes);
        if (key && byIcon.has(`icon:${key}`)) {
          byIcon.get(`icon:${key}`).placements.push({ screen, zone: link });
          return;
        }
        const icons = getIconUrls(link);
        icons.forEach(iconUrl => {
          const entry = byIcon.get(`url:${iconUrl}`);
          if (entry) {
            entry.placements.push({ screen, zone: link });
          } else {
            // Zone uses an icon that isn't in the library (inline upload, or an
            // address no icon holds any more). Surface it as an orphan entry so
            // the creator can still see where it's used.
            byIcon.set(`url:${iconUrl}`, {
              icon: { id: `orphan-${iconUrl}`, url: iconUrl, name: 'Inline icon', orphan: true },
              placements: [{ screen, zone: link }],
            });
          }
        });
      });
    });
    // Icons-with-placements first, then unused icons, for a more useful default order.
    return Array.from(byIcon.values()).sort((a, b) => b.placements.length - a.placements.length);
  }, [screenTypes, iconTypes]);

  // Link status for status badges on Screen / Icon cards.
  //   iconLinkByKey: icon key -> { screenCount, hasTargetedPlacement }, counting
  //     every zone that resolves to the icon (by icon_overlay_id, or a legacy
  //     zone whose address is the icon's current image), so an image change
  //     never turns a placed icon "Unplaced" (doctrine rule 17)
  //     screenCount = # of distinct screens this icon is placed on
  //     hasTargetedPlacement = at least one of those placements has a target set
  //   screenReachById: screen_id -> incomingZoneCount (# of zones with target = this screen)
  const { iconLinkByKey, screenReachById } = useMemo(() => {
    const iconLinkByKey = new Map();
    const screenReachById = new Map();
    screenTypes.forEach(src => {
      const links = src.screen_links || src.metadata?.screen_links || [];
      links.forEach(link => {
        // Icon usage (by icon key, dedup screens per icon)
        const key = resolveZoneIconKey(link, iconTypes);
        if (key) {
          if (!iconLinkByKey.has(key)) iconLinkByKey.set(key, { screens: new Set(), hasTargetedPlacement: false });
          const entry = iconLinkByKey.get(key);
          entry.screens.add(src.id);
          if (link.target) entry.hasTargetedPlacement = true;
        }
        // Screen reach (count of zones pointing to each target)
        if (link.target) {
          screenReachById.set(link.target, (screenReachById.get(link.target) || 0) + 1);
        }
      });
    });
    // Freeze to plain values to keep memo outputs stable
    const iconOut = new Map();
    iconLinkByKey.forEach((v, k) => iconOut.set(k, { screenCount: v.screens.size, hasTargetedPlacement: v.hasTargetedPlacement }));
    return { iconLinkByKey: iconOut, screenReachById };
  }, [screenTypes, iconTypes]);

  // The selected icon's placements on the screen the device shows: its own
  // zones, plus the home screen's persistent icons where the device draws them.
  const highlightIconKey = iconSelected ? activeScreen.id : null;
  const highlightedHere = useMemo(() => {
    if (!highlightIconKey || !deviceScreen) return 0;
    const own = getScreenLinks(deviceScreen);
    const persistent = deviceScreen.id !== firstScreen?.id && !isMapScreen(deviceScreen) ? persistentLinks : [];
    return [...own, ...persistent].filter(l => resolveZoneIconKey(l, iconTypes) === highlightIconKey).length;
  }, [highlightIconKey, deviceScreen, firstScreen, persistentLinks, iconTypes]);

  return (
    <div className="phone-hub-inner">
      {/* Phone Device */}
      <div className="phone-hub-device">
      {devicePane || (<>
      <PhoneDevice
        skin={skin}
        customFrameUrl={customFrameUrl}
        useCustomFrame={useCustomFrame}
        onCustomFrameError={() => setFrameError(true)}
        phoneScreen={deviceScreen}
        activeScreen={deviceScreen}
        firstScreen={firstScreen}
        persistentLinks={persistentLinks}
        icons={iconTypes}
        highlightIconKey={highlightIconKey}
        globalFit={globalFit}
        // While an icon is selected, Back must return to the screen the device
        // showed, not to the icon, so that screen goes along as the origin.
        onNavigate={onNavigate && iconSelected && deviceScreen
          ? (target) => onNavigate(target, deviceScreen.id)
          : onNavigate}
        navigationHistory={navigationHistory}
        onBack={onBack}
      />

      {highlightIconKey && deviceScreen && highlightedHere === 0 && (
        <div className="phone-hub-not-placed" style={{ marginTop: 8, fontSize: 11, textAlign: 'center', color: 'var(--lala-ink-muted)', fontFamily: 'var(--font-ui)' }}>
          ○ {activeScreen.name} isn't placed on {deviceScreen.name}
        </div>
      )}

      {/* "Edit Tap Zones" button removed — the Zones tab in the section bar
          is the canonical entry point now. `onEditZones` prop kept for any
          external callers that still need to jump directly to zone editing. */}

      {/* Skin picker — hidden behind a ⚙ trigger since it's a rare customization.
          Not shown at all for custom frames (skins don't apply there). */}
      {onChangeSkin && !useCustomFrame && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setSkinPickerOpen(o => !o)}
            aria-expanded={skinPickerOpen}
            aria-label="Phone skin settings"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              border: `1px solid ${skinPickerOpen ? 'var(--lala-gold)' : 'var(--lala-parchment-3)'}`,
              borderRadius: 'var(--lala-radius)',
              background: skinPickerOpen ? 'var(--lala-gold-soft)' : 'var(--lala-surface)',
              color: skinPickerOpen ? 'var(--lala-gold)' : 'var(--lala-ink-muted)',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
              letterSpacing: '0.3px', minHeight: 32,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <Settings size={12} /> {skinPickerOpen ? 'Hide skins' : 'Phone skin'}
          </button>
          {skinPickerOpen && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: '6px 4px' }}>
              {PHONE_SKINS.map(s => (
                <button
                  key={s.key}
                  title={s.label}
                  aria-label={`Phone skin: ${s.label}`}
                  onClick={() => onChangeSkin(s.key)}
                  className="phone-hub-skin-btn"
                  style={{
                    width: 36, height: 36, borderRadius: '50%', border: skin === s.key ? '2.5px solid var(--lala-gold)' : '1.5px solid var(--lala-parchment-3)',
                    background: typeof s.body === 'string' && s.body.startsWith('linear') ? undefined : s.body,
                    backgroundImage: typeof s.body === 'string' && s.body.startsWith('linear') ? s.body : undefined,
                    cursor: 'pointer', padding: 0, transition: 'transform 0.15s',
                    transform: skin === s.key ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </>)}
      </div>

      {/* Screen Slots Grid — Screens / Icons shown one at a time via tabs so the
          page stays focused on one surface instead of two stacked grids. */}
      <div className="phone-hub-grid-section">
        {!suppressSectionTabs && (
          <PhoneHubSectionTabs
            activeTab={gridSection}
            onChangeTab={setGridSection}
            screenCount={screenTypes.length}
            iconCount={iconTypes.length}
            placementCount={placements.length}
            hiddenCount={hiddenScreens.length}
            showHidden={showHidden}
            onToggleShowHidden={onToggleShowHidden}
            gridFilter={gridFilter}
            showZones={!!onChangeTab}
            showContent={!!onChangeTab}
            showMissions={!!onChangeTab}
          />
        )}

        {gridSection === 'screens' && (
          <div className="phone-hub-screen-grid">
            {screenTypes.filter(s => showHidden || !hiddenScreens.includes(s.id)).map(s => (
              <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '📱', desc: s.description || '' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onEditScreen={onEditScreen} onDelete={onDelete} onHide={onHideScreen} isHidden={hiddenScreens.includes(s.id)} globalFit={globalFit} linkCount={screenReachById.get(s.id) || 0} />
            ))}
          </div>
        )}

        {gridSection === 'icons' && (gridFilter === 'all' || gridFilter === 'icon') && iconTypes.length > 0 && (
          <div className="phone-hub-icon-grid">
            {iconTypes.filter(s => showHidden || !hiddenScreens.includes(s.id)).map(s => (
              <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '🎨', desc: s.description || '' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onEditScreen={onEditScreen} onDelete={onDelete} onHide={onHideScreen} isHidden={hiddenScreens.includes(s.id)} globalFit={globalFit} isIcon linkCount={iconLinkByKey.get(s.id)?.screenCount || 0} hasTargetedPlacement={!!iconLinkByKey.get(s.id)?.hasTargetedPlacement} />
            ))}
          </div>
        )}

        {/* Placements: each icon gets a card; within the card, a list of the
            screens it currently appears on. Clicking a screen chip navigates to
            that screen's editor so you can adjust position / remove / etc. */}
        {gridSection === 'placements' && (
          <div className="phone-hub-placements">
            {placements.length === 0 && (
              <div className="phone-hub-placements-empty">
                No icons in the library yet. Create one with <strong>+ New Icon</strong> above.
              </div>
            )}
            {placements.map(({ icon, placements: uses }) => (
              <div key={icon.id || icon.url} className="phone-hub-placement-card">
                <div className="phone-hub-placement-head">
                  <img src={icon.url} alt="" className="phone-hub-placement-thumb" />
                  <div className="phone-hub-placement-meta">
                    <div className="phone-hub-placement-name">
                      {icon.name}
                      {icon.orphan && <span className="phone-hub-placement-orphan"> · uploaded inline</span>}
                    </div>
                    <div className="phone-hub-placement-count">
                      {uses.length === 0
                        ? 'Not placed yet'
                        : uses.length === 1
                          ? 'Appears on 1 screen'
                          : `Appears on ${uses.length} screens`}
                    </div>
                  </div>
                </div>
                {uses.length > 0 && (
                  <div className="phone-hub-placement-chips">
                    {uses.map(({ screen, zone }, idx) => (
                      <button
                        key={`${screen.id}-${zone.id}-${idx}`}
                        type="button"
                        onClick={() => onSelectScreen && onSelectScreen(screen)}
                        className="phone-hub-placement-chip"
                        title={`${screen.name} — x:${Math.round(zone.x)}%, y:${Math.round(zone.y)}%`}
                      >
                        {screen.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .phone-hub-inner { display: flex; gap: 24px; align-items: flex-start; }
        .phone-hub-device { display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; position: sticky; top: 20px; align-self: flex-start; }
        .phone-hub-grid-section { flex: 1; min-width: 0; }

        .phone-hub-screen-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px;
        }
        .phone-hub-icon-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;
        }

        /* Placements view — one card per icon, stacked vertically. Inside each
           card, a row of screen chips showing where that icon appears. */
        .phone-hub-placements { display: flex; flex-direction: column; gap: 10px; }
        .phone-hub-placements-empty {
          padding: 20px 16px;
          text-align: center;
          color: var(--lala-ink-muted);
          font-family: var(--font-ui);
          font-size: var(--text-xs);
          background: var(--lala-parchment);
          border: 1px dashed var(--lala-parchment-3);
          border-radius: var(--lala-radius);
        }
        .phone-hub-placement-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 14px;
          background: var(--lala-surface);
          border: 1px solid var(--lala-parchment-3);
          border-radius: var(--lala-radius);
          transition: border-color 0.15s;
        }
        .phone-hub-placement-card:hover { border-color: var(--lala-gold-line); }
        .phone-hub-placement-head { display: flex; align-items: center; gap: 12px; }
        .phone-hub-placement-thumb {
          width: 40px; height: 40px;
          object-fit: contain;
          border-radius: var(--lala-radius);
          background: var(--lala-parchment);
          border: 1px solid var(--lala-parchment-3);
          padding: 2px;
          flex-shrink: 0;
        }
        .phone-hub-placement-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .phone-hub-placement-name {
          font-family: var(--font-prose);
          font-size: var(--text-md);
          font-weight: 600;
          color: var(--lala-ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .phone-hub-placement-orphan {
          font-family: var(--font-ui);
          font-size: var(--text-xs);
          color: var(--lala-ink-faint);
          font-weight: 500;
        }
        .phone-hub-placement-count {
          font-family: var(--font-ui);
          font-size: var(--text-xs);
          color: var(--lala-ink-muted);
          letter-spacing: 0.3px;
        }
        .phone-hub-placement-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .phone-hub-placement-chip {
          padding: 5px 10px;
          font-size: var(--text-xs);
          font-family: var(--font-ui);
          font-weight: 600;
          letter-spacing: 0.3px;
          border: 1px solid var(--lala-parchment-3);
          border-radius: var(--lala-radius);
          background: var(--lala-parchment);
          color: var(--lala-ink-muted);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .phone-hub-placement-chip:hover {
          border-color: var(--lala-gold);
          background: var(--lala-gold-soft);
          color: var(--lala-gold);
        }

        .screen-card-thumb { aspect-ratio: 9/16; }

        @media (max-width: 1024px) {
          .phone-hub-inner { gap: 16px; }
          .phone-hub-frame { width: 240px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
        }
        @media (max-width: 768px) {
          .phone-hub-inner { flex-direction: column; align-items: stretch; }
          .phone-hub-device { align-items: center; position: static; }
          .phone-hub-frame { width: 220px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .phone-hub-icon-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
          .screen-card-thumb { aspect-ratio: 3/4; }
        }
        @media (max-width: 480px) {
          .phone-hub-frame { width: 180px; }
          .phone-hub-inner { gap: 10px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(3, 1fr); gap: 5px; }
          .phone-hub-icon-grid { grid-template-columns: repeat(4, 1fr); gap: 5px; }
          .screen-card-thumb { aspect-ratio: 3/4; }
        }
        @media (max-width: 375px) {
          .phone-hub-frame { width: 160px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(2, 1fr); gap: 4px; }
          .phone-hub-icon-grid { grid-template-columns: repeat(3, 1fr); gap: 4px; }
        }
        .screen-card:hover .screen-card-menu { opacity: 1 !important; }
        .screen-card-menu { opacity: 0; transition: opacity 0.15s; }
        @media (hover: none) {
          .screen-card-menu { opacity: 0.7 !important; }
        }
      `}</style>
    </div>
  );
}


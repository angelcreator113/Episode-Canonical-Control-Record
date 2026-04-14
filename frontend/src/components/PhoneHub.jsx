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
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, EyeOff, Edit3 } from 'lucide-react';
import ScreenContentRenderer from './ScreenContentRenderer';

// type: 'screen' = full phone screen frame, 'icon' = app icon for home screen link editor
const SCREEN_TYPES = [
  // ── Screens (full phone views — upload designed screen images) ──
  { key: 'home', label: 'Home', icon: '📱', desc: 'App icons & notifications', type: 'screen' },
  { key: 'feed', label: 'Feed', icon: '📰', desc: 'Scrolling posts', type: 'screen' },
  { key: 'messages', label: 'Messages', icon: '✉️', desc: 'Text conversations', type: 'screen' },
  { key: 'dm', label: 'DMs', icon: '💬', desc: 'Private messages', type: 'screen' },
  { key: 'story', label: 'Stories', icon: '⭕', desc: 'Watching stories', type: 'screen' },
  { key: 'profile', label: 'Profile', icon: '👤', desc: 'Viewing someone', type: 'screen' },
  { key: 'calls', label: 'Calls', icon: '📞', desc: 'Call history & FaceTime', type: 'screen' },
  { key: 'contacts', label: 'Contacts', icon: '👥', desc: 'Contact list', type: 'screen' },
  { key: 'comments', label: 'Comments', icon: '💭', desc: 'Post reactions', type: 'screen' },
  { key: 'live', label: 'Live', icon: '🔴', desc: 'Going live', type: 'screen' },
  { key: 'notif', label: 'Alerts', icon: '🔔', desc: 'Notification center', type: 'screen' },
  { key: 'brand_deals', label: 'Brand Deals', icon: '🤝', desc: 'Sponsorship offers', type: 'screen' },
  { key: 'stats', label: 'Stats', icon: '📊', desc: 'Analytics & metrics', type: 'screen' },
  { key: 'creator_hub', label: 'Creator Hub', icon: '🎨', desc: 'Content management', type: 'screen' },
  { key: 'deadlines', label: 'Deadlines', icon: '⏰', desc: 'Upcoming due dates', type: 'screen' },
  { key: 'tasks', label: 'Tasks', icon: '✅', desc: 'To-do & reminders', type: 'screen' },
  { key: 'wardrobe', label: 'Closet', icon: '👗', desc: 'Outfit selection', type: 'screen' },
  { key: 'accessories', label: 'Accessories', icon: '💎', desc: 'Jewelry & extras', type: 'screen' },
  { key: 'shop', label: 'Shopping', icon: '🛍️', desc: 'Browsing items', type: 'screen' },
  { key: 'camera', label: 'Camera', icon: '📸', desc: 'Taking content', type: 'screen' },
  { key: 'map', label: 'Map', icon: '🗺️', desc: 'DREAM map', type: 'screen' },
  { key: 'invite', label: 'Invitation', icon: '💌', desc: 'Event invitations', type: 'screen' },
  { key: 'settings', label: 'Settings', icon: '⚙️', desc: 'Phone settings', type: 'screen' },
  // ── App Icons (small icons placed on the home screen via link editor) ──
  { key: 'icon_feed', label: 'Feed Icon', icon: '📰', desc: 'App icon for Feed', type: 'icon' },
  { key: 'icon_messages', label: 'Messages Icon', icon: '✉️', desc: 'App icon for Messages', type: 'icon' },
  { key: 'icon_dm', label: 'DMs Icon', icon: '💬', desc: 'App icon for DMs', type: 'icon' },
  { key: 'icon_camera', label: 'Camera Icon', icon: '📸', desc: 'App icon for Camera', type: 'icon' },
  { key: 'icon_closet', label: 'Closet Icon', icon: '👗', desc: 'App icon for Closet', type: 'icon' },
  { key: 'icon_shop', label: 'Shop Icon', icon: '🛍️', desc: 'App icon for Shopping', type: 'icon' },
  { key: 'icon_stats', label: 'Stats Icon', icon: '📊', desc: 'App icon for Stats', type: 'icon' },
  { key: 'icon_settings', label: 'Settings Icon', icon: '⚙️', desc: 'App icon for Settings', type: 'icon' },
  { key: 'icon_brand_deals', label: 'Deals Icon', icon: '🤝', desc: 'App icon for Brand Deals', type: 'icon' },
  { key: 'icon_creator_hub', label: 'Hub Icon', icon: '🎨', desc: 'App icon for Creator Hub', type: 'icon' },
  { key: 'icon_calls', label: 'Calls Icon', icon: '📞', desc: 'App icon for Calls', type: 'icon' },
  { key: 'icon_contacts', label: 'Contacts Icon', icon: '👥', desc: 'App icon for Contacts', type: 'icon' },
  { key: 'icon_tasks', label: 'Tasks Icon', icon: '✅', desc: 'App icon for Tasks', type: 'icon' },
  { key: 'icon_accessories', label: 'Accessories Icon', icon: '💎', desc: 'App icon for Accessories', type: 'icon' },
  { key: 'icon_phone', label: 'Phone Icon', icon: '📱', desc: 'App icon for Phone', type: 'icon' },
];

const PHONE_SKINS = [
  { key: 'midnight', label: 'Midnight', body: '#1a1a2e', notch: '#333', btn: '#444', shadow: 'rgba(0,0,0,0.3)', accent: 'rgba(255,255,255,0.1)' },
  { key: 'rosegold', label: 'Rose Gold', body: 'linear-gradient(135deg, #e8c4b8, #d4a090)', notch: '#c99585', btn: '#c99585', shadow: 'rgba(180,120,100,0.3)', accent: 'rgba(255,255,255,0.25)' },
  { key: 'gold', label: 'Gold', body: 'linear-gradient(135deg, #d4b896, #c9a84c)', notch: '#b89060', btn: '#b89060', shadow: 'rgba(184,150,46,0.3)', accent: 'rgba(255,255,255,0.2)' },
  { key: 'silver', label: 'Silver', body: 'linear-gradient(135deg, #e8e8ec, #c0c0c8)', notch: '#b0b0b8', btn: '#b0b0b8', shadow: 'rgba(100,100,120,0.2)', accent: 'rgba(255,255,255,0.4)' },
  { key: 'white', label: 'White', body: '#f5f5f7', notch: '#e0e0e4', btn: '#e0e0e4', shadow: 'rgba(0,0,0,0.1)', accent: 'rgba(255,255,255,0.6)' },
  { key: 'pink', label: 'Pink', body: 'linear-gradient(135deg, #f0c4d4, #d4789a)', notch: '#c06888', btn: '#c06888', shadow: 'rgba(212,120,154,0.3)', accent: 'rgba(255,255,255,0.2)' },
  { key: 'lavender', label: 'Lavender', body: 'linear-gradient(135deg, #d4c4e8, #a889c8)', notch: '#9878b8', btn: '#9878b8', shadow: 'rgba(168,137,200,0.3)', accent: 'rgba(255,255,255,0.2)' },
];

export { SCREEN_TYPES, PHONE_SKINS, getScreenImageStyle };

// Build image style from screen's fit settings (metadata.image_fit)
// globalFit is the device-level default applied when screen has no per-screen override
function getScreenImageStyle(screen, globalFit) {
  const screenFit = screen?.image_fit || screen?.metadata?.image_fit;
  const fit = screenFit || globalFit || {};
  const mode = fit.mode || 'cover'; // cover | contain | fill
  const scale = fit.scale || 100;   // percentage, 100 = normal
  const offsetX = fit.offsetX || 0; // percentage offset
  const offsetY = fit.offsetY || 0;

  // Use transform for scaling — keeps image centered and works with all objectFit modes
  const style = {
    width: '100%',
    height: '100%',
    objectFit: mode,
    objectPosition: `${50 + offsetX}% ${50 + offsetY}%`,
  };

  if (scale !== 100) {
    style.transform = `scale(${scale / 100})`;
    style.transformOrigin = `${50 + offsetX}% ${50 + offsetY}%`;
  }

  return style;
}

// Renders interactive tap zone overlays on the phone screen
function ScreenLinkOverlay({ links = [], onNavigate }) {
  if (!links.length || !onNavigate) return null;
  return (
    <>
      {links.map(link => (
        <div
          key={link.id}
          onClick={(e) => {
            e.stopPropagation();
            if (link.target) onNavigate(link.target);
          }}
          title={link.label || link.target}
          style={{
            position: 'absolute',
            left: `${link.x}%`, top: `${link.y}%`,
            width: `${link.w}%`, height: `${link.h}%`,
            cursor: link.target ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
            transition: 'background 0.15s',
            zIndex: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {link.icon_url && (
            <img
              src={link.icon_url}
              alt={link.label || link.target}
              style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }}
              draggable={false}
            />
          )}
        </div>
      ))}
    </>
  );
}

// Renders persistent icons (from home screen) that stay visible on all screens
function PersistentOverlay({ links = [], onNavigate }) {
  if (!links.length || !onNavigate) return null;
  return (
    <>
      {links.map(link => (
        <div
          key={link.id}
          onClick={(e) => {
            e.stopPropagation();
            if (link.target) onNavigate(link.target);
          }}
          title={link.label || link.target}
          style={{
            position: 'absolute',
            left: `${link.x}%`, top: `${link.y}%`,
            width: `${link.w}%`, height: `${link.h}%`,
            cursor: link.target ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
            zIndex: 4,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {link.icon_url && (
            <img
              src={link.icon_url}
              alt={link.label || link.target}
              style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }}
              draggable={false}
            />
          )}
        </div>
      ))}
    </>
  );
}

export default function PhoneHub({ screens = [], activeScreen, onSelectScreen, onDelete, onHideScreen, hiddenScreens = [], showHidden = false, onToggleShowHidden, onNavigate, navigationHistory = [], onBack, skin = 'midnight', onChangeSkin, customFrameUrl, globalFit, gridFilter = 'all' }) {
  const currentSkin = PHONE_SKINS.find(s => s.key === skin) || PHONE_SKINS[0];
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameError, setFrameError] = useState(false);

  // Only use custom frame if we have a URL AND it hasn't errored
  const useCustomFrame = customFrameUrl && !frameError;

  // Don't show icons in the phone device — only screens
  // Helper to detect if a screen/overlay is an icon type
  const isIcon = (s) => s?.type === 'icon' || s?.category === 'phone_icon' || (s?.id && s.id.startsWith('icon_')) || (s?.name && /icon$/i.test((s.name || '').trim()));

  const isIconType = isIcon(activeScreen);

  // Find home screen — used as persistent fallback
  const homeScreen = screens.find(s => s.id === 'home' && s.generated && s.url);

  // What to show on the phone: active screen > home screen > nothing
  const phoneScreen = isIconType ? homeScreen : (activeScreen || homeScreen);

  // Find persistent icons from the home screen that should show on ALL screens
  // Build a lookup of icon overlay IDs to their current URLs (handles bg removal)
  const iconUrlMap = React.useMemo(() => {
    const map = {};
    screens.forEach(s => {
      if (isIcon(s) && s.url) map[s.id] = s.url;
    });
    return map;
  }, [screens]);

  // Resolve tap zone icon URLs — if an icon_overlay_id is set, use the overlay's current URL
  const resolveLinks = (links) => {
    if (!links?.length) return links;
    return links.map(l => {
      if (l.icon_overlay_id && iconUrlMap[l.icon_overlay_id]) {
        return { ...l, icon_url: iconUrlMap[l.icon_overlay_id] };
      }
      return l;
    });
  };

  const persistentLinks = React.useMemo(() => {
    if (!homeScreen) return [];
    const links = homeScreen.screen_links || homeScreen.metadata?.screen_links || [];
    return resolveLinks(links.filter(l => l.persistent && l.icon_url));
  }, [homeScreen, iconUrlMap]);

  // Match screens to screen types — strict matching only (no fuzzy name includes)
  const getScreenForType = (type) => {
    return screens.find(s => {
      const sId = (s.id || '').toLowerCase();
      const sBeat = (s.beat || '').toLowerCase();
      const sName = (s.name || '').toLowerCase();
      const key = type.key.toLowerCase();
      const label = type.label.toLowerCase();
      // Strict: exact id match, exact beat match, or exact name match
      return sId === key || sBeat === key || sName === label || sName === `ui overlay: ${label}`;
    });
  };

  // Find custom overlays not matching any SCREEN_TYPE key
  const knownKeys = new Set(SCREEN_TYPES.map(t => t.key));
  const customScreens = screens.filter(s =>
    s.custom && !knownKeys.has(s.id) && !isIcon(s)
  );
  const customIcons = screens.filter(s =>
    s.custom && !knownKeys.has(s.id) && isIcon(s)
  );

  return (
    <div className="phone-hub-inner">
      {/* Phone Device */}
      <div className="phone-hub-device">
      {useCustomFrame ? (
        /* Custom uploaded phone frame */
        <div className="phone-hub-frame">
          {/* Screen content — rendered first, sits behind the frame */}
          <div style={{
            position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%',
            borderRadius: 16, overflow: 'hidden', zIndex: 1,
          }}>
            {phoneScreen?.url ? (
              <>
                <img src={activeScreen.url} alt={activeScreen.name} style={getScreenImageStyle(activeScreen, globalFit)} />
                <ScreenContentRenderer
                  zones={activeScreen.content_zones || activeScreen.metadata?.content_zones || []}
                  showId={activeScreen.show_id}
                  interactive={false}
                />
                <ScreenLinkOverlay links={resolveLinks(activeScreen.screen_links || activeScreen.metadata?.screen_links || [])} onNavigate={onNavigate} />
                {activeScreen.id !== 'home' && persistentLinks.length > 0 && (
                  <PersistentOverlay links={persistentLinks} onNavigate={onNavigate} />
                )}
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{phoneScreen ? 'Not generated' : 'Select a screen'}</span>
              </div>
            )}
            {navigationHistory.length > 0 && onBack && (
              <button onClick={onBack} style={{
                position: 'absolute', top: 6, left: 6, zIndex: 10,
                padding: '3px 8px', fontSize: 9, fontWeight: 700, border: 'none',
                borderRadius: 10, background: 'rgba(0,0,0,0.5)', color: '#fff',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
              }}>← Back</button>
            )}
          </div>
          {/* Frame image — on top so it visually wraps the screen content */}
          <img
            src={customFrameUrl}
            alt="Phone frame"
            onLoad={() => setFrameLoaded(true)}
            onError={() => { setFrameError(true); setFrameLoaded(false); }}
            style={{
              width: '100%', borderRadius: 24, display: 'block',
              position: 'relative', zIndex: 2, pointerEvents: 'none',
            }}
          />
        </div>
      ) : (
        /* Built-in iPhone-style phone frame with skin */
        <div className="phone-hub-frame" style={{
          background: currentSkin.body,
          borderRadius: 44,
          padding: '16px 12px 20px',
          boxShadow: `0 8px 32px ${currentSkin.shadow}, inset 0 1px 0 ${currentSkin.accent}, 0 0 0 2px rgba(0,0,0,0.3)`,
          position: 'relative',
          border: '2px solid rgba(0,0,0,0.5)',
        }}>
        {/* Side buttons — volume + power */}
        <div style={{ position: 'absolute', left: -5, top: '18%', width: 4, height: 28, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', left: -5, top: '26%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', left: -5, top: '34%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', right: -5, top: '24%', width: 4, height: 64, background: currentSkin.btn, borderRadius: '0 3px 3px 0', border: '1px solid rgba(0,0,0,0.3)', borderLeft: 'none' }} />

        {/* Screen area — hard dark border ensures visibility against any content */}
        <div style={{
          width: '100%', aspectRatio: '9/19.5',
          borderRadius: 24, overflow: 'hidden',
          background: phoneScreen?.url ? '#000' : 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)',
          position: 'relative',
          border: '2.5px solid #111',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.4)',
        }}>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 90, height: 24, borderRadius: 14,
            background: '#000', zIndex: 5,
            border: '1.5px solid #333',
          }}>
            {/* Camera dot */}
            <div style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: '#1a1a2e',
              border: '1px solid #333',
            }} />
          </div>

          {phoneScreen?.url ? (
            <>
              <img
                src={phoneScreen.url}
                alt={phoneScreen.name}
                style={getScreenImageStyle(phoneScreen, globalFit)}
              />
              <ScreenContentRenderer
                zones={activeScreen.content_zones || activeScreen.metadata?.content_zones || []}
                showId={activeScreen.show_id}
                interactive={false}
              />
              <ScreenLinkOverlay links={resolveLinks(activeScreen.screen_links || activeScreen.metadata?.screen_links || [])} onNavigate={onNavigate} />
              {/* Persistent icons from home screen — show on non-home screens */}
              {activeScreen.id !== 'home' && persistentLinks.length > 0 && (
                <PersistentOverlay links={persistentLinks} onNavigate={onNavigate} />
              )}
            </>
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#555',
            }}>
              <span style={{ fontSize: 32 }}>📱</span>
              <span style={{ fontSize: 11, marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
                {phoneScreen ? 'Not generated yet' : 'Select a screen'}
              </span>
            </div>
          )}

          {/* Back button for navigation */}
          {navigationHistory.length > 0 && onBack && (
            <button onClick={onBack} style={{
              position: 'absolute', top: 38, left: 8, zIndex: 10,
              padding: '3px 8px', fontSize: 9, fontWeight: 700, border: 'none',
              borderRadius: 10, background: 'rgba(0,0,0,0.5)', color: '#fff',
              cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}>← Back</button>
          )}

          {/* Screen name overlay */}
          {phoneScreen && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              padding: '20px 12px 10px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{phoneScreen.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Mono', monospace" }}>
                {phoneScreen.beat || phoneScreen.description?.slice(0, 40)}
              </div>
            </div>
          )}

          {/* Home indicator bar */}
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            width: 100, height: 4, borderRadius: 2,
            background: 'rgba(0,0,0,0.35)', zIndex: 5,
            boxShadow: '0 0 4px rgba(0,0,0,0.2)',
          }} />
        </div>
      </div>
      )}

      {/* Skin picker — only shown for built-in frame (skins don't apply to custom frames) */}
      {onChangeSkin && !useCustomFrame && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PHONE_SKINS.map(s => (
            <button
              key={s.key}
              title={s.label}
              aria-label={`Phone skin: ${s.label}`}
              onClick={() => onChangeSkin(s.key)}
              className="phone-hub-skin-btn"
              style={{
                width: 36, height: 36, borderRadius: '50%', border: skin === s.key ? '2.5px solid #B8962E' : '1.5px solid #ddd',
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

      {/* Screen Slots Grid */}
      <div className="phone-hub-grid-section">
        {/* Screens Section */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: '#B8962E', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>SCREENS</span>
            Full phone views
          </div>
          {hiddenScreens.length > 0 && onToggleShowHidden && (
            <button onClick={onToggleShowHidden} style={{
              fontSize: 11, color: '#666', background: showHidden ? '#fdf8ee' : '#fff', border: `1px solid ${showHidden ? '#B8962E' : '#ddd'}`,
              borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              minHeight: 36, fontWeight: 600,
            }}>{showHidden ? 'Hide removed' : `Show removed (${hiddenScreens.length})`}</button>
          )}
        </div>
        <div className="phone-hub-screen-grid">
          {SCREEN_TYPES.filter(t => t.type === 'screen').filter(t => showHidden || !hiddenScreens.includes(t.key)).map(type => (
            <ScreenCard key={type.key} type={type} screen={getScreenForType(type)} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onDelete={onDelete} onHide={onHideScreen} isHidden={hiddenScreens.includes(type.key)} globalFit={globalFit} />
          ))}
          {customScreens.map(s => (
            <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '📄', desc: s.description || 'Custom screen' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onDelete={onDelete} globalFit={globalFit} />
          ))}
        </div>

        {/* Icons Section */}
        {(gridFilter === 'all' || gridFilter === 'icon') && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a889c8', fontFamily: "'DM Mono', monospace", marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#a889c8', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>ICONS</span>
              App icons for home screen links
            </div>
            <div className="phone-hub-icon-grid">
              {SCREEN_TYPES.filter(t => t.type === 'icon').filter(t => showHidden || !hiddenScreens.includes(t.key)).map(type => (
                <ScreenCard key={type.key} type={type} screen={getScreenForType(type)} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onDelete={onDelete} onHide={onHideScreen} isHidden={hiddenScreens.includes(type.key)} globalFit={globalFit} isIcon />
              ))}
              {customIcons.map(s => (
                <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '🎨', desc: s.description || 'Custom icon' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} onDelete={onDelete} globalFit={globalFit} isIcon />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        .phone-hub-inner { display: flex; gap: 24px; align-items: flex-start; }
        .phone-hub-device { display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; position: sticky; top: 20px; align-self: flex-start; }
        .phone-hub-frame { width: 280px; position: relative; }
        .phone-hub-grid-section { flex: 1; min-width: 0; }
        .phone-hub-screen-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px;
        }
        .phone-hub-icon-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;
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

const ScreenCard = React.memo(function ScreenCard({ type, screen, activeScreen, onSelectScreen, onDelete, onHide, isHidden, globalFit, isIcon }) {
  const isActive = activeScreen?.id === screen?.id && screen;
  const hasImage = screen?.generated && screen?.url;
  const accentColor = isIcon ? '#a889c8' : '#B8962E';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
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
        screen ? onSelectScreen(screen) : onSelectScreen({ ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true });
      }}
      className="screen-card"
      style={{
        background: isHidden ? '#f5f3f0' : isActive ? '#2C2C2C' : hasImage ? '#fff' : '#faf8f5',
        border: `1px solid ${isHidden ? '#e8e0d0' : isActive ? accentColor : hasImage ? '#e8e0d0' : '#f0ece4'}`,
        borderRadius: isIcon ? 8 : 10, padding: isIcon ? 6 : 8,
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'visible',
        minHeight: isIcon ? 40 : 'auto',
        opacity: isHidden ? 0.45 : 1,
      }}
    >
      {/* 3-dot menu — replaces old delete/hide buttons */}
      {!isHidden && (onDelete || onHide) && (
        <div ref={menuRef} style={{ position: 'absolute', top: 4, right: 4, zIndex: 5 }}>
          <button
            className="screen-card-menu"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Screen options"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: hasImage ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',
              border: 'none', color: hasImage ? '#fff' : '#999',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: hasImage ? 'blur(4px)' : 'none',
            }}
          >
            <MoreVertical size={14} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: isIcon ? 'auto' : 0, left: isIcon ? 0 : 'auto', marginTop: 4,
              background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 20,
              minWidth: 140, overflow: 'hidden',
            }}>
              {/* Edit — opens the detail panel */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  screen ? onSelectScreen(screen) : onSelectScreen({ ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true });
                }}
                style={menuItemStyle}
              >
                <Edit3 size={14} /> Edit
              </button>

              {/* Hide from grid */}
              {onHide && !hasImage && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onHide(type.key); }}
                  style={menuItemStyle}
                >
                  <EyeOff size={14} /> Hide
                </button>
              )}

              {/* Delete — available for any screen with an image or asset */}
              {onDelete && (screen?.generated || screen?.asset_id || screen?.url) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(screen); }}
                  style={{ ...menuItemStyle, color: '#dc2626', borderBottom: 'none' }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Restore badge for hidden cards */}
      {isHidden && (
        <div style={{
          position: 'absolute', top: 4, right: 4, zIndex: 3,
          fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace",
          background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd',
        }}>restore</div>
      )}

      {/* Thumbnail preview */}
      {hasImage && (
        <div className="screen-card-thumb" style={{
          width: '100%',
          borderRadius: 8, overflow: 'hidden',
          marginBottom: 6, background: '#f0f0f0',
        }}>
          <img src={screen.url} alt={type.label}
            style={isIcon ? { width: '100%', height: '100%', objectFit: 'contain' } : getScreenImageStyle(screen, globalFit)} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: isIcon ? 12 : 14, flexShrink: 0 }}>{type.icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: isIcon ? 9 : 11, fontWeight: 600, color: isActive ? '#fff' : '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {type.label}
          </div>
          {!isIcon && (
            <div className="screen-card-desc" style={{ fontSize: 8, color: isActive ? 'rgba(255,255,255,0.6)' : '#999', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              {type.desc}
            </div>
          )}
        </div>
      </div>

      {/* Status dot */}
      {!menuOpen && (
        <div style={{
          position: 'absolute', top: isIcon ? 5 : 8, left: isIcon ? 5 : 8,
          width: 7, height: 7, borderRadius: '50%',
          background: hasImage ? '#16a34a' : screen ? '#eab308' : '#e0e0e0',
        }} />
      )}
    </div>
  );
});

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '11px 14px',
  border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 500, color: '#2C2C2C',
  textAlign: 'left', minHeight: 44,
  borderBottom: '1px solid #f5f3ee',
};

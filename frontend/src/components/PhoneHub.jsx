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
import React from 'react';

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

export default function PhoneHub({ screens = [], activeScreen, onSelectScreen, onNavigate, navigationHistory = [], onBack, skin = 'midnight', onChangeSkin, customFrameUrl, globalFit, gridFilter = 'all' }) {
  const currentSkin = PHONE_SKINS.find(s => s.key === skin) || PHONE_SKINS[0];

  // Don't show icons in the phone device — only screens
  const isIconType = activeScreen?.type === 'icon' || activeScreen?.category === 'phone_icon';
  const phoneScreen = isIconType ? null : activeScreen;

  // Match screens to screen types
  const getScreenForType = (type) => {
    return screens.find(s => {
      const sId = (s.id || '').toLowerCase();
      const sBeat = (s.beat || '').toLowerCase();
      const sName = (s.name || '').toLowerCase();
      const key = type.key.toLowerCase();
      const label = type.label.toLowerCase();
      return sId === key || sBeat === key || sName === label
        || sBeat.includes(key) || sName.includes(key) || sName.includes(label);
    });
  };

  // Find custom overlays not matching any SCREEN_TYPE key
  const knownKeys = new Set(SCREEN_TYPES.map(t => t.key));
  const customScreens = screens.filter(s =>
    s.custom && !knownKeys.has(s.id) && s.category !== 'phone_icon'
  );
  const customIcons = screens.filter(s =>
    s.custom && !knownKeys.has(s.id) && s.category === 'phone_icon'
  );

  return (
    <div className="phone-hub-inner">
      {/* Phone Device */}
      <div className="phone-hub-device">
      {customFrameUrl ? (
        /* Custom uploaded phone frame */
        <div className="phone-hub-frame">
          {/* Screen content — rendered first, sits behind the frame */}
          <div style={{
            position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%',
            borderRadius: 16, overflow: 'hidden', zIndex: 1,
          }}>
            {activeScreen?.url ? (
              <>
                <img src={activeScreen.url} alt={activeScreen.name} style={getScreenImageStyle(activeScreen, globalFit)} />
                <ScreenLinkOverlay links={activeScreen.screen_links || activeScreen.metadata?.screen_links || []} onNavigate={onNavigate} />
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{activeScreen ? 'Not generated' : 'Select a screen'}</span>
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
          <img src={customFrameUrl} alt="Phone frame" style={{
            width: '100%', borderRadius: 24, display: 'block',
            position: 'relative', zIndex: 2, pointerEvents: 'none',
          }} />
        </div>
      ) : (
        /* Built-in phone frame with skin */
        <div className="phone-hub-frame" style={{
          background: currentSkin.body,
          borderRadius: 32,
          padding: '12px 8px',
          boxShadow: `0 8px 32px ${currentSkin.shadow}, inset 0 1px 0 ${currentSkin.accent}`,
          position: 'relative',
        }}>
        {/* Notch */}
        <div style={{
          width: 80, height: 6, borderRadius: 3,
          background: currentSkin.notch, margin: '0 auto 8px',
        }} />

        {/* Screen */}
        <div style={{
          width: '100%', aspectRatio: '9/16',
          borderRadius: 20, overflow: 'hidden',
          background: activeScreen?.url ? 'transparent' : 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)',
          position: 'relative',
        }}>
          {activeScreen?.url ? (
            <>
              <img
                src={activeScreen.url}
                alt={activeScreen.name}
                style={getScreenImageStyle(activeScreen, globalFit)}
              />
              <ScreenLinkOverlay links={activeScreen.screen_links || activeScreen.metadata?.screen_links || []} onNavigate={onNavigate} />
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
                {activeScreen ? 'Not generated yet' : 'Select a screen'}
              </span>
            </div>
          )}

          {/* Back button for navigation */}
          {navigationHistory.length > 0 && onBack && (
            <button onClick={onBack} style={{
              position: 'absolute', top: 6, left: 6, zIndex: 10,
              padding: '3px 8px', fontSize: 9, fontWeight: 700, border: 'none',
              borderRadius: 10, background: 'rgba(0,0,0,0.5)', color: '#fff',
              cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}>← Back</button>
          )}

          {/* Screen name overlay */}
          {activeScreen && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              padding: '20px 12px 10px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{activeScreen.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Mono', monospace" }}>
                {activeScreen.beat || activeScreen.description?.slice(0, 40)}
              </div>
            </div>
          )}
        </div>

        {/* Home button */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: currentSkin.btn, margin: '8px auto 0',
        }} />
      </div>
      )}

      {/* Skin picker */}
      {onChangeSkin && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PHONE_SKINS.map(s => (
            <button
              key={s.key}
              title={s.label}
              onClick={() => onChangeSkin(s.key)}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: skin === s.key ? '2.5px solid #B8962E' : '1.5px solid #ddd',
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
        <div style={{ fontSize: 11, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#B8962E', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 9 }}>SCREENS</span>
          Full phone views
        </div>
        <div className="phone-hub-screen-grid">
          {SCREEN_TYPES.filter(t => t.type === 'screen').map(type => (
            <ScreenCard key={type.key} type={type} screen={getScreenForType(type)} activeScreen={activeScreen} onSelectScreen={onSelectScreen} globalFit={globalFit} />
          ))}
          {customScreens.map(s => (
            <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '📄', desc: s.description || 'Custom screen' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} globalFit={globalFit} />
          ))}
        </div>

        {/* Icons Section */}
        {(gridFilter === 'all' || gridFilter === 'icon') && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#a889c8', fontFamily: "'DM Mono', monospace", marginBottom: 8, marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#a889c8', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 9 }}>ICONS</span>
              App icons for home screen links
            </div>
            <div className="phone-hub-icon-grid">
              {SCREEN_TYPES.filter(t => t.type === 'icon').map(type => (
                <ScreenCard key={type.key} type={type} screen={getScreenForType(type)} activeScreen={activeScreen} onSelectScreen={onSelectScreen} globalFit={globalFit} isIcon />
              ))}
              {customIcons.map(s => (
                <ScreenCard key={s.id} type={{ key: s.id, label: s.name, icon: '🎨', desc: s.description || 'Custom icon' }} screen={s} activeScreen={activeScreen} onSelectScreen={onSelectScreen} globalFit={globalFit} isIcon />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        .phone-hub-inner { display: flex; gap: 24px; align-items: flex-start; }
        .phone-hub-device { display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; }
        .phone-hub-frame { width: 280px; position: relative; }
        .phone-hub-grid-section { flex: 1; min-width: 0; }
        .phone-hub-screen-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px;
        }
        .phone-hub-icon-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;
        }

        @media (max-width: 1024px) {
          .phone-hub-inner { gap: 16px; }
          .phone-hub-frame { width: 240px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
        }
        @media (max-width: 768px) {
          .phone-hub-inner { flex-direction: column; align-items: stretch; }
          .phone-hub-device { align-items: center; }
          .phone-hub-frame { width: 240px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
          .phone-hub-icon-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; }
        }
        @media (max-width: 480px) {
          .phone-hub-frame { width: 200px; }
          .phone-hub-inner { gap: 12px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .phone-hub-icon-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
        }
        @media (max-width: 375px) {
          .phone-hub-frame { width: 170px; }
          .phone-hub-screen-grid { grid-template-columns: repeat(2, 1fr); }
          .phone-hub-icon-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

function ScreenCard({ type, screen, activeScreen, onSelectScreen, globalFit, isIcon }) {
  const isActive = activeScreen?.id === screen?.id && screen;
  const hasImage = screen?.generated && screen?.url;
  const accentColor = isIcon ? '#a889c8' : '#B8962E';

  return (
    <div
      onClick={() => screen ? onSelectScreen(screen) : onSelectScreen({ ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true })}
      style={{
        background: isActive ? '#2C2C2C' : hasImage ? '#fff' : '#faf8f5',
        border: `1px solid ${isActive ? accentColor : hasImage ? '#e8e0d0' : '#f0ece4'}`,
        borderRadius: isIcon ? 10 : 12, padding: isIcon ? 8 : 10,
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
        minHeight: isIcon ? 44 : 'auto',
      }}
    >
      {/* Thumbnail preview */}
      {hasImage && (
        <div style={{
          width: '100%', aspectRatio: isIcon ? '1/1' : '9/16',
          borderRadius: 8, overflow: 'hidden',
          marginBottom: 6, background: '#f0f0f0',
        }}>
          <img src={screen.url} alt={type.label}
            style={isIcon ? { width: '100%', height: '100%', objectFit: 'contain' } : getScreenImageStyle(screen, globalFit)} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: isIcon ? 5 : 6, minWidth: 0 }}>
        <span style={{ fontSize: isIcon ? 14 : 18, flexShrink: 0 }}>{type.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isIcon ? 10 : 12, fontWeight: 600, color: isActive ? '#fff' : '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {type.label}
          </div>
          {!isIcon && (
            <div style={{ fontSize: 9, color: isActive ? 'rgba(255,255,255,0.6)' : '#999', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {type.desc}
            </div>
          )}
        </div>
      </div>

      {/* Status dot */}
      <div style={{
        position: 'absolute', top: isIcon ? 5 : 8, right: isIcon ? 5 : 8,
        width: 7, height: 7, borderRadius: '50%',
        background: hasImage ? '#16a34a' : screen ? '#eab308' : '#e0e0e0',
      }} />
    </div>
  );
}

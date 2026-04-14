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

const SCREEN_TYPES = [
  // ── Core ──
  { key: 'home', label: 'Home', icon: '📱', desc: 'App icons & notifications' },
  { key: 'feed', label: 'Feed', icon: '📰', desc: 'Scrolling posts' },
  { key: 'messages', label: 'Messages', icon: '✉️', desc: 'Text conversations' },
  { key: 'dm', label: 'DMs', icon: '💬', desc: 'Private messages' },
  { key: 'story', label: 'Stories', icon: '⭕', desc: 'Watching stories' },
  { key: 'profile', label: 'Profile', icon: '👤', desc: 'Viewing someone' },
  // ── Communication ──
  { key: 'calls', label: 'Calls', icon: '📞', desc: 'Call history & FaceTime' },
  { key: 'contacts', label: 'Contacts', icon: '👥', desc: 'Contact list' },
  { key: 'comments', label: 'Comments', icon: '💭', desc: 'Post reactions' },
  { key: 'live', label: 'Live', icon: '🔴', desc: 'Going live' },
  { key: 'notif', label: 'Alerts', icon: '🔔', desc: 'Notification center' },
  // ── Business ──
  { key: 'brand_deals', label: 'Brand Deals', icon: '🤝', desc: 'Sponsorship offers' },
  { key: 'stats', label: 'Stats', icon: '📊', desc: 'Analytics & metrics' },
  { key: 'creator_hub', label: 'Creator Hub', icon: '🎨', desc: 'Content management' },
  { key: 'deadlines', label: 'Deadlines', icon: '⏰', desc: 'Upcoming due dates' },
  { key: 'tasks', label: 'Tasks', icon: '✅', desc: 'To-do & reminders' },
  // ── Lifestyle ──
  { key: 'wardrobe', label: 'Closet', icon: '👗', desc: 'Outfit selection' },
  { key: 'accessories', label: 'Accessories', icon: '💎', desc: 'Jewelry & extras' },
  { key: 'shop', label: 'Shopping', icon: '🛍️', desc: 'Browsing items' },
  { key: 'camera', label: 'Camera', icon: '📸', desc: 'Taking content' },
  // ── World ──
  { key: 'map', label: 'Map', icon: '🗺️', desc: 'DREAM map' },
  { key: 'invite', label: 'Invitation', icon: '💌', desc: 'Event invitations' },
  { key: 'settings', label: 'Settings', icon: '⚙️', desc: 'Phone settings' },
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

export { SCREEN_TYPES, PHONE_SKINS };

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

export default function PhoneHub({ screens = [], activeScreen, onSelectScreen, onNavigate, navigationHistory = [], onBack, skin = 'midnight', onChangeSkin, customFrameUrl }) {
  const currentSkin = PHONE_SKINS.find(s => s.key === skin) || PHONE_SKINS[0];

  // Match screens to screen types
  const getScreenForType = (type) => {
    return screens.find(s =>
      (s.beat || '').toLowerCase().includes(type.key) ||
      (s.name || '').toLowerCase().includes(type.key) ||
      (s.name || '').toLowerCase().includes(type.label.toLowerCase())
    );
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Phone Device */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      {customFrameUrl ? (
        /* Custom uploaded phone frame */
        <div style={{ width: 280, position: 'relative' }}>
          <img src={customFrameUrl} alt="Phone frame" style={{ width: '100%', borderRadius: 24 }} />
          {/* Screen overlay positioned inside the frame */}
          <div style={{
            position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {activeScreen?.url ? (
              <>
                <img src={activeScreen.url} alt={activeScreen.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        </div>
      ) : (
        /* Built-in phone frame with skin */
        <div style={{
          width: 280,
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
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {PHONE_SKINS.map(s => (
            <button
              key={s.key}
              title={s.label}
              onClick={() => onChangeSkin(s.key)}
              style={{
                width: 20, height: 20, borderRadius: '50%', border: skin === s.key ? '2px solid #B8962E' : '1px solid #ddd',
                background: typeof s.body === 'string' && s.body.startsWith('linear') ? undefined : s.body,
                backgroundImage: typeof s.body === 'string' && s.body.startsWith('linear') ? s.body : undefined,
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      )}
      </div>

      {/* Screen Slots Grid */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
          PHONE SCREENS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
          {SCREEN_TYPES.map(type => {
            const screen = getScreenForType(type);
            const isActive = activeScreen?.id === screen?.id && screen;
            const hasImage = screen?.generated && screen?.url;

            return (
              <div
                key={type.key}
                onClick={() => screen ? onSelectScreen(screen) : onSelectScreen({ ...type, id: type.key, name: type.label, beat: type.key, description: type.desc, placeholder: true })}
                style={{
                  background: isActive ? '#2C2C2C' : hasImage ? '#fff' : '#faf8f5',
                  border: `1px solid ${isActive ? '#B8962E' : hasImage ? '#e8e0d0' : '#f0ece4'}`,
                  borderRadius: 10, padding: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Thumbnail preview */}
                {hasImage && (
                  <div style={{
                    width: '100%', aspectRatio: '9/16',
                    borderRadius: 6, overflow: 'hidden',
                    marginBottom: 6, background: '#f0f0f0',
                  }}>
                    <img src={screen.url} alt={type.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{type.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#fff' : '#2C2C2C' }}>
                      {type.label}
                    </div>
                    <div style={{ fontSize: 8, color: isActive ? 'rgba(255,255,255,0.6)' : '#999', fontFamily: "'DM Mono', monospace" }}>
                      {type.desc}
                    </div>
                  </div>
                </div>

                {/* Status dot */}
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: hasImage ? '#16a34a' : screen ? '#eab308' : '#e0e0e0',
                }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

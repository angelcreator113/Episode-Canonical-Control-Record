/**
 * PhoneHub — Visual phone device frame with screen slots
 *
 * Shows a phone device with the currently selected screen overlay.
 * Clicking screen slots on the side switches the active screen.
 *
 * Props:
 *   screens       — array of overlay objects (the phone screens)
 *   activeScreen  — currently displayed screen overlay
 *   onSelectScreen(overlay) — callback when a screen slot is clicked
 *   deviceFrame   — optional custom device frame image URL
 */
import React from 'react';

const SCREEN_TYPES = [
  { key: 'home', label: 'Home', icon: '📱', desc: 'App icons & notifications' },
  { key: 'feed', label: 'Feed', icon: '📰', desc: 'Scrolling posts' },
  { key: 'dm', label: 'DMs', icon: '💬', desc: 'Private messages' },
  { key: 'invite', label: 'Invitation', icon: '💌', desc: 'Event invitations' },
  { key: 'wardrobe', label: 'Closet', icon: '👗', desc: 'Outfit selection' },
  { key: 'comments', label: 'Comments', icon: '💭', desc: 'Post reactions' },
  { key: 'story', label: 'Stories', icon: '⭕', desc: 'Watching stories' },
  { key: 'profile', label: 'Profile', icon: '👤', desc: 'Viewing someone' },
  { key: 'notif', label: 'Alerts', icon: '🔔', desc: 'Notification center' },
  { key: 'camera', label: 'Camera', icon: '📸', desc: 'Taking content' },
  { key: 'shop', label: 'Shopping', icon: '🛍️', desc: 'Browsing items' },
  { key: 'live', label: 'Live', icon: '🔴', desc: 'Going live' },
  { key: 'map', label: 'Map', icon: '🗺️', desc: 'DREAM map' },
];

export { SCREEN_TYPES };

export default function PhoneHub({ screens = [], activeScreen, onSelectScreen }) {
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
      <div style={{
        width: 280, flexShrink: 0,
        background: '#1a1a2e',
        borderRadius: 32,
        padding: '12px 8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          width: 80, height: 6, borderRadius: 3,
          background: '#333', margin: '0 auto 8px',
        }} />

        {/* Screen */}
        <div style={{
          width: '100%', aspectRatio: '9/16',
          borderRadius: 20, overflow: 'hidden',
          background: activeScreen?.url ? 'transparent' : 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)',
          position: 'relative',
        }}>
          {activeScreen?.url ? (
            <img
              src={activeScreen.url}
              alt={activeScreen.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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
          background: '#444', margin: '8px auto 0',
        }} />
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

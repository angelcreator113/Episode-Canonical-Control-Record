import { PHONE_SKINS } from '../PhoneHub';

/**
 * Shared phone chrome. Renders device body, side buttons, dynamic island,
 * home indicator. `children` render inside the screen area — callers
 * control screen content (image, overlays, back button, etc.) themselves.
 *
 * Two render modes:
 *   - Built-in skin (default): iPhone-style frame tinted by `skin` key
 *   - Custom frame: caller's uploaded PNG sits on top of screen content
 *     (screen inset 6% from each edge, behind the frame image)
 *
 * This replaces chrome previously duplicated across PhoneHub.jsx:380-543,
 * ScreenLinkEditor.jsx:611-790, and PhonePreviewMode.jsx:416-432.
 */
export default function PhoneFrame({
  skin = 'midnight',
  customFrameUrl,
  onCustomFrameLoad,
  onCustomFrameError,
  className = '',
  children,
}) {
  const useCustom = Boolean(customFrameUrl);
  const currentSkin =
    PHONE_SKINS.find(s => s.key === skin) || PHONE_SKINS[0];

  if (useCustom) {
    return (
      <div className={`phone-hub-frame ${className}`.trim()}>
        {/* Screen content sits behind the frame, inset 6% */}
        <div
          style={{
            position: 'absolute',
            top: '6%',
            left: '6%',
            right: '6%',
            bottom: '6%',
            borderRadius: 16,
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          {children}
        </div>
        {/* Frame image — on top so it visually wraps the screen content */}
        <img
          src={customFrameUrl}
          alt="Phone frame"
          onLoad={onCustomFrameLoad}
          onError={onCustomFrameError}
          style={{
            width: '100%',
            borderRadius: 24,
            display: 'block',
            position: 'relative',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`phone-hub-frame ${className}`.trim()}
      style={{
        background: currentSkin.body,
        borderRadius: 44,
        padding: '16px 12px 20px',
        boxShadow: `0 8px 32px ${currentSkin.shadow}, inset 0 1px 0 ${currentSkin.accent}, 0 0 0 2px rgba(0,0,0,0.3)`,
        position: 'relative',
        border: '2px solid rgba(0,0,0,0.5)',
      }}
    >
      {/* Side buttons — volume + power */}
      <div style={{ position: 'absolute', left: -5, top: '18%', width: 4, height: 28, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
      <div style={{ position: 'absolute', left: -5, top: '26%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
      <div style={{ position: 'absolute', left: -5, top: '34%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
      <div style={{ position: 'absolute', right: -5, top: '24%', width: 4, height: 64, background: currentSkin.btn, borderRadius: '0 3px 3px 0', border: '1px solid rgba(0,0,0,0.3)', borderLeft: 'none' }} />

      {/* Screen area */}
      <div
        style={{
          width: '100%',
          aspectRatio: '9/19.5',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#000',
          position: 'relative',
          border: '2.5px solid #111',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.4)',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 90,
            height: 24,
            borderRadius: 14,
            background: '#000',
            zIndex: 5,
            border: '1.5px solid #333',
          }}
        >
          {/* Camera dot */}
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#1a1a2e',
              border: '1px solid #333',
            }}
          />
        </div>

        {children}

        {/* Home indicator bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 5,
            boxShadow: '0 0 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  );
}

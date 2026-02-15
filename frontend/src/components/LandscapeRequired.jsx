import React, { useState, useEffect } from 'react';
import './LandscapeRequired.css';

/**
 * LandscapeRequired — overlay that blocks portrait usage on mobile.
 * Wraps children and shows a "rotate your phone" prompt when
 * the viewport is portrait AND narrower than 768px.
 */
function LandscapeRequired({ children }) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };

    check();
    window.addEventListener('resize', check);
    // Also detect orientation change on mobile
    window.addEventListener('orientationchange', () => setTimeout(check, 100));

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', () => setTimeout(check, 100));
    };
  }, []);

  return (
    <>
      {isPortrait && (
        <div className="landscape-overlay">
          <div className="landscape-overlay-content">
            <div className="landscape-phone-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="14" y="8" width="36" height="48" rx="4" stroke="white" strokeWidth="2.5" fill="none" />
                <circle cx="32" cy="50" r="2" fill="white" />
                <path d="M52 16L12 48" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                {/* Rotation arrow */}
                <path d="M50 32 C50 20 42 12 32 12" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M50 32 L47 27 M50 32 L54 28" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="landscape-title">Rotate Your Phone</h3>
            <p className="landscape-message">
              This feature works best in landscape mode.
              Please turn your device sideways to continue.
            </p>
          </div>
        </div>
      )}
      <div style={isPortrait ? { display: 'none' } : undefined}>
        {children}
      </div>
    </>
  );
}

export default LandscapeRequired;

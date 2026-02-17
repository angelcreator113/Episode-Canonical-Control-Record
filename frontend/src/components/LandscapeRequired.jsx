import React, { useState, useEffect } from 'react';
import './LandscapeRequired.css';

/**
 * OrientationLock — overlay that blocks incorrect orientation on mobile/tablet.
 * Wraps children and shows a "rotate your device" prompt when
 * the viewport orientation doesn't match the required orientation
 * AND the screen is narrower than 1024px.
 * 
 * @param {string} requiredOrientation - 'landscape' or 'portrait' (default: 'landscape')
 */
function LandscapeRequired({ children, requiredOrientation = 'landscape' }) {
  const [isCorrectOrientation, setIsCorrectOrientation] = useState(true);

  useEffect(() => {
    const check = () => {
      const isSmallScreen = window.innerWidth < 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      
      // Check if current orientation matches required
      const correctOrientation = requiredOrientation === 'landscape' ? isLandscape : !isLandscape;
      
      // Only show overlay on small screens with wrong orientation
      setIsCorrectOrientation(!isSmallScreen || correctOrientation);
    };

    check();
    window.addEventListener('resize', check);
    // Also detect orientation change on mobile
    const handleOrientationChange = () => setTimeout(check, 100);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [requiredOrientation]);

  const orientationLabel = requiredOrientation === 'landscape' ? 'landscape' : 'portrait';
  const rotateMessage = requiredOrientation === 'landscape' 
    ? 'Please turn your device sideways to continue.'
    : 'Please hold your device upright to continue.';

  return (
    <>
      {!isCorrectOrientation && (
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
            <h3 className="landscape-title">Rotate Your Device</h3>
            <p className="landscape-message">
              This feature works best in <strong>{orientationLabel}</strong> mode.
              {' '}{rotateMessage}
            </p>
          </div>
        </div>
      )}
      <div style={!isCorrectOrientation ? { display: 'none' } : undefined}>
        {children}
      </div>
    </>
  );
}

export default LandscapeRequired;

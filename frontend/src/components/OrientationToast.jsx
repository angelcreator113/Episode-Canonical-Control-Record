import React, { useState, useEffect, useRef } from 'react';
import useOrientation from '../hooks/useOrientation';
import './OrientationToast.css';

/**
 * OrientationToast — shows a brief, helpful toast when the phone rotates.
 * Place this once in your App component.
 */
export default function OrientationToast() {
  const { orientation, isMobile, isLandscape, isPortrait } = useOrientation();
  const [toast, setToast] = useState(null);
  const prevOrientation = useRef(orientation);
  const timeoutRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't toast on first render or on desktop
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevOrientation.current = orientation;
      return;
    }

    if (!isMobile) return;
    if (orientation === prevOrientation.current) return;

    prevOrientation.current = orientation;

    // Clear existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const message = isLandscape
      ? { icon: '📱↔️', text: 'Landscape mode — great for editing!' }
      : { icon: '📱↕️', text: 'Portrait mode — perfect for browsing!' };

    setToast(message);

    timeoutRef.current = setTimeout(() => setToast(null), 2500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [orientation, isMobile, isLandscape, isPortrait]);

  if (!toast) return null;

  return (
    <div className={`orientation-toast ${toast ? 'visible' : ''}`}>
      <span className="orientation-toast-icon">{toast.icon}</span>
      <span className="orientation-toast-text">{toast.text}</span>
    </div>
  );
}

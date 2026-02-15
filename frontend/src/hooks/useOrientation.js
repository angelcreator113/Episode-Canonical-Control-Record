import { useState, useEffect, useCallback } from 'react';

/**
 * useOrientation — detects device orientation and screen rotation.
 * Returns:
 *   - orientation: 'portrait' | 'landscape'
 *   - isPortrait: boolean
 *   - isLandscape: boolean
 *   - isMobile: boolean (< 768px in portrait, < 1024px in landscape)
 *   - angle: rotation angle (0, 90, 180, 270)
 */
export default function useOrientation() {
  const getState = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const orientation = h > w ? 'portrait' : 'landscape';

    // Try to get the rotation angle
    let angle = 0;
    if (screen.orientation && screen.orientation.angle != null) {
      angle = screen.orientation.angle;
    } else if (window.orientation != null) {
      angle = Math.abs(window.orientation);
    }

    // Determine if mobile based on the shorter dimension
    const shortSide = Math.min(w, h);
    const isMobile = shortSide < 768;

    return {
      orientation,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      isMobile,
      angle,
      width: w,
      height: h,
    };
  }, []);

  const [state, setState] = useState(getState);

  useEffect(() => {
    const update = () => {
      // Small debounce to let the browser finish rotating
      requestAnimationFrame(() => setState(getState()));
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', () => setTimeout(update, 100));

    if (screen.orientation) {
      screen.orientation.addEventListener('change', update);
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', () => setTimeout(update, 100));
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', update);
      }
    };
  }, [getState]);

  return state;
}

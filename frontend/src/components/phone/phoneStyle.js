/**
 * phoneStyle — the phone's shared styling helpers (Task #1987, C2a).
 *
 * PHONE_SKINS and getScreenImageStyle, moved verbatim from PhoneHub so phone
 * components can use them without importing PhoneHub. PhoneHub re-exports
 * both for compatibility.
 */

export const PHONE_SKINS = [
  { key: 'midnight', label: 'Midnight', body: '#1a1a2e', notch: '#333', btn: '#444', shadow: 'rgba(0,0,0,0.3)', accent: 'rgba(255,255,255,0.1)' },
  { key: 'rosegold', label: 'Rose Gold', body: 'linear-gradient(135deg, #e8c4b8, #d4a090)', notch: '#c99585', btn: '#c99585', shadow: 'rgba(180,120,100,0.3)', accent: 'rgba(255,255,255,0.25)' },
  { key: 'gold', label: 'Gold', body: 'linear-gradient(135deg, #d4b896, #c9a84c)', notch: '#b89060', btn: '#b89060', shadow: 'rgba(184,150,46,0.3)', accent: 'rgba(255,255,255,0.2)' },
  { key: 'silver', label: 'Silver', body: 'linear-gradient(135deg, #e8e8ec, #c0c0c8)', notch: '#b0b0b8', btn: '#b0b0b8', shadow: 'rgba(100,100,120,0.2)', accent: 'rgba(255,255,255,0.4)' },
  { key: 'white', label: 'White', body: '#f5f5f7', notch: '#e0e0e4', btn: '#e0e0e4', shadow: 'rgba(0,0,0,0.1)', accent: 'rgba(255,255,255,0.6)' },
  { key: 'pink', label: 'Pink', body: 'linear-gradient(135deg, #f0c4d4, #d4789a)', notch: '#c06888', btn: '#c06888', shadow: 'rgba(212,120,154,0.3)', accent: 'rgba(255,255,255,0.2)' },
  { key: 'lavender', label: 'Lavender', body: 'linear-gradient(135deg, #d4c4e8, #a889c8)', notch: '#9878b8', btn: '#9878b8', shadow: 'rgba(168,137,200,0.3)', accent: 'rgba(255,255,255,0.2)' },
];

// Build image style from screen's fit settings.
//
// Cascade (highest precedence first, same rule applied in editor + player):
//   1. screen.image_fit or screen.metadata.image_fit — per-screen override set
//      by the creator in the Image Fit tab of the detail panel.
//   2. globalFit — device-level default stored on the show via
//      /api/v1/ui-overlays/:showId/frame and reapplied by PhonePreviewMode and
//      PhoneHub via the `globalFit` prop.
//   3. Built-in defaults: mode='cover', scale=100, offsetX/Y=0.
// Any field missing at a given tier falls through to the next tier.
export function getScreenImageStyle(screen, globalFit) {
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

/**
 * The two faces of a reveal on The Pulse (Task 2939; spec §5). FirstLook
 * labels what it wraps "First look" before its moment. Evoni, 2026-10-12
 * (Task 3034): the image inside is already the teaser, cut by the server
 * from the full one (a detail, or the whole blurred), so nothing is blurred
 * here and the full image never reaches the page; style is 'crop' or 'blur'.
 * RevealChip tells Director view when an item reveals.
 * Styles: pages/SocialMediaPage.css (pl-first-look, pl-reveal-chip).
 */
import React from 'react';
import { Sparkles, EyeOff } from 'lucide-react';

export function FirstLook({ active, children, className = '', style = 'crop' }) {
  if (!active) return children;
  const kind = style === 'blur' ? 'blur' : 'crop';
  return (
    <div className={`pl-first-look pl-first-look-${kind} ${className}`} data-testid="pl-first-look" data-style={kind}>
      <div className="pl-first-look-media" aria-hidden="true">{children}</div>
      <span className="pl-first-look-label"><Sparkles size={14} aria-hidden="true" /> First look</span>
    </div>
  );
}

export function RevealChip({ label }) {
  if (!label) return null;
  return (
    <span className="pl-reveal-chip" data-testid="pl-reveal-chip">
      <EyeOff size={12} aria-hidden="true" /> Reveals: {label}
    </span>
  );
}

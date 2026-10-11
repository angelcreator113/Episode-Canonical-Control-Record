/**
 * The two faces of a reveal on The Pulse (Task 2939; spec §5; Evoni,
 * 2026-10-11: teasers are blurred). FirstLook blurs what it wraps and labels
 * it "First look" before its moment; RevealChip tells Director view when an
 * item reveals. Styles: pages/SocialMediaPage.css (pl-first-look, pl-reveal-chip).
 */
import React from 'react';
import { Sparkles, EyeOff } from 'lucide-react';

export function FirstLook({ active, children, className = '' }) {
  if (!active) return children;
  return (
    <div className={`pl-first-look ${className}`} data-testid="pl-first-look">
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

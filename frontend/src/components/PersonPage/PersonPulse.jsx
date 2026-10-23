/**
 * Their Pulse account, inside the Voice & Pulse tab's "Pulse behavior"
 * card (Evoni, 2026-10-23: nothing shown twice): the card keeps its handle
 * and followers; the person read (GET /api/v1/person/:id) adds their
 * follower tier, their tie to Lala ("from their relationship" when their
 * story pair with her decides it) and a link to the profile.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './PersonPulse.css';

export const TIER_LABELS = { emerging: 'Emerging', nano: 'Nano', micro: 'Micro', mid: 'Mid-tier', macro: 'Macro', mega: 'Mega' };

/** "Micro · 48K": the tier before the count the card already reads; the count alone without a tier. */
export function followersWithTier(pulse, count) {
  const tier = pulse?.follower_tier ? TIER_LABELS[pulse.follower_tier] || pulse.follower_tier : null;
  return [tier, count || pulse?.follower_count || null].filter(Boolean).join(' · ') || null;
}

/** Their tie to Lala as one line; nothing for Lala herself or with no tie. */
export function PulseLalaTie({ lalaTie, isLala = false }) {
  if (isLala || !lalaTie) return null;
  return (
    <p className="ppu-tie" data-testid="person-lala-tie">
      <span className="ppu-label">With Lala</span> {lalaTie.words}
      {lalaTie.from === 'story' && <span className="ppu-from"> (from their relationship)</span>}
    </p>
  );
}

/** The link to their Pulse profile. */
export function PulseProfileLink({ pulse }) {
  if (!pulse?.link) return null;
  return <Link className="ch-link ppu-open" to={pulse.link}>Open their Pulse profile <ArrowRight size={14} aria-hidden="true" /></Link>;
}

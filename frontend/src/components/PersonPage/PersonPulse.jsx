/**
 * Person tab, section 2: their Pulse account (registry_characters.
 * feed_profile_id): handle, followers, their tie to Lala and a link to the
 * profile. With none, "Not on the Pulse yet" and where to match one (The
 * cast, as the Settings tab says).
 */
import { Link } from 'react-router-dom';
import { Smartphone, ArrowRight } from 'lucide-react';
import { atHandle, platformLabel } from '../../pages/feed/feedConstants';
import './PersonPulse.css';

export const TIER_LABELS = { emerging: 'Emerging', nano: 'Nano', micro: 'Micro', mid: 'Mid-tier', macro: 'Macro', mega: 'Mega' };

export default function PersonPulse({ pulse, lalaTie, isLala }) {
  const head = <h2 id="ppu-h" className="ch-h2"><Smartphone size={20} aria-hidden="true" className="ch-h2-icon" /> Their Pulse account</h2>;
  if (!pulse) {
    return (
      <section className="ch-card ppu" aria-labelledby="ppu-h" data-testid="person-pulse">
        {head}
        <p className="ppu-none">Not on the Pulse yet.</p>
        {lalaTie && <p className="ch-note">With Lala in the story: {lalaTie.words}</p>}
        <Link className="ch-btn-soft ppu-link" to="/character-registry">Match them to a Pulse person on The cast</Link>
      </section>
    );
  }
  const followers = [pulse.follower_tier ? TIER_LABELS[pulse.follower_tier] || pulse.follower_tier : null, pulse.follower_count].filter(Boolean).join(' · ');
  return (
    <section className="ch-card ppu" aria-labelledby="ppu-h" data-testid="person-pulse">
      {head}
      <p className="ppu-who">
        <strong className="ppu-handle">{atHandle(pulse.handle)}</strong>
        {pulse.display_name && <span>{pulse.display_name}</span>}
        {pulse.platform && <span className="ppu-plat">{platformLabel(pulse.platform)}</span>}
      </p>
      <dl className="ppu-list">
        <div className="ppu-row"><dt>Followers</dt><dd>{followers || <span className="ch-note">Not set</span>}</dd></div>
        {!isLala && (
          <div className="ppu-row">
            <dt>With Lala</dt>
            <dd>
              {lalaTie ? lalaTie.words : <span className="ch-note">No tie to Lala yet</span>}
              {lalaTie?.from === 'story' && <span className="ppu-from"> (from their relationship)</span>}
            </dd>
          </div>
        )}
      </dl>
      <Link className="ch-link ppu-open" to={pulse.link}>Open their Pulse profile <ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}

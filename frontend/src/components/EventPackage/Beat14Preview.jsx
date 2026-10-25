/**
 * Beat14Preview — what beat 14 can offer from this event (Evoni,
 * 2026-10-25): "This event's host can offer: Maison Velour SS27 campaign
 * (best fit)", from GET …/flow's beat14 (the ranking beat 14's own picker
 * uses, services/beat14Fit). Links to the episode's Script tab once the
 * event has one. Read-only.
 */
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { beat14Line } from '../../lib/eventActions';
import './EventFlow.css';

export default function Beat14Preview({ beat14, episodeId = null }) {
  const line = beat14Line(beat14, { hasEpisode: !!episodeId });
  if (!line) return null;
  return (
    <div className={`eff-card eff-beat14 is-${line.tone}`} data-testid="beat14-preview">
      <span className="eff-card-label"><Gift size={13} aria-hidden="true" /> Beat 14 opportunity</span>
      <p className="eff-card-line">
        <span>{line.lead}</span>
        {line.name && <> <strong data-testid="beat14-name">{line.name}</strong></>}
        {line.tag && <span className="eff-tag" data-testid="beat14-tag">{line.tag}</span>}
      </p>
      {line.note && <p className="eff-card-sub">{line.note}</p>}
      {episodeId && (
        <Link className="eff-card-link" to={`/episodes/${episodeId}?tab=scripts`} data-testid="beat14-open-script">Open the Script tab, beat 14 →</Link>
      )}
    </div>
  );
}

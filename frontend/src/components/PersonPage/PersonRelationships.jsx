/**
 * One relationship's story truth, inside its row on the Connections tab
 * (Evoni, 2026-10-23): its stage now, a heart for a love interest,
 * Secret / Rumoured / Known and who knows (known_by, public_state), and
 * "Different online" when their Pulse pair says something else
 * (services/relationshipTruth), with a link to it on the Relationships
 * page. From the person read (GET /api/v1/person/:id relationships).
 */
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import './PersonRelationships.css';

const listOf = (names) => (names.length <= 1 ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export function knowsLine(r) {
  if (!r.known_by?.length) return r.public_state === 'secret' ? 'Only the two of them know.' : null;
  return `${listOf(r.known_by)} ${r.known_by.length === 1 ? 'knows' : 'know'}.`;
}

/** The heart before a love interest's name; nothing otherwise. */
export function LoveHeart({ rel }) {
  return rel?.love_interest ? <Heart size={15} className="prl-heart" aria-label="Love interest" role="img" fill="currentColor" /> : null;
}

export default function PersonRelationship({ rel }) {
  if (!rel) return null;
  const knows = knowsLine(rel);
  return (
    <span className="prl" data-testid={`prl-${rel.id}`}>
      <span className="prl-tags">
        {rel.stage && <span className="prl-tag is-stage">now {rel.stage}</span>}
        {rel.public_label && <span className={`prl-tag is-${rel.public_state}`}>{rel.public_label}</span>}
        {rel.online?.differs && <span className="prl-tag is-differs" title={`On The Pulse: ${rel.online.says}`}>Different online</span>}
      </span>
      {(knows || rel.online?.differs) && (
        <span className="prl-sub">
          {knows}
          {rel.online?.differs && <span className="prl-online"> On The Pulse: {rel.online.says}.</span>}
        </span>
      )}
      <Link className="ch-link prl-open" to={rel.link}>Open in Relationships <ArrowRight size={13} aria-hidden="true" /></Link>
    </span>
  );
}

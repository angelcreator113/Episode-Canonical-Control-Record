/**
 * Person tab, section 3: every confirmed relationship of theirs. Each says
 * who with, what it is and its stage now, a heart for a love interest,
 * Secret / Rumoured / Known and who knows (known_by, public_state), and
 * "Different online" when their Pulse pair says something else
 * (services/relationshipTruth). Each opens on the Relationships page.
 */
import { Link } from 'react-router-dom';
import { Users, Heart, ArrowRight } from 'lucide-react';
import './PersonRelationships.css';

const listOf = (names) => (names.length <= 1 ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export function knowsLine(r) {
  if (!r.known_by?.length) return r.public_state === 'secret' ? 'Only the two of them know.' : null;
  return `${listOf(r.known_by)} ${r.known_by.length === 1 ? 'knows' : 'know'}.`;
}

export default function PersonRelationships({ characterId, relationships }) {
  const list = relationships || [];
  return (
    <section className="ch-card prl" aria-labelledby="prl-h" data-testid="person-relationships">
      <div className="ch-card-head">
        <h2 id="prl-h" className="ch-h2"><Users size={20} aria-hidden="true" className="ch-h2-icon" /> Relationships</h2>
        <Link className="ch-link" to={`/relationships?char=${characterId}`}>Open in Relationships</Link>
      </div>
      {list.length === 0 ? (
        <p className="ch-note">No confirmed relationships yet.</p>
      ) : (
        <ul className="prl-list">
          {list.map((r) => {
            const knows = knowsLine(r);
            return (
              <li key={r.id}>
                <Link className="prl-row" to={r.link} data-testid={`prl-${r.id}`}>
                  <span className="prl-main">
                    <span className="prl-name">
                      {r.love_interest && <Heart size={15} className="prl-heart" aria-label="Love interest" role="img" fill="currentColor" />}
                      {r.other.name}
                    </span>
                    <span className="prl-kind">{r.love_interest && !/love/i.test(r.kind) ? `${r.kind} · love interest` : r.kind}</span>
                  </span>
                  <span className="prl-tags">
                    {r.stage && <span className="prl-tag is-stage">now {r.stage}</span>}
                    {r.public_label && <span className={`prl-tag is-${r.public_state}`}>{r.public_label}</span>}
                    {r.online?.differs && (
                      <span className="prl-tag is-differs" title={`On The Pulse: ${r.online.says}`}>Different online</span>
                    )}
                  </span>
                  {(knows || r.online?.differs) && (
                    <span className="prl-sub">
                      {knows}
                      {r.online?.differs && <span className="prl-online"> On The Pulse: {r.online.says}.</span>}
                    </span>
                  )}
                  <ArrowRight size={16} className="prl-go" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

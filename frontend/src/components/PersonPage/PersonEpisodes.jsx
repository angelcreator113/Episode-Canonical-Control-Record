/**
 * Person tab, section 5: the episodes they are in, newest first (their row
 * in an episode's story record, a relationship an episode moved, an event
 * they host or are a guest of). Each says what changed for them there:
 * what they knew, learned and how they changed, and what moved between
 * them and someone.
 */
import { Link } from 'react-router-dom';
import { Clapperboard, ArrowRight } from 'lucide-react';
import './PersonEpisodes.css';

const VIA = { host: 'Hosts the event', guest: 'Guest at the event', 'story record': 'In the story record', relationship: 'A relationship moved' };
export const episodeLabel = (ep) => `Episode ${ep.episode_number ?? '?'}`;

export default function PersonEpisodes({ episodes }) {
  const list = episodes || [];
  return (
    <section className="ch-card pep" aria-labelledby="pep-h" data-testid="person-episodes">
      <h2 id="pep-h" className="ch-h2"><Clapperboard size={20} aria-hidden="true" className="ch-h2-icon" /> Episode history</h2>
      {list.length === 0 ? (
        <p className="ch-note">Not in an episode yet.</p>
      ) : (
        <ol className="pep-list">
          {list.map((ep) => {
            const rec = ep.record;
            const lines = rec ? [['Knew', rec.knew], ['Learned', rec.learned], ['Changed', rec.changed]].filter(([, v]) => v) : [];
            const nothing = !lines.length && !ep.changes?.length;
            return (
              <li key={ep.id} className="pep-item" data-testid={`pep-${ep.id}`}>
                <div className="pep-head">
                  <span className="pep-num">{episodeLabel(ep)}</span>
                  {ep.title && <span className="pep-title">{ep.title}</span>}
                  <Link className="ch-link pep-go" to={ep.link}>{episodeLabel(ep)} <ArrowRight size={14} aria-hidden="true" /></Link>
                </div>
                <p className="pep-via">
                  {ep.via.map((v) => <span key={v} className="pep-tag">{VIA[v] || v}</span>)}
                  {ep.events?.map((ev) => <span key={ev.id} className="pep-event">{ev.name}</span>)}
                  {rec?.status === 'draft' && <span className="pep-tag is-draft">Record not saved yet</span>}
                </p>
                <h3 className="pep-h3">What changed for them</h3>
                {lines.length > 0 && (
                  <dl className="pep-rec">
                    {lines.map(([k, v]) => <div key={k} className="pep-rec-row"><dt>{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                )}
                {ep.changes?.length > 0 && (
                  <ul className="pep-changes">
                    {ep.changes.map((c, i) => (
                      <li key={`${c.relationship_id}-${i}`}>
                        With {c.with}{c.stage ? `: ${c.stage}` : ''}{c.note ? ` — ${c.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {nothing && <p className="ch-note">Nothing recorded for them in this episode yet.</p>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

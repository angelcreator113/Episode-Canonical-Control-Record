/**
 * Who's in this season: the Season page's Cast tab (Evoni, 2026-10-25:
 * "What else can we improve on the Season page?" … "I want them all";
 * 2026-10-26, round 3). Two cards, from what the app already saved
 * (services/seasonCast, GET .../season/cast, of the season shown):
 *
 *   Who appears where  each person with the episodes they are in, plainly
 *                      ("Truthville: E2, E11"), what they did there (hosts,
 *                      guest at, in the story) and their longest absence
 *                      ("Not seen E3 – E10"). A name links their person page
 *                      when they have a registry character.
 *   What changed       per part, the relationship changes saved for its
 *                      episodes ("Ana and Ben: friends to rivals", E7).
 *
 * Props: api, showId, season (a past season's number, from the switcher),
 * reloadKey (the roadmap), suggestionsSlot (the AI mount point "Arc
 * suggestions": an empty spot under the cards until a later step fills it).
 */
import { Link } from 'react-router-dom';
import { Users, HeartHandshake } from 'lucide-react';
import { useSeasonCast, appearanceLine, longestGap, gapText, changeText, rolesLine, personHref } from '../../lib/seasonCast';
import './SeasonCast.css';

function PersonRow({ person }) {
  const href = personHref(person);
  const gap = gapText(longestGap(person));
  const codes = appearanceLine(person).slice(person.name.length + 2);
  return (
    <li className="scast-person" data-testid={`szn-cast-person-${person.key}`}>
      <span className="scast-name">
        {href ? <Link to={href} className="scast-link">{person.name}</Link> : <strong>{person.name}</strong>}
        {person.is_lala && <span className="scast-tag">Lead</span>}
      </span>
      <span className="scast-codes" aria-label={`${person.name} is in ${codes}`}>{codes}</span>
      <span className="scast-sub">
        {person.slots.length} {person.slots.length === 1 ? 'episode' : 'episodes'} · {rolesLine(person)}
        {gap && <span className="scast-gap" data-testid={`szn-cast-gap-${person.key}`}> · {gap}</span>}
      </span>
    </li>
  );
}

export default function SeasonCast({ api, showId, season = null, reloadKey = null, suggestionsSlot = null }) {
  const { data, error, reload } = useSeasonCast({ api, showId, season, reloadKey });
  const people = data?.people || [];
  const parts = data?.parts || [];
  const changes = parts.reduce((n, p) => n + p.changes.length, 0);
  return (
    <div className="scast" data-testid="szn-cast">
      {error && (
        <p className="szn-error" role="alert">{error} <button type="button" className="szn-link-btn" onClick={reload}>Retry</button></p>
      )}
      <section className="szn-card scast-card" aria-labelledby="scast-who">
        <header className="szn-card-head">
          <h2 id="scast-who" className="szn-card-title"><Users size={20} aria-hidden="true" /> Who appears where</h2>
          {data && <span className="szn-muted">{people.length} {people.length === 1 ? 'person' : 'people'}</span>}
        </header>
        {!data && !error && <p className="szn-muted" role="status">Reading who is in the season…</p>}
        {data && people.length === 0 && (
          <p className="szn-muted" data-testid="szn-cast-empty">Nobody is placed yet. People show up here once a slot&apos;s event has a host or guests, or an episode&apos;s story record is saved.</p>
        )}
        {people.length > 0 && <ul className="scast-people">{people.map((p) => <PersonRow key={p.key} person={p} />)}</ul>}
      </section>

      <section className="szn-card scast-card" aria-labelledby="scast-changed">
        <header className="szn-card-head">
          <h2 id="scast-changed" className="szn-card-title"><HeartHandshake size={20} aria-hidden="true" /> Relationships that changed</h2>
          {data && <span className="szn-muted">{changes} {changes === 1 ? 'change' : 'changes'}</span>}
        </header>
        {data && (
          <div className="scast-parts">
            {parts.map((p) => (
              <div key={p.phase} className="scast-part" data-testid={`szn-cast-part-${p.phase}`}>
                <h3 className="scast-part-title">Part {p.phase}{p.title ? ` · ${p.title}` : ''} <span className="szn-muted">E{p.episode_start} – E{p.episode_end}</span></h3>
                {p.changes.length === 0 ? <p className="szn-muted">No relationship change saved in this part yet.</p> : (
                  <ul className="scast-changes">
                    {p.changes.map((c, i) => (
                      <li key={`${c.slot_number}-${i}`}>
                        <span className="scast-code">E{c.slot_number}</span>
                        <span>{changeText(c)}{c.note ? <span className="szn-muted"> · {c.note}</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {/* AI mount point: "Arc suggestions" (who to bring back, whose arc to move). Empty until a later step fills it. */}
      <div className="szn-ai-slot" data-slot="cast-arc-suggestions" data-testid="szn-slot-cast-suggestions">{suggestionsSlot}</div>
    </div>
  );
}

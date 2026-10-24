/**
 * Season Plan › a slot's panel, what else is planned there (Evoni's review,
 * 2026-10-24, items 17 and 18; planner PR 3):
 *   - the twists it plants or pays off and the secrets it hints at or
 *     reveals (GET /season/slots/:id/notes);
 *   - the relationships it needs (the Season Plan's needs, this slot's);
 *   - useEventFit: "Pencil an event" ranked by fit for this slot, best
 *     first, each with a short reason (GET /season/slots/:id/event-fit).
 * Wardrobe drops are not shown: a piece's season_unlock_episode is a
 * show-wide episode number with no season, so it has no clean link to a
 * slot of Season 2 and on.
 */
import { useEffect, useState } from 'react';
import { NeedList } from './SeasonNeeds';
import './SlotNotes.css';

/** The slot's ranked events, or null while loading or when the read failed (the plain list is used then). */
export function useEventFit(api, showId, slotId, enabled = true) {
  const [fit, setFit] = useState(null);
  useEffect(() => {
    if (!enabled || !api || !slotId) { setFit(null); return undefined; }
    let gone = false;
    setFit(null);
    api.get(`/api/v1/world/${showId}/season/slots/${slotId}/event-fit`)
      .then((r) => { if (!gone) setFit(Array.isArray(r?.data?.events) ? r.data.events : null); })
      .catch((err) => { console.error('[SlotNotes] event fit not loaded:', err?.response?.status || err?.message); if (!gone) setFit(null); });
    return () => { gone = true; };
  }, [api, showId, slotId, enabled]);
  return fit;
}

/**
 * The pencil dropdown's options: the ranked events that can be pencilled
 * (best first, "Name · reason"), else the plain list in its own order.
 */
export function rankedOptions(available, fit) {
  const list = available || [];
  if (!fit?.length) return list.map((ev) => ({ id: ev.id, label: ev.name }));
  const known = new Set(list.map((ev) => String(ev.id)));
  const ranked = fit.filter((ev) => known.has(String(ev.id)));
  const rest = list.filter((ev) => !ranked.some((r) => String(r.id) === String(ev.id)));
  return [
    ...ranked.map((ev) => ({ id: ev.id, label: ev.reason ? `${ev.name} · ${ev.reason}` : ev.name, kind: ev.reason_kind })),
    ...rest.map((ev) => ({ id: ev.id, label: ev.name })),
  ];
}

export default function SlotNotes({ api, showId, slot, needs = [], onNeedsChanged }) {
  const [notes, setNotes] = useState(null);
  useEffect(() => {
    if (!api || !slot?.id) return undefined;
    let gone = false;
    setNotes(null);
    api.get(`/api/v1/world/${showId}/season/slots/${slot.id}/notes`)
      .then((r) => { if (!gone) setNotes(r?.data || {}); })
      .catch((err) => { console.error('[SlotNotes] slot notes not loaded:', err?.response?.status || err?.message); if (!gone) setNotes({ failed: true }); });
    return () => { gone = true; };
  }, [api, showId, slot?.id]);

  const plant = notes?.twists?.plant || [];
  const payoff = notes?.twists?.payoff || [];
  const reveals = notes?.reveals || [];
  const mine = needs.filter((n) => n.slot?.id === slot?.id);
  if (!plant.length && !payoff.length && !reveals.length && !mine.length && !notes?.failed) return null;
  return (
    <div className="sln" data-testid="slot-notes">
      {(plant.length > 0 || payoff.length > 0) && (
        <div className="sln-part" data-testid="slot-notes-twists">
          <span className="sln-label">Twists here</span>
          <ul className="sln-list">
            {plant.map((t) => <li key={`p-${t.id}`}><span className="sln-tag">Plant</span> {t.title}{t.characters?.length ? <span className="sln-who"> · {t.characters.join(', ')}</span> : null}</li>)}
            {payoff.map((t) => <li key={`o-${t.id}`}><span className="sln-tag is-payoff">Pay off</span> {t.title}{t.planted_in ? <span className="sln-who"> · planted in E{t.planted_in.episode_number}</span> : null}</li>)}
          </ul>
        </div>
      )}
      {reveals.length > 0 && (
        <div className="sln-part" data-testid="slot-notes-reveals">
          <span className="sln-label">Secrets here</span>
          <ul className="sln-list">
            {reveals.map((r) => (
              <li key={r.id}><span className={`sln-tag${r.intent === 'reveal' ? ' is-reveal' : ''}`}>{r.intent === 'reveal' ? 'Reveal' : 'Hint'}</span> {r.character_name}: {r.text}</li>
            ))}
          </ul>
        </div>
      )}
      {mine.length > 0 && (
        <div className="sln-part" data-testid="slot-notes-needs">
          <span className="sln-label">Relationships it needs</span>
          <NeedList needs={mine} api={api} onChanged={onNeedsChanged} showSlot={false} label={`Relationships ${slot.label} needs`} />
        </div>
      )}
      {notes?.failed && <p className="sln-note" role="status">The twists and secrets planned here did not load.</p>}
    </div>
  );
}

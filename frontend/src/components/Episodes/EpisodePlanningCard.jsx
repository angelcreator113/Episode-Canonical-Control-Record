/**
 * Planning (Evoni, 2026-10-03, episode creation step 2): what this episode
 * inherited from its event at Start Episode, item by item, and the one next
 * decision (Generate Script →, then the production checklist). Shown at the
 * top of the Overview; an episode with no source event shows nothing.
 *
 * The event is the brief's event_id (§8(w) P2), loaded with the same GET
 * the Event Package uses. Nothing here writes.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { episodePlanning } from '../../utils/episodePlanning';

export default function EpisodePlanningCard({ episode, onOpenTab }) {
  const [source, setSource] = useState(null);
  const showId = episode?.show_id || episode?.showId || null;
  const episodeId = episode?.id || null;

  useEffect(() => {
    if (!episodeId || !showId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/v1/episode-brief/${episodeId}`);
        const eventId = data?.data?.event_id;
        if (!eventId) { if (!cancelled) setSource(null); return; }
        const res = await api.get(`/api/v1/world/${showId}/events/${eventId}`);
        if (!cancelled) setSource(res.data || null);
      } catch (err) {
        console.error('[EpisodePlanning] load failed:', err);
        if (!cancelled) setSource(null);
      }
    })();
    return () => { cancelled = true; };
  }, [episodeId, showId]);

  const plan = source?.event
    ? episodePlanning({
      episode, event: source.event, sourceProfile: source.sourceProfile,
      sceneSet: source.sceneSet, venueLocation: source.venueLocation,
    })
    : null;
  if (!plan) return null;
  const eventId = source.event.id;

  return (
    <section className="epl-card" data-testid="episode-planning">
      <div className="epl-head">
        <h2 className="epl-title">Planning</h2>
        <span className="epl-count" data-testid="episode-planning-count">{plan.done} of {plan.total} carried from the event</span>
      </div>
      <ul className="epl-items">
        {plan.items.map((it) => (
          <li key={it.key} className={`epl-item ${it.done ? 'is-done' : 'is-open'}`} data-testid={`episode-planning-${it.key}`} data-done={it.done ? 'true' : 'false'}>
            {it.done ? <CheckCircle2 size={15} aria-hidden="true" className="epl-icon" /> : <CircleDashed size={15} aria-hidden="true" className="epl-icon" />}
            <span className="epl-label">{it.label}</span>
            <span className="epl-detail">{it.detail}</span>
            {it.fix === 'package' && (
              <Link className="epl-fix" to={`/shows/${showId}/events/${eventId}`} data-testid={`episode-planning-fix-${it.key}`}>
                Choose in the Event Package
              </Link>
            )}
            {it.fix === 'wardrobe' && (
              <button type="button" className="epl-fix" onClick={() => onOpenTab?.('wardrobe')} data-testid={`episode-planning-fix-${it.key}`}>
                Choose in Wardrobe
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="epl-next">
        <span className="epl-next-label">Next</span>
        <button
          type="button" className="epl-next-btn" data-testid="episode-planning-next"
          onClick={() => onOpenTab?.(plan.next.tab)}
        >
          {plan.next.label} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

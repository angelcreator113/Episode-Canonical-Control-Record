/**
 * The Roadmap's This week view (Evoni, 2026-10-25): the next two or three
 * release days (the release schedule's dates and hand-set air dates;
 * without either, the next slots in order), each slot with its episode, its
 * production stage, what it still needs (lib/releaseBoard readiness, read
 * from the episode's full row and its Pulse posts), its event and the goals
 * it moves. Open slot opens the roadmap's slot panel. Helpers: lib/seasonWeek.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from './SeasonPageParts';
import { MovesChips } from './GoalCoverage';
import { readiness } from '../../lib/releaseBoard';
import { deadlineWarning } from '../../lib/releaseSchedule';
import { slotCardTitle } from '../../lib/seasonPage';
import { weekAhead, weekWhen, stageText, stillNeeds } from '../../lib/seasonWeek';
import './SeasonWeek.css';

/** The episode's full row (the list leaves out its thumbnail, title approval and copy) and its Pulse posts. */
function useEpisodeReadiness(api, episodeId) {
  const [full, setFull] = useState(null);
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFull(null);
    setPosts(null);
    if (!episodeId) return undefined;
    api.get(`/api/v1/episodes/${episodeId}`)
      .then((r) => { if (!cancelled) setFull(r?.data?.data || null); })
      .catch((err) => console.error('[SeasonWeek] episode load failed:', err));
    api.get(`/api/v1/feed-posts/episode/${episodeId}`)
      .then((r) => { if (!cancelled) setPosts(Array.isArray(r?.data?.data) ? r.data.data : []); })
      .catch((err) => { console.error('[SeasonWeek] feed posts load failed:', err); if (!cancelled) setPosts([]); });
    return () => { cancelled = true; };
  }, [api, episodeId]);
  return { full, posts };
}

function WeekItem({ item, api, showId, events, moves, onOpen }) {
  const { slot, row } = item;
  const { full, posts } = useEpisodeReadiness(api, item.episode?.id || null);
  const episode = item.episode ? { ...item.episode, ...(full && full.id === item.episode.id ? full : {}) } : null;
  const ready = episode ? readiness(episode, posts, row) : null;
  const needs = ready ? stillNeeds(ready) : null;
  const warning = row ? deadlineWarning(row, posts == null ? null : ready) : null;
  const ev = slot.event ? (events || []).find((e) => e.id === slot.event.id) || slot.event : null;
  const n = slot.slot_number;
  return (
    <li className={`szw-item is-${slot.state || 'needs_event'}`} data-testid={`szw-item-${n}`}>
      <header className="szw-head">
        <span className={`szw-when${item.source === 'preview' ? ' is-preview' : ''}`} data-testid={`szw-when-${n}`}>{weekWhen(item)}</span>
        <StatusChip state={slot.state} />
      </header>
      <h3 className="szw-title"><span className="szw-num">E{n}</span> {slotCardTitle(slot)}</h3>
      {warning && <p className={`szw-warn is-${warning.tone}`} role="status" data-testid={`szw-warn-${n}`}>{warning.text}</p>}
      <dl className="szw-facts">
        <div>
          <dt>Stage</dt>
          <dd data-testid={`szw-stage-${n}`}>{episode ? stageText(episode) : 'No episode yet'}</dd>
        </div>
        <div>
          <dt>Still needs</dt>
          <dd data-testid={`szw-needs-${n}`}>
            {!episode ? (ev ? 'An episode made from its event' : 'An event, then an episode')
              : posts == null ? 'Checking…'
                : needs.length ? needs.join(', ') : 'Has everything it needs'}
          </dd>
        </div>
        <div>
          <dt>Event</dt>
          <dd data-testid={`szw-event-${n}`}>
            {ev ? <Link className="szw-link" to={`/shows/${showId}/events/${ev.id}`}>{ev.name || 'Untitled event'}</Link> : 'None pencilled'}
          </dd>
        </div>
      </dl>
      <MovesChips goals={moves} max={3} testId={`szw-moves-${n}`} />
      <div className="szw-actions">
        <button type="button" className="szn-btn is-quiet" onClick={onOpen} data-testid={`szw-open-${n}`}>Open slot</button>
        {episode && <Link className="szw-link" to={`/episodes/${episode.id}`}>Open the episode</Link>}
      </div>
    </li>
  );
}

export default function SeasonWeek({ roadmap, release, episodes, events, api, showId, movesBySlot = {}, onOpen, today }) {
  const ahead = weekAhead({ roadmap, view: release?.view || null, episodes, ...(today ? { today } : {}) });
  return (
    <section className="szw" aria-label="This week" data-testid="szn-roadmap-week">
      <p className="szn-muted szw-note" data-testid="szw-note">
        {ahead.mode === 'dated'
          ? 'The next releases, soonest first: their dates come from the release schedule or are set by hand.'
          : 'No release dates yet, so here are the next slots in order. A release schedule, or a date set on an episode, puts them in date order.'}
      </p>
      {ahead.items.length ? (
        <ol className="szw-list">
          {ahead.items.map((item) => (
            <WeekItem key={item.slot.id} item={item} api={api} showId={showId} events={events}
              moves={movesBySlot[item.slot.id] || []} onOpen={() => onOpen(item.slot)} />
          ))}
        </ol>
      ) : (
        <p className="szn-muted" data-testid="szw-empty">Every slot this season is done.</p>
      )}
    </section>
  );
}

/**
 * StoryTimeline — "Story so far" in the Inspector (2026-10-23): what has
 * happened between two people, oldest first, from their relationship_events
 * (GET /relationships/:id/events). Each event shows where they went (stage
 * before → stage), the tension before and after, the beat, the note, the
 * script's quote and the episode it happened in.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Quote } from 'lucide-react';
import apiClient from '../../services/api';
import { API, STAGE_TONE, stageLabel, humanize } from './tokens';

export const fetchRelationshipEvents = (relId) =>
  apiClient.get(`${API}/relationships/${relId}/events`).then(r => r.data?.events || []);

function StageChip({ stage, current }) {
  if (!stage) return null;
  return (
    <span className={`re-stage ${STAGE_TONE[stage] || ''} ${current ? 'is-current' : ''}`}>{stageLabel(stage)}</span>
  );
}

/** The stages they have been through, in order, each once: strangers → acquaintances → flirting. */
export function journeyOf(events) {
  const seen = [];
  (events || []).forEach(e => {
    [e.stage_before, e.relationship_stage].forEach(st => {
      if (st && seen[seen.length - 1] !== st) seen.push(st);
    });
  });
  return seen;
}

export default function StoryTimeline({ relId }) {
  const [state, setState] = useState({ loading: true, error: null, events: [] });

  useEffect(() => {
    let live = true;
    setState({ loading: true, error: null, events: [] });
    fetchRelationshipEvents(relId)
      .then(events => { if (live) setState({ loading: false, error: null, events }); })
      .catch(err => {
        console.error('[StoryTimeline] events load failed:', err);
        if (live) setState({ loading: false, error: 'Could not load the story so far.', events: [] });
      });
    return () => { live = false; };
  }, [relId]);

  const { loading, error, events } = state;
  const journey = journeyOf(events);

  return (
    <section className="re-story" aria-label="Story so far">
      <h3 className="re-story-title">Story so far</h3>
      {loading && <p className="re-story-muted">Loading…</p>}
      {error && <p className="re-story-muted" role="alert">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="re-story-muted">Nothing has happened between them on the page yet. Saving an episode&rsquo;s story record adds to this.</p>
      )}
      {journey.length > 0 && (
        <div className="re-story-journey" aria-label="Stages so far">
          {journey.map((st, i) => (
            <span key={`${st}-${i}`} className="re-story-step">
              {i > 0 && <ArrowRight size={12} aria-hidden className="re-story-arrow" />}
              <StageChip stage={st} current={i === journey.length - 1} />
            </span>
          ))}
        </div>
      )}
      {events.length > 0 && (
        <ol className="re-story-list">
          {events.map(e => (
            <li key={e.id} className="re-story-item">
              <div className="re-story-head">
                {e.stage_before && e.stage_before !== e.relationship_stage && (
                  <><StageChip stage={e.stage_before} /><ArrowRight size={12} aria-hidden className="re-story-arrow" /></>
                )}
                <StageChip stage={e.relationship_stage} />
                {!e.relationship_stage && <span className="re-story-kind">{humanize(e.event_type)}</span>}
              </div>
              <div className="re-story-meta">
                {(e.tension_before != null || e.tension_after != null) && (
                  <span>Tension {e.tension_before ?? '?'} → {e.tension_after ?? '?'}</span>
                )}
                {e.beat != null && <span>Beat {e.beat}</span>}
                {e.story_date && <span>{e.story_date}</span>}
              </div>
              {e.description && <p className="re-story-note">{e.description}</p>}
              {e.quote && (
                <blockquote className="re-story-quote">
                  <Quote size={12} aria-hidden /> {e.quote}
                </blockquote>
              )}
              {e.episode_id && (
                <Link className="re-story-ep" to={`/episodes/${e.episode_id}`}>
                  {e.episode_number != null ? `Episode ${e.episode_number}` : (e.episode_title || 'The episode')} <ArrowRight size={12} aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Producer Mode → Episodes → Production, to Evoni's mock (2026-10-07):
 *   - Now producing: the first episode in production (as the Overview picks
 *     it), with its status, logline, tags, the five-stage bar, Open episode,
 *     the script, and its production checklist count; beside it, From the
 *     event: the episode's event, where and when, what it pays and what its
 *     Event Package still misses (lib/episodePipeline `eventPanel`);
 *   - the season pipeline: Board (the five stages; drag a card to change
 *     its status; the season's open slots under Planning), Grid or List,
 *     and New episode.
 * Moved from the show page's Episodes tab when the two show workspaces became
 * one (Evoni, 2026-10-03).
 * Props: showId, episodes, total (the show's true count, when known),
 * onChanged (reload after a status change or delete), goTo(tabKey).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import episodeService from '../../services/episodeService';
import EpisodeCard from '../EpisodeCard';
import { episodesInProduction, checklistSummary } from './ShowOverview';
import { loadProductionChecks } from '../Episodes/EpisodeProductionChecklist';
import {
  STAGES, STATUS_LABEL, stageOf, episodeCode, episodeTags, cardLine,
  pipelineColumns, pipelineSummary, eventPanel,
} from '../../lib/episodePipeline';

const STATUS_ICON = { draft: '✏️', scripted: '📜', in_build: '🎬', in_review: '👀', published: '✅', archived: '📦' };
// The glyph is text: each tier's text twin (the fills were 1.4:1 to 4.5:1 short on white).
const TIERS = { slay: { e: '👑', c: 'var(--lala-gold-text)' }, pass: { e: '✨', c: 'var(--success-text)' }, safe: { e: '😐', c: 'var(--warning-text)' }, fail: { e: '💔', c: 'var(--danger-text)' } };
const VIEWS = [{ key: 'board', label: 'Board' }, { key: 'grid', label: 'Grid' }, { key: 'list', label: 'List' }];

function evaluation(ep) {
  if (typeof ep.evaluation_json !== 'string') return ep.evaluation_json || null;
  try {
    return JSON.parse(ep.evaluation_json);
  } catch (err) {
    console.error('[ShowEpisodesBoard] bad evaluation_json:', err);
    return null;
  }
}

/** The season roadmap (its open slots), or null when there is no season. */
function useRoadmap(showId) {
  const [roadmap, setRoadmap] = useState(null);
  useEffect(() => {
    if (!showId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/roadmap`)
      .then((r) => { if (!cancelled) setRoadmap(r.data?.roadmap || null); })
      .catch((err) => { console.error('[ShowEpisodesBoard] season roadmap load failed:', err); });
    return () => { cancelled = true; };
  }, [showId]);
  return roadmap;
}

/** The episode's checklist and its linked event (the Overview's loader). */
function useChecks(episode, showId) {
  const [state, setState] = useState({ loading: false, checks: null, linkedEvent: null });
  useEffect(() => {
    if (!episode?.id) { setState({ loading: false, checks: null, linkedEvent: null }); return undefined; }
    let cancelled = false;
    setState({ loading: true, checks: null, linkedEvent: null });
    loadProductionChecks(episode, showId).then(({ checks, linkedEvent }) => {
      if (!cancelled) setState({ loading: false, checks, linkedEvent });
    }).catch((err) => {
      console.error('[ShowEpisodesBoard] production checks failed:', err);
      if (!cancelled) setState({ loading: false, checks: null, linkedEvent: null });
    });
    return () => { cancelled = true; };
  }, [episode?.id, showId]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** The World locations, for the event venue's DREAM city; only when there is one to look up. */
function useLocations(needed) {
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    if (!needed) return undefined;
    let cancelled = false;
    api.get('/api/v1/world/locations')
      .then((r) => { if (!cancelled) setLocations(r.data?.locations || []); })
      .catch((err) => { console.error('[ShowEpisodesBoard] locations load failed:', err); });
    return () => { cancelled = true; };
  }, [needed]);
  return locations;
}

function StageBar({ episode }) {
  const at = STAGES.findIndex((s) => s.key === stageOf(episode));
  return (
    <ol className="seb-stages" aria-label="Stage">
      {STAGES.map((s, i) => (
        <li key={s.key} className={`seb-stage${i < at ? ' is-done' : ''}${i === at ? ' is-current' : ''}`} aria-current={i === at ? 'step' : undefined}>
          <span className="seb-stage-bar" aria-hidden="true" />
          <span className="seb-stage-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function NowProducing({ showId, episode, checks, panel }) {
  const summary = checks.checks ? checklistSummary(checks.checks) : null;
  const tags = episodeTags(episode);
  const blurb = episode.logline || episode.description;
  return (
    <section className="seb-hero" data-testid="seb-hero" aria-labelledby="seb-hero-title">
      <div className="seb-hero-main">
        <div className="seb-hero-kicker">
          <span>Now producing · {episodeCode(episode)}</span>
          <span className="seb-chip">{STATUS_LABEL[episode.status] || episode.status}</span>
        </div>
        <h2 id="seb-hero-title" className="seb-hero-title">{episode.title || 'Untitled'}</h2>
        {blurb && <p className="seb-hero-blurb">{blurb}</p>}
        {tags.length > 0 && (
          <ul className="seb-tags" aria-label="Tags">
            {tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
        <StageBar episode={episode} />
        <div className="seb-hero-actions">
          <Link className="seb-btn seb-btn-primary" to={`/episodes/${episode.id}`}>Open episode</Link>
          <Link className="seb-btn" to={`/episodes/${episode.id}?tab=scripts`}>{episode.script_content ? 'Open script' : 'Generate Script'}</Link>
          <Link className="seb-checklist" to={`/episodes/${episode.id}?tab=checklist`} data-testid="seb-checklist">
            {summary ? `Checklist ${summary.done} of ${summary.total}` : checks.loading ? 'Checking the checklist…' : ''}
          </Link>
        </div>
      </div>
      <aside className="seb-hero-event" data-testid="seb-event" aria-label="From the event">
        <div className="seb-event-kicker">From the event</div>
        {checks.loading ? <p className="seb-event-note">Finding the event…</p>
          : !panel ? <p className="seb-event-note">No event is linked to this episode yet.</p>
            : (
              <>
                <h3 className="seb-event-name">{panel.name}</h3>
                {panel.place && <p className="seb-event-line">{panel.place}</p>}
                {panel.when && <p className="seb-event-line">{panel.when}</p>}
                {panel.earns != null && <p className="seb-event-earns">Earns {panel.earns.toLocaleString()} coins</p>}
                {panel.stillNeeded.length > 0
                  ? (
                    <p className="seb-event-needed">
                      Still needed: {panel.stillNeeded.slice(0, 2).join('; ')}
                      {panel.stillNeeded.length > 2 && ` and ${panel.stillNeeded.length - 2} more`}
                    </p>
                  )
                  : <p className="seb-event-ready">The Event Package is complete.</p>}
                <Link className="seb-event-open" to={`/shows/${showId}/events/${panel.id}`}>Open the Event Package →</Link>
              </>
            )}
      </aside>
    </section>
  );
}

// Planning shows its episodes and the next open slots; the rest of the
// season's slots are a link to Season Plan.
const SLOTS_SHOWN = 2;
const visibleCards = (cards) => {
  let slots = 0;
  return cards.filter((c) => c.kind !== 'slot' || ++slots <= SLOTS_SHOWN);
};
const hiddenSlots = (cards) => Math.max(0, cards.filter((c) => c.kind === 'slot').length - SLOTS_SHOWN);

function PipelineBoard({ columns, heroId, heroSummary, onOpen, onStatusChange, onPickEvent }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (stage) => {
    const card = columns.flatMap((c) => c.cards).find((c) => c.id === dragId);
    setDragId(null); setOver(null);
    if (!card || card.kind !== 'episode') return;
    if (stageOf(card.episode) !== stage.key) onStatusChange(card.episode.id, stage.status);
  };
  return (
    <div className="seb-board" data-testid="seb-board">
      {columns.map((col) => (
        <section
          key={col.key}
          className={`seb-col seb-col-${col.key}${over === col.key ? ' is-over' : ''}`}
          aria-label={col.label}
          onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
          onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
          onDrop={(e) => { e.preventDefault(); drop(col); }}
        >
          <header className="seb-col-head"><span>{col.label}</span><span className="seb-col-count">{col.count}</span></header>
          {col.cards.length === 0 && <p className="seb-col-empty">Nothing here yet</p>}
          {visibleCards(col.cards).map((card) => (card.kind === 'slot' ? (
            <div key={card.id} className="seb-card seb-card-slot">
              <div className="seb-card-code">{card.slot.label || `Slot ${card.slot.slot_number}`} · open slot</div>
              {card.slot.intention?.story_purpose && <p className="seb-card-intent">{card.slot.intention.story_purpose}</p>}
              <button type="button" className="seb-card-link" onClick={onPickEvent}>{card.slot.event ? card.slot.event.name : 'Pick an event'}</button>
            </div>
          ) : (
            <button
              key={card.id}
              type="button"
              className="seb-card"
              draggable
              onDragStart={(e) => { setDragId(card.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDragId(null); setOver(null); }}
              onClick={() => onOpen(card.episode.id)}
            >
              <span className="seb-card-code">{episodeCode(card.episode)} · {STATUS_LABEL[card.episode.status] || card.episode.status}</span>
              <span className="seb-card-title">{card.episode.title || 'Untitled'}</span>
              {card.id === heroId && heroSummary && (
                <span className="seb-card-bar" role="progressbar" aria-label="Production checklist" aria-valuemin={0} aria-valuemax={heroSummary.total} aria-valuenow={heroSummary.done}>
                  <span style={{ width: `${heroSummary.total ? Math.round((heroSummary.done / heroSummary.total) * 100) : 0}%` }} />
                </span>
              )}
              <span className="seb-card-line">
                {card.id === heroId && heroSummary ? `${heroSummary.done} of ${heroSummary.total} · ` : ''}{cardLine(card.episode)}
              </span>
            </button>
          )))}
          {hiddenSlots(col.cards) > 0 && (
            <button type="button" className="seb-card-link seb-more-slots" onClick={onPickEvent}>
              + {hiddenSlots(col.cards)} more open slot{hiddenSlots(col.cards) === 1 ? '' : 's'} in Season Plan
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

// total: the show's true episode count (the list stops at 100), when known.
export default function ShowEpisodesBoard({ showId, episodes = [], total = null, onChanged, goTo = () => {} }) {
  const navigate = useNavigate();
  const [view, setView] = useState('board');
  const roadmap = useRoadmap(showId);
  const hero = useMemo(() => episodesInProduction(episodes)[0] || null, [episodes]);
  const checks = useChecks(hero, showId);
  const ev = checks.linkedEvent;
  const needsLocations = Boolean(ev && (ev.venue_location_id || ev.canon_consequences?.automation?.venue_location_id));
  const locations = useLocations(needsLocations);
  const panel = useMemo(() => eventPanel(ev, locations), [ev, locations]);
  const heroSummary = checks.checks ? checklistSummary(checks.checks) : null;
  const columns = useMemo(() => pipelineColumns(episodes, roadmap), [episodes, roadmap]);

  // One way to start an episode: the new-episode flow.
  const newEpisode = () => navigate(`/shows/${showId}/new-episode`);
  const open = (id) => navigate(`/episodes/${id}`);

  const changeStatus = async (episodeId, status) => {
    try {
      await episodeService.updateEpisode(episodeId, { status });
      onChanged?.();
    } catch (err) {
      console.error('[ShowEpisodesBoard] status change failed:', err);
    }
  };
  const remove = async (episodeId) => {
    if (!window.confirm('Are you sure you want to delete this episode?')) return;
    try {
      await episodeService.deleteEpisode(episodeId);
      onChanged?.();
    } catch (err) {
      console.error('[ShowEpisodesBoard] delete failed:', err);
    }
  };

  const sorted = [...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  const seasonNumber = roadmap?.season_number || hero?.season_number || sorted[0]?.season_number || 1;
  return (
    <div className="show-episodes-board" data-testid="show-episodes-board">
      {hero && <NowProducing showId={showId} episode={hero} checks={checks} panel={panel} />}

      <div className="seb-head">
        <div className="seb-head-title">
          <h2>Season {seasonNumber} pipeline</h2>
          <p className="seb-count" data-testid="seb-count">
            {pipelineSummary(episodes, roadmap, total)}
            {total != null && total > episodes.length && ` · showing the first ${episodes.length}`}
          </p>
        </div>
        <div className="seb-actions">
          <div className="seb-views" role="group" aria-label="Episode view">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={view === v.key} className={view === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
          <button type="button" className="seb-new" onClick={newEpisode}>+ New episode</button>
        </div>
      </div>

      {episodes.length === 0 && view !== 'board' ? (
        <div className="seb-empty">
          <div className="seb-empty-icon">📺</div>
          <h3>No episodes yet</h3>
          <p>An episode starts from an event: set the event up in Events, then start its episode.</p>
          <button type="button" className="seb-new" onClick={newEpisode}>+ New episode</button>
        </div>
      ) : view === 'board' ? (
        <>
          {episodes.length === 0 && (
            <p className="seb-board-empty">No episodes yet. An episode starts from an event: set the event up in Events, then start its episode.</p>
          )}
          <PipelineBoard columns={columns} heroId={hero?.id} heroSummary={heroSummary} onOpen={open} onStatusChange={changeStatus} onPickEvent={() => goTo('season')} />
          <p className="seb-board-hint">Drag an episode to another stage to change its status.</p>
        </>
      ) : view === 'list' ? (
        <div className="seb-table-wrap">
          <table className="seb-table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Stage</th><th>Status</th><th>Tier</th><th>Score</th></tr>
            </thead>
            <tbody>
              {sorted.map((ep) => {
                const evl = evaluation(ep);
                const tier = evl?.tier_final ? TIERS[evl.tier_final] : null;
                return (
                  <tr key={ep.id} onClick={() => open(ep.id)}>
                    <td>{ep.episode_number || '—'}</td>
                    <td className="seb-title">{ep.title || 'Untitled'}</td>
                    <td>{STAGES.find((s) => s.key === stageOf(ep))?.label || '—'}</td>
                    <td>{STATUS_ICON[ep.status] || '⚪'}</td>
                    <td>{tier ? <span style={{ color: tier.c }}>{tier.e}</span> : '—'}</td>
                    <td>{evl?.score || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="seb-grid">
          {sorted.map((ep) => (
            <EpisodeCard key={ep.id} episode={ep} onView={open} onEdit={(id) => navigate(`/episodes/${id}/edit`)} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Producer Mode → Episodes → Production, to Evoni's Episode Pipeline mock
 * (2026-10-17; first built to her 2026-10-07 mock):
 *   - the episode in production (as the Overview picks it): its thumbnail
 *     (Edit Thumbnail), code and status, title, logline and tags (Add Tag
 *     saves its categories); From the event: the event, where and when,
 *     what it pays and what its Event Package still misses (lib/
 *     episodePipeline `eventPanel`); the seven steps, derived from what the
 *     episode has (`pipelineSteps`), each opening where it is worked on;
 *     Open episode, the script, and a menu with the checklist;
 *   - the season pipeline: search, Board (the five stages; drag a card to
 *     change its status; the season's open slots under Planning), Grid or
 *     List, and New episode.
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
import { loadProductionChecks, CHECKLIST_SECTIONS } from '../Episodes/EpisodeProductionChecklist';
import { rawClipsApi } from '../../lib/rawClipsApi';
import { thumbnailStudioHref } from '../../lib/thumbnailStudioHref';
import {
  STAGES, STATUS_LABEL, stageOf, episodeCode, episodeTags, cardLine,
  pipelineColumns, pipelineSummary, eventPanel, pipelineSteps, matchesSearch,
} from '../../lib/episodePipeline';
import {
  Plus, Pencil, Play, FileText, MoreHorizontal, Check, CalendarDays, Search, LayoutDashboard, LayoutGrid, List,
  ClipboardList, Clapperboard, Scissors, MonitorPlay,
} from 'lucide-react';
import './ShowEpisodesBoard.css';

const STATUS_ICON = { draft: '✏️', scripted: '📜', in_build: '🎬', in_review: '👀', published: '✅', archived: '📦' };
// The glyph is text: each tier's text twin (the fills were 1.4:1 to 4.5:1 short on white).
const TIERS = { slay: { e: '👑', c: 'var(--lala-gold-text)' }, pass: { e: '✨', c: 'var(--success-text)' }, safe: { e: '😐', c: 'var(--warning-text)' }, fail: { e: '💔', c: 'var(--danger-text)' } };
const VIEWS = [{ key: 'board', label: 'Board', Icon: LayoutDashboard }, { key: 'grid', label: 'Grid', Icon: LayoutGrid }, { key: 'list', label: 'List', Icon: List }];

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

/** The hero's footage and primary thumbnail, for its seven steps. */
function useHeroMedia(episodeId) {
  const [media, setMedia] = useState({ clips: [], hasThumbnail: false });
  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    // Promise.resolve first: a read that throws at once still lands in catch.
    Promise.resolve().then(() => rawClipsApi.list(episodeId))
      .then((rows) => { if (live) setMedia((m) => ({ ...m, clips: Array.isArray(rows) ? rows : [] })); })
      .catch((err) => console.error('[ShowEpisodesBoard] clips load failed:', err));
    Promise.resolve().then(() => api.get(`/api/v1/thumbnails/episode/${episodeId}/primary`))
      .then((res) => { if (live) setMedia((m) => ({ ...m, hasThumbnail: Boolean(res?.data?.data) })); })
      .catch((err) => {
        // No primary thumbnail yet is a 404; anything else is worth a log.
        if (err?.response?.status !== 404) console.error('[ShowEpisodesBoard] thumbnail check failed:', err);
      });
    return () => { live = false; };
  }, [episodeId]);
  return media;
}

/** The episode's thumbnail, or its code on the show's pink. */
function Thumb({ episode, small = false }) {
  const src = episode.thumbnail_url || episode.thumbnailUrl || null;
  return (
    <span className={`seb-thumb${small ? ' is-small' : ''}${src ? '' : ' is-empty'}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <span className="seb-thumb-mark">{small ? episodeCode(episode) : 'Styling Adventures with Lala'}</span>}
    </span>
  );
}

function Tags({ episode, onSave }) {
  const tags = episodeTags(episode);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    const tag = draft.trim();
    if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) { setAdding(false); setDraft(''); return; }
    setSaving(true);
    const ok = await onSave([...tags, tag]);
    setSaving(false);
    if (ok) { setAdding(false); setDraft(''); }
  };
  return (
    <ul className="seb-tags" aria-label="Tags">
      {tags.map((t) => <li key={t}>{t}</li>)}
      <li className="seb-tag-add">
        {adding ? (
          <form onSubmit={add}>
            <input aria-label="New tag" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setDraft(''); } }} />
            <button type="submit" disabled={saving || !draft.trim()}>{saving ? 'Saving…' : 'Add'}</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add Tag</button>
        )}
      </li>
    </ul>
  );
}

function Steps({ steps }) {
  return (
    <ol className="seb-steps" aria-label="Stage">
      {steps.map((s) => (
        <li key={s.key} className={`seb-step${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`} aria-current={s.current ? 'step' : undefined}>
          <Link to={s.href} className="seb-step-link">
            <span className="seb-step-mark" aria-hidden="true">{s.done ? <Check size={14} /> : s.number}</span>
            <span className="seb-step-label">{s.label}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function More({ episode, summary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="seb-more">
      <button type="button" className="seb-icon-btn" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={18} aria-hidden="true" /></button>
      {open && (
        <div className="seb-menu" role="menu">
          <Link role="menuitem" to={`/episodes/${episode.id}?tab=checklist`} data-testid="seb-checklist">{summary ? `Checklist · ${summary.done} of ${summary.total}` : 'Checklist'}</Link>
          <Link role="menuitem" to={`/episodes/${episode.id}/edit`}>Edit details</Link>
        </div>
      )}
    </div>
  );
}

function NowProducing({ showId, episode, checks, panel, onTagsSaved }) {
  const summary = checks.checks ? checklistSummary(checks.checks) : null;
  const media = useHeroMedia(episode.id);
  const steps = pipelineSteps({ episode, checks: checks.checks, sections: CHECKLIST_SECTIONS, clips: media.clips, hasThumbnail: media.hasThumbnail });
  const blurb = episode.logline || episode.description;
  const saveTags = async (categories) => {
    try {
      await episodeService.updateEpisode(episode.id, { categories });
      onTagsSaved?.();
      return true;
    } catch (err) {
      console.error('[ShowEpisodesBoard] tag save failed:', err);
      return false;
    }
  };
  return (
    <section className="seb-hero" data-testid="seb-hero" aria-labelledby="seb-hero-title">
      <div className="seb-hero-card">
        <div className="seb-hero-art">
          <Thumb episode={episode} />
          <span className="seb-badge">{episodeCode(episode)}</span>
          <span className="seb-badge is-status">{STATUS_LABEL[episode.status] || episode.status}</span>
          <Link className="seb-thumb-edit" to={thumbnailStudioHref({ episodeId: episode.id })}><Pencil size={14} aria-hidden="true" /> Edit Thumbnail</Link>
        </div>
        <div className="seb-hero-main">
          <h2 id="seb-hero-title" className="seb-hero-title">{episode.title || 'Untitled'}</h2>
          {blurb && <p className="seb-hero-blurb">{blurb}</p>}
          <Tags episode={episode} onSave={saveTags} />
        </div>
        <aside className="seb-hero-event" data-testid="seb-event" aria-label="From the event">
          <div className="seb-event-kicker">From the event</div>
          {checks.loading ? <p className="seb-event-note">Finding the event…</p>
            : !panel ? <p className="seb-event-note">No event is linked to this episode yet.</p>
              : (
                <>
                  <h3 className="seb-event-name"><CalendarDays size={18} aria-hidden="true" /> {panel.name}</h3>
                  {panel.place && <p className="seb-event-line">{panel.place}</p>}
                  {panel.when && <p className="seb-event-line">{panel.when}</p>}
                  {panel.earns != null && <p className="seb-event-earns">Earns {panel.earns.toLocaleString()} coins</p>}
                  {panel.stillNeeded.length > 0
                    ? (
                      <div className="seb-event-needed">
                        <strong>Still needed:</strong>
                        <p>{panel.stillNeeded.slice(0, 2).join('; ')}{panel.stillNeeded.length > 2 && ` and ${panel.stillNeeded.length - 2} more`}</p>
                      </div>
                    )
                    : <p className="seb-event-ready">The Event Package is complete.</p>}
                  <Link className="seb-event-open" to={`/shows/${showId}/events/${panel.id}`}>Open Event Package →</Link>
                </>
              )}
        </aside>
      </div>
      <div className="seb-hero-steps">
        <Steps steps={steps} />
        <div className="seb-hero-actions">
          <Link className="seb-btn seb-btn-primary" to={`/episodes/${episode.id}`}><Play size={16} aria-hidden="true" /> Open episode</Link>
          <Link className="seb-btn" to={`/episodes/${episode.id}?tab=scripts`}><FileText size={16} aria-hidden="true" /> {episode.script_content ? 'Open script' : 'Generate Script'}</Link>
          <More episode={episode} summary={summary} />
        </div>
      </div>
    </section>
  );
}

const COLUMN_ICONS = { planning: ClipboardList, script: FileText, production: Clapperboard, edit: Scissors, released: MonitorPlay };
const EMPTY = {
  planning: ['No episodes in planning yet', 'Start one from an event with New episode.'],
  script: ['No episodes in script stage yet', 'Move an episode from Planning when the brief is ready to write.'],
  production: ['No episodes in production yet', 'Move an episode from Script when approved.'],
  edit: ['No episodes in edit stage yet', 'Upload footage and assemble your episode.'],
  released: ['No released episodes yet', 'Completed episodes will appear here.'],
};

// Planning shows its episodes and the next open slots; the rest of the
// season's slots are a link to Season Plan.
const SLOTS_SHOWN = 2;
const visibleCards = (cards) => {
  let slots = 0;
  return cards.filter((c) => c.kind !== 'slot' || ++slots <= SLOTS_SHOWN);
};
const hiddenSlots = (cards) => Math.max(0, cards.filter((c) => c.kind === 'slot').length - SLOTS_SHOWN);

function PipelineBoard({ columns, heroId, heroSummary, seasonNumber, searching, onOpen, onStatusChange, onPickEvent }) {
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
      {columns.map((col) => {
        const Icon = COLUMN_ICONS[col.key];
        const [emptyTitle, emptyHint] = EMPTY[col.key];
        return (
          <section
            key={col.key}
            className={`seb-col seb-col-${col.key}${over === col.key ? ' is-over' : ''}`}
            aria-label={col.label}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => { e.preventDefault(); drop(col); }}
          >
            <header className="seb-col-head"><span className="seb-col-name"><Icon size={16} aria-hidden="true" /> <span>{col.label}</span></span><span className="seb-col-count">{col.count}</span></header>
            {col.cards.length === 0 && (
              <div className="seb-col-empty">
                <Icon size={34} aria-hidden="true" />
                <p className="seb-col-empty-title">{searching ? 'Nothing matches' : emptyTitle}</p>
                {!searching && <p>{emptyHint}</p>}
              </div>
            )}
            {visibleCards(col.cards).map((card) => (card.kind === 'slot' ? (
              <div key={card.id} className="seb-card seb-card-slot">
                <div className="seb-chips"><span className="seb-chip">{card.slot.label || `S${seasonNumber} E${card.slot.slot_number}`}</span><span className="seb-chip is-open">Open Slot</span></div>
                {card.slot.intention?.story_purpose && <p className="seb-card-intent">{card.slot.intention.story_purpose}</p>}
                <button type="button" className="seb-card-link" onClick={onPickEvent}>{card.slot.event ? card.slot.event.name : 'Pick an event'}</button>
              </div>
            ) : (
              <article
                key={card.id}
                className="seb-card"
                draggable
                data-testid={`seb-card-${card.episode.id}`}
                aria-label={card.episode.title || 'Untitled'}
                onDragStart={(e) => { setDragId(card.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setOver(null); }}
              >
                <div className="seb-card-top">
                  <Thumb episode={card.episode} small />
                  <div className="seb-card-text">
                    <div className="seb-chips"><span className="seb-chip">{episodeCode(card.episode)}</span><span className="seb-chip is-status">{STATUS_LABEL[card.episode.status] || card.episode.status}</span></div>
                    <span className="seb-card-title">{card.episode.title || 'Untitled'}</span>
                  </div>
                </div>
                {card.id === heroId && heroSummary && (
                  <span className="seb-card-bar" role="progressbar" aria-label="Production checklist" aria-valuemin={0} aria-valuemax={heroSummary.total} aria-valuenow={heroSummary.done}>
                    <span style={{ width: `${heroSummary.total ? Math.round((heroSummary.done / heroSummary.total) * 100) : 0}%` }} />
                  </span>
                )}
                <div className="seb-card-foot">
                  <span className="seb-card-line">{card.id === heroId && heroSummary ? `${heroSummary.done} of ${heroSummary.total}` : cardLine(card.episode)}</span>
                  <button type="button" className="seb-card-go" onClick={() => onOpen(card.episode.id)}>Continue</button>
                </div>
              </article>
            )))}
            {hiddenSlots(col.cards) > 0 && (
              <button type="button" className="seb-card-link seb-more-slots" onClick={onPickEvent}>
                + {hiddenSlots(col.cards)} more open slot{hiddenSlots(col.cards) === 1 ? '' : 's'} in Season {seasonNumber} Plan
              </button>
            )}
          </section>
        );
      })}
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
  const [query, setQuery] = useState('');
  const columns = useMemo(() => pipelineColumns(episodes, roadmap)
    .map((col) => {
      const cards = col.cards.filter((c) => matchesSearch(c, query));
      return { ...col, cards, count: cards.length };
    }), [episodes, roadmap, query]);

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

  const sorted = [...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0))
    .filter((ep) => matchesSearch({ kind: 'episode', episode: ep }, query));
  const seasonNumber = roadmap?.season_number || hero?.season_number || sorted[0]?.season_number || 1;
  return (
    <div className="show-episodes-board" data-testid="show-episodes-board">
      {hero && <NowProducing showId={showId} episode={hero} checks={checks} panel={panel} onTagsSaved={onChanged} />}

      <section className="seb-pipeline" aria-labelledby="seb-pipeline-title">
      <div className="seb-head">
        <div className="seb-head-title">
          <h2 id="seb-pipeline-title">Season {seasonNumber} Pipeline</h2>
          <p className="seb-count" data-testid="seb-count">
            {pipelineSummary(episodes, roadmap, total)}
            {total != null && total > episodes.length && ` · showing the first ${episodes.length}`}
          </p>
        </div>
        <div className="seb-actions">
          <label className="seb-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Search episodes…" aria-label="Search episodes" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="seb-views" role="group" aria-label="Episode view">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={view === v.key} className={view === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
                <v.Icon size={15} aria-hidden="true" /> {v.label}
              </button>
            ))}
          </div>
          <button type="button" className="seb-new" onClick={newEpisode}><Plus size={16} aria-hidden="true" /> New episode</button>
        </div>
      </div>

      {episodes.length === 0 && view !== 'board' ? (
        <div className="seb-empty">
          <div className="seb-empty-icon">📺</div>
          <h3>No episodes yet</h3>
          <p>An episode starts from an event: set the event up in Events, then start its episode.</p>
          <button type="button" className="seb-new" onClick={newEpisode}><Plus size={16} aria-hidden="true" /> New episode</button>
        </div>
      ) : view === 'board' ? (
        <>
          {episodes.length === 0 && (
            <p className="seb-board-empty">No episodes yet. An episode starts from an event: set the event up in Events, then start its episode.</p>
          )}
          <PipelineBoard columns={columns} heroId={hero?.id} heroSummary={heroSummary} seasonNumber={seasonNumber} searching={Boolean(query.trim())} onOpen={open} onStatusChange={changeStatus} onPickEvent={() => goTo('season')} />
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
      </section>
    </div>
  );
}

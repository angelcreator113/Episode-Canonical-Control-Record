/**
 * The Season page's Overview, Story and Results tabs (Evoni's mockup, 2026-10-25). The pieces are the Season Plan's
 * (SeasonPlan.jsx, SeasonSetup's checklist, SeasonProposals, SeasonKnows,
 * SeasonTwists, SeasonRevealPlan, SeasonNeeds, the threads card, Planning
 * Insights); only the summary cards are the page's own, and they read the
 * same data.
 *
 *   Overview   Needs attention (SeasonAttention: what is waiting, most urgent
 *              first, each row a link to its fix; 2026-10-25), then
 *              Season Overview (title, logline, dates, status, Ep x of 24,
 *              description, Edit), Season Parts (each opens its part in the
 *              roadmap), the setup checklist, the proposals and what the
 *              season knows (folded), then Key Events, Story Threads, Secrets
 *              & Reveals (the hint and reveal slots per secret) and Season
 *              Goals, each with See all and an add button (Season Goals'
 *              open the Goals tab).
 *   Story      threads, twists, the reveal plan, the relationships needed.
 *   Results    this season's episodes (or every season's, `?seasons=all`) in
 *              the Episode Ledger (how each episode turned out: tier, score,
 *              money, what it changed; Producer Mode's old Episodes ›
 *              Results), then Planning Insights (each slot's plan beside
 *              what happened, and the season's money).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Pencil } from 'lucide-react';
import SeasonProposals from './SeasonProposals';
import SeasonKnows from './SeasonKnows';
import SeasonTwists from './SeasonTwists';
import SeasonRevealPlan from './SeasonRevealPlan';
import SeasonNeeds from './SeasonNeeds';
import { SeasonChecklist, setupSteps } from './SeasonSetup';
import { StoryThreadsCard, PlanningInsights, TEMP_CONFIG, THREAD_STATUS } from './SeasonPlan';
import { SeasonBar, SummaryCard } from './SeasonPageParts';
import EpisodeLedger from './EpisodeLedger';
import SeasonAttention from './SeasonAttention';
import { dateRange, dayLabel, arcPart, partProgress, revealMatrix, slotEvents } from '../../lib/seasonPage';
import { useReleaseSchedule, scheduleSentence, startLine, firstDue, deadlineWarning, seasonOf, formatDay } from '../../lib/releaseSchedule';

const GOAL_STATUS = { active: 'Active', paused: 'Paused', completed: 'Complete', failed: 'Missed', upcoming: 'Planned' };

/** "Starts releasing Sun, Nov 1" for the season shown, when the show has more than one season; else the schedule's own line. */
function seasonStartLine(view, seasonNumber) {
  const mine = (view?.seasons || []).length >= 2 ? seasonOf(view, seasonNumber) : null;
  if (!mine || view.state === 'paused') return startLine(view);
  return mine.first_release ? `Season ${seasonNumber} starts releasing ${formatDay(mine.first_release)}` : `Season ${seasonNumber} is not releasing yet`;
}

/**
 * The show's release schedule in a line, and the season's next deadline
 * (Evoni, 2026-10-25); set on Producer Mode's Release tab. `release` is the
 * page's useReleaseSchedule (read once there); without it the line reads
 * its own.
 */
function ReleasesFact({ api, showId, release = null, seasonNumber = null }) {
  const own = useReleaseSchedule({ api: release ? null : api, showId });
  const view = release ? release.view : own.view;
  if (!view) return null;
  const due = deadlineWarning(firstDue(view, seasonNumber), null);
  return (
    <div data-testid="szn-releases">
      <dt>Releases</dt>
      <dd>
        {view.schedule ? `${scheduleSentence(view.schedule)} · ${seasonStartLine(view, seasonNumber)}` : <span className="szn-muted">No release schedule yet</span>}
        {' '}<Link to={`/shows/${encodeURIComponent(showId)}/world?tab=release`} className="szn-link">Release tab</Link>
        {due && <span className={`szn-release-due is-${due.tone}`} data-testid="szn-release-due">{due.text}</span>}
      </dd>
    </div>
  );
}

function SeasonOverviewCard({ arc, roadmap, onEdit, api, showId, release }) {
  const temp = TEMP_CONFIG[arc.emotional_temperature] || TEMP_CONFIG.rising;
  const current = arcPart(arc, arc.current_phase);
  const total = arc.episode_end || roadmap?.slot_count || 24;
  const at = Number(arc.current_episode) || 0;
  const dates = dateRange(arc.starts_on, arc.ends_on);
  return (
    <section className="szn-card szn-overview" data-testid="szn-overview-card" aria-label="Season Overview">
      <header className="szn-card-head">
        <h2 className="szn-card-title">Season Overview</h2>
        {onEdit && <button type="button" className="szn-btn is-quiet is-small" onClick={onEdit} data-testid="szn-overview-edit"><Pencil size={14} aria-hidden="true" /> Edit</button>}
      </header>
      <dl className="szn-facts">
        <div><dt>Title</dt><dd>Season {arc.season_number || 1}: {arc.title}</dd></div>
        <div><dt>Logline</dt><dd>{arc.logline || <span className="szn-muted">No logline yet</span>}</dd></div>
        <div><dt>Dates</dt><dd>{dates || <span className="szn-muted">No dates yet</span>}</dd></div>
        <ReleasesFact api={api} showId={showId} release={release} seasonNumber={roadmap?.season_number ?? arc.season_number ?? null} />
        <div>
          <dt>Status</dt>
          <dd className="szn-status">
            <span className="szn-chip is-temp" data-testid="szn-temp">{temp.label}</span>
            {current?.emotional_arc && <span className="szn-muted" data-testid="szn-current-arc">Part {current.phase}: {current.emotional_arc}</span>}
            <span className="szn-ep-at">Ep {at} of {total}</span>
            <SeasonBar done={at} total={total} label="Where the season is" />
          </dd>
        </div>
      </dl>
      <h3 className="szn-sub-title">Description</h3>
      <p className="szn-prose" data-testid="szn-description">{arc.description || <span className="szn-muted">No description yet. Add one with Edit.</span>}</p>
    </section>
  );
}

function SeasonPartsCard({ arc, roadmap, goTab }) {
  const phases = roadmap?.phases || [];
  return (
    <section className="szn-card" data-testid="szn-parts-card" aria-label="Season Parts">
      <header className="szn-card-head"><h2 className="szn-card-title">Season Parts</h2></header>
      <ul className="szn-part-list">
        {phases.map((p) => {
          const pic = arcPart(arc, p.phase)?.picture_url;
          const prog = partProgress(p);
          return (
            <li key={p.phase}>
              <button type="button" className="szn-part-row" onClick={() => goTab('roadmap', { part: p.phase, view: 'grid' })} data-testid={`szn-part-open-${p.phase}`}
                aria-label={`Part ${p.phase}: ${p.title}, open it in the roadmap`}>
                <span className={`szn-part-pic is-part-${p.phase}`} aria-hidden="true">{pic && <img src={pic} alt="" loading="lazy" />}</span>
                <span className="szn-part-text">
                  <span className="szn-part-name"><span className="szn-part-num">Part {p.phase}</span> {p.title}<span className="szn-part-range">E{p.episode_start} – E{p.episode_end}</span></span>
                  {p.tagline && <span className="szn-part-tagline">{p.tagline}</span>}
                  <span className="szn-part-prog"><SeasonBar done={prog.done} total={prog.total} label={`Part ${p.phase} done`} /><span>{prog.done}/{prog.total}</span></span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="szn-part-go" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChecklistCard({ plan, onPanel, goTab }) {
  const steps = setupSteps({ roadmap: plan.roadmap, goals: plan.goals, threads: plan.threadData.threads });
  const actions = {
    setup: { label: 'Edit season', icon: 'edit', onClick: () => onPanel('edit') },
    place: { label: 'Place them', onClick: () => onPanel('place') },
    goals: plan.goals.length === 0
      ? { label: 'Seed 24 goals', onClick: plan.seedGoals, busy: plan.seedingGoals }
      : { label: 'Open Goals', onClick: () => goTab('goals') },
    threads: { label: 'Add a thread', onClick: () => goTab('story') },
    draft: { label: 'Draft with AI', onClick: () => onPanel('draft') },
  };
  const all = steps.every((s) => s.done);
  return (
    <div className="szn-checklist" data-testid="szn-checklist">
      {all ? (
        <section className="szn-card"><h2 className="szn-card-title">Season Checklist</h2><p className="szn-muted">Every setup step is done.</p></section>
      ) : <SeasonChecklist steps={steps} actions={actions} />}
    </div>
  );
}

function KeyEventsCard({ roadmap, events, goTab }) {
  const rows = slotEvents(roadmap, events).slice(0, 4);
  return (
    <SummaryCard title="Key Events This Season" testId="szn-sum-events" onSeeAll={() => goTab('events')}
      add={<button type="button" className="szn-add-row" onClick={() => goTab('events')}><Plus size={16} aria-hidden="true" /> Pencil an event</button>}>
      {rows.length === 0 ? <p className="szn-muted">No event is pencilled in yet.</p> : (
        <ul className="szn-mini-list">
          {rows.map(({ slot, event }) => (
            <li key={slot.id}>
              <span className="szn-mini-main">
                <span className="szn-mini-title">{event.name}</span>
                <span className="szn-mini-sub">E{slot.slot_number}{dayLabel(event.event_date) ? ` · ${dayLabel(event.event_date)}` : ''}</span>
              </span>
              {event.event_type && <span className="szn-chip is-soft">{String(event.event_type).replace(/_/g, ' ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </SummaryCard>
  );
}

function ThreadsSummary({ threads, goTab }) {
  const rows = threads.slice(0, 4);
  return (
    <SummaryCard title="Story Threads" testId="szn-sum-threads" onSeeAll={() => goTab('story')}
      add={<button type="button" className="szn-add-row" onClick={() => goTab('story')} data-testid="szn-new-thread"><Plus size={16} aria-hidden="true" /> New Thread</button>}>
      {rows.length === 0 ? <p className="szn-muted">No story threads yet.</p> : (
        <ul className="szn-mini-list">
          {rows.map((t) => {
            const n = Array.isArray(t.slot_numbers) ? t.slot_numbers.length : 0;
            return (
              <li key={t.id}>
                <span className="szn-mini-main">
                  <span className="szn-mini-title">{t.title}</span>
                  <span className="szn-mini-sub">{n} {n === 1 ? 'episode' : 'episodes'}</span>
                </span>
                <span className={`szn-chip is-thread-${t.status}`}>{(THREAD_STATUS[t.status] || THREAD_STATUS.open).label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SummaryCard>
  );
}

/** Secrets & Reveals: per secret, the slots that hint at it and the one that reveals it (the reveal plan). */
function SecretsSummary({ api, showId, goTab }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/reveals`)
      .then((r) => { if (!cancelled) setPlan(r.data); })
      .catch((err) => {
        console.error('[SeasonPage] reveal plan load failed:', err);
        if (!cancelled) setError(err?.response?.data?.error || 'The reveal plan could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [api, showId]);
  const rows = revealMatrix(plan).slice(0, 5);
  return (
    <SummaryCard title="Secrets & Reveals" testId="szn-sum-secrets" onSeeAll={() => goTab('story')}
      add={<button type="button" className="szn-add-row" onClick={() => goTab('story')}><Plus size={16} aria-hidden="true" /> Add Reveal</button>}>
      {error && <p className="szn-error" role="alert">{error}</p>}
      {!plan && !error && <p className="szn-muted" role="status">Reading the reveal plan…</p>}
      {plan && rows.length === 0 && <p className="szn-muted">No secret is hinted at or revealed yet.</p>}
      {rows.length > 0 && (
        <table className="szn-matrix" data-testid="szn-reveal-matrix">
          <thead><tr><th scope="col">Secret</th><th scope="col">Hinted</th><th scope="col">Revealed</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" title={r.who ? `${r.who}: ${r.name}` : r.name}>{r.name}</th>
                <td>{r.hints.length ? r.hints.map((n) => <span key={n} className="szn-pill is-hint">E{n}</span>) : <span className="szn-muted">—</span>}</td>
                <td>{r.reveal != null ? <span className="szn-pill is-reveal">E{r.reveal}</span> : <span className="szn-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SummaryCard>
  );
}

function GoalsSummary({ goals, goTab }) {
  const rows = goals.filter((g) => g.status !== 'archived').slice(0, 5);
  // Goals are written on this page's Goals tab.
  const toGoals = () => goTab('goals');
  return (
    <SummaryCard title="Season Goals" testId="szn-sum-goals" onSeeAll={toGoals}
      add={<button type="button" className="szn-add-row" onClick={toGoals} data-testid="szn-add-goal"><Plus size={16} aria-hidden="true" /> Add Goal</button>}>
      {rows.length === 0 ? <p className="szn-muted">No goals yet.</p> : (
        <ul className="szn-mini-list">
          {rows.map((g) => (
            <li key={g.id}>
              <span className="szn-mini-main">
                <span className="szn-mini-title">{g.icon ? `${g.icon} ` : ''}{g.title}</span>
                {g.target_value != null && <span className="szn-mini-sub">{g.current_value ?? 0} of {g.target_value}</span>}
              </span>
              <span className={`szn-chip is-goal-${g.status}`}>{GOAL_STATUS[g.status] || g.status}</span>
            </li>
          ))}
        </ul>
      )}
    </SummaryCard>
  );
}

export function SeasonOverviewTab({ plan, api, showId, arc, roadmap, events, goTab, onEdit, onPanel, attention = null, hrefFor = null, release = null, readOnly = false }) {
  return (
    <div className="szn-overview-tab">
      {attention && hrefFor && (
        <SeasonAttention items={attention} hrefFor={hrefFor} loading={Boolean(release && !release.view && !release.error)} />
      )}
      <div className={`szn-overview-row${readOnly ? ' is-two' : ''}`}>
        <SeasonOverviewCard arc={arc} roadmap={roadmap} onEdit={readOnly ? null : onEdit} api={api} showId={showId} release={release} />
        <SeasonPartsCard arc={arc} roadmap={roadmap} goTab={goTab} />
        {/* The checklist, the proposals and what the season knows act on the season in progress. */}
        {!readOnly && <ChecklistCard plan={plan} onPanel={onPanel} goTab={goTab} />}
      </div>

      {!readOnly && (
        <details className="szn-fold" data-testid="szn-fold-proposals">
          <summary>Proposals from the feed, and what the season knows</summary>
          <div className="szn-fold-body">
            <SeasonProposals showId={showId} api={api} onApplied={() => plan.loadArc()} />
            {roadmap && <SeasonKnows showId={showId} api={api} />}
          </div>
        </details>
      )}

      <div className="szn-summary-row">
        <KeyEventsCard roadmap={roadmap} events={events} goTab={goTab} />
        <ThreadsSummary threads={plan.threadData.threads} goTab={goTab} />
        <SecretsSummary api={api} showId={showId} goTab={goTab} />
        <GoalsSummary goals={plan.goals} goTab={goTab} />
      </div>
    </div>
  );
}

export function SeasonStoryTab({ plan, S, api, showId, setToast, goTab }) {
  return (
    <div className="szn-story" data-testid="szn-story">
      {plan.roadmap && (
        <StoryThreadsCard threads={plan.threadData.threads} drafts={plan.threadData.drafts} S={S} api={api} showId={showId}
          onChanged={plan.loadRoadmap} setToast={setToast} />
      )}
      <SeasonTwists showId={showId} api={api} onSeeAll={goTab ? () => goTab('plants') : null} />
      <SeasonRevealPlan showId={showId} api={api} />
      {plan.roadmap && <SeasonNeeds data={plan.needs.data} api={api} onChanged={plan.loadNeeds} error={plan.needs.error} onRetry={plan.loadNeeds} />}
    </div>
  );
}

export function SeasonResultsTab({ plan, S, showId, api, episodes, events, setToast, arc, scope = null }) {
  return (
    <div className="szn-results" data-testid="szn-results">
      {scope}
      <section className="szn-card szn-ledger" aria-label="Episode results" data-testid="szn-ledger">
        <EpisodeLedger showId={showId} api={api} episodes={episodes} events={events} setToast={setToast} title="Episode results" />
      </section>
      {/* With no season there is no plan to set beside the results. */}
      {plan.insights ? <PlanningInsights insights={plan.insights} S={S} /> : arc ? <p className="szn-muted">Planning Insights did not load.</p> : null}
    </div>
  );
}

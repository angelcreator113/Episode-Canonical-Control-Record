/**
 * Lala's career goals, on the Season page's Goals tab (Evoni, 2026-10-25:
 * moved out of Producer Mode's Season Plan with the brands she has worked
 * with). What she is working toward this season: each goal tracks one of
 * her stats to a target.
 *
 *   Sync from stats   POST .../goals/sync (the goals read her current stats)
 *   Suggest events    GET .../suggest-events?limit=3 (from the active goals)
 *   Seed 24 goals     POST .../goals/seed, only before there are any
 *   New Goal / edit   POST .../goals, PUT .../goals/:id; delete after a confirm
 *
 * The list is the page's (useSeasonPlan's goals), so the stat card and the
 * Overview's Season Goals count the same goals; every change calls
 * onChanged, which reloads them. The goal APIs are the ones Producer Mode
 * used. Styled by CareerGoals.css with the page's --sp-* colours.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Lightbulb, Sprout, Pencil, Trash2 } from 'lucide-react';
import './CareerGoals.css';

const TYPES = [
  { key: 'primary', label: 'Primary Goal', option: 'Primary (1 max)', limit: '1 max' },
  { key: 'secondary', label: 'Secondary Goals', option: 'Secondary (2 max)', limit: '2 max' },
  { key: 'passive', label: 'Passive Goals', option: 'Passive (unlimited)', limit: '' },
];
const METRICS = [
  ['coins', 'Coins'], ['reputation', 'Reputation'], ['brand_trust', 'Brand Trust'], ['influence', 'Influence'],
  ['stress', 'Stress (reduce to)'], ['followers', 'Followers'], ['engagement_rate', 'Engagement Rate'], ['portfolio_strength', 'Portfolio Strength'],
];
const METRIC_LABEL = Object.fromEntries(METRICS);
const EMPTY_GOAL = { title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '', description: '' };
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/** A goal's progress, 0–100: the server's, else from its start, current and target. */
export function goalProgress(g) {
  if (g.progress) return g.progress;
  const start = g.starting_value || 0;
  return Math.max(0, Math.min(100, Math.round(((g.current_value - start) / Math.max(1, (g.target_value - start))) * 100)));
}

function GoalEditor({ editing, form, setForm, saving, onSave, onCancel }) {
  const field = (key) => ({ value: form[key] ?? '', onChange: (e) => setForm((p) => ({ ...p, [key]: e.target.value })) });
  return (
    <form className="szn-card cg-editor" data-testid="cg-editor" aria-label={editing === 'new' ? 'New goal' : 'Edit goal'}
      onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <h3 className="cg-editor-title">{editing === 'new' ? 'New Goal' : 'Edit Goal'}</h3>
      <div className="cg-fields">
        <label className="cg-field is-wide">
          <span>Goal title</span>
          <input {...field('title')} placeholder="Break Into Luxury Fashion" required data-testid="cg-title" />
        </label>
        <label className="cg-field">
          <span>Type</span>
          <select {...field('type')} data-testid="cg-type">
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.option}</option>)}
          </select>
        </label>
        <label className="cg-field">
          <span>Metric</span>
          <select {...field('target_metric')} data-testid="cg-metric">
            {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="cg-field">
          <span>Target value</span>
          <input type="number" value={form.target_value ?? ''} data-testid="cg-target"
            onChange={(e) => setForm((p) => ({ ...p, target_value: parseFloat(e.target.value) || 0 }))} />
        </label>
        <label className="cg-field">
          <span>Icon</span>
          <input {...field('icon')} placeholder="🎯" />
        </label>
        {/* A goal's colour is data (the seed sets one); empty draws the page's pink. */}
        <label className="cg-field">
          <span>Colour</span>
          <input {...field('color')} placeholder="#RRGGBB" />
        </label>
        <label className="cg-field is-wide">
          <span>Description</span>
          <textarea {...field('description')} rows={3} placeholder="What does achieving this goal mean for Lala's journey?" />
        </label>
      </div>
      <div className="cg-editor-actions">
        <button type="button" className="szn-btn is-quiet" onClick={onCancel}>Cancel</button>
        <button type="submit" className="szn-btn" disabled={saving || !String(form.title || '').trim()} data-testid="cg-save">
          {saving ? 'Saving…' : editing === 'new' ? 'Create goal' : 'Save goal'}
        </button>
      </div>
    </form>
  );
}

function GoalCard({ goal, primary, onEdit, onDelete }) {
  const pct = goalProgress(goal);
  const done = pct >= 100;
  return (
    <article className={`cg-goal${primary ? ' is-primary' : ''}`} data-testid={`cg-goal-${goal.id}`}
      style={goal.color ? { borderColor: goal.color } : undefined}>
      <div className="cg-goal-head">
        <span className="cg-goal-icon" aria-hidden="true">{goal.icon || '🎯'}</span>
        <div className="cg-goal-text">
          <h4 className="cg-goal-title">{goal.title}</h4>
          {goal.description && <p className="cg-goal-desc">{goal.description}</p>}
        </div>
        <button type="button" className="szn-icon-btn" onClick={onEdit} aria-label={`Edit ${goal.title}`}><Pencil size={16} aria-hidden="true" /></button>
        <button type="button" className="szn-icon-btn" onClick={onDelete} aria-label={`Delete ${goal.title}`}><Trash2 size={16} aria-hidden="true" /></button>
      </div>
      <p className="cg-goal-metric">
        {METRIC_LABEL[goal.target_metric] || String(goal.target_metric || '').replace(/_/g, ' ')}: <strong>{goal.current_value ?? 0}</strong> / {goal.target_value}
      </p>
      <span className="cg-bar" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className={done ? 'is-done' : ''} style={{ width: `${pct}%`, ...(goal.color && !done ? { background: goal.color } : {}) }} />
      </span>
      <p className={`cg-goal-left${done ? ' is-done' : ''}`}>
        {done ? 'Complete' : `${pct}% · ${Math.max(0, goal.target_value - (goal.current_value ?? 0))} to go`}
      </p>
    </article>
  );
}

function Suggestions({ suggestions, showId }) {
  return (
    <section className="szn-card" data-testid="cg-suggestions" aria-label="Suggested events">
      <header className="szn-card-head"><h3 className="szn-card-title">Suggested events, from the active goals</h3></header>
      <ul className="cg-sugs">
        {suggestions.map((s) => (
          <li key={s.id || s.name} className={`cg-sug${s.requirements_met === false ? ' is-unmet' : ''}`} data-testid="cg-suggestion">
            <div className="cg-sug-head">
              <span className="cg-sug-name">{s.name}</span>
              <span className="szn-chip is-soft">Prestige {s.prestige}</span>
              <span className="szn-chip is-soft">{s.cost_coins} coins</span>
              {s.is_paid && <span className="szn-chip is-done">Paid</span>}
              {s.requirements_met === false && <span className="szn-chip is-goal-failed">Requirements not met</span>}
            </div>
            {s.narrative_stakes && <p className="cg-sug-stakes">{s.narrative_stakes}</p>}
            {(s.suggestion_reasons || []).length > 0 && <p className="cg-sug-why">{s.suggestion_reasons.slice(0, 4).join(' · ')}</p>}
            {s.id && (
              <div className="cg-sug-links">
                {/* Its editor in Producer Mode's Events; the package is where its episode starts. */}
                <Link className="szn-link" to={`/shows/${showId}/world?tab=events&event=${encodeURIComponent(s.id)}`}>View in Events</Link>
                <Link className="szn-link" to={`/shows/${showId}/events/${s.id}`}>Open the event package</Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CareerGoals({ showId, api, goals = [], onChanged, loadError = null }) {
  const [editing, setEditing] = useState(null); // null | 'new' | a goal id
  const [form, setForm] = useState(EMPTY_GOAL);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null); // 'sync' | 'suggest' | 'seed'
  const [note, setNote] = useState(null); // { kind: 'ok' | 'error', text }
  const [suggestions, setSuggestions] = useState([]);
  const reload = async () => { if (onChanged) await onChanged(); };

  const run = async (what, fn) => {
    setBusy(what); setNote(null);
    try { await fn(); } catch (err) {
      console.error(`[CareerGoals] ${what} failed:`, err);
      setNote({ kind: 'error', text: errorText(err) });
    }
    setBusy(null);
  };

  const save = async () => {
    setSaving(true); setNote(null);
    try {
      const res = editing === 'new'
        ? await api.post(`/api/v1/world/${showId}/goals`, form)
        : await api.put(`/api/v1/world/${showId}/goals/${editing}`, form);
      if (res.data?.success === false) {
        setNote({ kind: 'error', text: res.data.error || 'The goal was not saved.' });
      } else {
        setNote({ kind: 'ok', text: editing === 'new' ? 'Goal created.' : 'Goal saved.' });
        setEditing(null);
        await reload();
      }
    } catch (err) {
      console.error('[CareerGoals] save failed:', err);
      setNote({ kind: 'error', text: errorText(err) });
    }
    setSaving(false);
  };

  const remove = (goal) => {
    if (!window.confirm(`Delete "${goal.title}"?`)) return;
    run('delete', async () => {
      await api.delete(`/api/v1/world/${showId}/goals/${goal.id}`);
      if (editing === goal.id) setEditing(null);
      setNote({ kind: 'ok', text: 'Goal deleted.' });
      await reload();
    });
  };

  const sync = () => run('sync', async () => {
    const res = await api.post(`/api/v1/world/${showId}/goals/sync`);
    const completed = res.data?.completed || [];
    setNote({ kind: 'ok', text: `Synced ${res.data?.synced ?? 0} goals from her stats.${completed.length ? ` Completed: ${completed.map((c) => c.title).join(', ')}.` : ''}` });
    await reload();
  });

  const suggest = () => run('suggest', async () => {
    const res = await api.get(`/api/v1/world/${showId}/suggest-events?limit=3`);
    const list = res.data?.suggestions || [];
    setSuggestions(list);
    if (!list.length) setNote({ kind: 'ok', text: 'No event to suggest for the active goals.' });
  });

  const seed = () => run('seed', async () => {
    const res = await api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 });
    setNote({ kind: 'ok', text: `Seeded ${res.data?.created ?? 0} goals${res.data?.skipped ? ` (${res.data.skipped} already there)` : ''}.` });
    await reload();
  });

  const openNew = () => { setForm(EMPTY_GOAL); setEditing('new'); };
  const openEdit = (g) => { setForm({ ...EMPTY_GOAL, ...g, color: g.color || '' }); setEditing(g.id); };
  const active = goals.filter((g) => g.status === 'active');
  const completed = goals.filter((g) => g.status === 'completed');

  return (
    <section className="cg" data-testid="career-goals" aria-labelledby="cg-heading">
      <header className="szn-card cg-head">
        <div>
          <h2 id="cg-heading" className="szn-card-title">Career Goals</h2>
          <p className="szn-muted">What Lala is working toward this season. Each goal tracks one of her stats to a target.</p>
          <p className="cg-counts" data-testid="cg-counts">{active.length} active · {completed.length} complete</p>
        </div>
        <div className="cg-tools">
          <button type="button" className="szn-btn is-quiet" onClick={sync} disabled={busy === 'sync'} data-testid="cg-sync">
            <RefreshCw size={16} aria-hidden="true" /> {busy === 'sync' ? 'Syncing…' : 'Sync from stats'}
          </button>
          <button type="button" className="szn-btn is-quiet" onClick={suggest} disabled={busy === 'suggest'} data-testid="cg-suggest">
            <Lightbulb size={16} aria-hidden="true" /> {busy === 'suggest' ? 'Suggesting…' : 'Suggest events'}
          </button>
          {/* Only before there are any: the seed adds the 24 starting goals. */}
          {goals.length === 0 && !loadError && (
            <button type="button" className="szn-btn is-quiet" onClick={seed} disabled={busy === 'seed'} data-testid="cg-seed">
              <Sprout size={16} aria-hidden="true" /> {busy === 'seed' ? 'Seeding…' : 'Seed 24 goals'}
            </button>
          )}
          <button type="button" className="szn-btn" onClick={openNew} data-testid="cg-new"><Plus size={16} aria-hidden="true" /> New Goal</button>
        </div>
      </header>

      {loadError && <p className="szn-error" role="alert">The goals did not load ({loadError}).</p>}
      {note && <p className={note.kind === 'error' ? 'szn-error' : 'szn-note'} role={note.kind === 'error' ? 'alert' : 'status'} data-testid="cg-note">{note.text}</p>}

      {editing && <GoalEditor editing={editing} form={form} setForm={setForm} saving={saving} onSave={save} onCancel={() => setEditing(null)} />}

      {TYPES.map((t) => {
        const list = active.filter((g) => g.type === t.key);
        if (!list.length && t.key === 'passive') return null;
        return (
          <section key={t.key} className="cg-type" aria-label={t.label} data-testid={`cg-type-${t.key}`}>
            <h3 className="cg-type-title">{t.label}{t.limit && <span className="szn-muted"> ({t.limit})</span>}</h3>
            <div className={`cg-goals${t.key === 'primary' ? ' is-one' : ''}`}>
              {list.map((g) => <GoalCard key={g.id} goal={g} primary={t.key === 'primary'} onEdit={() => openEdit(g)} onDelete={() => remove(g)} />)}
              {!list.length && <p className="cg-empty">No active {t.key} goal. New Goal adds one.</p>}
            </div>
          </section>
        );
      })}

      {completed.length > 0 && (
        <section className="szn-card" data-testid="cg-completed" aria-label="Completed goals">
          <header className="szn-card-head"><h3 className="szn-card-title">Completed Goals</h3></header>
          <ul className="cg-done-list">
            {completed.map((g) => (
              <li key={g.id}>
                <span aria-hidden="true">{g.icon || '🎯'}</span>
                <span className="cg-done-title">{g.title}</span>
                <span className="szn-muted">{g.completed_at ? new Date(g.completed_at).toLocaleDateString() : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && <Suggestions suggestions={suggestions} showId={showId} />}
    </section>
  );
}

/**
 * The narrative debt: the goals a part left unmet that Lala carries (they
 * feed the scripts, Pulse posts and event stakes). Moved here with the
 * goals from the retired Season Plan tab.
 */
export function NarrativeDebt({ debt = [] }) {
  if (!debt.length) return null;
  return (
    <section className="szn-card" data-testid="season-debt" aria-label="Narrative debt">
      <header className="szn-card-head"><h3 className="szn-card-title">Narrative Debt ({debt.length})</h3></header>
      <p className="szn-muted">Failed goals that carry emotional weight. These feed into AI-generated scripts, Pulse posts, and event stakes.</p>
      <ul className="cg-debt">
        {debt.map((d, i) => (
          <li key={`${d.goal_title}-${i}`}>
            <p className="cg-debt-title">{d.goal_title} <span className="cg-debt-meta">({d.achieved}/{d.target} {String(d.target_metric || '').replace(/_/g, ' ')})</span></p>
            {d.narrative_weight && <p className="cg-debt-weight">{d.narrative_weight}</p>}
            <p className="cg-debt-meta">From Phase {d.phase}{(d.affects || []).length ? ` · Affects: ${d.affects.join(', ')}` : ''}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PHASE_STATUS = { active: 'Active', completed: 'Complete', upcoming: 'Upcoming' };
const episodeRange = (g) => {
  if (typeof g.episode_range !== 'string') return g.episode_range || null;
  try { return JSON.parse(g.episode_range); } catch (err) { console.error('[CareerGoals] episode_range parse failed:', err); return null; }
};

/**
 * Each part with its goals (hit, missed, active) and the season's
 * progression log, folded. Moved here with the goals from the retired
 * Season Plan tab.
 */
export function SeasonPhasesHistory({ arc, goals = [] }) {
  const phases = arc?.phases || [];
  const log = arc?.progression_log || [];
  if (!phases.length && !log.length) return null;
  const phaseGoals = (phase) => goals.filter((g) => {
    const range = episodeRange(g);
    return Array.isArray(range) && range[0] >= phase.episode_start && range[0] <= phase.episode_end;
  });
  return (
    <details className="szn-fold" data-testid="season-phases-fold">
      <summary>Phases and history <span className="szn-muted">· {phases.length} phases{log.length ? ` · ${log.length} log entries` : ''}</span></summary>
      <div className="szn-fold-body">
        {phases.map((phase) => {
          const pGoals = phaseGoals(phase);
          const current = Number(phase.phase) === Number(arc.current_phase);
          return (
            <section key={phase.phase} className={`cg-phase${current ? ' is-current' : ''}`} aria-label={`Phase ${phase.phase}: ${phase.title}`} data-testid={`cg-phase-${phase.phase}`}>
              <header className="cg-phase-head">
                <div>
                  <h4 className="cg-phase-title">Phase {phase.phase}: {phase.title}</h4>
                  <p className="cg-phase-sub">{phase.tagline ? `“${phase.tagline}” · ` : ''}Episodes {phase.episode_start}–{phase.episode_end}</p>
                </div>
                <span className={`szn-chip is-phase-${phase.status || 'upcoming'}`}>{PHASE_STATUS[phase.status] || phase.status || 'Upcoming'}</span>
              </header>
              {phase.emotional_arc && <p className="cg-phase-line"><strong>Emotional arc:</strong> {phase.emotional_arc}</p>}
              {phase.feed_behavior && (
                <p className="cg-phase-line"><strong>Pulse:</strong> {phase.feed_behavior.feed_tone || `Follow bias: ${phase.feed_behavior.follow_bias}`}
                  {phase.feed_behavior.event_prestige_max ? ` · Max prestige: ${phase.feed_behavior.event_prestige_max}` : ''}</p>
              )}
              {pGoals.length > 0 && (
                <div className="cg-phase-goals">
                  <p className="cg-phase-label">Goals ({pGoals.filter((g) => g.status === 'completed').length}/{pGoals.length} complete)</p>
                  <ul>
                    {pGoals.map((g) => <li key={g.id} className={`szn-chip is-goal-${g.status}`}>{g.icon || '🎯'} {g.title}</li>)}
                  </ul>
                </div>
              )}
              {phase.goal_summary && phase.status === 'completed' && (
                <p className="cg-phase-line">Results: {phase.goal_summary.completed} completed, {phase.goal_summary.failed} failed
                  {phase.goal_summary.carried > 0 ? `, ${phase.goal_summary.carried} carried as debt` : ''}</p>
              )}
            </section>
          );
        })}
        {log.length > 0 && (
          <section className="cg-log" aria-label="Progression log" data-testid="cg-log">
            <h4 className="cg-phase-title">Progression Log</h4>
            <ul>
              {log.slice().reverse().map((entry, i) => (
                <li key={`${entry.timestamp || ''}-${i}`}>
                  <span className={`szn-chip ${entry.triggered_by === 'manual' ? 'is-goal-failed' : 'is-soft'}`}>{entry.triggered_by}</span>
                  <span className="cg-log-text">
                    {entry.trigger_reason}
                    <span className="cg-debt-meta">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}{entry.goals_carried > 0 ? ` · ${entry.goals_carried} goals carried` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}

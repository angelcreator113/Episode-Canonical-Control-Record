/**
 * The season wrap-up (Evoni, 2026-10-26: Season page round 3), on the
 * Results tab above the Episode Ledger, for the season shown (`?season=N`,
 * else the one in progress). It shows once the season has a finished
 * episode or is complete.
 *
 * The plain recap is exact data from GET .../season/wrap-up
 * (services/seasonWrapUp): the goals and the finished events that moved
 * them, the goals reached, the best-scoring episodes, the season's money
 * from the ledger, and the threads and twists still open going into the
 * next season. "Write the wrap-up" makes one AI call that reads that recap
 * (never a script) and drafts a short recap into a textarea; Evoni edits
 * it, and it is saved only on Save.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Save, Pencil } from 'lucide-react';
import defaultApi from '../../services/api';
import './SeasonWrapUp.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const signed = (n) => `${Number(n) >= 0 ? '+' : ''}${fmt(n)}`;
const TIER_LABEL = { slay: 'Slay', pass: 'Pass', safe: 'Safe', fail: 'Fail' };
const savedOn = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
};
const moverList = (list) => list.map((m) => `${m.name} (${m.label || m.code})`).join(', ');

/** The wrap-up's URL for the season shown (`suffix` '/draft' for Write the wrap-up). */
export function wrapUpPath(showId, season, suffix = '') {
  const q = /^[1-9]\d{0,2}$/.test(String(season || '')) ? `?season=${season}` : '';
  return `/api/v1/world/${showId}/season/wrap-up${suffix}${q}`;
}

function GoalsCard({ goals }) {
  return (
    <div className="swu-card" data-testid="swu-goals">
      <h4>Goals and the events that moved them</h4>
      {goals.length === 0 ? <p className="swu-muted">No goals were set for this season.</p> : (
        <ul className="swu-list">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="swu-goal-line">
                <span className="swu-goal-title">{g.icon ? `${g.icon} ` : ''}{g.title}</span>
                <span className={`swu-pill ${g.reached ? 'is-reached' : g.status === 'failed' ? 'is-missed' : ''}`}>
                  {g.reached ? 'Reached' : g.status === 'failed' ? 'Missed' : 'Not reached yet'}
                </span>
              </div>
              {g.target_value != null && !g.reached && (
                <div className="swu-sub">{fmt(g.current_value)} of {fmt(g.target_value)}{g.metric_label ? ` ${g.metric_label}` : ''}</div>
              )}
              {g.main_events.length > 0 && <div className="swu-sub"><strong>Main event:</strong> {moverList(g.main_events)}</div>}
              {g.also_helps.length > 0 && <div className="swu-sub"><strong>Also helped:</strong> {moverList(g.also_helps)}</div>}
              {g.main_events.length === 0 && g.also_helps.length === 0 && (
                <div className="swu-sub swu-muted">No finished event moved it{g.still_planned ? `; ${g.still_planned} planned still to come` : ''}.</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BestCard({ episodes }) {
  return (
    <div className="swu-card" data-testid="swu-best">
      <h4>Best episodes</h4>
      {episodes.length === 0 ? <p className="swu-muted">No episode has a score yet.</p> : (
        <ol className="swu-list swu-best">
          {episodes.map((e) => (
            <li key={e.id}>
              <span className="swu-goal-title">{e.label ? <span className="swu-code">{e.label}</span> : null}{e.title}</span>
              <span className="swu-best-meta">
                {e.tier && <span className={`swu-pill is-${e.tier}`}>{TIER_LABEL[e.tier] || e.tier}</span>}
                {e.score != null && <span className="swu-score">{e.score}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MoneyCard({ money }) {
  return (
    <div className="swu-card" data-testid="swu-money">
      <h4>Money over the season</h4>
      <dl className="swu-money">
        <div className="is-in"><dt>In</dt><dd>{fmt(money.income)}</dd></div>
        <div className="is-out"><dt>Out</dt><dd>{fmt(money.spend)}</dd></div>
        <div className={money.net >= 0 ? 'is-in' : 'is-out'}><dt>Net</dt><dd>{signed(money.net)}</dd></div>
      </dl>
      {money.top_earners.length > 0 && <div className="swu-sub"><strong>Earned most:</strong> {money.top_earners.map((r) => `${r.title} (${fmt(r.income)})`).join(', ')}</div>}
      {money.top_spenders.length > 0 && <div className="swu-sub"><strong>Cost most:</strong> {money.top_spenders.map((r) => `${r.title} (${fmt(r.spend)})`).join(', ')}</div>}
      {money.episodes_with_money === 0 && <p className="swu-muted">No ledger rows on this season's episodes yet.</p>}
    </div>
  );
}

function OpenCard({ threads, twists, next }) {
  return (
    <div className="swu-card" data-testid="swu-open">
      <h4>Still open going into Season {next}</h4>
      {threads.length === 0 && twists.length === 0 && <p className="swu-muted">Nothing left open.</p>}
      {threads.length > 0 && (
        <ul className="swu-list">
          {threads.map((t) => (
            <li key={t.id}><span className="swu-goal-title">{t.title}</span> <span className="swu-pill">{t.status === 'advanced' ? 'Advanced' : 'Open'} thread</span></li>
          ))}
        </ul>
      )}
      {twists.length > 0 && (
        <ul className="swu-list">
          {twists.map((t) => (
            <li key={t.id}>
              <span className="swu-goal-title">{t.title}</span> <span className="swu-pill">{t.status === 'planted' ? 'Planted' : 'Planned'} twist</span>
              {(t.plant_label || t.payoff_label) && (
                <div className="swu-sub">{[t.plant_label ? `Plant in ${t.plant_label}` : null, t.payoff_label ? `pays off in ${t.payoff_label}` : 'no payoff yet'].filter(Boolean).join(' · ')}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SeasonWrapUp({ showId, api = defaultApi, setToast = () => {} }) {
  const [params] = useSearchParams();
  const season = params.get('season');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // The text in the textarea while Evoni edits (a fresh draft or the saved one); null when not editing.
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(null); // 'draft' | 'save'
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get(wrapUpPath(showId, season));
      setData(res?.data || null);
    } catch (err) {
      console.error('[SeasonWrapUp] the season wrap-up load failed:', err);
      setLoadError(err.response?.data?.error || 'The season wrap-up did not load.');
    }
  }, [api, showId, season]);
  useEffect(() => { setDraft(null); setError(null); load(); }, [load]);

  if (loadError) {
    return (
      <p className="swu-load-error" role="alert" data-testid="swu-load-error">
        {loadError} <button type="button" className="swu-link" onClick={load}>Try again</button>
      </p>
    );
  }
  if (!data?.ready || !data.season) return null;

  const { season: s, saved } = data;
  const write = async () => {
    if (draft != null && draft.trim() && draft !== (saved?.text || '')
      && !window.confirm('Replace the text you are editing with a new draft?')) return;
    setBusy('draft');
    setError(null);
    try {
      const res = await api.post(wrapUpPath(showId, season, '/draft'));
      setDraft(res?.data?.draft || '');
    } catch (err) {
      console.error('[SeasonWrapUp] the wrap-up draft failed:', err);
      setError(err.response?.data?.error || 'The AI could not write the wrap-up. Try again.');
    } finally { setBusy(null); }
  };
  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const res = await api.put(wrapUpPath(showId, season), { text: draft });
      setData((prev) => ({ ...prev, saved: res?.data?.saved || null }));
      setDraft(null);
      setToast('Season wrap-up saved.');
    } catch (err) {
      console.error('[SeasonWrapUp] the wrap-up save failed:', err);
      setError(err.response?.data?.error || 'The wrap-up was not saved. Try again.');
    } finally { setBusy(null); }
  };
  const editing = draft != null;

  return (
    <section className="swu" aria-label={`Season ${s.season_number} wrap-up`} data-testid="season-wrapup">
      <div className="swu-head">
        <div>
          <h3 className="swu-title">Season {s.season_number} wrap-up</h3>
          <p className="swu-line">
            {s.complete ? `Season ${s.season_number} is complete` : 'So far'}: {data.finished_count} of {data.episode_count} episodes finished
            {data.goals_reached.length > 0 ? `, ${data.goals_reached.length} ${data.goals_reached.length === 1 ? 'goal' : 'goals'} reached` : ''}.
          </p>
        </div>
      </div>

      <div className="swu-grid">
        <GoalsCard goals={data.goals} />
        <BestCard episodes={data.best_episodes} />
        <MoneyCard money={data.money} />
        <OpenCard threads={data.open_threads} twists={data.open_twists} next={data.next_season_number} />
      </div>

      <div className="swu-ai" data-testid="swu-ai">
        {!editing && saved && (
          <div className="swu-saved" data-testid="swu-saved">
            <p className="swu-saved-text">{saved.text}</p>
            {savedOn(saved.saved_at) && <p className="swu-muted">Saved {savedOn(saved.saved_at)}</p>}
          </div>
        )}
        {editing && (
          <div className="swu-edit">
            <label htmlFor="swu-text" className="swu-label">The wrap-up (edit it, then Save)</label>
            <textarea id="swu-text" className="swu-text" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} data-testid="swu-text" />
          </div>
        )}
        {error && <p className="swu-error" role="alert">{error}</p>}
        <div className="swu-actions">
          <button type="button" className="swu-btn is-primary" onClick={write} disabled={busy != null} data-testid="swu-write">
            <Sparkles size={16} aria-hidden="true" /> {busy === 'draft' ? 'Writing…' : saved || editing ? 'Write it again' : 'Write the wrap-up'}
          </button>
          {!editing && saved && (
            <button type="button" className="swu-btn" onClick={() => setDraft(saved.text)} disabled={busy != null} data-testid="swu-edit">
              <Pencil size={16} aria-hidden="true" /> Edit
            </button>
          )}
          {editing && (
            <>
              <button type="button" className="swu-btn is-save" onClick={save} disabled={busy != null} data-testid="swu-save">
                <Save size={16} aria-hidden="true" /> {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="swu-btn" onClick={() => { setDraft(null); setError(null); }} disabled={busy != null} data-testid="swu-discard">
                {saved ? 'Cancel' : 'Discard'}
              </button>
            </>
          )}
        </div>
        <p className="swu-muted swu-note">One AI call reads the recap above, not the scripts. Nothing is saved until you press Save.</p>
      </div>
    </section>
  );
}

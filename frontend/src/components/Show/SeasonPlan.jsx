/**
 * The Season Plan's pieces, moved out of WorldAdmin.jsx (2026-10-25). The
 * Season page (pages/SeasonPage.jsx, Evoni's mockup) draws them; Producer
 * Mode's Season Plan tab, which drew them too, is retired (Evoni,
 * 2026-10-25: Season is a banner entry that opens the Season page):
 *
 *   useSeasonPlan        the season's loaders and actions (arc, goals,
 *                        roadmap, threads, insights, needs; setup, advance)
 *   the roadmap's parts  useRoadmapControls, AdvanceBar (with AdvanceConfirm),
 *                        SlotSide (SlotPanel with SlotIntentionEditor),
 *                        UnslottedEpisodes
 *   StoryThreadsCard, PlanningInsights, BalanceTrend, SeasonLoadError
 *
 * Styles: the wa-arc-* and wa-season-* rules in WorldAdmin.css, and PLAN_S
 * (planStyles.js) through the `S` prop.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import SlotNotes, { useEventFit, rankedOptions } from './SlotNotes';
import { slotTitle, slotThreads, defaultSlotId } from '../../lib/seasonArc';
import { eventCardDetails } from '../../utils/eventCardSummary';
import '../../pages/WorldAdmin.css';

// ─── SEASON TAB COMPONENT ───────────────────────────────────────────────────
// Planning Insights (§8(ff) A8, Q13, Q15): per slot the plan beside the
// result and its money; phase totals; the balance trend over every ledger
// row; the season-health line. Money is from the ledger, never cost_coins.
export const coins = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n || 0)).toLocaleString()}`;
export const signedCoins = (n) => `${n > 0 ? '+' : ''}${coins(n)}`;

function pressureNote(delta) {
  if (delta == null) return null;
  if (delta === 0) return { text: 'pressure on plan', color: '#15803d' };
  const steps = Math.abs(delta);
  return { text: `${steps} step${steps > 1 ? 's' : ''} ${delta > 0 ? 'above' : 'below'} plan`, color: '#b45309' };
}

export function BalanceTrend({ trend }) {
  if (!trend || trend.length < 2) return null;
  const W = 300; const H = 60; const pad = 4;
  const values = trend.map((t) => t.balance_after);
  const min = Math.min(...values); const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / (trend.length - 1);
  const y = (v) => H - pad - ((v - min) * (H - pad * 2)) / span;
  const path = trend.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t.balance_after).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
      aria-label={`Balance trend from ${coins(values[0])} to ${coins(values[values.length - 1])}`} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="var(--lala-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {trend.map((t, i) => t.between_episodes && (
        <circle key={i} cx={x(i)} cy={y(t.balance_after)} r="2.5" fill="var(--primary)" />
      ))}
    </svg>
  );
}

export function PlanningInsights({ insights, S }) {
  if (!insights) return null;
  const { health, money, phases } = insights;
  const trend = money.trend || [];
  const between = trend.filter((t) => t.between_episodes).length;
  const healthLine = health.accepted === 0
    ? 'No accepted episodes yet.'
    : `${health.in_range} of ${health.with_range} accepted episode${health.with_range === 1 ? ' landed in its' : 's landed in their'} planned outcome range`
      + (health.without_range ? ` · ${health.without_range} had no range planned` : '');
  const stat = (label, value, color) => (
    <div style={{ flex: '1 1 70px', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    </div>
  );
  return (
    <div style={S.card} data-testid="planning-insights">
      <h3 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Planning Insights</h3>
      <p style={{ ...S.muted, margin: '0 0 10px', fontSize: 12 }}>
        Each slot's plan beside what happened. Money comes from the ledger only.
      </p>
      <div data-testid="season-health" style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>
        <strong>Season health:</strong> {healthLine}
      </div>

      <div data-testid="season-money" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {stat('Income', coins(money.season.income), 'var(--success-text)')}
        {stat('Spend', coins(money.season.spend), 'var(--danger-text)')}
        {stat('Net', signedCoins(money.season.net))}
        {money.balance != null && stat('Balance', coins(money.balance), 'var(--lala-gold-text)')}
      </div>
      {trend.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <BalanceTrend trend={trend} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Balance after each of {trend.length} ledger row{trend.length === 1 ? '' : 's'}
            {between > 0 && <> · <span style={{ color: 'var(--primary-text)' }}>●</span> {between} between episodes</>}
          </div>
        </div>
      )}

      {phases.map((p) => (
        <div key={p.phase} data-testid={`insights-phase-${p.phase}`} style={{ borderTop: '1px solid var(--lala-parchment-3)', paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Phase {p.phase}{p.title ? ` · ${p.title}` : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Income {coins(p.totals.income)} · spend {coins(p.totals.spend)} · net {signedCoins(p.totals.net)}
          </div>
          {p.slots.map((sl) => {
            const pn = pressureNote(sl.pressure_delta);
            const range = sl.planned.outcome_range;
            return (
              <div key={sl.slot_number} data-testid={`insights-slot-${sl.slot_number}`} style={{ padding: '6px 0', fontSize: 12, borderTop: '1px dashed var(--lala-parchment-3)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                  {sl.label}{sl.episode ? ` · ${sl.episode.title || 'Untitled'}` : ''}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Planned: {sl.planned.desired_pressure || 'no pressure set'}{range ? ` · ${range.min === range.max ? range.min : `${range.min} to ${range.max}`}` : ''}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Actual: {sl.actual.outcome ? `${sl.actual.outcome} · ${sl.actual.pressure || '—'}` : 'not accepted yet'}
                  {pn && <span style={{ color: pn.color, fontWeight: 600 }}> · {pn.text}</span>}
                  {sl.outcome_in_range != null && (
                    <span style={{ color: sl.outcome_in_range ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}> · {sl.outcome_in_range ? 'in range' : 'outside range'}</span>
                  )}
                </div>
                {sl.money && (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Income {coins(sl.money.income)} · spend {coins(sl.money.spend)} · net {signedCoins(sl.money.net)}
                  </div>
                )}
              </div>
            );
          })}
          {p.unplanned_count > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {p.unplanned_count} slot{p.unplanned_count === 1 ? '' : 's'} with nothing planned yet
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Story threads (§8(ff) A3, A6, Q9): "you create and name them; drafts
// are offered from seeds_future_events. Acceptance can mark one
// "advanced", and only you close one."
export const THREAD_STATUS = {
  open: { label: 'Open', color: 'var(--primary-text)' },
  advanced: { label: 'Advanced', color: 'var(--success-text)' },
  closed: { label: 'Closed', color: 'var(--text-secondary)' },
};

export function StoryThreadsCard({ threads, drafts, S, api, showId, onChanged, setToast }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  // The add form opens from "+ New thread" (Evoni, 2026-10-22 layout list).
  const [adding, setAdding] = useState(false);
  // "Make a thread" from a seed opens a small form on its row, the name
  // filled from the seed (it was a browser prompt; Evoni's review, 2026-10-24).
  const [naming, setNaming] = useState(null);
  const [error, setError] = useState(null);
  const field = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6 };

  const failedWith = (what, err) => {
    console.error(`[StoryThreadsCard] ${what} failed:`, err);
    setError(err.response?.data?.error || err.message || `Could not ${what}.`);
  };
  const create = async (body, done) => {
    setBusy(true); setError(null);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads`, body);
      if (setToast) setToast(done);
      if (onChanged) await onChanged();
      return true;
    } catch (err) {
      failedWith('add the thread', err);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (!title.trim()) return;
    if (await create({ title, description }, 'Story thread added')) { setTitle(''); setDescription(''); setAdding(false); }
  };
  const startNaming = (draft) => { setError(null); setNaming({ seed: draft.seed_text, name: draft.seed_text.slice(0, 120) }); };
  const fromDraft = async (draft) => {
    const name = naming?.seed === draft.seed_text ? naming.name : '';
    if (!name.trim()) return;
    if (await create({ title: name.trim(), seed_text: draft.seed_text, episode_id: draft.episode_id }, 'Story thread added')) setNaming(null);
  };
  const close = async (thread) => {
    if (!window.confirm(`Close "${thread.title}"? A closed thread can no longer be chosen for a slot.`)) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads/${thread.id}/close`);
      if (setToast) setToast('Story thread closed');
      if (onChanged) await onChanged();
    } catch (err) {
      failedWith('close the thread', err);
    }
    setBusy(false);
  };

  // PR 7 choice 1 (Evoni, 2026-10-01): she can reopen a closed thread, with
  // a confirm; it keeps its history.
  const reopen = async (thread) => {
    if (!window.confirm(`Reopen "${thread.title}"? It keeps its history and can be chosen for a slot again.`)) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/api/v1/world/${showId}/season/threads/${thread.id}/reopen`);
      if (setToast) setToast('Story thread reopened');
      if (onChanged) await onChanged();
    } catch (err) {
      failedWith('reopen the thread', err);
    }
    setBusy(false);
  };

  return (
    <div style={S.card} data-testid="story-threads">
      <h3 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Story threads</h3>
      <p style={{ ...S.muted, margin: '0 0 12px', fontSize: 12 }}>
        You create and name them; a slot's intention says which one it continues, and accepting its episode marks the thread advanced. Only you close one, and you can reopen it.
      </p>
      {error && <p className="wa-season-inline-error" role="alert" data-testid="story-threads-error">{error}</p>}
      {threads.length === 0 && <p style={{ ...S.muted, fontSize: 12 }}>No story threads yet.</p>}
      {threads.map((t) => {
        const st = THREAD_STATUS[t.status] || THREAD_STATUS.open;
        return (
          <div key={t.id} data-testid={`story-thread-${t.id}`} style={{ padding: '8px 0', borderTop: '1px solid var(--lala-parchment-3)', display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.status === 'closed' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{t.title}</div>
              {t.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>}
              <div style={{ fontSize: 12, marginTop: 2 }}>
                <span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>
                {Array.isArray(t.slot_numbers) && t.slot_numbers.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> · in {t.slot_numbers.map((n) => `E${n}`).join(', ')}</span>}
                {t.source === 'seed' && <span style={{ color: 'var(--text-secondary)' }}> · from a seed</span>}
                {t.reopened_at && t.status !== 'closed' && <span style={{ color: 'var(--text-secondary)' }}> · reopened</span>}
              </div>
            </div>
            {t.status !== 'closed' ? (
              <button onClick={() => close(t)} disabled={busy} style={{ ...S.secBtn, padding: '4px 10px', fontSize: 12 }}>Close</button>
            ) : (
              <button onClick={() => reopen(t)} disabled={busy} style={{ ...S.secBtn, padding: '4px 10px', fontSize: 12 }}>Reopen</button>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lala-parchment-3)' }}>
        {adding ? (
          <>
            <input aria-label="New thread title" placeholder="New thread title" value={title} onChange={(e) => setTitle(e.target.value)} style={field} autoFocus />
            <textarea aria-label="New thread description" placeholder="What it is about (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...field, marginTop: 6 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button onClick={add} disabled={busy || !title.trim()} style={S.primaryBtn}>Add thread</button>
              <button type="button" onClick={() => { setAdding(false); setTitle(''); setDescription(''); }} style={S.secBtn}>Cancel</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setAdding(true)} style={S.secBtn} data-testid="story-thread-new">+ New thread</button>
        )}
      </div>

      {drafts.length > 0 && (
        <div data-testid="story-thread-drafts" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lala-parchment-3)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Drafts from your episodes' seeds</div>
          {drafts.map((d) => {
            const open = naming?.seed === d.seed_text;
            return (
              <div key={d.seed_text} style={{ padding: '4px 0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: '1 1 200px', minWidth: 0 }}>
                    {d.seed_text}{d.episode_title && <span style={{ color: 'var(--text-secondary)' }}> · {d.episode_title}</span>}
                  </span>
                  {!open && <button onClick={() => startNaming(d)} disabled={busy} className="wa-season-small-btn" data-testid="story-thread-make">Make a thread</button>}
                </div>
                {open && (
                  <form className="wa-season-name-form" data-testid="story-thread-name-form" onSubmit={(e) => { e.preventDefault(); fromDraft(d); }}>
                    <label className="wa-season-name-label">Name this story thread
                      <input aria-label="Thread name" value={naming.name} onChange={(e) => setNaming({ ...naming, name: e.target.value })} style={field} autoFocus maxLength={200} />
                    </label>
                    <div className="wa-season-name-actions">
                      <button type="submit" disabled={busy || !naming.name.trim()} style={S.primaryBtn} data-testid="story-thread-name-save">{busy ? 'Adding…' : 'Add thread'}</button>
                      <button type="button" onClick={() => setNaming(null)} disabled={busy} style={S.secBtn}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Season Arc roadmap (§8(ff) A2): the season's 24 slots in three phases,
// each slot showing its state, numbered "S1 · E7" (Q3). A future slot can
// have an event pencilled in, moved freely (Q5); an episode in no slot can
// be placed in an open one (Q4). A started slot is locked (A7). When every
// slot of the current phase is done, a summary asks before advancing (Q6).
// A slot's state (seasonSlotService.slotState), as its panel names it
// (Evoni's redesign, 2026-10-05); the colours are the .wa-arc-panel.state-*
// rules in WorldAdmin.css.
export const SLOT_STATE_LABEL = { done: 'Done', in_production: 'In production', event_ready: 'Event pencilled', needs_event: 'Open' };

const PRESSURE_OPTIONS = ['Low', 'Medium', 'High', 'Peak'];
const OUTCOME_OPTIONS = ['fail', 'safe', 'pass', 'slay'];

// A slot's intention (§8(ff) A3): story purposes, career focus, desired
// pressure (Q7) and the outcome range hoped for (Q10). Labelled
// Auto-drafted or Edited; Draft asks before replacing an edit.
// A9: a started slot stays editable while its episode is a draft; saving
// updates the episode's season position. A10: up to three purposes, one
// primary, each optionally tied to a story thread.
const MAX_PURPOSES = 3;

function initialPurposes(init) {
  const list = Array.isArray(init.story_purposes) && init.story_purposes.length
    ? init.story_purposes.map((p) => ({ text: p.text || '', primary: Boolean(p.primary), story_thread_id: p.story_thread?.id || '' }))
    : [{ text: init.story_purpose || '', primary: true, story_thread_id: init.story_thread?.id || '' }];
  if (!list.some((p) => p.primary)) list[0].primary = true;
  return list;
}

export function SlotIntentionEditor({ slot, S, api, showId, onSaved, onClose, setToast, threads = [] }) {
  const init = slot.intention || {};
  const started = Boolean(slot.episode);
  const [form, setForm] = useState({
    career_focus: init.career_focus || '',
    desired_pressure: init.desired_pressure || '',
    min: init.outcome_range?.min || '',
    max: init.outcome_range?.max || '',
  });
  const [purposes, setPurposes] = useState(() => initialPurposes(init));
  const setPurpose = (i, patch) => setPurposes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const makePrimary = (i) => setPurposes((ps) => ps.map((p, j) => ({ ...p, primary: j === i })));
  const addPurpose = () => setPurposes((ps) => (ps.length >= MAX_PURPOSES ? ps : [...ps, { text: '', primary: false, story_thread_id: '' }]));
  const removePurpose = (i) => setPurposes((ps) => {
    const next = ps.filter((_, j) => j !== i);
    if (next.length && !next.some((p) => p.primary)) next[0] = { ...next[0], primary: true };
    return next.length ? next : [{ text: '', primary: true, story_thread_id: '' }];
  });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const failedWith = (what, err) => {
    console.error(`[SlotIntentionEditor] ${what} failed:`, err);
    setError(err.response?.data?.error || err.message || `Could not ${what}.`);
  };
  const field = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, marginTop: 4 };
  const label = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 10, display: 'block' };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy('save'); setError(null);
    try {
      await api.put(`/api/v1/world/${showId}/season/slots/${slot.id}/intention`, {
        story_purposes: purposes.map((p) => ({ text: p.text, primary: p.primary, story_thread_id: p.story_thread_id || null })),
        career_focus: form.career_focus,
        desired_pressure: form.desired_pressure || null,
        outcome_range: form.min || form.max ? { min: form.min || form.max, max: form.max || form.min } : null,
      });
      if (setToast) setToast(started ? `${slot.label} intention saved; the episode's season position is updated` : `${slot.label} intention saved`);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      failedWith('save the intention', err);
    }
    setBusy(null);
  };
  // A started slot (A9, as changed 2026-10-01) is drafted from its episode's
  // event and script, and the purposes Evoni edited are kept: no confirm.
  const draft = async () => {
    const edited = init.source === 'edited';
    if (!started && edited && !window.confirm(`${slot.label}'s intention was edited. Replace it with an AI draft?`)) return;
    setBusy('draft'); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/slots/${slot.id}/intention/draft`, !started && edited ? { force: true } : {});
      const d = res?.data?.data || res?.data || {};
      const kept = d.kept_edited || 0;
      if (setToast) {
        setToast(started
          ? `${slot.label} intention drafted from its episode${kept ? `; ${kept} edited purpose${kept === 1 ? '' : 's'} kept` : ''}${d.placed === null && kept ? ' (no room for the drafted purpose)' : ''}`
          : `${slot.label} intention drafted`);
      }
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      failedWith('draft the intention', err);
    }
    setBusy(null);
  };

  // Inside the slot's panel (on a phone, its sheet), under Edit intention
  // (Evoni's review, 2026-10-24: it was under the whole grid, behind the sheet).
  return (
    <div className="wa-arc-intention" data-testid="season-intention-editor" style={{ alignSelf: 'stretch', boxSizing: 'border-box', marginTop: 4, padding: '12px 14px', border: '1px solid var(--lala-gold-line)', borderRadius: 10, background: 'var(--lala-gold-soft)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{slot.label} intention</div>
        {init.source && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{init.source === 'edited' ? 'Edited' : 'Auto-drafted'}</span>}
      </div>
      {started && (
        <div data-testid="season-intention-started" style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 6 }}>
          Started: editable while its episode is a draft. Saving updates the episode's season position; it locks once the episode is accepted. Draft with AI reads its event and script and keeps the purposes you edited.
        </div>
      )}
      <span style={label}>Story purposes (up to {MAX_PURPOSES}, one primary)</span>
      {purposes.map((p, i) => (
        <div key={i} data-testid={`season-purpose-${i}`} style={{ marginTop: 6, padding: 8, border: '1px solid var(--lala-parchment-3)', borderRadius: 8, background: 'var(--surface-card)' }}>
          <textarea aria-label={`Story purpose ${i + 1}`} value={p.text} onChange={(e) => setPurpose(i, { text: e.target.value })} rows={2} style={{ ...field, marginTop: 0 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name={`primary-${slot.id}`} aria-label={`Primary purpose ${i + 1}`} checked={p.primary} onChange={() => makePrimary(i)} /> Primary
            </label>
            <select aria-label={`Story thread ${i + 1}`} value={p.story_thread_id} onChange={(e) => setPurpose(i, { story_thread_id: e.target.value })} style={{ ...field, marginTop: 0, flex: '1 1 140px', width: 'auto' }}>
              <option value="">No story thread</option>
              {threads.filter((t) => t.status !== 'closed' || t.id === p.story_thread_id).map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.status === 'closed' ? ' (closed)' : ''}</option>
              ))}
            </select>
            {purposes.length > 1 && (
              <button type="button" onClick={() => removePurpose(i)} style={{ fontSize: 12, border: 'none', background: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}>Remove</button>
            )}
          </div>
        </div>
      ))}
      {purposes.length < MAX_PURPOSES && (
        <button type="button" data-testid="season-purpose-add" onClick={addPurpose} style={{ marginTop: 6, fontSize: 12, padding: '3px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--lala-gold-text)', cursor: 'pointer' }}>
          + Add a purpose
        </button>
      )}
      <label style={label}>Career focus
        <input aria-label="Career focus" value={form.career_focus} onChange={set('career_focus')} style={field} />
      </label>
      <label style={label}>Desired pressure
        <select aria-label="Desired pressure" value={form.desired_pressure} onChange={set('desired_pressure')} style={field}>
          <option value="">Not set</option>
          {PRESSURE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <span style={label}>Outcome range hoped for</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select aria-label="Lowest outcome" value={form.min} onChange={set('min')} style={{ ...field, marginTop: 0 }}>
          <option value="">From…</option>
          {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>to</span>
        <select aria-label="Highest outcome" value={form.max} onChange={set('max')} style={{ ...field, marginTop: 0 }}>
          <option value="">To…</option>
          {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {error && <p className="wa-season-inline-error" role="alert" data-testid="season-intention-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={save} disabled={!!busy} style={S.primaryBtn}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
        <button onClick={draft} disabled={!!busy} style={S.secBtn}>{busy === 'draft' ? 'Drafting...' : 'Draft with AI'}</button>
        <button onClick={onClose} disabled={!!busy} style={S.secBtn}>Close</button>
      </div>
    </div>
  );
}

const slotSelectStyle = { width: '100%', marginTop: 6, fontSize: 12, padding: '4px 6px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-primary)', minWidth: 0 };

// The open slot, beside the season's grid: what it holds, its event and the
// deal, the threads it moves, and its controls (pencil an event, the
// intention, the episode).
// Planner PR 3 (2026-10-24): the panel also lists what is planned there
// (its twists, secrets and the relationships it needs, SlotNotes), and the
// pencil list is ranked by fit for this slot, each event with a reason.
// readOnly: a past season (the Season page's switcher, 2026-10-25): read, never pencilled or re-planned.
export function SlotPanel({ slot, showId, available, busy, episode, event, onPencil, onIntention, onClose, editing = false, error = null, children = null, api = null, needs = [], onNeedsChanged, readOnly = false }) {
  const fit = useEventFit(api, showId, slot.id, !readOnly && !slot.locked && available.length > 0);
  const options = rankedOptions(available, fit);
  const title = slotTitle(slot);
  const logline = episode?.logline || episode?.description || null;
  const deal = event ? eventCardDetails(event).deal : null;
  const purposes = slot.intention?.story_purposes || [];
  const primary = slot.intention?.story_purpose;
  const threads = slotThreads(slot);
  const state = SLOT_STATE_LABEL[slot.state] || SLOT_STATE_LABEL.needs_event;
  return (
    <section className={`wa-arc-panel state-${slot.state}`} data-testid="season-slot-panel" aria-label={`Slot ${slot.label}`}>
      <span className="wa-arc-eyebrow">Slot {slot.label}</span>
      {/* × closes the sheet on a phone; hidden elsewhere. */}
      {onClose && <button type="button" className="wa-arc-sheet-close" aria-label="Close" onClick={onClose}>×</button>}
      <h3 className="wa-arc-panel-title">{title || 'Open slot'}</h3>
      <span className="wa-arc-chip">{state}{slot.locked ? ' · locked' : ''}</span>
      {logline && <p className="wa-arc-logline">{logline}</p>}
      {primary && (
        <p className="wa-arc-purpose" data-testid={`season-slot-purpose-${slot.slot_number}`}>
          {primary}
          {purposes.length > 1 && <span className="wa-arc-more"> +{purposes.length - 1} more</span>}
          {slot.intention?.source === 'auto-drafted' && <span className="wa-arc-source"> · Auto-drafted</span>}
        </p>
      )}

      <dl className="wa-arc-facts">
        <div><dt>Event</dt><dd>{slot.event?.name || 'None pencilled'}</dd></div>
        {deal && <div><dt>Deal{deal.label ? ` · ${deal.label}` : ''}</dt><dd>{deal.pays}</dd></div>}
      </dl>

      {threads.length > 0 && (
        <div className="wa-arc-threads">
          <span className="wa-arc-threads-label">Threads this episode moves</span>
          <ul>{threads.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
        </div>
      )}

      {api && <SlotNotes api={api} showId={showId} slot={slot} needs={needs} onNeedsChanged={onNeedsChanged} />}

      {readOnly && <p className="wa-arc-readonly" data-testid="season-slot-readonly">A past season: this slot is read here, not changed.</p>}
      {!readOnly && !slot.locked && (
        <select
          className="wa-arc-select"
          aria-label={`Pencil an event into ${slot.label}`}
          data-testid={`season-pencil-${slot.slot_number}`}
          value=""
          disabled={busy}
          onChange={(e) => onPencil(e.target.value)}
        >
          <option value="">{slot.event ? 'Change event…' : fit?.length ? 'Pencil an event (best fit first)…' : 'Pencil an event…'}</option>
          {options.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
          {slot.event && <option value="__clear__">Clear this slot</option>}
        </select>
      )}
      {!readOnly && (slot.intention_editable ?? !slot.locked) && (
        <button type="button" className="wa-arc-secondary" data-testid={`season-intention-${slot.slot_number}`} onClick={onIntention} aria-expanded={editing}>
          {primary ? 'Edit intention' : 'Add intention'}
        </button>
      )}
      {children}
      {error && <p className="wa-season-inline-error" role="alert" data-testid="season-slot-error">{error}</p>}
      {slot.episode ? (
        <Link className="wa-arc-primary" to={`/episodes/${slot.episode.id}`}>
          {slot.state === 'done' ? 'Open episode' : 'Continue episode'}
        </Link>
      ) : slot.event ? (
        <Link className="wa-arc-primary" to={`/shows/${showId}/events/${slot.event.id}`}>Open the event package</Link>
      ) : null}
    </section>
  );
}

// The confirm step before an advance, in the page (Evoni's review,
// 2026-10-24): which slots stay open, which goals are unmet and what happens
// to them, and whether advancing completes the season.
export function AdvanceConfirm({ warning, advancing, onConfirm, onCancel, S }) {
  const open = warning.open_slots || [];
  const unmet = warning.unmet_goals || [];
  const final = Boolean(warning.is_final);
  const them = unmet.length === 1 ? 'it' : 'them';
  const debtWord = final ? `Completing the season leaves ${them} unmet.` : `Advancing carries ${them} as narrative debt.`;
  const confirmLabel = final
    ? 'Confirm: complete the season'
    : unmet.length || (warning.warning && !open.length) ? 'Confirm: advance and carry the debt' : 'Confirm: advance with open slots';
  return (
    <div className="wa-arc-confirm" data-testid="season-phase-confirm" role="group" aria-label={final ? 'Complete the season?' : 'Advance the phase?'}>
      <div className="wa-arc-confirm-title">
        {final ? 'Complete the season?' : `Advance to Phase ${warning.next_phase?.phase}${warning.next_phase?.title ? `: ${warning.next_phase.title}` : ''}?`}
      </div>
      {open.length > 0 && (
        <p className="wa-arc-confirm-line" data-testid="season-confirm-open-slots">
          {open.length} {open.length === 1 ? 'slot stays' : 'slots stay'} open: {open.map((sl) => `E${sl.slot_number}`).join(', ')}.
          {' '}{final ? 'The season completes with them unfilled.' : `They stay in Part ${warning.current_phase?.phase ?? ''} and can still be filled.`}
        </p>
      )}
      {unmet.length > 0 && (
        <div data-testid="season-confirm-unmet">
          <p className="wa-arc-confirm-line">{unmet.length} {unmet.length === 1 ? 'goal is' : 'goals are'} unmet. {debtWord}</p>
          <ul className="wa-arc-confirm-goals">
            {unmet.map((g) => (
              <li key={g.id}>{g.title}{g.target_value != null && <span> ({g.current_value ?? 0}/{g.target_value}{g.target_metric ? ` ${String(g.target_metric).replace(/_/g, ' ')}` : ''})</span>}</li>
            ))}
          </ul>
        </div>
      )}
      {warning.warning && unmet.length === 0 && <p className="wa-arc-confirm-line">{warning.warning}</p>}
      <div className="wa-arc-confirm-actions">
        <button type="button" onClick={onConfirm} disabled={advancing} style={{ ...S.primaryBtn, background: 'var(--warning-text)' }} data-testid="season-confirm-advance">
          {advancing ? (final ? 'Completing...' : 'Advancing...') : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={advancing} style={S.secBtn}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * The roadmap's controls, for the Season page's roadmap cards and events
 * list (2026-10-25): which slot is open, its sheet on a phone, the
 * intention editor, and the pencil and placement saves with their errors.
 */
export function useRoadmapControls({ roadmap, api, showId, onChanged, setToast }) {
  const [busySlot, setBusySlot] = useState(null);
  // A pencil or placement that failed: said in the page, where it was done.
  const [slotError, setSlotError] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  // On a phone the panel is a sheet from the bottom, open after a tap (Evoni, 2026-10-22 layout list).
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelRef = useRef(null);
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);
  const phases = roadmap?.phases || [];
  const allSlots = phases.flatMap((p) => p.slots);
  const openSlots = allSlots.filter((sl) => !sl.locked);
  const selected = roadmap
    ? allSlots.find((sl) => sl.id === selectedId) || allSlots.find((sl) => sl.id === defaultSlotId(roadmap)) || null
    : null;
  const editing = allSlots.find((sl) => sl.id === editingSlotId) || null;

  const save = async (slotId, path, body, done) => {
    setBusySlot(slotId); setSlotError(null);
    try {
      await api.put(`/api/v1/world/${showId}/season/slots/${slotId}/${path}`, body);
      if (setToast) setToast(done);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(`[SeasonRoadmap] ${path} save failed:`, err);
      setSlotError({ where: path, slotId, text: err.response?.data?.error || err.message || 'That was not saved.' });
    }
    setBusySlot(null);
  };
  const pencil = (slot, value) => {
    if (value === '') return;
    const eventId = value === '__clear__' ? null : value;
    save(slot.id, 'event', { event_id: eventId }, eventId ? `Pencilled into ${slot.label}` : `${slot.label} cleared`);
  };
  const place = (episode, slotId) => {
    if (!slotId) return;
    const slot = openSlots.find((sl) => sl.id === slotId);
    if (!window.confirm(`Place "${episode.title || 'this episode'}" in ${slot?.label}? The slot then locks to it.`)) return;
    save(slotId, 'episode', { episode_id: episode.id }, `Placed in ${slot?.label}`);
  };
  // Opening a slot: on a phone the panel opens as a sheet; between a phone
  // and a desktop, where it sits above the parts, it scrolls into view.
  const open = (slot) => {
    setSelectedId(slot.id);
    if (slotError?.slotId !== slot.id) setSlotError(null);
    if (editingSlotId && editingSlotId !== slot.id) setEditingSlotId(null);
    setSheetOpen(true);
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 769px) and (max-width: 1099px)').matches) {
      panelRef.current?.querySelector('.wa-arc-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  };
  return {
    busySlot, slotError, editing, editingSlotId, setEditingSlotId, selected, sheetOpen, setSheetOpen, panelRef,
    openSlots, pencil, place, open,
  };
}

/**
 * Advancing the part (Evoni's rulings): at the phase boundary the summary
 * box; before it, "Advance with N open slots", shown only once a slot of the
 * current part is done ("Only show it once a slot is done", 2026-10-25). The
 * server's confirm step is unchanged.
 */
export function AdvanceBar({ roadmap, S, onAdvance, advancing, advanceWarning, onConfirmAdvance, onCancelAdvance, advanceError = null }) {
  if (!roadmap) return null;
  const phases = roadmap.phases || [];
  const currentPart = phases.find((p) => p.phase === Number(roadmap.arc?.current_phase)) || null;
  const openInPart = currentPart ? currentPart.slots.filter((sl) => sl.state !== 'done') : [];
  const doneInPart = currentPart ? currentPart.slots.length - openInPart.length : 0;
  const isLastPart = Boolean(currentPart) && currentPart.phase === Math.max(...phases.map((p) => p.phase));
  return (
    <>
      {roadmap.phase_boundary && (() => {
        const pb = roadmap.phase_boundary;
        const outcomeText = Object.entries(pb.outcomes || {}).map(([tier, n]) => `${n} ${tier}`).join(' · ');
        return (
          <div data-testid="season-phase-boundary" style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--lala-gold-soft)', border: '1px solid var(--lala-gold-line)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Phase {pb.phase}: {pb.title} is complete</div>
            {outcomeText && <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>Results: {outcomeText}</div>}
            {pb.goals && (
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>
                Goals: {pb.goals.completed} of {pb.goals.total} complete{pb.goals.unmet > 0 ? `; ${pb.goals.unmet} unmet${pb.next_phase ? ' will be carried as narrative debt' : ', left unmet when the season completes'}` : ''}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>
              {pb.next_phase
                ? `Advancing opens Phase ${pb.next_phase.phase}: ${pb.next_phase.title}${pb.next_phase.tagline ? ` (“${pb.next_phase.tagline}”)` : ''} and activates its goals.`
                : 'Advancing completes the season.'}
            </div>
            {advanceWarning ? (
              <AdvanceConfirm warning={advanceWarning} advancing={advancing} onConfirm={onConfirmAdvance} onCancel={onCancelAdvance} S={S} />
            ) : onAdvance && (
              <button onClick={onAdvance} disabled={advancing} style={{ ...S.primaryBtn, marginTop: 10 }} data-testid="season-advance">
                {advancing ? 'Advancing...' : pb.next_phase ? `Advance to Phase ${pb.next_phase.phase}` : 'Complete the season'}
              </button>
            )}
            {advanceError && <p className="wa-season-inline-error" role="alert" data-testid="season-advance-error">{advanceError}</p>}
          </div>
        );
      })()}

      {/* The phase is not done yet: she can still advance, leaving its open
          slots open (Evoni's review, 2026-10-24: Advance lived only in the
          boundary box, which needs every slot done), once one is done. */}
      {!roadmap.phase_boundary && currentPart && openInPart.length > 0 && doneInPart > 0 && onAdvance && (
        <div className="wa-arc-open-advance" data-testid="season-advance-open">
          <p className="wa-arc-open-advance-text">
            Part {currentPart.phase}: {currentPart.title} · {doneInPart} of {currentPart.slots.length} slots done
          </p>
          {advanceWarning ? (
            <AdvanceConfirm warning={advanceWarning} advancing={advancing} onConfirm={onConfirmAdvance} onCancel={onCancelAdvance} S={S} />
          ) : (
            <button type="button" className="wa-arc-open-advance-btn" onClick={onAdvance} disabled={advancing} data-testid="season-advance-open-btn">
              {advancing ? 'Checking...' : `${isLastPart ? 'Complete the season' : 'Advance'} with ${openInPart.length} open ${openInPart.length === 1 ? 'slot' : 'slots'}`}
            </button>
          )}
          {advanceError && <p className="wa-season-inline-error" role="alert" data-testid="season-advance-error">{advanceError}</p>}
        </div>
      )}
    </>
  );
}

/** The open slot's panel beside the grid (a sheet on a phone), with its intention editor. */
export function SlotSide({ controls, roadmap, S, api, showId, onChanged, setToast, threads = [], episodes = [], events = [], needs = [], onNeedsChanged, readOnly = false }) {
  const { selected, editing, editingSlotId, setEditingSlotId, sheetOpen, setSheetOpen, panelRef, busySlot, slotError, pencil } = controls;
  const available = roadmap?.available_events || [];
  return (
    <aside className={`wa-arc-side${sheetOpen ? ' is-sheet-open' : ''}`} ref={panelRef}>
      <button type="button" className="wa-arc-sheet-backdrop" aria-label="Close the slot" tabIndex={-1} onClick={() => setSheetOpen(false)} />
      {selected && (
        <SlotPanel
          onClose={() => setSheetOpen(false)}
          slot={selected} showId={showId} available={available} busy={busySlot === selected.id}
          episode={episodes.find((e) => e.id === selected.episode?.id) || null}
          event={events.find((e) => e.id === selected.event?.id) || null}
          onPencil={(value) => pencil(selected, value)}
          onIntention={() => setEditingSlotId(editingSlotId === selected.id ? null : selected.id)}
          editing={editing?.id === selected.id}
          error={slotError && slotError.slotId === selected.id && slotError.where === 'event' ? slotError.text : null}
          api={api} needs={needs} onNeedsChanged={onNeedsChanged} readOnly={readOnly}
        >
          {!readOnly && editing && editing.id === selected.id && (
            <SlotIntentionEditor key={editing.id} slot={editing} S={S} api={api} showId={showId}
              onSaved={onChanged} onClose={() => setEditingSlotId(null)} setToast={setToast} threads={threads} />
          )}
        </SlotPanel>
      )}
    </aside>
  );
}

/** The episodes in no slot, each with "Place in…". */
export function UnslottedEpisodes({ roadmap, controls }) {
  const unslotted = roadmap?.unslotted_episodes || [];
  const { slotError, openSlots, place } = controls;
  if (!unslotted.length) return null;
  return (
    <div data-testid="season-unslotted" style={{ marginTop: 16, padding: '10px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning-text)', marginBottom: 6 }}>
        Not in a slot ({unslotted.length})
      </div>
      <p style={{ fontSize: 12, color: 'var(--warning-text)', margin: '0 0 6px' }}>
        These episodes are not placed on the roadmap yet. Place one, or leave it unslotted.
      </p>
      {slotError?.where === 'episode' && <p className="wa-season-inline-error" role="alert" data-testid="season-place-error">{slotError.text}</p>}
      {unslotted.map((ep) => (
        <div key={ep.id} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '4px 0' }}>
          {ep.title || 'Untitled episode'}
          <span style={{ color: 'var(--text-secondary)' }}> · {ep.evaluation_status === 'accepted' ? 'done' : (ep.status || 'draft')}</span>
          <select
            aria-label={`Place ${ep.title || 'episode'} in a slot`}
            data-testid={`season-place-${ep.id}`}
            value=""
            onChange={(e) => place(ep, e.target.value)}
            style={{ ...slotSelectStyle, maxWidth: 220, display: 'block' }}
          >
            <option value="">Place in…</option>
            {openSlots.map((sl) => <option key={sl.id} value={sl.id}>{sl.label}{sl.event ? ` (${sl.event.name})` : ''}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

const SEASON_PART_LABEL = { season: 'the season', goals: 'the goals', roadmap: 'the roadmap', threads: 'the story threads', insights: 'Planning Insights' };

// Lala's temperament (arc.emotional_temperature), as a chip: on the Season
// Plan's header and the Season page's overview.
export const TEMP_CONFIG = {
  unstoppable: { color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)', label: 'Unstoppable' },
  confident:   { color: 'var(--success-text)', bg: 'var(--success-bg)', label: 'Confident' },
  rising:      { color: 'var(--primary-text)', bg: 'var(--primary-subtle)', label: 'Rising' },
  anxious:     { color: 'var(--warning-text)', bg: 'var(--warning-bg)', label: 'Anxious' },
  desperate:   { color: 'var(--danger-text)', bg: 'var(--danger-bg)', label: 'Desperate' },
  broken:      { color: 'var(--danger-text)', bg: 'var(--danger-bg)', label: 'Broken' },
};

/**
 * The Season page's data and actions (Evoni, 2026-10-25). The first load
 * shows "Loading"; every later one reloads in place. A part that did not
 * load is named in `failed`, with a Retry. `loadGoals` reloads the goals
 * alone, after the Goals tab changes one, so the stat card and the
 * Overview's Season Goals count them at once.
 */
export function useSeasonPlan({ showId, api, setToast, season = null }) {
  // season: another season's number (the Season page's switcher, ?season=N);
  // the arc, roadmap and Planning Insights read it, the rest read the show.
  const seasonQuery = season ? `?season=${encodeURIComponent(season)}` : '';
  const [arc, setArc] = useState(null);
  // Every season of the show, and the one in progress (else the latest).
  const [seasons, setSeasons] = useState([]);
  const [currentArcId, setCurrentArcId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Setting up a season (Evoni, 2026-10-24): the next season's number, and
  // which setup panel is open: 'new' (the form for the next season), 'edit',
  // 'place' (use your events and episodes) or 'draft'.
  const [nextSeason, setNextSeason] = useState(1);
  const [panel, setPanel] = useState(null);
  const [seedingGoals, setSeedingGoals] = useState(false);
  const [setupNote, setSetupNote] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [warning, setWarning] = useState(null);
  const [goals, setGoals] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [insights, setInsights] = useState(null);
  const [threadData, setThreadData] = useState({ threads: [], drafts: [] });
  // The relationships the season needs (planner PR 3); its own error, shown in its fold.
  const [needs, setNeeds] = useState({ data: null, error: null });
  const loadNeeds = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/needs`);
      setNeeds({ data: { needs: r.data?.needs || [], counts: r.data?.counts || {} }, error: null });
    } catch (err) {
      console.error('Season needs load failed:', err);
      setNeeds((n) => ({ ...n, error: err.response?.data?.error || err.message || 'failed' }));
    }
  }, [showId]);
  // What did not load, by part, so the tab says so with a Retry instead of
  // reading as "No season set up yet" (Evoni's review, 2026-10-24).
  const [failed, setFailed] = useState({});
  const markFailed = useCallback((part, err) => setFailed((f) => ({ ...f, [part]: err ? (err.response?.data?.error || err.message || 'failed') : null })), []);
  // An advance that failed: said in the page, by the advance controls.
  const [advanceError, setAdvanceError] = useState(null);

  // The season's 24 slots (Season Arc §8(ff) A2); reloaded alone after a
  // pencil or placement so the tab does not blank. A failed reload keeps
  // what is on screen.
  const loadRoadmap = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/roadmap${seasonQuery}`);
      setRoadmap(r.data.roadmap || null);
      markFailed('roadmap', null);
    } catch (err) {
      console.error('Season roadmap load failed:', err);
      markFailed('roadmap', err);
    }
    // Story threads (§8(ff) Q9)
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/threads`);
      setThreadData({ threads: r.data.threads || [], drafts: r.data.drafts || [] });
      markFailed('threads', null);
    } catch (err) {
      console.error('Story threads load failed:', err);
      markFailed('threads', err);
    }
    // Planning Insights (§8(ff) A8). The season-health score is one line in
    // it, from the slot outcome ranges (Q15); the old 1/4/2/1 grade is not read.
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/insights${seasonQuery}`);
      setInsights(r.data.insights || null);
      markFailed('insights', null);
    } catch (err) {
      console.error('Planning Insights load failed:', err);
      markFailed('insights', err);
    }
    // A purpose, a pencil or a placement can change what the season needs.
    await loadNeeds();
  }, [showId, markFailed, loadNeeds, seasonQuery]);

  // Every goal, so the phases show what was hit and missed, the checklist
  // knows whether any is live, and the Goals tab lists them.
  const loadGoals = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/goals`);
      setGoals(r.data.goals || []);
      markFailed('goals', null);
    } catch (err) {
      console.error('Season goals load failed:', err);
      markFailed('goals', err);
    }
  }, [showId, markFailed]);

  // The first load shows "Loading"; every later one (after an accept, an
  // advance, a setup save) reloads in place, so the parts below keep what
  // she typed and the forms she has open (Evoni's review, 2026-10-24).
  const loadArc = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    try {
      const r = await api.get(`/api/v1/world/${showId}/arc${seasonQuery}`);
      setArc(r.data.arc);
      setNextSeason(r.data.next_season_number || 1);
      setSeasons(r.data.seasons || []);
      setCurrentArcId(r.data.current_arc_id || r.data.arc?.id || null);
      markFailed('season', null);
    } catch (err) {
      console.error('Season arc load failed:', err);
      markFailed('season', err);
    }

    await loadGoals();
    await loadRoadmap();

    if (initial) setLoading(false);
  }, [showId, loadRoadmap, loadGoals, markFailed, seasonQuery]);

  useEffect(() => { loadArc({ initial: true }); }, [loadArc]);
  const retry = () => loadArc({ initial: !arc });

  // The form's Save: a new season, or Edit season. A refusal is thrown back
  // to the form, which shows it in place.
  const handleSeed = async (body) => {
    const r = await api.post(`/api/v1/world/${showId}/arc/seed`, body);
    setPanel(null);
    setSetupNote(`Season ${r.data.season_number} is set up. Next: place your episodes and events.`);
    await loadArc();
  };
  const handleEdit = async (body) => {
    const r = await api.put(`/api/v1/world/${showId}/arc/setup`, body);
    setPanel(null);
    setSetupNote(r.data.moved ? `Season saved; ${r.data.moved} ${r.data.moved === 1 ? 'slot moved' : 'slots moved'} to a new part.` : 'Season saved.');
    await loadArc();
  };
  const seedGoals = async () => {
    setSeedingGoals(true); setSetupNote(null);
    try {
      const r = await api.post(`/api/v1/world/${showId}/goals/seed`, { activate_tier: 1 });
      setSetupNote(r.data.created ? `Seeded ${r.data.created} goals.` : 'No new goals: the show already has these. Add your own on the Goals tab.');
      await loadArc();
    } catch (err) {
      console.error('Seed goals failed:', err);
      setSetupNote(err.response?.data?.error || 'The goals were not seeded.');
    }
    setSeedingGoals(false);
  };

  // Advance (at the phase boundary, or "Advance with N open slots"): the
  // server asks first when goals are unmet or slots are not done, and the
  // confirm step in the roadmap lists them; at the last phase it says the
  // season completes.
  const handleAdvance = async () => {
    setAdvancing(true); setAdvanceError(null);
    try {
      const r = await api.post(`/api/v1/world/${showId}/arc/advance`);
      if (r.data.data?.needs_confirmation) {
        setWarning(r.data.data);
        setAdvancing(false);
        return;
      }
      setWarning(null);
      await loadArc();
      if (setToast) setToast(r.data.data?.arc_completed ? 'Season complete' : 'Phase advanced');
    } catch (err) {
      console.error('Phase advance failed:', err);
      setAdvanceError(err.response?.data?.error || err.message || 'The phase did not advance.');
    }
    setAdvancing(false);
  };

  const handleConfirmAdvance = async () => {
    setAdvancing(true); setAdvanceError(null);
    try {
      const r = await api.post(`/api/v1/world/${showId}/arc/advance/confirm`);
      setWarning(null);
      await loadArc();
      if (setToast) setToast(r.data?.data?.arc_completed ? 'Season complete' : 'Phase advanced');
    } catch (err) {
      console.error('Phase advance (confirmed) failed:', err);
      setAdvanceError(err.response?.data?.error || err.message || 'The phase did not advance.');
    }
    setAdvancing(false);
  };

  return {
    arc, loading, nextSeason, panel, setPanel, seedingGoals, setupNote, setSetupNote, seasons, currentArcId,
    // Whether the season shown is the one in progress (a past one, from the switcher, is read-only here).
    isCurrent: !arc || !currentArcId || arc.id === currentArcId,
    advancing, warning, setWarning, advanceError, goals, roadmap, insights, threadData, needs, failed,
    loadNeeds, loadRoadmap, loadArc, loadGoals, retry, handleSeed, handleEdit, seedGoals, handleAdvance, handleConfirmAdvance,
  };
}

/** The load-error box, by part, with a Retry (Evoni's review, 2026-10-24). */
export function SeasonLoadError({ plan }) {
  const { failed, arc, retry } = plan;
  const failedParts = Object.entries(failed).filter(([, v]) => v).map(([k]) => k);
  if (!failedParts.length) return null;
  return (
    <div className="wa-season-error" role="alert" data-testid="season-load-error">
      <span>
        {failed.season && !arc
          ? `The season could not be loaded (${failed.season}).`
          : `Some of the season did not load: ${failedParts.map((k) => SEASON_PART_LABEL[k] || k).join(', ')}.`}
      </span>
      <button type="button" className="wa-season-error-retry" onClick={retry} data-testid="season-load-retry">Retry</button>
    </div>
  );
}

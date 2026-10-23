/**
 * Fix what can be fixed (Evoni, 2026-10-18: "how can we fix these
 * automatically"), on Facts & checks: one run takes the whole cast through
 * the tools each character's page has (POST /api/v1/cast/consistency/fix-all,
 * services/castFixAll). What it changed comes back with an Undo for each;
 * what it could not do says why. Rewrites of their text wait here for her
 * one "Apply all" click (her ruling), and a built voice still waits for her
 * approval on Voices. Styles: TheCast.css (cast-fix-*).
 */
import React, { useState } from 'react';
import api from '../../services/api';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const itemKey = (q) => `${q.character_id}:${q.flag_id}`;

function Change({ change, onUndo }) {
  const [state, setState] = useState(null);
  const undo = async () => {
    setState({ busy: true });
    try {
      await api.post('/api/v1/cast/consistency/undo', { change });
      setState({ done: true });
      onUndo?.();
    } catch (err) {
      console.error('[CastFixAll] the undo failed:', err);
      setState({ error: errorText(err, 'That could not be undone.') });
    }
  };
  return (
    <li className="cast-fix-change" data-testid="cast-fix-change">
      <span className={state?.done ? 'cast-fix-undone' : undefined}>{change.label}</span>
      {state?.done ? <span className="cast-note">Undone</span> : (
        <button type="button" className="cast-fix-link" disabled={state?.busy} onClick={undo}>Undo</button>
      )}
      {state?.error && <span className="cast-note" role="alert">{state.error}</span>}
    </li>
  );
}

export default function CastFixAll({ registryIds, onDone }) {
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [off, setOff] = useState(() => new Set());
  const [applied, setApplied] = useState(null);
  const key = (registryIds || []).join(',');

  const fixAll = async () => {
    setBusy('run'); setError(null); setApplied(null); setOff(new Set());
    try {
      const { data } = await api.post('/api/v1/cast/consistency/fix-all', { registry_id: key });
      setRun(data);
      onDone?.();
    } catch (err) {
      console.error('[CastFixAll] the run failed:', err);
      setError(errorText(err, 'The cast could not be fixed. Try again.'));
    } finally { setBusy(null); }
  };

  const queued = (run?.characters || []).flatMap((c) => c.queued.map((q) => ({ ...q, name: c.name })));
  const chosen = queued.filter((q) => !off.has(itemKey(q)));
  const toggle = (q) => setOff((s) => {
    const next = new Set(s);
    if (next.has(itemKey(q))) next.delete(itemKey(q)); else next.add(itemKey(q));
    return next;
  });

  const applyAll = async () => {
    setBusy('apply'); setError(null);
    try {
      const items = chosen.map(({ character_id, flag_id, verdict, before, after, why }) => ({ character_id, flag_id, verdict, before, after, why }));
      const { data } = await api.post('/api/v1/cast/consistency/apply-rewrites', { items });
      setApplied(data);
      onDone?.();
    } catch (err) {
      console.error('[CastFixAll] Apply all failed:', err);
      setError(errorText(err, 'The rewrites could not be applied. Try again.'));
    } finally { setBusy(null); }
  };

  return (
    <div className="cast-fix" data-testid="cast-fix">
      <div className="cast-fix-head">
        <button type="button" className="cast-btn-primary" disabled={!!busy || !key} onClick={fixAll}>
          {busy === 'run' ? 'Fixing the cast…' : 'Fix what can be fixed'}
        </button>
        <span className="cast-note">
          Links Pulse profiles, confirms followers, fills missing facts and types, fixes findings with one right wording,
          and builds voices for Active characters. Rewrites wait for you; voices wait for your approval.
          A few AI calls per character.
        </span>
      </div>
      {error && <p className="cast-note" role="alert">{error}</p>}

      {run && (
        <div className="cast-fix-result" data-testid="cast-fix-result">
          <p className="cast-note" data-testid="cast-fix-summary">
            {run.summary.changes} change{run.summary.changes === 1 ? '' : 's'} made · {run.summary.queued} rewrite{run.summary.queued === 1 ? '' : 's'} waiting for you
          </p>
          {run.stopped && <p className="cast-note" role="alert">The run stopped: {run.stopped} What was done before it stays.</p>}
          <ul className="cast-fix-list">
            {run.characters.filter((c) => c.changes.length || c.left.length).map((c) => (
              <li key={c.id} className="cast-fix-row" data-testid="cast-fix-row">
                <strong>{c.name}</strong>
                {c.changes.length > 0 && (
                  <ul className="cast-fix-changes">{c.changes.map((ch) => <Change key={ch.id} change={ch} onUndo={onDone} />)}</ul>
                )}
                {c.left.length > 0 && (
                  <ul className="cast-fix-left">{c.left.map((l, i) => <li key={`${i}-${l}`} className="cast-note">Left: {l}</li>)}</ul>
                )}
              </li>
            ))}
          </ul>

          {queued.length > 0 && !applied && (
            <section className="cast-fix-queue" data-testid="cast-fix-queue" aria-labelledby="cast-fix-queue-h">
              <h3 id="cast-fix-queue-h" className="cast-fix-h3">Waiting for you</h3>
              <ul className="cast-fix-items">
                {queued.map((q) => (
                  <li key={itemKey(q)} className="cast-fix-item">
                    <label className="cast-fix-pick">
                      <input type="checkbox" checked={!off.has(itemKey(q))} onChange={() => toggle(q)} />
                      <span><strong>{q.name}</strong>{q.field_label ? ` · ${q.field_label}` : ''}</span>
                    </label>
                    {q.verdict === 'fix' ? (
                      <>
                        <p className="cast-fix-before">{q.before}</p>
                        <p className="cast-fix-after">{q.after}</p>
                      </>
                    ) : (
                      <p className="cast-fix-after">Keep as written: {q.before}</p>
                    )}
                    {q.why && <p className="cast-note">{q.why}</p>}
                  </li>
                ))}
              </ul>
              <button type="button" className="cast-btn-primary" disabled={!!busy || !chosen.length} onClick={applyAll}>
                {busy === 'apply' ? 'Applying…' : `Apply all ${chosen.length}`}
              </button>
            </section>
          )}

          {applied && (
            <div data-testid="cast-fix-applied">
              <p className="cast-note">{applied.applied} applied{applied.skipped ? ` · ${applied.skipped} skipped because the text changed` : ''}</p>
              <ul className="cast-fix-changes">
                {applied.results.filter((r) => r.ok && r.change).map((r) => <Change key={r.change.id} change={r.change} onUndo={onDone} />)}
                {applied.results.filter((r) => !r.ok).map((r, i) => <li key={`${i}-${r.flag_id}`} className="cast-note">Skipped: {r.error}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

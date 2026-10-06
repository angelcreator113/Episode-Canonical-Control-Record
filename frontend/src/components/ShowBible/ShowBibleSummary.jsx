/**
 * ShowBibleSummary — the Show Bible's front page in the LalaVerse hub, to
 * Evoni's mock (2026-10-06): "Always true", "Canon guard" and "Decisions,
 * newest first", above the Bible's own tabs (Knowledge, Decisions,
 * Documents, Guard), which stay as they were.
 *
 * Canon guard (Evoni's ruling: "Check on request"): nothing runs on load.
 * "Check now" reads the show's episodes and events and sends them to the
 * franchise guard (POST /franchise-brain/guard { items }) in batches of at
 * most 25, one AI call a batch, and lists what disagrees with the Bible.
 * Results live only on this screen; nothing is stored. A batch that could
 * not be checked says so: it is never shown as a pass.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { fetchAllEpisodes } from '../../lib/fetchAllPages';
import { alwaysTrue, decisions, canonItems, canonFindings } from '../../lib/showBibleSummary';
import './ShowBibleSummary.css';

const RULES_SHOWN = 6;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function CanonGuard({ show }) {
  const [state, setState] = useState({ phase: 'idle' });
  const [ignored, setIgnored] = useState(() => new Set());

  const check = async () => {
    if (!show?.id) return;
    setIgnored(new Set());
    setState({ phase: 'reading' });
    let episodes = [];
    let events = [];
    try {
      const [epRes, evRes] = await Promise.all([
        fetchAllEpisodes(api, show.id),
        api.get(`/api/v1/world/${show.id}/events`),
      ]);
      episodes = epRes.items || [];
      events = evRes.data?.events || [];
    } catch (err) {
      console.error('[CanonGuard] could not read the episodes and events:', err?.response?.status || err?.message);
      setState({ phase: 'failed', message: 'The episodes and events could not be read, so nothing was checked.' });
      return;
    }
    const batches = canonItems({ episodes, events, showId: show.id });
    const count = batches.reduce((n, b) => n + b.length, 0);
    if (!count) { setState({ phase: 'nothing' }); return; }
    const results = [];
    let failed = 0;
    for (let i = 0; i < batches.length; i += 1) {
      setState({ phase: 'checking', done: i, of: batches.length });
      try {
        const r = await api.post('/api/v1/franchise-brain/guard', { items: batches[i].map(({ key, label, brief }) => ({ key, label, brief })) });
        if (r.data?.status === 'check_failed') failed += batches[i].length;
        results.push({ items: batches[i], result: r.data });
      } catch (err) {
        console.error('[CanonGuard] a batch could not be checked:', err?.response?.status || err?.message);
        failed += batches[i].length;
        if (err?.response?.status === 429) {
          for (let j = i + 1; j < batches.length; j += 1) failed += batches[j].length;
          break;
        }
      }
    }
    const rules = results.find((r) => r.result?.rules_checked != null)?.result.rules_checked ?? null;
    setState({ phase: 'done', findings: canonFindings(results), checked: count - failed, failed, rules, episodes: episodes.length, events: events.length });
  };

  const busy = state.phase === 'reading' || state.phase === 'checking';
  const findings = state.phase === 'done' ? state.findings.filter((f) => !ignored.has(f.key)) : [];

  return (
    <section className="sbs-card sbs-guard" aria-labelledby="sbs-guard-heading" data-testid="canon-guard">
      <div className="sbs-card-head">
        <h2 id="sbs-guard-heading" className="sbs-title">Canon guard</h2>
        {state.phase === 'done' && <span className="sbs-chip" data-testid="canon-guard-count">{findings.length ? `${findings.length} to check` : 'Nothing to check'}</span>}
      </div>
      <p className="sbs-sub">Places where an episode or event disagrees with the Bible.</p>
      {state.phase === 'idle' && <p className="sbs-note">Nothing has been checked yet. Checking uses AI each time, and the results are not kept.</p>}
      {busy && (
        <p className="sbs-note" role="status">
          {state.phase === 'reading' ? 'Reading the episodes and events…' : `Checking… batch ${state.done + 1} of ${state.of}`}
        </p>
      )}
      {state.phase === 'nothing' && <p className="sbs-note">This show has no episodes or events to check yet.</p>}
      {state.phase === 'failed' && <p className="sbs-warn" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <>
          <p className="sbs-note" data-testid="canon-guard-scope">
            Checked {plural(state.checked, 'item')} ({plural(state.episodes, 'episode')}, {plural(state.events, 'event')}){state.rules != null ? ` against ${plural(state.rules, 'rule')}` : ''}.
          </p>
          {state.failed > 0 && (
            <p className="sbs-warn" role="alert" data-testid="canon-guard-failed">
              {plural(state.failed, 'item')} could not be checked. That is not a pass: check again in a few minutes.
            </p>
          )}
          {findings.length === 0 && state.checked > 0 && <p className="sbs-ok">Nothing disagrees with the Bible.</p>}
          <ul className="sbs-findings">
            {findings.map((f) => (
              <li key={f.key} className="sbs-finding">
                <strong className="sbs-finding-title">{f.label || 'Across the show'}</strong>
                <span className="sbs-finding-risk">{f.risk || f.law}</span>
                {f.risk && f.law && <span className="sbs-finding-law">Rule: {f.law}</span>}
                {f.suggestion && <span className="sbs-finding-fix">{f.suggestion}</span>}
                <span className="sbs-finding-actions">
                  {f.to && <Link to={f.to}>{f.kind === 'event' ? 'Open event' : 'Open episode'}</Link>}
                  <button type="button" onClick={() => setIgnored((s) => new Set([...s, f.key]))}>Ignore</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="sbs-btn" onClick={check} disabled={busy || !show?.id}>
        {busy ? 'Checking…' : state.phase === 'idle' ? 'Check now' : 'Check again'}
      </button>
    </section>
  );
}

export default function ShowBibleSummary({ entries, loading, show, onAddRule, onOpen }) {
  const rules = alwaysTrue(entries);
  const decided = decisions(entries);

  return (
    <div className="sbs" data-testid="show-bible-summary">
      <div className="sbs-grid">
        <div className="sbs-col">
          <section className="sbs-card sbs-rules-card" aria-labelledby="sbs-rules-heading">
            <div className="sbs-card-head">
              <h2 id="sbs-rules-heading" className="sbs-title">Always true</h2>
              <button type="button" className="sbs-btn sbs-btn-head" onClick={onAddRule}>+ Add a rule</button>
            </div>
            {loading ? <p className="sbs-note">Loading the rules…</p> : rules.length === 0 ? (
              <p className="sbs-note" data-testid="always-true-empty">No rule is marked always-inject yet. A rule marked always-inject goes into every AI prompt.</p>
            ) : (
              <>
                <ul className="sbs-rules" data-testid="always-true">
                  {rules.slice(0, RULES_SHOWN).map((r) => (
                    <li key={r.id} className="sbs-rule">
                      <span className="sbs-rule-label">{r.label}{r.critical && <span className="sbs-rule-crit"> · critical</span>}</span>
                      <span className="sbs-rule-text">{r.text}</span>
                    </li>
                  ))}
                </ul>
                {rules.length > RULES_SHOWN && (
                  <button type="button" className="sbs-link" onClick={() => onOpen('knowledge')}>See all {rules.length} always-true rules in Knowledge →</button>
                )}
              </>
            )}
          </section>

          <section className="sbs-card sbs-decisions-card" aria-labelledby="sbs-decisions-heading">
            <div className="sbs-card-head">
              <h2 id="sbs-decisions-heading" className="sbs-title">Decisions, newest first</h2>
            </div>
            {loading ? <p className="sbs-note">Loading the decisions…</p> : decided.length === 0 ? (
              <p className="sbs-note" data-testid="decisions-empty">No locked decisions yet. A Bible entry in the locked decision category shows here, with its date.</p>
            ) : (
              <ol className="sbs-timeline" data-testid="decisions-timeline">
                {decided.slice(0, 8).map((d) => (
                  <li key={d.id} className="sbs-decision">
                    {d.when && <span className="sbs-when">{d.when}</span>}
                    <span className="sbs-decision-text">{d.text}</span>
                    {d.affects.length > 0 && <span className="sbs-affects">Affects: {d.affects.join(', ')}</span>}
                  </li>
                ))}
              </ol>
            )}
            {decided.length > 8 && <button type="button" className="sbs-link" onClick={() => onOpen('decisions')}>See all {decided.length} in Decisions →</button>}
          </section>
        </div>

        <CanonGuard show={show} />
      </div>
    </div>
  );
}

// frontend/src/components/Episodes/EpisodePhoneNeeds.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Sparkles, Undo2, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { phoneNeeds, buildPlan, beatsLabel, NEED_STATUS } from '../../lib/episodePhoneNeeds';
import { makeScreen, addTapZone, fillZone } from '../../lib/episodePhoneBuild';
import './EpisodePhoneNeeds.css';

/**
 * "What this episode needs from the phone" (phone round step 2; Evoni,
 * 2026-10-25: "Yes do them all"). The episode's script names screens in its
 * `[UI:…]` lines; each one is listed with its beats and whether it is ready
 * (lib/episodePhoneNeeds), with the path problems the Script tab flags.
 * Make it, Add tap zone and Fill run one step; Build all runs every step, in
 * order, after saying what it will spend. Everything made lands in a review
 * list with Undo per item (lib/episodePhoneBuild), so nothing here is final.
 *
 * The script is the saved one (GET /episodes/:id, as the Script tab checks
 * it), the episode's copy until that answers.
 */

const pl = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const STATUS_CLASS = { ok: 'is-ok', missing: 'is-missing', unmade: 'is-missing', unreachable: 'is-warn', empty: 'is-warn' };

export default function EpisodePhoneNeeds({ episode, showId, episodeId, overlays = [], overlaysReady = true, reloadOverlays, studioPath = null }) {
  const [script, setScript] = useState(typeof episode?.script_content === 'string' ? episode.script_content : '');
  const [scriptRead, setScriptRead] = useState(false);
  useEffect(() => {
    if (!episodeId) { setScriptRead(true); return undefined; }
    let cancelled = false;
    api.get(`/api/v1/episodes/${episodeId}`)
      .then((res) => {
        const saved = res?.data?.data?.script_content;
        if (!cancelled && typeof saved === 'string') setScript(saved);
      })
      // The episode's own copy stays: the list is still drawn from it.
      .catch((err) => console.error('[EpisodePhoneNeeds] saved script read failed:', err))
      .finally(() => { if (!cancelled) setScriptRead(true); });
    return () => { cancelled = true; };
  }, [episodeId]);

  const read = useMemo(() => phoneNeeds(script, overlays), [script, overlays]);
  const plan = useMemo(() => buildPlan(read.needs), [read]);
  const episodeNumber = episode?.episode_number ?? episode?.episodeNumber ?? null;

  const [busy, setBusy] = useState(null); // the need key a row step runs on, or 'all'
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, label }
  const [review, setReview] = useState([]); // [{ key, label, undo, state }]
  const [failures, setFailures] = useState([]);
  const [stopped, setStopped] = useState(false);

  const keep = useCallback((result) => {
    if (result.items.length) setReview((prev) => [...prev, ...result.items.map((it) => ({ ...it, state: 'kept' }))]);
    if (result.error) setFailures((prev) => [...prev, result.error]);
  }, []);

  const reload = useCallback(async () => {
    try {
      return await reloadOverlays();
    } catch (err) {
      console.error('[EpisodePhoneNeeds] phone reload failed:', err);
      setFailures((prev) => [...prev, `The phone could not be read again (${err?.message || 'no reason given'}); reload the tab to see what was made.`]);
      return null;
    }
  }, [reloadOverlays]);

  // One step on one row.
  const runOne = async (need, kind, zone = null) => {
    if (busy) return;
    setBusy(need.key);
    setFailures([]);
    setStopped(false);
    try {
      if (kind === 'make') keep(await makeScreen(api, showId, need, { episodeNumber }));
      else if (kind === 'zone') keep(await addTapZone(api, showId, episodeId, need, need.fromScreen));
      else if (kind === 'fill') keep(await fillZone(api, showId, episodeId, need.screen, zone));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  // Build all: every missing screen, then (with the phone read again) a tap
  // zone to every screen nothing reaches, then every empty content zone. A
  // failed step is listed and the run goes on; out of budget, it stops.
  const runAll = async () => {
    setConfirming(false);
    setBusy('all');
    setFailures([]);
    setStopped(false);
    let done = 0;
    let total = plan.total;
    let halted = false;
    const step = async (label, fn) => {
      setProgress({ done, total: Math.max(total, done + 1), label });
      const result = await fn();
      keep(result);
      done += 1;
      if (result.stop) halted = true;
    };
    try {
      for (const need of plan.make) {
        if (halted) break;
        await step(`Making ${need.name}`, () => makeScreen(api, showId, need, { episodeNumber }));
      }
      let fresh = halted ? null : await reload();
      if (fresh) {
        const reach = phoneNeeds(script, fresh).needs.filter((n) => n.issues.includes('unreachable') && !n.issues.includes('unmade'));
        total = done + reach.length + plan.calls.fills;
        for (const need of reach) {
          if (halted) break;
          await step(`Adding a tap zone to ${need.name}`, () => addTapZone(api, showId, episodeId, need, need.fromScreen));
        }
        fresh = halted ? null : await reload();
      }
      if (fresh) {
        const fills = phoneNeeds(script, fresh).needs.flatMap((n) => n.emptyZones.map((z) => ({ need: n, zone: z })));
        total = done + fills.length;
        for (const { need, zone } of fills) {
          if (halted) break;
          await step(`Filling the ${zone.content_type} zone on ${need.name}`, () => fillZone(api, showId, episodeId, need.screen, zone));
        }
        await reload();
      }
      if (halted) { setStopped(true); await reload(); }
    } finally {
      setProgress(null);
      setBusy(null);
    }
  };

  const undo = async (item) => {
    setReview((prev) => prev.map((it) => (it.key === item.key ? { ...it, state: 'undoing' } : it)));
    try {
      await item.undo();
      setReview((prev) => prev.map((it) => (it.key === item.key ? { ...it, state: 'undone' } : it)));
      await reload();
    } catch (err) {
      console.error('[EpisodePhoneNeeds] undo failed:', err);
      setReview((prev) => prev.map((it) => (it.key === item.key ? { ...it, state: 'kept', undoError: err?.response?.data?.error || err?.message || 'Undo failed' } : it)));
    }
  };

  const hubAt = (id) => (studioPath && id ? `${studioPath}&screen=${encodeURIComponent(id)}` : studioPath);
  const working = Boolean(busy);
  const { calls } = plan;
  const toDo = read.needs.filter((n) => n.status !== 'ok').length;

  return (
    <section className="lalas-phone-card phone-needs" aria-labelledby="lalas-phone-reqs">
      <div className="phone-needs-head">
        <h3 id="lalas-phone-reqs" className="lalas-phone-section-title">
          <ListChecks size={14} aria-hidden="true" /> What this episode needs from the phone
        </h3>
        {read.needs.length > 0 && plan.total > 0 && (
          <button type="button" className="phone-needs-build" onClick={() => setConfirming(true)} disabled={working || !showId || !overlaysReady}>
            <Sparkles size={14} aria-hidden="true" /> Build all
          </button>
        )}
      </div>

      {!scriptRead && !script && <div className="lalas-phone-muted">Reading the script…</div>}
      {(scriptRead || script) && !read.hasScript && (
        <div className="phone-needs-note" role="note" data-testid="phone-needs-none">
          This episode has no script yet. Once the Script tab has one, every screen its phone lines open is listed here, with what is missing.
        </div>
      )}
      {read.hasScript && read.needs.length === 0 && (
        <div className="phone-needs-note" role="note" data-testid="phone-needs-none">
          The script opens no phone screen yet: no <code>[UI:OPEN …]</code> or tap lines outside the cutscene.
        </div>
      )}

      {read.needs.length > 0 && (
        <>
          <p className="phone-needs-summary">
            From the script: {pl(read.needs.length, 'screen')}{toDo ? `, ${toDo} to fix` : ', all ready'}.
          </p>
          <ul className="phone-needs-list">
            {read.needs.map((n) => {
              const rowBusy = busy === n.key;
              return (
                <li key={n.key} className="phone-needs-row" data-testid={`need-${n.name}`}>
                  <span className="phone-needs-name">
                    {n.screen && studioPath ? <Link to={hubAt(n.screen.id)}>{n.name}</Link> : n.name}
                    <span className="phone-needs-beats"> · {beatsLabel(n.beats)}</span>
                  </span>
                  <span className={`phone-needs-status ${STATUS_CLASS[n.status]}`}>
                    {n.status === 'empty' ? `${pl(n.emptyZones.length, 'content zone')} empty` : NEED_STATUS[n.status]}
                    {n.issues.length > 1 && <span className="phone-needs-more"> +{n.issues.slice(1).map((i) => (i === 'empty' ? 'content zone empty' : NEED_STATUS[i].toLowerCase())).join(', ')}</span>}
                  </span>
                  <span className="phone-needs-actions">
                    {(n.status === 'missing' || n.status === 'unmade') && (
                      <button type="button" className="phone-needs-act" onClick={() => runOne(n, 'make')} disabled={working || !showId}>
                        {rowBusy ? 'Making…' : 'Make it'}
                      </button>
                    )}
                    {n.status === 'unreachable' && (
                      <button type="button" className="phone-needs-act" onClick={() => runOne(n, 'zone')} disabled={working || !showId}
                        title={n.fromScreen ? `AI proposes a tap zone on ${n.fromScreen.name} that opens ${n.name}` : undefined}>
                        {rowBusy ? 'Adding…' : `Add tap zone${n.fromScreen ? ` on ${n.fromScreen.name}` : ''}`}
                      </button>
                    )}
                    {n.status === 'empty' && (
                      <button type="button" className="phone-needs-act" onClick={() => runOne(n, 'fill', n.emptyZones[0])} disabled={working || !showId}>
                        {rowBusy ? 'Filling…' : 'Fill with AI'}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {read.problems.length > 0 && (
        <div className="phone-needs-problems" data-testid="phone-needs-problems">
          <p className="phone-needs-subhead"><AlertTriangle size={13} aria-hidden="true" /> On the way there</p>
          <ul>
            {read.problems.map((p, i) => <li key={i}>Beat {p.beat}: {p.text}</li>)}
          </ul>
          <p className="phone-needs-hint">The Script tab&apos;s Ready to film list puts the missing step in the script.</p>
        </div>
      )}

      {confirming && (
        <div className="phone-needs-confirm" role="dialog" aria-label="Build all" data-testid="phone-needs-confirm">
          <p>
            Build all will {[
              plan.make.length ? `make ${pl(plan.make.length, 'screen')}` : null,
              calls.zones ? `add ${pl(calls.zones, 'tap zone')}` : null,
              calls.fills ? `fill ${pl(calls.fills, 'content zone')}` : null,
            ].filter(Boolean).join(', ')}: up to <strong>{pl(plan.total, 'AI call')}</strong> ({[
              calls.pictures ? pl(calls.pictures, 'picture') : null,
              calls.zones ? pl(calls.zones, 'tap-zone proposal') : null,
              calls.fills ? pl(calls.fills, 'content fill') : null,
            ].filter(Boolean).join(', ')}).
          </p>
          <p className="phone-needs-hint">
            Each step is the Phone Hub&apos;s own, with its budget. Everything made is listed for review afterwards, each with Undo.
            {plan.make.length > 0 && ' New screens are the show’s, so they are on every episode’s phone.'}
          </p>
          <div className="phone-needs-confirm-actions">
            <button type="button" className="phone-needs-build" onClick={runAll}>Start</button>
            <button type="button" className="phone-needs-act" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}

      {progress && (
        <div className="phone-needs-progress" role="status" data-testid="phone-needs-progress">
          <span>{progress.label}… ({progress.done + 1} of {progress.total})</span>
          <span className="phone-needs-bar" aria-hidden="true"><span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></span>
        </div>
      )}

      {stopped && <p className="phone-needs-failed" role="alert">Stopped: the AI budget is used up. What was made is below.</p>}
      {failures.length > 0 && (
        <div className="phone-needs-failed" role="alert" data-testid="phone-needs-failures">
          <p className="phone-needs-subhead">Not done</p>
          <ul>{failures.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}

      {review.length > 0 && (
        <div className="phone-needs-review" data-testid="phone-needs-review">
          <p className="phone-needs-subhead">Made here: review</p>
          <ul>
            {review.map((it) => (
              <li key={it.key} className={it.state === 'undone' ? 'is-undone' : ''}>
                <span>{it.label}</span>
                {it.state === 'undone' ? <span className="phone-needs-undone">Undone</span> : (
                  <button type="button" className="phone-needs-act" onClick={() => undo(it)} disabled={it.state === 'undoing' || busy === 'all'} aria-label={`Undo ${it.label}`}>
                    <Undo2 size={13} aria-hidden="true" /> {it.state === 'undoing' ? 'Undoing…' : 'Undo'}
                  </button>
                )}
                {it.undoError && <span className="phone-needs-undo-error">{it.undoError}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

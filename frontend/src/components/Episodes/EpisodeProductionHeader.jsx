/**
 * The top of Production (Evoni's Production mock, 2026-10-17), as one thin
 * strip since her layout list of 2026-10-22 ("work first"): the seven steps
 * an episode goes through (lib/productionSteps) as numbered marks, each
 * opening where it is worked on, with the current one named; the
 * checklist's count, opening the Checklist; Open Editor and Mark Ready
 * (status In review). It sits under the Production pills, so the work
 * starts right below it. The episode card it had repeated the page header,
 * and its progress by section is the Checklist tab's own (its progress bar
 * and a card per section).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clapperboard, CircleCheck } from 'lucide-react';
import { rawClipsApi } from '../../lib/rawClipsApi';
import { currentThumbnail } from '../../lib/youtubeThumbnailsApi';
import { productionSteps, sectionSummary, canMarkReady } from '../../lib/productionSteps';
import { STATUS_LABEL } from '../../lib/episodePipeline';
import './EpisodeProductionHeader.css';

export default function EpisodeProductionHeader({ episode, checks = null, sections = null, onOpenTab, onMarkReady, statusSaving = false }) {
  const episodeId = episode?.id;
  const [clips, setClips] = useState([]);
  const [savedThumbnail, setSavedThumbnail] = useState(false);
  // The episode's own thumbnail_url counts at once; the editor's saved list confirms one saved before it was set.
  const hasThumbnail = Boolean(episode?.thumbnail_url) || savedThumbnail;

  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    // Promise.resolve first: a read that throws at once still lands in catch.
    Promise.resolve().then(() => rawClipsApi.list(episodeId))
      .then((rows) => { if (live) setClips(Array.isArray(rows) ? rows : []); })
      .catch((err) => console.error('[Production] clips load failed:', err));
    Promise.resolve().then(() => currentThumbnail(episodeId))
      .then((thumb) => { if (live) setSavedThumbnail(Boolean(thumb)); })
      .catch((err) => {
        console.error('[Production] thumbnail check failed:', err);
        if (live) setSavedThumbnail(false);
      });
    return () => { live = false; };
  }, [episodeId]);

  const steps = productionSteps({ episode, checks, sections, clips, hasThumbnail });
  const summary = sectionSummary(sections, checks);
  const done = summary.reduce((n, s) => n + s.count, 0);
  const total = summary.reduce((n, s) => n + s.total, 0);
  const status = String(episode?.status || 'draft').toLowerCase();
  const at = steps.findIndex((s) => s.current);
  const current = at >= 0 ? steps[at] : null;

  return (
    <section className="eph" aria-label="Production">
      <p className="eph-now" data-testid="eph-now">
        {current
          ? <>Step {at + 1} of {steps.length}: <strong>{current.label}</strong>{current.detail ? <span className="eph-now-detail"> · {current.detail}</span> : null}</>
          : <strong>All {steps.length} steps done</strong>}
      </p>

      <ol className="eph-steps" aria-label="Production steps">
        {steps.map((s) => {
          const tip = [s.label, s.done ? 'done' : s.current ? 'now' : null, s.detail, s.stat].filter(Boolean).join(' · ');
          const inner = (
            <>
              <span className="eph-step-mark" aria-hidden>{s.done ? <Check size={14} /> : s.number}</span>
              <span className="eph-step-label">{s.label}</span>
              {s.detail && <span className="eph-step-detail">{s.detail}</span>}
              {s.stat && <span className="eph-step-stat" data-testid={`eph-step-stat-${s.key}`}>{s.stat}</span>}
            </>
          );
          const cls = `eph-step${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`;
          return (
            <li key={s.key} className={cls} data-testid={`eph-step-${s.key}`} aria-current={s.current ? 'step' : undefined}>
              {s.open.href
                ? <Link className="eph-step-btn" to={s.open.href} title={tip}>{inner}</Link>
                : <button type="button" className="eph-step-btn" title={tip} onClick={() => onOpenTab?.(s.open.tab)}>{inner}</button>}
            </li>
          );
        })}
      </ol>

      <button type="button" className="eph-count" onClick={() => onOpenTab?.('checklist')} data-testid="eph-count"
        title="Open the checklist">
        {checks ? <>{done}/{total}<span className="eph-count-word"> checks</span></> : 'Checking…'}
      </button>

      <div className="eph-actions">
        <Link className="eph-btn" to={`/episodes/${episodeId}/timeline`}><Clapperboard size={16} aria-hidden /> Open Editor</Link>
        {canMarkReady(episode) ? (
          <button type="button" className="eph-btn is-primary" onClick={onMarkReady} disabled={statusSaving} data-testid="eph-mark-ready">
            <Check size={16} aria-hidden /> Mark Ready
          </button>
        ) : (
          <span className="eph-ready" data-testid="eph-ready"><CircleCheck size={16} aria-hidden /> {STATUS_LABEL[status] || status}</span>
        )}
      </div>
    </section>
  );
}

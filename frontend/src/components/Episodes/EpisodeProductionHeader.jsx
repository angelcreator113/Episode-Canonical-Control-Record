/**
 * The top of Production (Evoni's Production mock, 2026-10-17): the seven
 * steps an episode goes through (lib/productionSteps), each opening where
 * it is worked on; the episode at a glance; the production checklist's
 * progress by section; and Mark Ready (status In review) and Open Editor.
 * Shown above every Production sub-tab.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ClipboardList, FileText, Images, FolderOpen, Scissors, Image as ImageIcon, Upload, CalendarDays, MapPin, Clapperboard, CircleCheck, Circle,
} from 'lucide-react';
import { rawClipsApi } from '../../lib/rawClipsApi';
import { currentThumbnail } from '../../lib/youtubeThumbnailsApi';
import { productionSteps, sectionSummary, canMarkReady } from '../../lib/productionSteps';
import { STATUS_LABEL } from '../../lib/episodePipeline';
import './EpisodeProductionHeader.css';

const STEP_ICONS = { brief: ClipboardList, script: FileText, scenes: Images, files: FolderOpen, edit: Scissors, thumbnail: ImageIcon, publish: Upload };

const fmtDate = (d) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function EpisodeProductionHeader({ episode, sourceEvent = null, checks = null, sections = null, onOpenTab, onMarkReady, statusSaving = false }) {
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
  const pct = total ? Math.round((done / total) * 100) : 0;
  const status = String(episode?.status || 'draft').toLowerCase();
  const date = fmtDate(episode?.air_date || sourceEvent?.event_date || sourceEvent?.date);
  const where = sourceEvent?.venue_name || sourceEvent?.location || sourceEvent?.venue?.name || null;
  const cover = episode?.show?.coverImageUrl || episode?.show?.cover_image_url || null;

  return (
    <section className="eph" aria-label="Production">
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

      <ol className="eph-steps" aria-label="Production steps">
        {steps.map((s) => {
          const Icon = STEP_ICONS[s.key];
          const inner = (
            <>
              <span className="eph-step-mark" aria-hidden>{s.done ? <Check size={16} /> : s.number}</span>
              <span className="eph-step-label"><Icon size={15} aria-hidden /> {s.label}</span>
              {s.detail && <span className="eph-step-detail">{s.detail}</span>}
              {s.stat && <span className="eph-step-stat" data-testid={`eph-step-stat-${s.key}`}>{s.stat}</span>}
            </>
          );
          const cls = `eph-step${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`;
          return (
            <li key={s.key} className={cls} data-testid={`eph-step-${s.key}`} aria-current={s.current ? 'step' : undefined}>
              {s.open.href
                ? <Link className="eph-step-btn" to={s.open.href}>{inner}</Link>
                : <button type="button" className="eph-step-btn" onClick={() => onOpenTab?.(s.open.tab)}>{inner}</button>}
            </li>
          );
        })}
      </ol>

      <div className="eph-cards">
        <article className="eph-card eph-episode">
          {cover && <img className="eph-cover" src={cover} alt="" loading="lazy" />}
          <div className="eph-episode-text">
            <div className="eph-episode-top">
              <h2 className="eph-episode-title">
                {episode?.episode_number ? `Episode ${episode.episode_number}` : 'Episode'}
                {episode?.title ? <span className="eph-episode-name">{episode.title}</span> : null}
              </h2>
              <span className={`eph-status is-${status}`}>{STATUS_LABEL[status] || status}</span>
            </div>
            {sourceEvent?.name && <p className="eph-line"><Clapperboard size={14} aria-hidden /> {sourceEvent.name}</p>}
            {date && <p className="eph-line"><CalendarDays size={14} aria-hidden /> {date}</p>}
            {where && <p className="eph-line"><MapPin size={14} aria-hidden /> {where}</p>}
            {episode?.description && <p className="eph-desc">{episode.description}</p>}
          </div>
        </article>

        <article className="eph-card eph-progress">
          <div className="eph-progress-head">
            <h2 className="eph-card-title">Progress</h2>
            <span className="eph-progress-count">{checks ? `${done} of ${total} checks` : 'Checking…'}</span>
          </div>
          <div className="eph-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Production progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <ul className="eph-sections">
            {summary.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : ''}>
                {s.done ? <CircleCheck size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                <span className="eph-section-label">{s.label}</span>
                <span className="eph-section-count">{s.count}/{s.total}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="eph-link" onClick={() => onOpenTab?.('checklist')}>Open the checklist</button>
        </article>
      </div>
    </section>
  );
}

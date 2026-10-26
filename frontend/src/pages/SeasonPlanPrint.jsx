/**
 * The season plan on one page, to print (Evoni, 2026-10-25: "What else can
 * we improve on the Season page?" … "I want them all"; 2026-10-26, round 3).
 * Route /shows/:showId/season/plan (?season=N another season's), opened from
 * the Season page's ⋯ menu and its Overview. The parts with their slots and
 * release days, the events, the goals and the release schedule
 * (lib/seasonPlanSheet), with Print (the browser's Print, then Save as PDF:
 * no PDF library). At the top, a marked spot for the two-line season pitch:
 * the arc's logline when there is one; a later AI step fills it (pitchSlot).
 *
 * Reads what the Season page reads: useSeasonPlan (arc, roadmap, goals), the
 * show and its events, the release schedule. Styles: SeasonPlanPrint.css
 * (print rules there hide the app around the sheet).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../services/api';
import { useSeasonPlan, SeasonLoadError } from '../components/Show/SeasonPlan';
import { useReleaseSchedule } from '../lib/releaseSchedule';
import { seasonPageHref } from '../lib/seasonPage';
import { seasonPlanSheet } from '../lib/seasonPlanSheet';
import './SeasonPlanPrint.css';

/** The sheet itself, from seasonPlanSheet's shape; pitchSlot replaces the pitch spot's content when given. */
export function SeasonPlanSheet({ sheet, showName = null, pitchSlot = null }) {
  return (
    <article className="splan-sheet" data-testid="splan-sheet">
      <header className="splan-head">
        {showName && <p className="splan-show">{showName}</p>}
        <p className="splan-eyebrow">{sheet.eyebrow}</p>
        <h1 className="splan-title">{sheet.title}</h1>
        {sheet.tagline && <p className="splan-tagline">{sheet.tagline}</p>}
        <p className="splan-meta">{[sheet.dates, `${sheet.slotCount} episodes`, `${sheet.parts.length} parts`].filter(Boolean).join(' · ')}</p>
      </header>

      {/* AI mount point: the two-line season pitch. The logline until a later step writes it. */}
      <section className={`splan-pitch${sheet.pitch || pitchSlot ? '' : ' is-empty'}`} data-slot="plan-pitch" data-testid="splan-pitch" aria-label="Season pitch">
        <p className="splan-label" role="heading" aria-level={2}>Season pitch</p>
        {pitchSlot || (sheet.pitch ? <p className="splan-pitch-text">{sheet.pitch}</p> : <p className="splan-pitch-empty">Two lines on what this season is. Not written yet.</p>)}
      </section>

      {sheet.releases && (
        <p className="splan-releases" data-testid="splan-releases">{sheet.releases.line}{sheet.releases.start ? ` · ${sheet.releases.start}` : ''}</p>
      )}

      <section className="splan-parts" aria-label="Parts and slots">
        {sheet.parts.map((p) => (
          <div key={p.phase} className="splan-part" data-testid={`splan-part-${p.phase}`}>
            <h2 className="splan-part-title">Part {p.phase}{p.title ? ` · ${p.title}` : ''} <span className="splan-range">{p.range}</span></h2>
            {p.tagline && <p className="splan-part-tagline">{p.tagline}</p>}
            <table className="splan-table">
              <thead><tr><th scope="col">Ep</th><th scope="col">Releases</th><th scope="col">Episode or plan</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {p.slots.map((s) => (
                  <tr key={s.code}>
                    <th scope="row">{s.code}</th>
                    <td>{s.when || '—'}</td>
                    <td>{s.title}{s.event && s.event !== s.title ? <span className="splan-sub"> · {s.event}</span> : null}</td>
                    <td>{s.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {sheet.specials?.length > 0 && (
        <section className="splan-specials" aria-label="Specials" data-testid="splan-specials">
          <p className="splan-label" role="heading" aria-level={2}>Specials</p>
          <ul className="splan-list">
            {sheet.specials.map((s) => (
              <li key={s.id} data-testid={`splan-special-${s.id}`}>
                <strong>{s.code}</strong> {s.title}{s.event && s.event !== s.title ? ` · ${s.event}` : ''} · {s.when || 'No date yet'}
                <span className="splan-sub"> · {s.kind}{s.place ? `, ${s.place}` : ''}{s.status ? ` · ${s.status}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="splan-two">
        <section aria-label="Events" data-testid="splan-events">
          <p className="splan-label" role="heading" aria-level={2}>Events</p>
          {sheet.events.length === 0 ? <p className="splan-muted">No event is pencilled in yet.</p> : (
            <ul className="splan-list">
              {sheet.events.map((e) => <li key={`${e.code}-${e.name}`}><strong>{e.code}</strong> {e.name}{e.date ? ` · ${e.date}` : ''}{e.type ? <span className="splan-sub"> · {e.type}</span> : null}</li>)}
            </ul>
          )}
        </section>
        <section aria-label="Goals" data-testid="splan-goals">
          <p className="splan-label" role="heading" aria-level={2}>Goals</p>
          {sheet.goals.length === 0 ? <p className="splan-muted">No goals yet.</p> : (
            <ul className="splan-list">
              {sheet.goals.map((g) => <li key={g.id}>{g.title}{g.progress ? ` · ${g.progress}` : ''}{g.status ? <span className="splan-sub"> · {g.status}</span> : null}</li>)}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

export default function SeasonPlanPrint() {
  const { showId } = useParams();
  const [params] = useSearchParams();
  const season = /^[1-9]\d{0,2}$/.test(params.get('season') || '') ? params.get('season') : null;
  const plan = useSeasonPlan({ showId, api, season });
  const release = useReleaseSchedule({ api, showId, reloadKey: plan.roadmap });
  const [events, setEvents] = useState([]);
  const [showName, setShowName] = useState(null);
  useEffect(() => {
    api.get(`/api/v1/shows/${showId}`).then((r) => setShowName(r.data?.data?.name || r.data?.name || null))
      .catch((err) => console.error('[SeasonPlanPrint] show load failed:', err));
    api.get(`/api/v1/world/${showId}/events`).then((r) => setEvents(r.data?.events || []))
      .catch((err) => console.error('[SeasonPlanPrint] events load failed:', err));
  }, [showId]);
  const sheet = useMemo(() => (plan.arc ? seasonPlanSheet({ arc: plan.arc, roadmap: plan.roadmap, events, goals: plan.goals, release: release.view }) : null),
    [plan.arc, plan.roadmap, events, plan.goals, release.view]);

  return (
    <div className="splan" data-testid="season-plan-print">
      <div className="splan-bar">
        <Link className="splan-back" to={seasonPageHref(showId, null, { season })}><ArrowLeft size={16} aria-hidden="true" /> Season page</Link>
        <button type="button" className="splan-print" onClick={() => window.print()} disabled={!sheet} data-testid="splan-print">
          <Printer size={16} aria-hidden="true" /> Print or save as PDF
        </button>
      </div>
      <SeasonLoadError plan={plan} />
      {plan.loading ? <p className="splan-muted" role="status">Loading the season…</p>
        : !sheet ? <p className="splan-muted">No season set up yet.</p>
          : <SeasonPlanSheet sheet={sheet} showName={showName} />}
    </div>
  );
}
